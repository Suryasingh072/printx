@echo off
echo =======================================================
echo Building PrintQR Windows x64 Desktop Agent Executable
echo =======================================================

echo 1. Installing requirements...
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

echo 2. Packaging executable with PyInstaller...
pyinstaller --noconfirm --onedir --windowed ^
    --name "PrintQR-WindowsAgent" ^
    --add-data "requirements.txt;." ^
    --clean ^
    agent.py

echo =======================================================
echo Build Completed!
echo Executable output located in: dist\PrintQR-WindowsAgent\PrintQR-WindowsAgent.exe
echo =======================================================
pause
