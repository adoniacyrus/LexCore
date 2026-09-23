from selenium.webdriver.common.by import By
from .base_page import BasePage


class ClientDashboardPage(BasePage):
    PATH = "/dashboard/client"

    # Locators
    SECTION_TAG = (By.CSS_SELECTOR, ".admin-dash .section-tag-gold")
    DASHBOARD_TITLE = (By.CSS_SELECTOR, "h1.admin-dash__title")
    BOOK_CONSULTATION_QA = (By.CSS_SELECTOR, "a.admin-qa[href*='/dashboard/client/consultations/book']")
    SIDEBAR_CONSULTATIONS = (By.CSS_SELECTOR, "a.lw-sidebar__link[href*='/dashboard/client/consultations']")
    SIDEBAR_CASES = (By.CSS_SELECTOR, "a.lw-sidebar__link[href*='/dashboard/client/cases']")
    SIDEBAR_LOGOUT = (By.CSS_SELECTOR, "button.lw-sidebar__logout")

    def open(self):
        super().open(self.PATH)
        return self

    def is_loaded(self, timeout=8):
        return (
            self.wait_for_url_contains(self.PATH, timeout=timeout)
            and self.is_visible(self.DASHBOARD_TITLE, timeout=timeout)
        )

    def open_book_consultation(self):
        if self.is_visible(self.BOOK_CONSULTATION_QA, timeout=3):
            self.click(self.BOOK_CONSULTATION_QA)
        else:
            self.open("/dashboard/client/consultations?book=1")
        return self

    def open_my_consultations(self):
        self.click(self.SIDEBAR_CONSULTATIONS)
        self.wait_for_url_contains("/dashboard/client/consultations")
        return self

    def open_my_cases(self):
        self.click(self.SIDEBAR_CASES)
        self.wait_for_url_contains("/dashboard/client/cases")
        return self

    def logout(self):
        self.click(self.SIDEBAR_LOGOUT)
        self.wait_for_url_contains("/login")
        return self
