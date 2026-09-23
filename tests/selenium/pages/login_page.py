from selenium.webdriver.common.by import By
from .base_page import BasePage


class LoginPage(BasePage):
    PATH = "/login"

    # Locators
    EMAIL_INPUT = (By.CSS_SELECTOR, "input[name='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[name='password']")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button.auth-submit")
    ERROR_ALERT = (By.CSS_SELECTOR, "p.auth-error[role='alert']")
    INVALID_FEEDBACK = (By.CSS_SELECTOR, ".invalid-feedback")
    BRAND_TITLE = (By.CSS_SELECTOR, ".auth-sheet-firm")

    def open(self):
        super().open(self.PATH)
        self.wait_for_page_ready()
        return self

    def wait_for_page_ready(self):
        self.find_visible(self.EMAIL_INPUT)
        return self

    def enter_email(self, email):
        self.type_text(self.EMAIL_INPUT, email)
        return self

    def enter_password(self, password):
        self.type_text(self.PASSWORD_INPUT, password)
        return self

    def click_login(self):
        self.click(self.SUBMIT_BUTTON)
        return self

    def login(self, email, password, wait_for_redirect=True):
        self.enter_email(email)
        self.enter_password(password)
        self.click_login()
        if wait_for_redirect:
            self.wait.until(lambda d: "/login" not in d.current_url)
        return self

    def get_error_message(self, timeout=5):
        if self.is_visible(self.ERROR_ALERT, timeout=timeout):
            return self.get_text(self.ERROR_ALERT)
        if self.is_visible(self.INVALID_FEEDBACK, timeout=timeout):
            return self.get_text(self.INVALID_FEEDBACK)
        return ""

    def is_error_displayed(self, timeout=5):
        return self.is_visible(self.ERROR_ALERT, timeout=timeout) or self.is_visible(
            self.INVALID_FEEDBACK, timeout=timeout
        )
