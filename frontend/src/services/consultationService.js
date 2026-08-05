import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function createConsultation(access, payload) {
  const { data } = await api.post('/consultations/', payload, authHeaders(access));
  return data;
}

export async function listMyConsultations(access) {
  const { data } = await api.get('/consultations/my/', authHeaders(access));
  return data;
}

export { getErrorMessage };
