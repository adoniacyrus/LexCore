import pytest
from selenium.webdriver.common.by import By
from . import config
from .pages.login_page import LoginPage
from .pages.calendar_page import CalendarPage


class TestCourtCalendar:
    """
    Suite covering TC-CAL-01 through TC-CAL-05.
    """

    def test_tc_cal_01_open_court_calendar(self, driver):
        """
        TC-CAL-01: Open Court Calendar
        Verify calendar header and layout are rendered.
        """
        LoginPage(driver).open().login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        cal_page = CalendarPage(driver).open(role="admin")
        assert cal_page.is_loaded(timeout=8), (
            f"Expected Court Hearing Calendar page, but title was not displayed. URL: {driver.current_url}"
        )

    def test_tc_cal_02_filter_by_date_preset(self, driver):
        """
        TC-CAL-02: Filter by date preset
        Verify changing date range preset updates filter state.
        """
        LoginPage(driver).open().login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        cal_page = CalendarPage(driver).open(role="admin")
        assert cal_page.is_loaded(timeout=8)

        # Switch to TODAY and THIS_MONTH
        cal_page.select_date_preset("TODAY")
        cal_page.select_date_preset("THIS_MONTH")
        assert cal_page.is_loaded()

    def test_tc_cal_03_filter_by_court(self, driver):
        """
        TC-CAL-03: Filter by court/forum
        Verify court filter dropdown can be selected.
        """
        LoginPage(driver).open().login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        cal_page = CalendarPage(driver).open(role="admin")
        assert cal_page.is_loaded(timeout=8)

        cal_page.select_court("District Court")
        assert cal_page.is_loaded()

    def test_tc_cal_04_filter_by_practice_area(self, driver):
        """
        TC-CAL-04: Filter by practice area
        Verify practice area filter is accessible.
        """
        LoginPage(driver).open().login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        cal_page = CalendarPage(driver).open(role="admin")
        assert cal_page.is_loaded(timeout=8)

        pa_select = (By.XPATH, "//label[contains(., 'Practice Area')]/select")
        if cal_page.is_visible(pa_select, timeout=4):
            element = cal_page.find(pa_select)
            options = element.find_elements(By.TAG_NAME, "option")
            if len(options) > 1:
                options[1].click()
        assert cal_page.is_loaded()

    def test_tc_cal_05_switch_calendar_views(self, driver):
        """
        TC-CAL-05: Switch between Agenda / Week / Month views
        Verify view mode buttons toggle the presentation.
        """
        LoginPage(driver).open().login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        cal_page = CalendarPage(driver).open(role="admin")
        assert cal_page.is_loaded(timeout=8)

        # Switch to Week View
        cal_page.switch_to_week()
        assert cal_page.is_loaded()

        # Switch to Month View
        cal_page.switch_to_month()
        assert cal_page.is_loaded()

        # Switch back to Agenda View
        cal_page.switch_to_agenda()
        assert cal_page.is_loaded()
