from selenium.webdriver.common.by import By
from .base_page import BasePage


class AdminDashboardPage(BasePage):
    PATH = "/dashboard/admin"

    # Locators
    SECTION_TAG = (By.CSS_SELECTOR, ".admin-dash .section-tag-gold")
    DASHBOARD_TITLE = (By.CSS_SELECTOR, "h1.admin-dash__title")
    SIDEBAR_CONSULTATIONS = (By.CSS_SELECTOR, "a.lw-sidebar__link[href*='/dashboard/admin/consultations']")
    SIDEBAR_CASES = (By.CSS_SELECTOR, "a.lw-sidebar__link[href*='/dashboard/admin/cases']")
    SIDEBAR_CALENDAR = (By.CSS_SELECTOR, "a.lw-sidebar__link[href*='/dashboard/admin/calendar']")
    SIDEBAR_LOGOUT = (By.CSS_SELECTOR, "button.lw-sidebar__logout")

    def open(self):
        super().open(self.PATH)
        return self

    def is_loaded(self, timeout=8):
        return (
            self.wait_for_url_contains(self.PATH, timeout=timeout)
            and self.is_visible(self.DASHBOARD_TITLE, timeout=timeout)
        )

    def open_consultations(self):
        self.click(self.SIDEBAR_CONSULTATIONS)
        self.wait_for_url_contains("/dashboard/admin/consultations")
        return self

    def open_cases(self):
        self.click(self.SIDEBAR_CASES)
        self.wait_for_url_contains("/dashboard/admin/cases")
        return self

    def open_calendar(self):
        self.click(self.SIDEBAR_CALENDAR)
        self.wait_for_url_contains("/dashboard/admin/calendar")
        return self

    def logout(self):
        self.click(self.SIDEBAR_LOGOUT)
        self.wait_for_url_contains("/login")
        return self
