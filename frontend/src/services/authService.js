import api from './api';

/**
 * Flatten Django REST Framework error payloads into a single message.
 */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error.response) {
    return 'Unable to reach the server. Please try again.';
  }

  const { status, data } = error.response;

  if (status >= 500) {
    return 'Server error. Please try again later.';
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    if (status === 401) return 'Invalid credentials or session expired.';
    if (status === 400) return 'Invalid request. Please check your details.';
    return fallback;
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => (typeof item === 'string' ? item : item?.msg || String(item))).join(' ');
  }

  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors.join(' ');
  }

  const fieldMessages = Object.entries(data)
    .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
    .flatMap(([key, value]) => {
      const messages = Array.isArray(value) ? value : [value];
      return messages
        .filter(Boolean)
        .map((msg) => (typeof msg === 'string' ? `${formatFieldLabel(key)}: ${msg}` : String(msg)));
    });

  if (fieldMessages.length) {
    return fieldMessages.join(' ');
  }

  if (status === 401) return 'Invalid credentials or session expired.';
  if (status === 400) return 'Invalid request. Please check your details.';
  return fallback;
}

function formatFieldLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function register({ full_name, email, phone_number, password, confirm_password }) {
  const { data } = await api.post('/auth/register/', {
    full_name,
    email,
    phone_number,
    password,
    confirm_password,
  });
  return data;
}

export async function login({ email, password }) {
  const { data } = await api.post('/auth/login/', { email, password });
  return data;
}

export async function logout({ refresh, access }) {
  const { data } = await api.post(
    '/auth/logout/',
    { refresh },
    {
      headers: {
        Authorization: `Bearer ${access}`,
      },
    }
  );
  return data;
}

export async function getCurrentUser(access) {
  const { data } = await api.get('/auth/me/', {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  });
  return data;
}

/**
 * Exchange a Google ID token for LexCore JWTs.
 * intent: "login" | "register"
 */
export async function googleAuth({ id_token, intent }) {
  const { data } = await api.post('/auth/google/', {
    id_token,
    credential: id_token,
    intent,
  });
  return data;
}

export async function forgotPassword({ email }) {
  const { data } = await api.post('/auth/forgot-password/', { email });
  return data;
}

export async function resetPassword({ uid, token, password, confirm_password }) {
  const { data } = await api.post('/auth/reset-password/', {
    uid,
    token,
    password,
    confirm_password,
  });
  return data;
}

export async function changePassword(access, {
  current_password,
  new_password,
  confirm_password,
}) {
  const { data } = await api.post(
    '/auth/change-password/',
    { current_password, new_password, confirm_password },
    {
      headers: {
        Authorization: `Bearer ${access}`,
      },
    }
  );
  return data;
}
