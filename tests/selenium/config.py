import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = BASE_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# URLs
BASE_URL = os.getenv("SELENIUM_BASE_URL", "http://localhost:5173").rstrip("/")

# Browser Settings
HEADLESS = os.getenv("SELENIUM_HEADLESS", "true").lower() in ("true", "1", "yes")
DEFAULT_TIMEOUT = int(os.getenv("SELENIUM_DEFAULT_TIMEOUT", "10"))

# Locate Chrome executable on Windows if not provided
DEFAULT_CHROME_PATHS = [
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]
CHROME_BINARY = os.getenv("SELENIUM_BROWSER_BINARY")
if not CHROME_BINARY:
    for path in DEFAULT_CHROME_PATHS:
        if os.path.exists(path):
            CHROME_BINARY = path
            break

# Test Credentials (configured via environment variables with existing demo fallbacks)
ADMIN_EMAIL = os.getenv("SELENIUM_ADMIN_EMAIL", "admin@lexcore.com")
ADMIN_PASSWORD = os.getenv("SELENIUM_ADMIN_PASSWORD", "LexCore@Demo1")

CLIENT_EMAIL = os.getenv("SELENIUM_CLIENT_EMAIL", "client@lexcore.com")
CLIENT_PASSWORD = os.getenv("SELENIUM_CLIENT_PASSWORD", "LexCore@Demo1")

LAWYER_EMAIL = os.getenv("SELENIUM_LAWYER_EMAIL", "senior@lexcore.com")
LAWYER_PASSWORD = os.getenv("SELENIUM_LAWYER_PASSWORD", "LexCore@Demo1")

PARALEGAL_EMAIL = os.getenv("SELENIUM_PARALEGAL_EMAIL", "paralegal@lexcore.com")
PARALEGAL_PASSWORD = os.getenv("SELENIUM_PARALEGAL_PASSWORD", "LexCore@Demo1")
