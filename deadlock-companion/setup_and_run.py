"""Creates an isolated local environment; no admin install or game modification."""
import os, subprocess, sys, venv
from pathlib import Path
root=Path(__file__).resolve().parent
if os.name!='nt':raise SystemExit('Run Start-Companion.cmd on your Windows home PC.')
if sys.version_info<(3,11):raise SystemExit('Install Python 3.11 or newer from python.org, then reopen Start-Companion.cmd.')
folder=root/'.venv';python=folder/'Scripts/python.exe'
if not python.exists():
    print('Creating the companion runtime in this folder…')
    venv.EnvBuilder(with_pip=True).create(folder)
expected=(root/'requirements.txt').read_text();marker=folder/'companion-dependencies.txt'
if not marker.exists() or marker.read_text()!=expected:
    print('Installing OBS connection libraries from PyPI…')
    subprocess.run([str(python),'-m','pip','install','--disable-pip-version-check','-r',str(root/'requirements.txt')],check=True)
    marker.write_text(expected)
print('Opening Eternus Companion…')
subprocess.Popen([str(folder/'Scripts/pythonw.exe'),str(root/'app.py')],cwd=str(root))
