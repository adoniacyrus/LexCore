/**
 * Reusable client-side validators for LexCore auth forms.
 * Backend field errors are mapped via mapDjangoFieldErrors().
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s()-]{10,20}$/;

export function validateFullName(value) {
  const name = String(value ?? '').trim();
  if (!name) return 'Full name is required.';
  if (name.length < 2) return 'Enter at least 2 characters.';
  if (!/^[a-zA-Z\s.'-]+$/.test(name)) return 'Use letters only (spaces and . \' - allowed).';
  return '';
}

export function validateEmail(value) {
  const email = String(value ?? '').trim();
  if (!email) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return '';
}

export function validateMobile(value) {
  const mobile = String(value ?? '').trim();
  if (!mobile) return 'Mobile number is required.';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a valid mobile number (at least 10 digits).';
  if (!PHONE_PATTERN.test(mobile)) return 'Enter a valid mobile number.';
  return '';
}

export function validatePassword(value) {
  const password = String(value ?? '');
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character.';
  return '';
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!String(confirmPassword ?? '')) return 'Please confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return '';
}

export function validateTerms(accepted) {
  if (!accepted) return 'Please accept the Terms & Privacy Policy.';
  return '';
}

export function validateLoginPassword(value) {
  if (!String(value ?? '')) return 'Password is required.';
  return '';
}

/**
 * Password strength for the indicator + checklist.
 * score: 0–3 (matches existing auth-strength bars).
 */
export function getPasswordStrength(password) {
  const value = String(password ?? '');
  const checks = {
    minLength: value.length >= 8,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };

  const met = Object.values(checks).filter(Boolean).length;
  // Map 0–5 rule hits onto the existing 3-segment strength bar.
  const score = met <= 0 ? 0 : met <= 2 ? 1 : met <= 4 ? 2 : 3;

  return { score, checks };
}

export function validateResetPasswordForm({ password, confirmPassword }) {
  return {
    password: validatePassword(password),
    confirmPassword: validateConfirmPassword(password, confirmPassword),
  };
}

export function validateChangePasswordForm({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  return {
    currentPassword: validateLoginPassword(currentPassword),
    newPassword: validatePassword(newPassword),
    confirmPassword: validateConfirmPassword(newPassword, confirmPassword),
  };
}

export function validateForgotPasswordForm({ email }) {
  return {
    email: validateEmail(email),
  };
}

export function validateRegistrationForm(form) {
  return {
    fullName: validateFullName(form.fullName),
    email: validateEmail(form.email),
    mobile: validateMobile(form.mobile),
    password: validatePassword(form.password),
    confirmPassword: validateConfirmPassword(form.password, form.confirmPassword),
    terms: validateTerms(form.terms),
  };
}

export function validateLoginForm({ email, password }) {
  return {
    email: validateEmail(email),
    password: validateLoginPassword(password),
  };
}

export function hasFieldErrors(errors) {
  return Object.values(errors).some(Boolean);
}

/**
 * Map Django / DRF error payloads onto frontend field keys.
 * Returns { fields: { fullName, email, ... }, formError: string }
 */
export function mapDjangoFieldErrors(error, fieldMap = {}) {
  const defaultMap = {
    full_name: 'fullName',
    email: 'email',
    phone_number: 'mobile',
    password: 'password',
    confirm_password: 'confirmPassword',
    non_field_errors: '_form',
    detail: '_form',
    ...fieldMap,
  };

  const fields = {};
  let formError = '';

  const data = error?.response?.data;
  if (!data || typeof data !== 'object' || typeof data === 'string') {
    return { fields, formError };
  }

  Object.entries(data).forEach(([key, value]) => {
    const messages = Array.isArray(value) ? value : [value];
    const text = messages
      .map((msg) => (typeof msg === 'string' ? msg : msg?.msg || String(msg)))
      .filter(Boolean)
      .join(' ');

    if (!text) return;

    const mapped = defaultMap[key] || key;
    if (mapped === '_form') {
      formError = formError ? `${formError} ${text}` : text;
    } else {
      fields[mapped] = text;
    }
  });

  return { fields, formError };
}

function firstMessage(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : '';
}

export function pickFirstFieldError(errors) {
  const entry = Object.entries(errors).find(([, msg]) => Boolean(msg));
  return entry ? firstMessage(entry[1]) : '';
}
