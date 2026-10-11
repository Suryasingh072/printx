# PrintQR Windows Desktop Printing Agent

A native Windows desktop application built with Python 3.11+ and PySide6 to connect shop computers directly to your PrintQR Cloud Queue.

## Capabilities
- **Direct Windows Spooler Dispatch:** Sends verified, paid documents directly to Windows-connected thermal or laser printers.
- **Atomic Job Claims:** Prevents duplicate print dispatches when multiple terminals run simultaneously.
- **Expiring Signed URLs:** Secure temporary download URLs ensure documents cannot be accessed or retained outside the authorized print session.
- **Separate B&W and Colour Routing:** Automatically routes color documents to your inkjet/color printer and monochrome text to your high-speed laser printer.
- **Dry-Run Mode:** Built-in simulation toggle allows test runs without wasting paper or toner.
- **Automatic Diagnostics & Retries:** Spooler errors trigger status updates and up to 3 automatic safe retry attempts.

## Running in Development
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python agent.py
```

## Packaging to Windows x64 Executable (.exe)
Double-click `build_windows_exe.bat` or run:
```bash
pip install pyinstaller
pyinstaller --noconfirm --onedir --windowed --name "PrintQR-WindowsAgent" agent.py
```
The output standalone `.exe` will be generated inside `dist/PrintQR-WindowsAgent/`.
