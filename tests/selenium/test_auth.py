import pytest
from . import config
from .pages.login_page import LoginPage
from .pages.admin_dashboard_page import AdminDashboardPage
from .pages.client_dashboard_page import ClientDashboardPage


class TestAuthentication:
    """
    Suite covering TC-AUTH-01 through TC-AUTH-07.
    """

    def test_tc_auth_01_valid_client_login(self, driver):
        """
        TC-AUTH-01: Valid Client Login
        1. Open login page.
        2. Enter valid client credentials.
        3. Submit.
        4. Wait for dashboard.
        5. Verify Client Dashboard is displayed.
        """
        login_page = LoginPage(driver).open()
        login_page.login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        client_dash = ClientDashboardPage(driver)
        assert client_dash.is_loaded(timeout=10), (
            f"Expected Client Dashboard (/dashboard/client), but current URL is {driver.current_url}"
        )

    def test_tc_auth_02_invalid_login(self, driver):
        """
        TC-AUTH-02: Invalid Login
        1. Open login.
        2. Enter invalid credentials.
        3. Submit.
        4. Wait for error.
        5. Verify login fails and appropriate error is displayed.
        """
        login_page = LoginPage(driver).open()
        login_page.login("invalid_user_999@example.com", "WrongPassword!123", wait_for_redirect=False)

        assert login_page.is_error_displayed(timeout=6), (
            f"Expected login error message to be displayed, but none appeared. Current URL: {driver.current_url}"
        )

    def test_tc_auth_03_admin_login(self, driver):
        """
        TC-AUTH-03: Admin Login
        Verify admin reaches the Admin Dashboard.
        """
        login_page = LoginPage(driver).open()
        login_page.login(config.ADMIN_EMAIL, config.ADMIN_PASSWORD)

        admin_dash = AdminDashboardPage(driver)
        assert admin_dash.is_loaded(timeout=10), (
            f"Expected Admin Dashboard (/dashboard/admin), but current URL is {driver.current_url}"
        )

    def test_tc_auth_04_lawyer_login(self, driver):
        """
        TC-AUTH-04: Lawyer Login
        Verify correct lawyer dashboard opens.
        """
        login_page = LoginPage(driver).open()
        login_page.login(config.LAWYER_EMAIL, config.LAWYER_PASSWORD)

        # Senior or junior lawyer dashboard
        assert login_page.wait_for_url_contains("/dashboard/senior", timeout=10) or login_page.wait_for_url_contains(
            "/dashboard/junior", timeout=10
        ), f"Expected lawyer dashboard route, but current URL is {driver.current_url}"

    def test_tc_auth_05_paralegal_login(self, driver):
        """
        TC-AUTH-05: Paralegal Login
        Verify correct paralegal dashboard opens.
        """
        login_page = LoginPage(driver).open()
        login_page.login(config.PARALEGAL_EMAIL, config.PARALEGAL_PASSWORD)

        assert login_page.wait_for_url_contains("/dashboard/paralegal", timeout=10), (
            f"Expected Paralegal Dashboard (/dashboard/paralegal), but current URL is {driver.current_url}"
        )

    def test_tc_auth_06_protected_route_unauthenticated(self, driver):
        """
        TC-AUTH-06: Protected Route
        Without logging in, open a protected dashboard URL.
        Expected: User is redirected to the authentication page or blocked according to current behavior.
        """
        driver.get(f"{config.BASE_URL}/dashboard/admin")
        login_page = LoginPage(driver)
        assert login_page.wait_for_url_contains("/login", timeout=8), (
            f"Expected redirect to /login for unauthenticated request, but current URL is {driver.current_url}"
        )

    def test_tc_auth_07_logout_flow(self, driver):
        """
        TC-AUTH-07: Logout Test
        1. Login.
        2. Reach dashboard.
        3. Click Logout.
        4. Verify authentication page is shown.
        5. Attempt to access a protected page.
        Expected: Protected access is denied according to session behavior.
        """
        login_page = LoginPage(driver).open()
        login_page.login(config.CLIENT_EMAIL, config.CLIENT_PASSWORD)

        client_dash = ClientDashboardPage(driver)
        assert client_dash.is_loaded(timeout=10)

        client_dash.logout()
        assert login_page.wait_for_url_contains("/login", timeout=8)

        # Attempt to access protected dashboard after logging out
        driver.get(f"{config.BASE_URL}/dashboard/client")
        assert login_page.wait_for_url_contains("/login", timeout=8), (
            f"Expected redirect back to /login after logout, but current URL is {driver.current_url}"
        )
