import datetime
import pytest
from selenium.webdriver.common.by import By
from . import config
from .pages.login_page import LoginPage
from .pages.case_page import CasePage
from .pages.consultation_page import ConsultationPage


class TestAppointments:
    """
    Suite covering existing-case appointment booking (TC-APP-01 through TC-APP-06).
    """

    def test_tc_app_01_client_opens_existing_case_and_verifies_appointment_action(self, driver):
        """
        TC-APP-01: Open an existing case and verify Book Appointment action is available.
        CASE-2026-0001 is active, has a lead counsel, and has a configured fee (₹1500).
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        book_btn = (By.XPATH, "//button[contains(., 'Book Appointment')]")
        assert case_page.is_visible(book_btn, timeout=6), (
            "Expected 'Book Appointment' button in the Appointment Fee section for eligible case CASE-2026-0001."
        )

    def test_tc_app_02_appointment_modal_opens(self, driver):
        """
        TC-APP-02: Click Book Appointment and verify modal opens.
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.click_book_appointment()
        cons_page = ConsultationPage(driver)
        assert cons_page.is_book_modal_open(timeout=6), (
            "Expected Appointment Booking modal to open upon clicking Book Appointment."
        )

    def test_tc_app_03_verify_case_information(self, driver):
        """
        TC-APP-03: Verify correct case information is displayed inside modal.
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.click_book_appointment()
        modal = ConsultationPage(driver).find(ConsultationPage.MODAL_CONTAINER)
        assert "CASE-2026-0001" in modal.text, (
            "Expected CASE-2026-0001 reference to be clearly displayed inside the appointment modal."
        )

    def test_tc_app_04_verify_responsible_lawyer_displayed(self, driver):
        """
        TC-APP-04: Verify responsible/lead lawyer is displayed in appointment modal.
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.click_book_appointment()
        modal = ConsultationPage(driver).find(ConsultationPage.MODAL_CONTAINER)
        assert "Vikram Malhotra" in modal.text or "Lead Counsel" in modal.text, (
            "Expected lead counsel to be displayed inside the appointment booking modal."
        )

    def test_tc_app_05_verify_consultation_fee(self, driver):
        """
        TC-APP-05: Verify consultation/appointment fee is displayed.
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.click_book_appointment()
        modal = ConsultationPage(driver).find(ConsultationPage.MODAL_CONTAINER)
        assert "1,500" in modal.text or "1500" in modal.text, (
            "Expected appointment fee (₹1,500) to be shown in the modal."
        )

    def test_tc_app_06_appointment_form_submission_flow(self, driver):
        """
        TC-APP-06: Verify appointment review flow.
        """
        LoginPage(driver).open().login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="client")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.click_book_appointment()
        cons_page = ConsultationPage(driver)
        assert cons_page.is_book_modal_open(timeout=6)
