"""Silent launcher for the scrapers, used by Windows Task Scheduler.

Why this exists: the scheduled tasks now also fire at logon, and running
python.exe would flash a console window in the owner's face every time the PC
starts. pythonw.exe has no console, so it runs invisibly — but it also
discards print() output, and both scrapers log everything through print().

This bridges the two: point the task at pythonw.exe, hand it this file plus
the real script, and the scraper's own log() output lands in a rolling log
file instead of nowhere.

Usage (what the tasks run):
    pythonw.exe run_hidden.py scrape_threads.py
"""

import runpy
import sys
import traceback
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOG_FILE = HERE / "scraper.log"

# Keep the log from growing forever. 1 MB is a few hundred runs; at that point
# the tail is what matters, so start clean rather than rotating into archives
# nobody will read.
MAX_LOG_BYTES = 1_000_000


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: run_hidden.py <script.py> [args...]", file=sys.stderr)
        return 2

    target = HERE / sys.argv[1]
    if not target.exists():
        print(f"no such script: {target}", file=sys.stderr)
        return 2

    if LOG_FILE.exists() and LOG_FILE.stat().st_size > MAX_LOG_BYTES:
        LOG_FILE.unlink()

    # Hand the remaining args to the target script as if it were called
    # directly, so `run_hidden.py scrape_reddit.py makinghiphop "need beats"`
    # still works for one-off testing.
    sys.argv = [str(target)] + sys.argv[2:]

    with open(LOG_FILE, "a", encoding="utf-8", buffering=1) as log:
        sys.stdout = log
        sys.stderr = log
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log.write(f"\n===== {target.name} started {stamp} =====\n")
        try:
            runpy.run_path(str(target), run_name="__main__")
            return 0
        except SystemExit as e:
            return int(e.code or 0)
        except Exception:
            # Without this the traceback would vanish with the console.
            traceback.print_exc(file=log)
            return 1


if __name__ == "__main__":
    sys.exit(main())
