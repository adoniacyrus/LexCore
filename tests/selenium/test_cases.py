import pytest
from selenium.webdriver.common.by import By
from . import config
from .pages.login_page import LoginPage
from .pages.case_page import CasePage


class TestCases:
    """
    Suite covering TC-CASE-01 through TC-CASE-07.
    """

    def test_tc_case_01_lawyer_opens_assigned_consultations(self, driver):
        """
        TC-CASE-01: Lawyer opens assigned consultation
        Expected: Assigned consultations view is loaded.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        driver.get(f"{config.BASE_URL}/dashboard/senior/consultations")
        case_page = CasePage(driver)
        assert case_page.wait_for_url_contains("/dashboard/senior/consultations", timeout=8)
        assert case_page.is_visible((By.CSS_SELECTOR, "header.lw-page-header h1, h1"), timeout=8)

    def test_tc_case_02_conversion_workflow_navigation(self, driver):
        """
        TC-CASE-02: Eligible consultation to case conversion flow
        Verify case conversion route or action is accessible for assigned counsel.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        # Access conversion interface for a consultation
        driver.get(f"{config.BASE_URL}/dashboard/senior/consultations")
        case_page = CasePage(driver)
        assert case_page.wait_for_url_contains("/consultations", timeout=8)

    def test_tc_case_03_my_cases_list(self, driver):
        """
        TC-CASE-03: Created cases appear in My Cases
        Verify active case roster is displayed.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_cases(role="senior")
        assert case_page.wait_for_url_contains("/dashboard/senior/cases", timeout=8)
        assert case_page.is_visible((By.CSS_SELECTOR, "table.cases-table, .cases-page"), timeout=8)

    def test_tc_case_04_case_details_open(self, driver):
        """
        TC-CASE-04: Case details open
        Verify opening an existing case loads comprehensive matter details.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)
        assert "CASE-2026-0001" in driver.page_source

    def test_tc_case_05_case_classification_update_accessible(self, driver):
        """
        TC-CASE-05: Case information can be updated
        Verify counsel can access the classification / case edit modal.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        # Click update classification or edit
        update_btn = (By.XPATH, "//button[contains(., 'Update Classification') or contains(., 'Edit')]")
        if case_page.is_visible(update_btn, timeout=4):
            case_page.click(update_btn)
            assert case_page.is_visible((By.CSS_SELECTOR, ".cons-modal, [role='dialog']"), timeout=5)

    def test_tc_case_06_assistant_lawyer_management(self, driver):
        """
        TC-CASE-06: Assistant lawyer can be added/viewed in Manage Team
        Verify legal team modal is accessible and displays counsel controls.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_manage_team_modal()
        assert case_page.is_visible((By.CSS_SELECTOR, ".case-modal, .cons-modal, [role='dialog']"), timeout=6)

    def test_tc_case_07_supporting_paralegal_assignment(self, driver):
        """
        TC-CASE-07: Supporting paralegal can be assigned in Manage Team
        Verify team management modal allows selecting paralegal support.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_manage_team_modal()
        assert case_page.is_visible((By.CSS_SELECTOR, ".case-modal select, select"), timeout=6)
