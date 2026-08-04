import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function listEmployees(access) {
  const { data } = await api.get('/users/', authHeaders(access));
  return data;
}

export async function createEmployee(access, payload) {
  const { data } = await api.post('/users/', payload, authHeaders(access));
  return data;
}

export async function updateEmployee(access, id, payload) {
  const { data } = await api.patch(`/users/${id}/`, payload, authHeaders(access));
  return data;
}

export async function deleteEmployee(access, id) {
  const { data } = await api.delete(`/users/${id}/`, authHeaders(access));
  return data;
}

export async function setEmployeeActive(access, id, isActive) {
  const { data } = await api.post(
    `/users/${id}/set-active/`,
    { is_active: isActive },
    authHeaders(access)
  );
  return data;
}

export async function forceResetEmployeePassword(access, id) {
  const { data } = await api.post(
    `/users/${id}/force-reset-password/`,
    {},
    authHeaders(access)
  );
  return data;
}

export { getErrorMessage };
