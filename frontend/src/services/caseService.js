import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function listCases(access) {
  const { data } = await api.get('/cases/', authHeaders(access));
  return data;
}

export async function getCaseDetail(access, id) {
  const { data } = await api.get(`/cases/${id}/`, authHeaders(access));
  return data;
}

export async function convertConsultationToCase(access, payload) {
  const { data } = await api.post('/cases/convert/', payload, authHeaders(access));
  return data;
}

export async function listActiveParalegals(access) {
  const { data } = await api.get('/cases/active-paralegals/', authHeaders(access));
  return data;
}

export async function updateCase(access, id, payload) {
  const { data } = await api.patch(`/cases/${id}/`, payload, authHeaders(access));
  return data;
}

export { getErrorMessage };
