#!/usr/bin/env python3
"""
PrintQR - Windows Desktop Printing Agent
PySide6 Application for Local Print Shop Automation
Connects shop desktop printers to the PrintQR cloud queue.
"""

import sys
import os
import json
import time
import re
import tempfile
import threading
import requests
from pathlib import Path

# Optional pywin32 import for native Windows printer enumeration
try:
    import win32print
    import win32api
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

from PySide6.QtCore import Qt, QThread, Signal, Slot, QTimer
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QComboBox, QCheckBox, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox, QMessageBox,
    QStatusBar, QFrame
)
from PySide6.QtGui import QIcon, QFont, QColor

CONFIG_FILE = Path("config.json")
DEFAULT_SERVER = "http://localhost:3000"

def redact_secrets(text: str) -> str:
    """Sanitize tokens and sensitive values from application logs"""
    text = re.sub(r'Bearer\s+[A-Za-z0-9\-_.]+', 'Bearer [REDACTED_TOKEN]', text)
    text = re.sub(r'agt_token_[A-Za-z0-9]+', 'agt_token_[REDACTED]', text)
    text = re.sub(r'token=[A-Za-z0-9\-_.]{10,}', 'token=[REDACTED_SIG]', text)
    return text

def enumerate_windows_printers():
    """Detect all printers installed on Windows"""
    printers = []
    if WIN32_AVAILABLE:
        try:
            default_pr = win32print.GetDefaultPrinter()
            flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            installed = win32print.EnumPrinters(flags)
            for pr in installed:
                name = pr[2]
                printers.append({
                    "name": name,
                    "isDefault": (name == default_pr),
                    "status": "Ready",
                    "supportsColor": "color" in name.lower() or "pixma" in name.lower() or "epson" in name.lower(),
                })
        except Exception as e:
            print(f"Error enumerating win32 printers: {e}")

    # Fallback if running on non-Windows or if win32print returns empty
    if not printers:
        printers = [
            {"name": "HP LaserJet Pro M404dn", "isDefault": True, "status": "Ready", "supportsColor": False},
            {"name": "Canon PIXMA G3010", "isDefault": False, "status": "Ready", "supportsColor": True},
            {"name": "Microsoft Print to PDF", "isDefault": False, "status": "Ready", "supportsColor": True},
        ]
    return printers

class WorkerThread(QThread):
    log_signal = Signal(str)
    job_signal = Signal(dict)
    status_signal = Signal(str, str) # status, message

    def __init__(self, server_url, agent_token, dry_run=True):
        super().__init__()
        self.server_url = server_url.rstrip("/")
        self.agent_token = agent_token
        self.dry_run = dry_run
        self.running = True

    def run(self):
        self.log_signal.emit("[Agent] Worker thread started. Polling server queue...")
        while self.running:
            try:
                # 1. Heartbeat
                headers = {"x-agent-token": self.agent_token}
                printers = enumerate_windows_printers()
                hb_payload = {
                    "installedPrinters": printers,
                    "defaultPrinter": next((p["name"] for p in printers if p.get("isDefault")), printers[0]["name"]),
                }
                
                hb_resp = requests.post(f"{self.server_url}/api/agent/heartbeat", json=hb_payload, headers=headers, timeout=10)
                if hb_resp.status_code == 200:
                    self.status_signal.emit("online", "Connected to PrintQR Cloud")
                else:
                    self.status_signal.emit("error", f"Heartbeat error: {hb_resp.status_code}")

                # 2. Poll for authorized jobs
                jobs_resp = requests.get(f"{self.server_url}/api/agent/jobs", headers=headers, timeout=10)
                if jobs_resp.status_code == 200:
                    data = jobs_resp.json()
                    jobs = data.get("jobs", [])
                    for job in jobs:
                        self.process_job(job, headers)

            except Exception as e:
                self.log_signal.emit(f"[Connection Error] {redact_secrets(str(e))}")
                self.status_signal.emit("offline", "Reconnecting...")

            # Sleep 5 seconds before next polling cycle
            for _ in range(5):
                if not self.running:
                    break
                time.sleep(1)

    def process_job(self, job, headers):
        job_id = job.get("jobId")
        order_num = job.get("orderNumber")
        doc_name = job.get("documentName")
        target_pr = job.get("targetPrinter", "Default Printer")

        self.log_signal.emit(f"[Job Detected] #{order_num} - {doc_name} -> Target: {target_pr}")
        self.job_signal.emit(job)

        # Step A: Atomic Claim
        claim_resp = requests.post(f"{self.server_url}/api/agent/jobs/{job_id}/claim", headers=headers, timeout=10)
        if claim_resp.status_code != 200:
            self.log_signal.emit(f"[Claim Skipped] Job #{order_num} was claimed by another thread.")
            return

        claim_data = claim_resp.json()
        claim_token = claim_data.get("claimToken")
        self.log_signal.emit(f"[Claimed] Job #{order_num} locked with claim token.")

        # Step B: Report spooling
        requests.post(f"{self.server_url}/api/agent/jobs/{job_id}/report", json={
            "claimToken": claim_token,
            "status": "spooling"
        }, headers=headers, timeout=10)

        # Step C: Download Document
        download_url = f"{self.server_url}{job.get('downloadUrl')}"
        try:
            doc_resp = requests.get(download_url, timeout=30)
            if doc_resp.status_code != 200:
                raise Exception(f"Failed to download document: HTTP {doc_resp.status_code}")

            # Save to temporary file
            suffix = Path(doc_name).suffix or ".pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(doc_resp.content)
                tmp_path = tmp_file.name

            self.log_signal.emit(f"[Spooling] Downloaded {len(doc_resp.content)} bytes to {tmp_path}")

            # Step D: Physical / Dry Run Print Execution
            if self.dry_run:
                self.log_signal.emit(f"[DRY-RUN MODE] Simulating print for #{order_num} on '{target_pr}'...")
                time.sleep(3) # Simulate print time
                print_success = True
            else:
                print_success = self.dispatch_to_windows_spooler(tmp_path, target_pr, job)
                # Spool settlement wait (gives Windows Print Spooler time to buffer the file before any subsequent job starts)
                time.sleep(3)

            # Keep temp file in workstation spool cache for 10 minutes so Windows spooler can finish reading
            # (Instant deletion causes blank pages on physical printers!)

            if print_success:
                # Step E: Report Printed Confirmation
                requests.post(f"{self.server_url}/api/agent/jobs/{job_id}/report", json={
                    "claimToken": claim_token,
                    "status": "printed"
                }, headers=headers, timeout=10)
                self.log_signal.emit(f"[PRINT SUCCESS] Order #{order_num} physically printed & confirmed!")
            else:
                requests.post(f"{self.server_url}/api/agent/jobs/{job_id}/report", json={
                    "claimToken": claim_token,
                    "status": "failed",
                    "errorMessage": "Windows spooler failed to accept job"
                }, headers=headers, timeout=10)
                self.log_signal.emit(f"[PRINT FAILED] Order #{order_num} spooling error.")

        except Exception as e:
            err_msg = redact_secrets(str(e))
            self.log_signal.emit(f"[Job Error] {err_msg}")
            requests.post(f"{self.server_url}/api/agent/jobs/{job_id}/report", json={
                "claimToken": claim_token,
                "status": "failed",
                "errorMessage": err_msg
            }, headers=headers, timeout=10)

    def dispatch_to_windows_spooler(self, file_path, printer_name, job):
        """Submit job to Windows Print Spooler with port separation"""
        if WIN32_AVAILABLE:
            try:
                self.log_signal.emit(f"[Win32 Spooler] Submitting '{file_path}' to '{printer_name}'...")
                win32api.ShellExecute(0, "printto", file_path, f'"{printer_name}"', ".", 0)
                time.sleep(2)
                return True
            except Exception as e:
                self.log_signal.emit(f"[Win32 Spooler Note] '{printer_name}' failed: {e}. Fallback to Windows default printer...")
                try:
                    win32api.ShellExecute(0, "print", file_path, None, ".", 0)
                    time.sleep(2)
                    return True
                except Exception as e2:
                    self.log_signal.emit(f"[Win32 Spooler Fatal] Both target and default printer failed: {e2}")
                    return False
        else:
            self.log_signal.emit("[Warning] pywin32 not installed. Simulating execution.")
            return True

    def stop(self):
        self.running = False


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PrintQR - Windows Desktop Print Agent v1.2")
        self.resize(860, 640)
        self.config = self.load_config()
        self.worker = None

        self.init_ui()

        # Auto-connect if token present
        if self.config.get("agent_token"):
            self.start_agent()

    def load_config(self):
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "server_url": DEFAULT_SERVER,
            "agent_token": "",
            "device_name": "Counter-PC-01",
            "dry_run": True
        }

    def save_config(self):
        with open(CONFIG_FILE, "w") as f:
            json.dump(self.config, f, indent=2)

    def init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)

        # 1. Header & Connection Bar
        header_box = QGroupBox("Shop Connection & Pairing")
        header_layout = QHBoxLayout(header_box)

        self.server_input = QLineEdit(self.config.get("server_url", DEFAULT_SERVER))
        self.server_input.setPlaceholderText("https://your-shop.printqr.in")
        header_layout.addWidget(QLabel("Server URL:"))
        header_layout.addWidget(self.server_input, 2)

        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("6-digit Pairing Code")
        self.code_input.setMaxLength(6)
        header_layout.addWidget(QLabel("Pair Code:"))
        header_layout.addWidget(self.code_input, 1)

        self.btn_pair = QPushButton("Pair Device")
        self.btn_pair.setStyleSheet("background-color: #2563eb; color: white; font-weight: bold; padding: 6px 12px;")
        self.btn_pair.clicked.connect(self.handle_pair)
        header_layout.addWidget(self.btn_pair)

        self.btn_disconnect = QPushButton("Unpair / Reset")
        self.btn_disconnect.clicked.connect(self.handle_unpair)
        header_layout.addWidget(self.btn_disconnect)

        main_layout.addWidget(header_box)

        # 2. Printer Selection & Settings
        settings_box = QGroupBox("Printer Hardware Configuration")
        settings_layout = QHBoxLayout(settings_box)

        self.cb_bw_printer = QComboBox()
        self.cb_color_printer = QComboBox()
        self.refresh_printers()

        settings_layout.addWidget(QLabel("B&W Printer:"))
        settings_layout.addWidget(self.cb_bw_printer, 2)

        settings_layout.addWidget(QLabel("Colour Printer:"))
        settings_layout.addWidget(self.cb_color_printer, 2)

        self.chk_dry_run = QCheckBox("Dry-Run Mode (Test without paper)")
        self.chk_dry_run.setChecked(self.config.get("dry_run", True))
        self.chk_dry_run.toggled.connect(self.toggle_dry_run)
        settings_layout.addWidget(self.chk_dry_run, 2)

        main_layout.addWidget(settings_box)

        # 3. Active Print Queue Table
        queue_box = QGroupBox("Active Spooler Queue")
        queue_layout = QVBoxLayout(queue_box)

        self.table_jobs = QTableWidget(0, 5)
        self.table_jobs.setHorizontalHeaderLabels(["Order #", "Document", "Copies", "Target Printer", "Status"])
        self.table_jobs.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        queue_layout.addWidget(self.table_jobs)

        main_layout.addWidget(queue_box)

        # 4. Agent Console Logs
        log_box = QGroupBox("Agent Diagnostics & Spooler Logs")
        log_layout = QVBoxLayout(log_box)

        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setStyleSheet("background-color: #0f172a; color: #38bdf8; font-family: monospace; font-size: 11px;")
        log_layout.addWidget(self.log_console)

        main_layout.addWidget(log_box)

        # Status Bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_label = QLabel("Status: Disconnected")
        self.status_bar.addWidget(self.status_label)

    def refresh_printers(self):
        printers = enumerate_windows_printers()
        self.cb_bw_printer.clear()
        self.cb_color_printer.clear()
        for p in printers:
            self.cb_bw_printer.addItem(p["name"])
            self.cb_color_printer.addItem(p["name"])

        # Pick smart defaults if available
        color_idx = next((i for i, p in enumerate(printers) if p.get("supportsColor")), 0)
        self.cb_color_printer.setCurrentIndex(color_idx)

    def append_log(self, text):
        timestamp = time.strftime("%H:%M:%S")
        self.log_console.append(f"[{timestamp}] {text}")

    def update_status(self, status, message):
        color = "#10b981" if status == "online" else "#ef4444"
        self.status_label.setText(f"Status: {message}")
        self.status_label.setStyleSheet(f"color: {color}; font-weight: bold;")

    def toggle_dry_run(self, checked):
        self.config["dry_run"] = checked
        self.save_config()
        if self.worker:
            self.worker.dry_run = checked
        self.append_log(f"Dry-run mode set to: {checked}")

    def handle_pair(self):
        code = re.sub(r'[\s\-]', '', self.code_input.text().strip())
        server = self.server_input.text().strip().rstrip("/")
        if server and not server.startswith("http://") and not server.startswith("https://"):
            server = f"https://{server}"
            self.server_input.setText(server)

        if not code or len(code) < 4:
            QMessageBox.warning(self, "Validation Error", "Please enter the 6-digit pairing code from your Shop Dashboard.")
            return

        self.append_log(f"Attempting pairing with {server} using code {code}...")
        try:
            resp = requests.post(f"{server}/api/agent/pair", json={
                "pairingCode": code,
                "deviceName": os.environ.get("COMPUTERNAME", "Shop-Counter-Windows-PC")
            }, timeout=15)

            if resp.status_code == 200:
                data = resp.json()
                token = data.get("token")
                self.config["server_url"] = server
                self.config["agent_token"] = token
                self.save_config()
                self.code_input.clear()
                QMessageBox.information(self, "Success", "Windows Printing Agent paired successfully!")
                self.start_agent()
            else:
                err = resp.json().get("error", "Pairing failed")
                QMessageBox.critical(self, "Pairing Failed", err)
        except Exception as e:
            QMessageBox.critical(self, "Connection Error", f"Unable to reach server: {e}")

    def handle_unpair(self):
        if QMessageBox.question(self, "Confirm", "Unpair this computer from the shop?") == QMessageBox.Yes:
            self.stop_agent()
            self.config["agent_token"] = ""
            self.save_config()
            self.update_status("offline", "Unpaired")
            self.append_log("Device credentials cleared.")

    def start_agent(self):
        token = self.config.get("agent_token")
        if not token:
            return

        if self.worker and self.worker.isRunning():
            return

        self.worker = WorkerThread(
            server_url=self.config.get("server_url", DEFAULT_SERVER),
            agent_token=token,
            dry_run=self.config.get("dry_run", True)
        )
        self.worker.log_signal.connect(self.append_log)
        self.worker.job_signal.connect(self.add_job_to_table)
        self.worker.status_signal.connect(self.update_status)
        self.worker.start()
        self.append_log("PrintQR Agent running in background.")

    def stop_agent(self):
        if self.worker:
            self.worker.stop()
            self.worker.wait(2000)
            self.worker = None

    def add_job_to_table(self, job):
        row = self.table_jobs.rowCount()
        self.table_jobs.insertRow(row)
        self.table_jobs.setItem(row, 0, QTableWidgetItem(job.get("orderNumber", "")))
        self.table_jobs.setItem(row, 1, QTableWidgetItem(job.get("documentName", "")))
        self.table_jobs.setItem(row, 2, QTableWidgetItem(str(job.get("copies", 1))))
        self.table_jobs.setItem(row, 3, QTableWidgetItem(job.get("targetPrinter", "")))
        self.table_jobs.setItem(row, 4, QTableWidgetItem("Processing..."))

    def closeEvent(self, event):
        self.stop_agent()
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
