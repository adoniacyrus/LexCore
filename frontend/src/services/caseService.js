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

export async function listActiveLawyers(access) {
  const { data } = await api.get('/cases/active-lawyers/', authHeaders(access));
  return data;
}

export async function updateCaseTeam(access, id, payload) {
  const { data } = await api.patch(`/cases/${id}/team/`, payload, authHeaders(access));
  return data;
}

export async function listCaseDocuments(access, caseId) {
  const { data } = await api.get(`/cases/${caseId}/documents/`, authHeaders(access));
  return data;
}

export async function uploadCaseDocument(access, caseId, formData) {
  const { data } = await api.post(`/cases/${caseId}/documents/`, formData, {
    headers: {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function downloadCaseDocument(access, docId) {
  const response = await api.get(`/documents/${docId}/`, {
    headers: {
      Authorization: `Bearer ${access}`,
    },
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteCaseDocument(access, docId) {
  const { data } = await api.delete(`/documents/${docId}/`, authHeaders(access));
  return data;
}

export { getErrorMessage };
