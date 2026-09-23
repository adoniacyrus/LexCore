# LexCore — Automated Selenium E2E Testing Framework

Automated End-to-End (E2E) testing framework for the LexCore Legal Practice Management Platform using **Python**, **pytest**, **Selenium 4**, and **Google Chrome**.

---

## Prerequisites

1. **PostgreSQL** running with the `lexcore_db` database.
2. **Django Backend** running on port 8000:
   ```bash
   cd backend
   python manage.py runserver
   ```
3. **React Frontend** running on port 5173:
   ```bash
   cd frontend
   npm run dev
   ```
4. **Google Chrome** installed on the host system.
5. **Python Dependencies** installed in your virtual environment:
   ```bash
   pip install pytest selenium
   ```

---

## Directory Structure

```
tests/
└── selenium/
    ├── __init__.py
    ├── conftest.py               # Reusable browser driver fixture & failure screenshot hook
    ├── config.py                 # Environment-driven test configuration & credentials
    ├── README.md                 # Framework documentation
    ├── screenshots/              # Automated screenshot captures on test failure
    ├── pages/
    │   ├── __init__.py
    │   ├── base_page.py          # Explicit wait primitives and browser interactions
    │   ├── login_page.py         # Login form interactions, validation & error assertions
    │   ├── admin_dashboard_page.py # Admin dashboard, KPIs & sidebar navigation
    │   ├── client_dashboard_page.py# Client dashboard, quick actions & portal access
    │   ├── consultation_page.py  # Book consultation modal, validation, review & queue
    │   ├── case_page.py          # Case detail, legal team, documents & task management
    │   └── calendar_page.py      # Court calendar views, date presets & court filters
    │
    ├── test_auth.py              # TC-AUTH-01 through TC-AUTH-07
    ├── test_consultations.py     # TC-CONS-01 to 04 & TC-ADMIN-CONS-01 to 03
    ├── test_cases.py             # TC-CASE-01 through TC-CASE-07
    ├── test_documents.py         # TC-DOC-01 through TC-DOC-04
    ├── test_tasks.py             # TC-TASK-01 through TC-TASK-04
    ├── test_calendar.py          # TC-CAL-01 through TC-CAL-05
    └── test_appointments.py      # TC-APP-01 through TC-APP-06
```

---

## Environment Variables & Configuration

The framework uses sensible defaults matching the local development setup, which can be overridden via environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `SELENIUM_BASE_URL` | `http://localhost:5173` | Frontend application root URL |
| `SELENIUM_HEADLESS` | `true` | Runs Chrome in headless mode (`true` or `false`) |
| `SELENIUM_DEFAULT_TIMEOUT` | `10` | Explicit wait timeout in seconds |
| `SELENIUM_BROWSER_BINARY` | *(auto-detected)* | Path to `chrome.exe` if not in system PATH |
| `SELENIUM_ADMIN_EMAIL` | `admin@lexcore.com` | Administrator user email |
| `SELENIUM_ADMIN_PASSWORD` | `LexCore@Demo1` | Administrator user password |
| `SELENIUM_CLIENT_EMAIL` | `client@lexcore.com` | Client portal user email |
| `SELENIUM_CLIENT_PASSWORD` | `LexCore@Demo1` | Client portal user password |
| `SELENIUM_LAWYER_EMAIL` | `senior@lexcore.com` | Senior lawyer user email |
| `SELENIUM_LAWYER_PASSWORD` | `LexCore@Demo1` | Senior lawyer user password |
| `SELENIUM_PARALEGAL_EMAIL` | `paralegal@lexcore.com` | Paralegal user email |
| `SELENIUM_PARALEGAL_PASSWORD` | `LexCore@Demo1` | Paralegal user password |

---

## Running the Tests

Execute tests from the project root directory:

### Run all Selenium E2E tests:
```powershell
.\backend\venv\Scripts\python.exe -m pytest tests/selenium -v
```

### Run a specific test suite:
```powershell
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_auth.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_consultations.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_cases.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_documents.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_tasks.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_calendar.py -v
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_appointments.py -v
```

### Run a specific individual test case:
```powershell
# Run only TC-AUTH-01
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_auth.py -k "test_tc_auth_01_valid_client_login" -v

# Run only TC-TASK-01
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_tasks.py -k "test_tc_task_01_create_task_modal_accessible" -v
```

### Run with visible Chrome browser (Live Visual Demonstration):
```powershell
# 1. Disable headless mode
$env:SELENIUM_HEADLESS="false"

# 2. (Optional) Keep browser open for 2 seconds after test finishes so you can see the result
$env:SELENIUM_DEMO_DELAY="2"

# 3. Run any test
.\backend\venv\Scripts\python.exe -m pytest tests/selenium/test_auth.py -k "test_tc_auth_01_valid_client_login" -v

# 4. Turn headless mode back on when done
Remove-Item Env:SELENIUM_HEADLESS
Remove-Item Env:SELENIUM_DEMO_DELAY
```

---

## Automated Failure Screenshots

Whenever an assertion or interaction fails:
- A full-screen PNG screenshot is automatically saved to `tests/selenium/screenshots/`.
- File naming format: `{test_name}_{YYYYMMDD_HHMMSS}_failure.png`.
- The terminal output details the failing test, current URL, and screenshot location.

---

## Planned Availability Test Specifications (TC-AVAIL)

*Note: The lawyer availability and slot booking engine is undergoing independent module finalization. The following specifications are planned for automation once availability endpoints are fully deployed:*

- **TC-AVAIL-01**: Lawyer opens availability settings.
- **TC-AVAIL-02**: Lawyer configures consultation duration (e.g. 30/60 minutes).
- **TC-AVAIL-03**: Lawyer configures weekly recurring availability.
- **TC-AVAIL-04**: Lawyer blocks a specific time window.
- **TC-AVAIL-05**: Lawyer blocks a full date.
- **TC-AVAIL-06**: Client views available slot options on booking modal.
- **TC-AVAIL-07**: Blocked slot cannot be selected or booked.
- **TC-AVAIL-08**: Confirmed appointment automatically removes the occupied slot.
- **TC-AVAIL-09**: Double booking is prevented across concurrent requests.
