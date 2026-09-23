from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException
from .. import config


class BasePage:
    def __init__(self, driver, timeout=None):
        self.driver = driver
        self.timeout = timeout or config.DEFAULT_TIMEOUT
        self.wait = WebDriverWait(self.driver, self.timeout)

    def open(self, path=""):
        url = f"{config.BASE_URL}/{path.lstrip('/')}"
        self.driver.get(url)
        return self

    @property
    def current_url(self):
        return self.driver.current_url

    def find(self, locator, timeout=None):
        wait = WebDriverWait(self.driver, timeout or self.timeout)
        return wait.until(EC.presence_of_element_located(locator))

    def find_visible(self, locator, timeout=None):
        wait = WebDriverWait(self.driver, timeout or self.timeout)
        return wait.until(EC.visibility_of_element_located(locator))

    def find_all(self, locator, timeout=None):
        wait = WebDriverWait(self.driver, timeout or self.timeout)
        try:
            return wait.until(EC.presence_of_all_elements_located(locator))
        except TimeoutException:
            return []

    def find_clickable(self, locator, timeout=None):
        wait = WebDriverWait(self.driver, timeout or self.timeout)
        return wait.until(EC.element_to_be_clickable(locator))

    def click(self, locator, timeout=None):
        element = self.find_clickable(locator, timeout=timeout)
        try:
            element.click()
        except ElementClickInterceptedException:
            # Scroll element into center and retry or use JS click if blocked by an overlay animation
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            try:
                element.click()
            except Exception:
                self.driver.execute_script("arguments[0].click();", element)
        return self

    def type_text(self, locator, text, clear_first=True, timeout=None):
        element = self.find_visible(locator, timeout=timeout)
        if clear_first:
            element.clear()
        element.send_keys(text)
        return self

    def get_text(self, locator, timeout=None):
        element = self.find_visible(locator, timeout=timeout)
        return element.text

    def is_visible(self, locator, timeout=3):
        try:
            self.find_visible(locator, timeout=timeout)
            return True
        except (TimeoutException, NoSuchElementException):
            return False

    def wait_for_url_contains(self, fragment, timeout=None):
        wait = WebDriverWait(self.driver, timeout or self.timeout)
        return wait.until(EC.url_contains(fragment))

    def select_dropdown_by_value(self, locator, value, timeout=None):
        element = self.find_visible(locator, timeout=timeout)
        select = Select(element)
        select.select_by_value(str(value))
        return self

    def select_dropdown_by_visible_text(self, locator, text, timeout=None):
        element = self.find_visible(locator, timeout=timeout)
        select = Select(element)
        select.select_by_visible_text(text)
        return self
