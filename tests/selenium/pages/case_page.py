import time
from selenium.webdriver.common.by import By
from .base_page import BasePage


class CasePage(BasePage):
    # Locators
    CASE_HEADER_TITLE = (By.CSS_SELECTOR, "header.lw-page-header h1, h1")
    CASE_TABLE_ROWS = (By.CSS_SELECTOR, "table.cases-table tbody tr")
    DETAIL_CASE_TITLE = (By.CSS_SELECTOR, ".case-section h2, .case-header h1, h1")
    
    # Team Modal
    MANAGE_TEAM_BUTTON = (By.XPATH, "//button[contains(., 'Manage Team')]")
    TEAM_MODAL = (By.CSS_SELECTOR, ".case-modal, .cons-modal, [role='dialog']")
    PARALEGAL_SELECT = (By.CSS_SELECTOR, "select[name='supporting_paralegal'], select")
    UPDATE_TEAM_SUBMIT = (By.CSS_SELECTOR, ".case-modal button[type='submit'], .cons-modal button[type='submit'], button[type='submit']")
    
    # Documents
    UPLOAD_DOC_BUTTON = (By.XPATH, "//button[contains(., 'Upload Document')]")
    DOC_MODAL = (By.CSS_SELECTOR, ".case-modal, .cons-modal, [role='dialog']")
    DOC_TITLE_INPUT = (By.CSS_SELECTOR, "input[name='title'], input[placeholder*='title'], input[placeholder*='Affidavit'], input[type='text']")
    DOC_FILE_INPUT = (By.CSS_SELECTOR, "input[type='file']")
    DOC_SUBMIT_BUTTON = (By.CSS_SELECTOR, ".case-modal button[type='submit'], .cons-modal button[type='submit'], button[type='submit']")
    DOC_TABLE_ROWS = (By.CSS_SELECTOR, "table.cases-table tbody tr")
    
    # Tasks
    NEW_TASK_BUTTON = (By.XPATH, "//button[contains(., 'New Task') or contains(., 'Create Task') or contains(., '+ Add Task')]")
    TASK_MODAL = (By.CSS_SELECTOR, ".case-modal, .cons-modal, [role='dialog']")
    TASK_TITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='title'], input[placeholder*='written statement'], input[type='text']")
    TASK_ASSIGNEE_SELECT = (By.CSS_SELECTOR, ".case-modal select, select")
    TASK_DUE_DATE = (By.CSS_SELECTOR, "input[type='date']")
    TASK_SUBMIT_BUTTON = (By.CSS_SELECTOR, ".case-modal button[type='submit'], .cons-modal button[type='submit'], button[type='submit']")
    TASK_CARDS = (By.CSS_SELECTOR, ".case-task-card, .task-row, tr")

    # Client Appointment on Case
    BOOK_APPT_BUTTON = (By.XPATH, "//button[contains(., 'Book Appointment')]")

    def open_cases(self, role="senior"):
        self.open(f"/dashboard/{role}/cases")
        return self

    def open_case_detail(self, case_reference, role="senior"):
        self.open(f"/dashboard/{role}/cases/{case_reference}")
        return self

    def is_case_detail_loaded(self, case_reference=None, timeout=8):
        if case_reference:
            self.wait_for_url_contains(case_reference, timeout=timeout)
        return self.is_visible(self.DETAIL_CASE_TITLE, timeout=timeout)

    def open_manage_team_modal(self):
        self.click(self.MANAGE_TEAM_BUTTON)
        self.find_visible(self.TEAM_MODAL)
        return self

    def open_upload_document_modal(self):
        self.click(self.UPLOAD_DOC_BUTTON)
        self.find_visible(self.DOC_MODAL)
        return self

    def upload_document(self, title, file_path):
        self.type_text(self.DOC_TITLE_INPUT, title)
        file_input = self.find(self.DOC_FILE_INPUT)
        file_input.send_keys(str(file_path))
        self.click(self.DOC_SUBMIT_BUTTON)
        return self

    def open_create_task_modal(self):
        self.click(self.NEW_TASK_BUTTON)
        self.find_visible(self.TASK_MODAL)
        return self

    def create_task(self, title, due_date_str):
        self.type_text(self.TASK_TITLE_INPUT, title)
        # Select first available team member
        selects = self.find_all((By.CSS_SELECTOR, ".cons-modal select"))
        if selects:
            options = selects[0].find_elements(By.TAG_NAME, "option")
            if len(options) > 1:
                options[1].click()
        date_inputs = self.find_all((By.CSS_SELECTOR, ".cons-modal input[type='date']"))
        if date_inputs:
            date_inputs[0].send_keys(due_date_str)
        self.click(self.TASK_SUBMIT_BUTTON)
        return self

    def click_book_appointment(self):
        self.click(self.BOOK_APPT_BUTTON)
        return self
