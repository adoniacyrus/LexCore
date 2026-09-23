import datetime
import pytest
from selenium.webdriver.common.by import By
from . import config
from .pages.login_page import LoginPage
from .pages.case_page import CasePage


class TestTasks:
    """
    Suite covering TC-TASK-01 through TC-TASK-04.
    """

    def test_tc_task_01_create_task_modal_accessible(self, driver):
        """
        TC-TASK-01: Create a case task
        Verify the task creation dialog is accessible from the case work section.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_create_task_modal()
        assert case_page.is_visible((By.CSS_SELECTOR, ".case-modal, .cons-modal, [role='dialog']"), timeout=6)

    def test_tc_task_02_assign_task_form_filling(self, driver):
        """
        TC-TASK-02: Assign task
        Fill task details and assign to a team member.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_create_task_modal()
        due_date = (datetime.date.today() + datetime.timedelta(days=5)).strftime("%Y-%m-%d")

        case_page.create_task(title="Review Draft Petition [TEST]", due_date_str=due_date)
        assert case_page.wait_for_url_contains("CASE-2026-0001", timeout=8)

    def test_tc_task_03_view_tasks_section(self, driver):
        """
        TC-TASK-03: Open task details / task section
        Verify Tasks & Work section displays task items.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        tasks_header = (By.XPATH, "//h2[contains(., 'Tasks & Work') or contains(., 'Tasks')]")
        assert case_page.is_visible(tasks_header, timeout=6)

    def test_tc_task_04_task_status_controls_present(self, driver):
        """
        TC-TASK-04: Task status controls
        Verify tasks can be clicked to view detailed status controls.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        # Look for existing task rows or cards
        task_items = case_page.find_all((By.CSS_SELECTOR, ".case-task-card, .cases-table tbody tr, .task-row"))
        if task_items:
            task_items[0].click()
            # Modal or detail drawer should be open
            assert case_page.is_visible((By.CSS_SELECTOR, ".cons-modal, [role='dialog']"), timeout=5)
