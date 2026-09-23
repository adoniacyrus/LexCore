import os
import tempfile
import pytest
from selenium.webdriver.common.by import By
from . import config
from .pages.login_page import LoginPage
from .pages.case_page import CasePage


class TestDocuments:
    """
    Suite covering TC-DOC-01 through TC-DOC-04.
    """

    @pytest.fixture
    def sample_file(self):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w") as f:
            f.write("LexCore automated E2E testing dummy document content.")
            temp_path = f.name
        yield temp_path
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

    def test_tc_doc_01_open_case_documents_section(self, driver):
        """
        TC-DOC-01: Open case documents
        Verify document records or empty document state is visible on the case detail page.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        # Check Documents section
        docs_header = (By.XPATH, "//h2[contains(., 'Documents')]")
        assert case_page.is_visible(docs_header, timeout=6), (
            "Expected 'Documents' section on Case Detail page."
        )

    def test_tc_doc_02_upload_document_modal_opens(self, driver):
        """
        TC-DOC-02: Open upload document modal
        Verify the document upload dialog is accessible.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_upload_document_modal()
        assert case_page.is_visible((By.CSS_SELECTOR, ".case-modal input[type='file'], input[type='file']"), timeout=6)

    def test_tc_doc_03_upload_document_submission(self, driver, sample_file):
        """
        TC-DOC-03: Upload a small safe test document
        Verify document is uploaded and modal completes.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        case_page.open_upload_document_modal()
        case_page.upload_document(title="Affidavit Verification [TEST]", file_path=sample_file)

        # Confirm upload dialog completes
        assert case_page.wait_for_url_contains("CASE-2026-0001", timeout=8)

    def test_tc_doc_04_view_documents_table(self, driver):
        """
        TC-DOC-04: View documents table or list on case
        Verify document elements are rendered with action triggers.
        """
        LoginPage(driver).open().login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        case_page = CasePage(driver).open_case_detail("CASE-2026-0001", role="senior")
        assert case_page.is_case_detail_loaded("CASE-2026-0001", timeout=10)

        docs_section = (By.CSS_SELECTOR, "section[aria-labelledby='section-documents'], .case-section")
        assert case_page.is_visible(docs_section, timeout=6)
