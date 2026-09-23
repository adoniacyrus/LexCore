import datetime
import logging
from pathlib import Path
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from . import config

logger = logging.getLogger(__name__)


def pytest_addoption(parser):
    parser.addoption(
        "--headed",
        action="store_true",
        default=False,
        help="Run tests with a visible Google Chrome browser window",
    )
    parser.addoption(
        "--demo-delay",
        action="store",
        type=float,
        default=0.0,
        help="Seconds to keep browser open after each test for visual inspection",
    )


def build_chrome_options(headed=False):
    options = Options()
    # If --headed is passed on CLI or SELENIUM_HEADLESS=false, disable headless mode
    is_headless = config.HEADLESS and not headed
    if is_headless:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-extensions")
    options.add_argument("--ignore-certificate-errors")

    if config.CHROME_BINARY:
        options.binary_location = config.CHROME_BINARY

    return options


@pytest.fixture(scope="function")
def driver(request):
    """
    Initializes and provides a fresh Google Chrome driver instance per test.
    Automatically captures a screenshot upon test failure.
    """
    is_headed = request.config.getoption("--headed", default=False)
    options = build_chrome_options(headed=is_headed)
    driver_instance = webdriver.Chrome(options=options)
    driver_instance.implicitly_wait(0)

    # Attach driver to test node so the report hook can access it
    request.node._driver = driver_instance

    yield driver_instance

    # Optional pause for visual demonstrations (in seconds)
    import os
    import time
    cli_delay = request.config.getoption("--demo-delay", default=0.0)
    env_delay = float(os.getenv("SELENIUM_DEMO_DELAY", "0"))
    demo_delay = max(cli_delay, env_delay)
    if demo_delay > 0:
        time.sleep(demo_delay)

    try:
        driver_instance.quit()
    except Exception as exc:
        logger.warning(f"Error closing browser driver: {exc}")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    Hook to capture a screenshot when a test fails during execution.
    """
    outcome = yield
    report = outcome.get_result()

    if report.when == "call" and report.failed:
        driver_instance = getattr(item, "_driver", None)
        if driver_instance:
            try:
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                sanitized_name = item.name.replace("[", "_").replace("]", "_").replace("/", "_")
                filename = f"{sanitized_name}_{timestamp}_failure.png"
                filepath = config.SCREENSHOT_DIR / filename

                driver_instance.save_screenshot(str(filepath))

                current_url = "unknown"
                try:
                    current_url = driver_instance.current_url
                except Exception:
                    pass

                print(
                    f"\n[SELENIUM TEST FAILURE]\n"
                    f"Test: {item.nodeid}\n"
                    f"Current URL: {current_url}\n"
                    f"Screenshot saved to: {filepath}\n"
                )
            except Exception as e:
                logger.error(f"Failed to capture screenshot for {item.name}: {e}")
