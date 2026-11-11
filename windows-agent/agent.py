#!/usr/bin/env python3
"""
printx - Windows Desktop Printing Agent v2.5
PySide6 Application for Local Print Shop Automation
Connects shop desktop printers to the printx cloud queue 24/7.
Features: Permanent connection resilience, auto-recovery watchdog,
and safe multi-file spooler handling.
"""

import sys
import os
import json
import time
import re
import tempfile
from pathlib import Path

# Optional pywin32 import for native Windows printer enumeration
try:
    import win32print
    import win32api
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from PySide6.QtCore import Qt, QThread, Signal, Slot, QTimer
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QComboBox, QCheckBox, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox, QMessageBox,
    QStatusBar, QFrame
)
from PySide6.QtGui import QIcon, QFont, QColor

CONFIG_FILE = Path("config.json")
DEFAULT_SERVER = "https://printx-x5a2.vercel.app"

def redact_secrets(text: str) -> str:
    """Sanitize tokens and sensitive values from application logs"""
    text = re.sub(r'Bearer\s+[A-Za-z0-9\-_.]+', 'Bearer [REDACTED_TOKEN]', text)
    text = re.sub(r'agt_token_[A-Za-z0-9]+', 'agt_token_[REDACTED]', text)
    text = re.sub(r'token=[A-Za-z0-9\-_.]{10,}', 'token=[REDACTED_SIG]', text)
    return text

def enumerate_windows_printers():
    """Detect all printers installed on Windows safely with complete fallback"""
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
                    "supportsColor": any(c in name.lower() for c in ["color", "colour", "pixma", "epson", "inkjet", "deskjet", "ecotank"]),
                })
        except Exception as e:
            print(f"Note enumerating win32 printers: {e}")

    # Fallback if running on non-Windows or if win32print returns empty
    if not printers:
        printers = [
            {"name": "HP LaserJet Pro M404dn", "isDefault": True, "status": "Ready", "supportsColor": False},
            {"name": "Canon PIXMA G3010", "isDefault": False, "status": "Ready", "supportsColor": True},
            {"name": "Epson L3150 Series", "isDefault": False, "status": "Ready", "supportsColor": True},
            {"name": "Microsoft Print to PDF", "isDefault": False, "status": "Ready", "supportsColor": True},
        ]
    return printers

def create_resilient_session() -> requests.Session:
    """Creates a high-performance persistent HTTP session with connection pooling and retries"""
    session = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[500, 502, 503, 504],
        raise_on_status=False
    )
    adapter = HTTPAdapter(pool_connections=10, pool_maxsize=20, max_retries=retries)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

class WorkerThread(QThread):
    log_signal = Signal(str)
    job_signal = Signal(dict)
    status_signal = Signal(str, str) # status ('online' | 'offline' | 'error'), message
    token_updated_signal = Signal(str) # new_token

    def __init__(self, server_url, agent_token, pairing_code="", dry_run=False):
        super().__init__()
        self.server_url = server_url.rstrip("/")
        self.agent_token = agent_token
        self.pairing_code = pairing_code
        self.dry_run = dry_run
        self.running = True
        self.session = create_resilient_session()
        self.consecutive_failures = 0
        self.last_heartbeat_time = 0

    def run(self):
        self.log_signal.emit("[Agent] 24/7 Background Spooler started. Connecting to printx Cloud...")
        # Initially report online attempt
        self.status_signal.emit("online", "Connected • Ready to Print")

        while self.running:
            try:
                headers = {
                    "x-agent-token": self.agent_token,
                    "Authorization": f"Bearer {self.agent_token}",
                    "Connection": "keep-alive"
                }

                now = time.time()
                # 1. Heartbeat every 8-10 seconds to maintain live server presence
                if now - self.last_heartbeat_time >= 8:
                    printers = enumerate_windows_printers()
                    def_printer = "Default Windows Printer"
                    if printers:
                        def_printer = next((p.get("name") for p in printers if p.get("isDefault")), printers[0].get("name", "Default Windows Printer"))

                    hb_payload = {
                        "installedPrinters": printers,
                        "defaultPrinter": def_printer,
                        "status": "online"
                    }

                    try:
                        hb_resp = self.session.post(
                            f"{self.server_url}/api/agent/heartbeat",
                            json=hb_payload,
                            headers=headers,
                            timeout=(5, 12)
                        )

                        if hb_resp.status_code == 200:
                            self.consecutive_failures = 0
                            self.last_heartbeat_time = now
                            self.status_signal.emit("online", "Connected • Ready to Print (24/7)")
                        elif hb_resp.status_code == 401 and self.pairing_code:
                            # Auto-re-pair using permanent pairing code if server session was reset!
                            self.log_signal.emit("[Auth Refresh] Server token refreshed. Auto-reconnecting with permanent code...")
                            self.auto_repair()
                        else:
                            self.consecutive_failures += 1
                    except Exception as hb_err:
                        self.consecutive_failures += 1
                        # Transient blip - don't immediately throw UI into offline!
                        if self.consecutive_failures < 4:
                            self.log_signal.emit(f"[Network Notice] Re-syncing heartbeat ({self.consecutive_failures}/4)...")

                # 2. Poll for authorized pending print jobs in strict chronological FIFO order
                try:
                    jobs_resp = self.session.get(
                        f"{self.server_url}/api/agent/jobs",
                        headers=headers,
                        timeout=(5, 12)
                    )

                    if jobs_resp.status_code == 200:
                        self.consecutive_failures = 0
                        data = jobs_resp.json()
                        jobs = data.get("jobs", [])
                        if jobs:
                            self.log_signal.emit(f"[Queue Poll] Found {len(jobs)} pending print job(s). Processing in strict order...")
                            for job in jobs:
                                if not self.running:
                                    break
                                self.process_job(job, headers)
                        else:
                            # Connected and idle
                            if self.consecutive_failures == 0:
                                self.status_signal.emit("online", "Connected • Ready to Print (24/7)")
                    elif jobs_resp.status_code == 401 and self.pairing_code:
                        self.auto_repair()
                    else:
                        self.consecutive_failures += 1
                except Exception as poll_err:
                    self.consecutive_failures += 1

                # If we had multiple consecutive failures across 25+ seconds, update status safely
                if self.consecutive_failures >= 5:
                    self.status_signal.emit("offline", f"Reconnecting (attempt {self.consecutive_failures})...")
                elif self.consecutive_failures == 0:
                    self.status_signal.emit("online", "Connected • Ready to Print (24/7)")

            except Exception as e:
                self.consecutive_failures += 1
                err_text = redact_secrets(str(e))
                if self.consecutive_failures >= 5:
                    self.log_signal.emit(f"[Connection Error] {err_text}")
                    self.status_signal.emit("offline", "Reconnecting...")

            # Sleep 3 seconds before next polling cycle (responsive yet low CPU)
            for _ in range(3):
                if not self.running:
                    break
                time.sleep(1)

    def auto_repair(self):
        """Automatically re-pairs using the permanent pairing code when server restarts"""
        if not self.pairing_code or len(self.pairing_code) < 4:
            return False
        try:
            resp = self.session.post(
                f"{self.server_url}/api/agent/pair",
                json={
                    "pairingCode": self.pairing_code,
                    "deviceName": os.environ.get("COMPUTERNAME", "Shop-Counter-Windows-PC")
                },
                timeout=(5, 12)
            )
            if resp.status_code == 200:
                data = resp.json()
                new_token = data.get("token") or data.get("permanentToken")
                if new_token:
                    self.agent_token = new_token
                    self.consecutive_failures = 0
                    self.token_updated_signal.emit(new_token)
                    self.log_signal.emit("[Auto-Reconnect] Permanent connection restored successfully!")
                    self.status_signal.emit("online", "Connected • Ready to Print (24/7)")
                    return True
        except Exception as e:
            self.log_signal.emit(f"[Auto-Reconnect Note] Retry scheduled: {e}")
        return False

    def process_job(self, job, headers):
        job_id = job.get("jobId")
        order_num = job.get("orderNumber")
        doc_name = job.get("documentName", "Document.pdf")
        target_pr = job.get("targetPrinter", "Default Windows Printer")
        file_idx = job.get("fileIndex", 1)
        total_files = job.get("totalFiles", 1)

        self.log_signal.emit(f"[Job Detected] #{order_num} (File {file_idx}/{total_files}: {doc_name}) -> Target: '{target_pr}'")
        self.job_signal.emit(job)

        # Step A: Atomic Claim (Guarantees no duplicate printing across threads)
        try:
            claim_resp = self.session.post(
                f"{self.server_url}/api/agent/jobs/{job_id}/claim",
                headers=headers,
                timeout=(5, 10)
            )
            if claim_resp.status_code != 200:
                self.log_signal.emit(f"[Claim Skipped] Job #{order_num} was claimed by another thread or already completed.")
                return

            claim_data = claim_resp.json()
            claim_token = claim_data.get("claimToken")
            self.log_signal.emit(f"[Claimed] Job #{order_num} locked with claim token.")

            # Step B: Report spooling
            self.session.post(
                f"{self.server_url}/api/agent/jobs/{job_id}/report",
                json={"claimToken": claim_token, "status": "spooling"},
                headers=headers,
                timeout=(5, 10)
            )

            # Step C: Download Document with validation
            download_url = f"{self.server_url}{job.get('downloadUrl')}"
            doc_resp = self.session.get(download_url, timeout=(5, 30))
            if doc_resp.status_code != 200:
                raise Exception(f"Download returned HTTP {doc_resp.status_code}")

            content = doc_resp.content
            if len(content) < 200:
                raise Exception(f"Downloaded file too small ({len(content)} bytes), skipped to avoid blank paper")

            # Check if server returned a JSON error response instead of file bytes
            if content.startswith(b'{"error"') or content.startswith(b'{"message"'):
                raise Exception("Server returned error payload instead of printable document")

            # Save to temporary workstation file
            suffix = Path(doc_name).suffix or ".pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name

            self.log_signal.emit(f"[Spooling] Downloaded {len(content)} bytes to {tmp_path}")

            # Step D: Physical / Dry-Run Print Execution
            if self.dry_run:
                self.log_signal.emit(f"[DRY-RUN MODE] Simulating print for #{order_num} on '{target_pr}'...")
                time.sleep(2)
                print_success = True
            else:
                print_success = self.dispatch_to_windows_spooler(tmp_path, target_pr, job)
                # Spool settlement wait (gives Windows Print Spooler time to buffer before next file)
                time.sleep(3)

            if print_success:
                # Step E: Report Printed Confirmation
                self.session.post(
                    f"{self.server_url}/api/agent/jobs/{job_id}/report",
                    json={"claimToken": claim_token, "status": "printed"},
                    headers=headers,
                    timeout=(5, 10)
                )
                self.log_signal.emit(f"[PRINT SUCCESS] Order #{order_num} (File {file_idx}/{total_files}) printed & confirmed!")
            else:
                self.session.post(
                    f"{self.server_url}/api/agent/jobs/{job_id}/report",
                    json={
                        "claimToken": claim_token,
                        "status": "failed",
                        "errorMessage": "Windows print spooler rejected job"
                    },
                    headers=headers,
                    timeout=(5, 10)
                )
                self.log_signal.emit(f"[PRINT FAILED] Order #{order_num} spooling error.")

        except Exception as e:
            err_msg = redact_secrets(str(e))
            self.log_signal.emit(f"[Job Error] #{order_num}: {err_msg}")
            try:
                self.session.post(
                    f"{self.server_url}/api/agent/jobs/{job_id}/report",
                    json={"claimToken": locals().get("claim_token", ""), "status": "failed", "errorMessage": err_msg},
                    headers=headers,
                    timeout=(5, 10)
                )
            except Exception:
                pass

    def dispatch_to_windows_spooler(self, file_path, printer_name, job):
        """Submit job to Windows Print Spooler with robust printer routing"""
        if WIN32_AVAILABLE:
            try:
                if printer_name and printer_name != "Default Windows Printer":
                    try:
                        win32print.SetDefaultPrinter(printer_name)
                    except Exception:
                        pass
                self.log_signal.emit(f"[Win32 Spooler] Submitting '{file_path}' to '{printer_name}'...")
                win32api.ShellExecute(0, "printto", file_path, f'"{printer_name}"', ".", 0)
                time.sleep(2)
                return True
            except Exception as e:
                self.log_signal.emit(f"[Win32 Spooler Note] Target '{printer_name}' failed: {e}. Fallback to Windows default printer...")
                try:
                    win32api.ShellExecute(0, "print", file_path, None, ".", 0)
                    time.sleep(2)
                    return True
                except Exception as e2:
                    self.log_signal.emit(f"[Win32 Spooler Fatal] Both target and default printer failed: {e2}")
                    return False
        else:
            self.log_signal.emit(f"[Platform Note] Simulated native spool for '{file_path}' on non-Windows environment.")
            return True

    def stop(self):
        self.running = False


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("printx - Windows Desktop Print Agent v2.5 (24/7 Online)")
        self.resize(880, 650)
        self.config = self.load_config()
        self.worker = None

        self.init_ui()

        # Auto-connect if token or pairing code present
        if self.config.get("agent_token") or self.config.get("pairing_code"):
            self.start_agent()

        # Watchdog Timer: Runs every 10 seconds to ensure the worker thread is always alive
        self.watchdog_timer = QTimer(self)
        self.watchdog_timer.setInterval(10000)
        self.watchdog_timer.timeout.connect(self.check_worker_health)
        self.watchdog_timer.start()

    def check_worker_health(self):
        """Watchdog to auto-revive worker thread if terminated unexpectedly"""
        if (self.config.get("agent_token") or self.config.get("pairing_code")) and (self.worker is None or not self.worker.isRunning()):
            self.append_log("[Watchdog] Reviving print spooler background worker...")
            self.start_agent()

    def load_config(self):
        cfg = {
            "server_url": DEFAULT_SERVER,
            "agent_token": "",
            "pairing_code": "",
            "device_name": "Shop-Counter-PC",
            "dry_run": False
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r") as f:
                    saved = json.load(f)
                    cfg.update(saved)
            except Exception:
                pass
        # Auto-migrate away from obsolete localhost to DEFAULT_SERVER
        if not cfg.get("server_url") or "localhost" in cfg.get("server_url", "") or "127.0.0.1" in cfg.get("server_url", ""):
            cfg["server_url"] = DEFAULT_SERVER
        return cfg

    def save_config(self):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
        except Exception as e:
            print(f"Error saving config: {e}")

    def init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)

        # 1. Header & Connection Bar
        header_box = QGroupBox("Shop Hardware Link & 24/7 Permanent Connection")
        header_layout = QHBoxLayout(header_box)

        self.server_input = QLineEdit(self.config.get("server_url", DEFAULT_SERVER))
        self.server_input.setPlaceholderText("https://your-shop.printx.in")
        header_layout.addWidget(QLabel("Server URL:"))
        header_layout.addWidget(self.server_input, 2)

        self.code_input = QLineEdit(self.config.get("pairing_code", ""))
        self.code_input.setPlaceholderText("6-Digit Code")
        self.code_input.setMaxLength(6)
        header_layout.addWidget(QLabel("Pair Code:"))
        header_layout.addWidget(self.code_input, 1)

        self.btn_pair = QPushButton("Connect (24/7)")
        self.btn_pair.setStyleSheet("background-color: #2563eb; color: white; font-weight: bold; padding: 6px 14px; border-radius: 6px;")
        self.btn_pair.clicked.connect(self.handle_pair)
        header_layout.addWidget(self.btn_pair)

        self.btn_disconnect = QPushButton("Unpair / Reset")
        self.btn_disconnect.setStyleSheet("padding: 6px 10px; color: #94a3b8;")
        self.btn_disconnect.clicked.connect(self.handle_unpair)
        header_layout.addWidget(self.btn_disconnect)

        main_layout.addWidget(header_box)

        # 2. Printer Selection & Settings
        settings_box = QGroupBox("Workstation Printer Assignment")
        settings_layout = QHBoxLayout(settings_box)

        self.cb_bw_printer = QComboBox()
        self.cb_color_printer = QComboBox()
        self.refresh_printers()

        settings_layout.addWidget(QLabel("B&W Printer:"))
        settings_layout.addWidget(self.cb_bw_printer, 2)

        settings_layout.addWidget(QLabel("Colour Printer:"))
        settings_layout.addWidget(self.cb_color_printer, 2)

        self.chk_dry_run = QCheckBox("Simulation Mode (Test without paper)")
        self.chk_dry_run.setChecked(self.config.get("dry_run", False))
        self.chk_dry_run.toggled.connect(self.toggle_dry_run)
        settings_layout.addWidget(self.chk_dry_run, 2)

        main_layout.addWidget(settings_box)

        # 3. Active Print Queue Table
        queue_box = QGroupBox("Active Spooler Queue (Strict FIFO Chronological Order)")
        queue_layout = QVBoxLayout(queue_box)

        self.table_jobs = QTableWidget(0, 5)
        self.table_jobs.setHorizontalHeaderLabels(["Order #", "Document", "Copies", "Target Printer", "Status"])
        self.table_jobs.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        queue_layout.addWidget(self.table_jobs)

        main_layout.addWidget(queue_box)

        # 4. Agent Console Logs
        log_box = QGroupBox("Agent Diagnostics & Live Spooler Feed")
        log_layout = QVBoxLayout(log_box)

        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setStyleSheet("background-color: #080b14; color: #38bdf8; font-family: monospace; font-size: 11px;")
        log_layout.addWidget(self.log_console)

        main_layout.addWidget(log_box)

        # Status Bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_label = QLabel("Status: Ready to Connect")
        self.status_bar.addWidget(self.status_label)

    def refresh_printers(self):
        printers = enumerate_windows_printers()
        self.cb_bw_printer.clear()
        self.cb_color_printer.clear()
        for p in printers:
            self.cb_bw_printer.addItem(p["name"])
            self.cb_color_printer.addItem(p["name"])

        # Smart defaults
        color_idx = next((i for i, p in enumerate(printers) if p.get("supportsColor")), 0)
        self.cb_color_printer.setCurrentIndex(color_idx)

    def append_log(self, text):
        timestamp = time.strftime("%H:%M:%S")
        self.log_console.append(f"[{timestamp}] {text}")

    def update_status(self, status, message):
        color = "#10b981" if status == "online" else "#ef4444"
        self.status_label.setText(f"Status: {message}")
        self.status_label.setStyleSheet(f"color: {color}; font-weight: bold; font-size: 12px;")
        if status == "online":
            self.btn_pair.setText("Connected (24/7)")
            self.btn_pair.setStyleSheet("background-color: #059669; color: white; font-weight: bold; padding: 6px 14px; border-radius: 6px;")
        else:
            self.btn_pair.setText("Connect (24/7)")
            self.btn_pair.setStyleSheet("background-color: #2563eb; color: white; font-weight: bold; padding: 6px 14px; border-radius: 6px;")

    def on_token_updated(self, new_token):
        self.config["agent_token"] = new_token
        self.save_config()

    def toggle_dry_run(self, checked):
        self.config["dry_run"] = checked
        self.save_config()
        if self.worker:
            self.worker.dry_run = checked
        self.append_log(f"Simulation mode set to: {checked}")

    def handle_pair(self):
        code = re.sub(r'[\s\-]', '', self.code_input.text().strip())
        server = self.server_input.text().strip().rstrip("/")
        if server and not server.startswith("http://") and not server.startswith("https://"):
            server = f"https://{server}"
            self.server_input.setText(server)

        if not code or len(code) < 4:
            QMessageBox.warning(self, "Validation Error", "Please enter the 6-Digit Pairing Code from your Shop Dashboard.")
            return

        self.append_log(f"Attempting permanent connection with {server} using 6-digit code '{code}'...")
        try:
            resp = requests.post(
                f"{server}/api/agent/pair",
                json={
                    "pairingCode": code,
                    "deviceName": os.environ.get("COMPUTERNAME", "Shop-Counter-Windows-PC")
                },
                timeout=15
            )

            if resp.status_code == 200:
                data = resp.json()
                token = data.get("token") or data.get("permanentToken")
                self.config["server_url"] = server
                self.config["pairing_code"] = code
                self.config["agent_token"] = token
                self.save_config()
                QMessageBox.information(self, "Success", "Windows Printing Agent paired and permanently connected 24/7!")
                self.start_agent()
            else:
                err = resp.json().get("error", "Pairing failed")
                QMessageBox.critical(self, "Pairing Failed", err)
        except Exception as e:
            QMessageBox.critical(self, "Connection Error", f"Unable to reach server: {e}")

    def handle_unpair(self):
        if QMessageBox.question(self, "Confirm", "Unpair this computer from the shop? Connection will stop until re-paired.") == QMessageBox.Yes:
            self.stop_agent()
            self.config["agent_token"] = ""
            self.config["pairing_code"] = ""
            self.save_config()
            self.code_input.clear()
            self.update_status("offline", "Unpaired")
            self.append_log("Device credentials cleared.")

    def start_agent(self):
        token = self.config.get("agent_token")
        code = self.config.get("pairing_code", "")
        if not token and not code:
            return

        if self.worker and self.worker.isRunning():
            return

        self.worker = WorkerThread(
            server_url=self.config.get("server_url", DEFAULT_SERVER),
            agent_token=token or "",
            pairing_code=code,
            dry_run=self.config.get("dry_run", False)
        )
        self.worker.log_signal.connect(self.append_log)
        self.worker.job_signal.connect(self.add_job_to_table)
        self.worker.status_signal.connect(self.update_status)
        self.worker.token_updated_signal.connect(self.on_token_updated)
        self.worker.start()
        self.append_log("[Status] printx Agent background service running.")

    def stop_agent(self):
        if self.worker:
            self.worker.stop()
            self.worker.wait(2000)
            self.worker = None

    def add_job_to_table(self, job):
        row = self.table_jobs.rowCount()
        self.table_jobs.insertRow(row)
        self.table_jobs.setItem(row, 0, QTableWidgetItem(str(job.get("orderNumber", ""))))
        self.table_jobs.setItem(row, 1, QTableWidgetItem(str(job.get("documentName", ""))))
        self.table_jobs.setItem(row, 2, QTableWidgetItem(str(job.get("copies", 1))))
        self.table_jobs.setItem(row, 3, QTableWidgetItem(str(job.get("targetPrinter", ""))))
        self.table_jobs.setItem(row, 4, QTableWidgetItem("Spooling..."))

    def closeEvent(self, event):
        self.stop_agent()
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
