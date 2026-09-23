from selenium.webdriver.common.by import By
from .base_page import BasePage


class ConsultationPage(BasePage):
    CLIENT_PATH = "/dashboard/client/consultations"
    ADMIN_PATH = "/dashboard/admin/consultations"

    # Client Modal Locators
    BOOK_BUTTON = (By.CSS_SELECTOR, "header.lw-page-header button.btn-primary, button.btn-primary")
    MODAL_CONTAINER = (By.CSS_SELECTOR, ".cons-modal")
    MODAL_TITLE = (By.CSS_SELECTOR, "#cons-book-title")

    # Form Fields
    RADIO_KNOWS_YES = (By.CSS_SELECTOR, "input[name='knowsPracticeArea'][type='radio']")
    PRACTICE_AREA_SELECT = (By.CSS_SELECTOR, "select[name='practice_area']")
    SUBJECT_INPUT = (By.CSS_SELECTOR, "input[name='subject']")
    DATE_INPUT = (By.CSS_SELECTOR, "input[name='preferred_date']")
    TIME_INPUT = (By.CSS_SELECTOR, "input[name='preferred_time']")
    MODE_SELECT = (By.CSS_SELECTOR, "select[name='consultation_mode']")
    ISSUE_SUMMARY = (By.CSS_SELECTOR, "textarea[name='issue_summary']")
    SUBMIT_FORM_BUTTON = (By.CSS_SELECTOR, ".cons-actions button[type='submit']")
    CANCEL_BUTTON = (By.CSS_SELECTOR, ".cons-actions button.btn-ghost-dark")

    # Validation Feedback
    INVALID_FEEDBACKS = (By.CSS_SELECTOR, ".invalid-feedback, .cons-error")

    # Review Step
    REVIEW_STEP = (By.CSS_SELECTOR, ".cons-review-step")
    REVIEW_TITLE = (By.CSS_SELECTOR, ".cons-review-title")
    REVIEW_FEE = (By.CSS_SELECTOR, ".cons-fee-amount")
    PAY_AND_SUBMIT_BUTTON = (By.CSS_SELECTOR, ".cons-review-step .cons-actions button.btn-primary")

    # Admin Queue Locators
    QUEUE_TITLE = (By.CSS_SELECTOR, "header.lw-page-header h1")
    ADMIN_TABLE_ROWS = (By.CSS_SELECTOR, "table.lw-directory__table tbody tr, table.cons-table tbody tr")
    ADMIN_MANAGE_MODAL = (By.CSS_SELECTOR, ".cons-modal--detail")
    ADMIN_LAWYER_SELECT = (By.CSS_SELECTOR, ".cons-modal--detail select:nth-of-type(2), select")
    ADMIN_SAVE_BUTTON = (By.CSS_SELECTOR, ".cons-modal__actions button.btn-primary")

    def open_client_consultations(self):
        self.open(self.CLIENT_PATH)
        return self

    def open_book_modal(self):
        # Either click button or open with query param
        if self.is_visible(self.BOOK_BUTTON, timeout=3):
            self.click(self.BOOK_BUTTON)
        else:
            self.open(f"{self.CLIENT_PATH}?book=1")
        self.find_visible(self.MODAL_CONTAINER)
        return self

    def is_book_modal_open(self, timeout=5):
        return self.is_visible(self.MODAL_CONTAINER, timeout=timeout)

    def select_knows_practice_area(self, knows=True):
        radios = self.find_all(self.RADIO_KNOWS_YES)
        if radios:
            target = radios[0] if knows else radios[1]
            try:
                target.click()
            except Exception:
                self.driver.execute_script("arguments[0].click();", target)
        return self

    def select_practice_area(self, value=None):
        from selenium.webdriver.support.ui import Select, WebDriverWait
        element = self.find_visible(self.PRACTICE_AREA_SELECT, timeout=6)
        # Wait until options are populated asynchronously from the backend
        WebDriverWait(self.driver, 8).until(
            lambda d: len(element.find_elements(By.TAG_NAME, "option")) > 1
        )
        select_obj = Select(element)
        if value:
            select_obj.select_by_visible_text(value)
        else:
            select_obj.select_by_index(1)
        self.driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", element)
        return self

    def enter_subject(self, subject):
        self.type_text(self.SUBJECT_INPUT, subject)
        return self

    def enter_preferred_date(self, date_str):
        element = self.find_visible(self.DATE_INPUT)
        self.driver.execute_script(
            """
            const el = arguments[0];
            const val = arguments[1];
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            """,
            element,
            date_str,
        )
        return self

    def enter_preferred_time(self, time_str):
        element = self.find_visible(self.TIME_INPUT)
        self.driver.execute_script(
            """
            const el = arguments[0];
            const val = arguments[1];
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            """,
            element,
            time_str,
        )
        return self

    def select_mode(self, mode_value):
        if self.is_visible(self.MODE_SELECT, timeout=2):
            self.select_dropdown_by_value(self.MODE_SELECT, mode_value)
        return self

    def submit_form(self):
        self.click(self.SUBMIT_FORM_BUTTON)
        return self

    def get_validation_errors(self):
        elements = self.find_all(self.INVALID_FEEDBACKS, timeout=2)
        return [el.text.strip() for el in elements if el.text.strip()]

    def is_review_stage_displayed(self, timeout=5):
        return self.is_visible(self.REVIEW_STEP, timeout=timeout) or self.is_visible(
            self.REVIEW_TITLE, timeout=timeout
        )

    def get_review_fee(self):
        return self.get_text(self.REVIEW_FEE)

    def click_pay_and_submit(self):
        self.click(self.PAY_AND_SUBMIT_BUTTON)
        return self

    # Admin methods
    def open_admin_queue(self):
        self.open(self.ADMIN_PATH)
        return self

    def is_queue_loaded(self, timeout=8):
        return self.wait_for_url_contains(self.ADMIN_PATH, timeout=timeout)

    def get_consultation_rows(self):
        return self.find_all(self.ADMIN_TABLE_ROWS)

    def open_first_consultation_manage_modal(self):
        rows = self.get_consultation_rows()
        if rows:
            # Click the row or its manage button
            try:
                btn = rows[0].find_element(By.CSS_SELECTOR, "button, a")
                btn.click()
            except Exception:
                rows[0].click()
            self.find_visible(self.ADMIN_MANAGE_MODAL)
        return self

    def is_admin_modal_open(self, timeout=5):
        return self.is_visible(self.ADMIN_MANAGE_MODAL, timeout=timeout)
