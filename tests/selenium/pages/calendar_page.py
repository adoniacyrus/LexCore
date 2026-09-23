from selenium.webdriver.common.by import By
from .base_page import BasePage


class CalendarPage(BasePage):
    # Locators
    PAGE_TITLE = (By.CSS_SELECTOR, "header.lw-page-header h1")
    STATS_BAR = (By.CSS_SELECTOR, ".calendar-stats")
    
    # View toggles
    AGENDA_VIEW_BTN = (By.XPATH, "//button[contains(., 'Agenda View')]")
    WEEK_VIEW_BTN = (By.XPATH, "//button[contains(., 'Week View')]")
    MONTH_VIEW_BTN = (By.XPATH, "//button[contains(., 'Month View')]")
    
    # Filter dropdowns
    DATE_PRESET_SELECT = (By.CSS_SELECTOR, ".calendar-filters-grid label:nth-of-type(1) select")
    COURT_SELECT = (By.XPATH, "//label[contains(., 'Court')]/select")
    PRACTICE_AREA_SELECT = (By.XPATH, "//label[contains(., 'Practice Area')]/select")
    
    # Calendar Views Containers
    AGENDA_CONTAINER = (By.CSS_SELECTOR, ".calendar-agenda-view, .calendar-timeline, .cases-table")
    WEEK_CONTAINER = (By.CSS_SELECTOR, ".calendar-week-view, .calendar-grid, div")
    MONTH_CONTAINER = (By.CSS_SELECTOR, ".calendar-month-grid, div")

    def open(self, role="admin"):
        super().open(f"/dashboard/{role}/calendar")
        self.wait_for_page_ready()
        return self

    def wait_for_page_ready(self, timeout=8):
        self.wait_for_url_contains("/calendar", timeout=timeout)
        self.find_visible(self.PAGE_TITLE, timeout=timeout)
        return self

    def is_loaded(self, timeout=8):
        return self.is_visible(self.PAGE_TITLE, timeout=timeout)

    def switch_to_agenda(self):
        self.click(self.AGENDA_VIEW_BTN)
        return self

    def switch_to_week(self):
        self.click(self.WEEK_VIEW_BTN)
        return self

    def switch_to_month(self):
        self.click(self.MONTH_VIEW_BTN)
        return self

    def select_date_preset(self, preset_value):
        if self.is_visible(self.DATE_PRESET_SELECT, timeout=3):
            self.select_dropdown_by_value(self.DATE_PRESET_SELECT, preset_value)
        return self

    def select_court(self, court_value):
        if self.is_visible(self.COURT_SELECT, timeout=3):
            self.select_dropdown_by_value(self.COURT_SELECT, court_value)
        return self
