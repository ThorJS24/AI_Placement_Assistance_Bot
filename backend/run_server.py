"""
Convenience launcher: reads SERVER_HOST / SERVER_PORT from .env, starts the
FastAPI app with uvicorn, and opens the app in the default browser shortly
after startup. This is what run.bat / run.sh actually invoke.
"""
from __future__ import annotations

import threading
import time
import webbrowser

import uvicorn

import config


def _open_browser_later(url: str, delay: float = 1.5) -> None:
    def _open():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()


if __name__ == "__main__":
    url = f"http://{config.SERVER_HOST}:{config.SERVER_PORT}"
    print(f"\nStarting {config.APP_TITLE}...")
    print(f"Open {url} in your browser if it doesn't open automatically.\n")
    _open_browser_later(url)
    uvicorn.run("main:app", host=config.SERVER_HOST, port=config.SERVER_PORT, reload=False, log_level="info")
