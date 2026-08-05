import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

/* ---- Practice areas ---- */

export async function listPracticeAreas(access) {
  const { data } = await api.get('/consultations/practice-areas/', authHeaders(access));
  return data;
}

export async function createPracticeArea(access, payload) {
  const { data } = await api.post(
    '/consultations/practice-areas/',
    payload,
    authHeaders(access)
  );
  return data;
}

export async function updatePracticeArea(access, id, payload) {
  const { data } = await api.patch(
    `/consultations/practice-areas/${id}/`,
    payload,
    authHeaders(access)
  );
  return data;
}

export async function setPracticeAreaActive(access, id, isActive) {
  const { data } = await api.patch(
    `/consultations/practice-areas/${id}/`,
    { is_active: isActive },
    authHeaders(access)
  );
  return data;
}

export async function deletePracticeArea(access, id) {
  const { data } = await api.delete(
    `/consultations/practice-areas/${id}/`,
    authHeaders(access)
  );
  return data;
}

/* ---- Client ---- */

export async function createConsultation(access, payload) {
  const { data } = await api.post('/consultations/', payload, authHeaders(access));
  return data;
}

export async function listMyConsultations(access) {
  const { data } = await api.get('/consultations/my/', authHeaders(access));
  return data;
}

/* ---- Admin ---- */

export async function listAdminConsultations(access, params = {}) {
  const { data } = await api.get('/consultations/admin/', {
    ...authHeaders(access),
    params,
  });
  return data;
}

export async function getAdminConsultation(access, id) {
  const { data } = await api.get(`/consultations/admin/${id}/`, authHeaders(access));
  return data;
}

export async function updateAdminConsultation(access, id, payload) {
  const { data } = await api.patch(
    `/consultations/admin/${id}/`,
    payload,
    authHeaders(access)
  );
  return data;
}

export async function listEligibleLawyers(access, practiceAreaId) {
  const params = {};
  if (practiceAreaId == null || practiceAreaId === '') {
    params.practice_area = 'unassigned';
  } else {
    params.practice_area = practiceAreaId;
  }
  const { data } = await api.get('/consultations/admin/eligible-lawyers/', {
    ...authHeaders(access),
    params,
  });
  return data;
}

/* ---- Lawyer ---- */

export async function listAssignedConsultations(access) {
  const { data } = await api.get('/consultations/assigned/', authHeaders(access));
  return data;
}

export async function updateAssignedConsultationStatus(access, id, statusValue) {
  const { data } = await api.patch(
    `/consultations/assigned/${id}/status/`,
    { status: statusValue },
    authHeaders(access)
  );
  return data;
}

export { getErrorMessage };
