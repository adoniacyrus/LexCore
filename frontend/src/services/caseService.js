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

export async function getMatterBoardSummary(access) {
  const { data } = await api.get('/cases/matter-board/', authHeaders(access));
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

export async function updateCaseAppointmentFee(access, caseId, fee) {
  const { data } = await api.patch(
    `/cases/${caseId}/appointment-fee/`,
    { appointment_fee: fee },
    authHeaders(access)
  );
  return data;
}

export async function downloadCaseSummaryPDF(access, caseId, download = false) {
  const response = await api.get(`/cases/${caseId}/summary-pdf/`, {
    params: download ? { download: 'true' } : {},
    headers: {
      Authorization: `Bearer ${access}`,
    },
    responseType: 'blob',
  });
  return response.data;
}

export async function listCaseMessages(access, caseReference, conversationType = 'client') {
  const conv = conversationType?.toLowerCase().includes('team') ? 'team' : 'client';
  const { data } = await api.get(
    `/cases/${caseReference}/messages/?conversation=${conv}`,
    authHeaders(access)
  );
  return data;
}

export async function sendCaseMessage(access, caseReference, content, conversationType = 'client', file = null) {
  const conv = conversationType?.toLowerCase().includes('team') ? 'team' : 'client';
  let payload;
  const config = {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };

  if (file) {
    const formData = new FormData();
    if (content) formData.append('content', content);
    formData.append('conversation', conv);
    formData.append('attachment', file);
    payload = formData;
    config.headers['Content-Type'] = 'multipart/form-data';
  } else {
    payload = { content, conversation: conv };
  }

  const { data } = await api.post(
    `/cases/${caseReference}/messages/?conversation=${conv}`,
    payload,
    config
  );
  return data;
}

export async function getCaseTimeline(access, caseId) {
  const { data } = await api.get(`/cases/${caseId}/timeline/`, authHeaders(access));
  return data;
}

export async function getCaseDurationAnalytics(access, caseId) {
  const { data } = await api.get(`/cases/${caseId}/duration/`, authHeaders(access));
  return data;
}

export { getErrorMessage };


