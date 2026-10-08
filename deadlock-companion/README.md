# Deadlock Companion

A Windows desktop application for reviewing Deadlock match data, organizing practice, and connecting session recordings to match notes.

## Features

- OBS session recording with explicit arming and Windows process detection.
- Local match-data caching, CSV exports, and match notes.
- Hero summaries and comparisons between recent performance windows.
- Manual video alignment and VLC seeking.
- A 24-lesson practice guide with local progress.
- SQLite storage and backups.

## Code structure

| File | Purpose |
| --- | --- |
| [app.py](app.py) | Tkinter interface and application coordination |
| [core.py](core.py) | Data adapters, OBS integration, and storage |
| [profile_stats.py](profile_stats.py) | Performance-window calculations |
| [tests/](tests/) | Tests using simulated integrations and synthetic data |
| [Study-Guide.md](Study-Guide.md) | Practice curriculum |

## Running on Windows

1. Install Python 3.11 or newer with the Windows launcher and Tcl/Tk support.
2. Install and configure OBS Studio if you want to record sessions. VLC is used for video seeking.
3. Run `Start-Companion.cmd`. The launcher creates a local virtual environment and installs the packages in `requirements.txt`.
4. Follow [START-HERE.html](START-HERE.html) for OBS setup and the verification checklist.

To run the included tests from this project directory:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Limitations

Recording is triggered by process presence; exact match boundaries are not automatically detected. Event availability depends on the upstream match data. Live OBS, Windows capture, and real-account integrations need verification in the target environment.

Performance comparisons use valid observation counts and simple change thresholds. They are prompts for replay review, not statistical significance tests or measures of player rank.
