import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function listClients(access, params = {}) {
  const { data } = await api.get('/clients/', {
    ...authHeaders(access),
    params,
  });
  return data;
}

export async function createClient(access, payload) {
  const { data } = await api.post('/clients/', payload, authHeaders(access));
  return data;
}

export async function getClient(access, id) {
  const { data } = await api.get(`/clients/${id}/`, authHeaders(access));
  return data;
}

export async function updateClient(access, id, payload) {
  const { data } = await api.patch(`/clients/${id}/`, payload, authHeaders(access));
  return data;
}

export async function deleteClient(access, id) {
  const { data } = await api.delete(`/clients/${id}/`, authHeaders(access));
  return data;
}

export async function setClientActive(access, id, isActive) {
  const { data } = await api.post(
    `/clients/${id}/set-active/`,
    { is_active: isActive },
    authHeaders(access)
  );
  return data;
}

export async function forceResetClientPassword(access, id) {
  const { data } = await api.post(
    `/clients/${id}/force-reset-password/`,
    {},
    authHeaders(access)
  );
  return data;
}

export { getErrorMessage };
