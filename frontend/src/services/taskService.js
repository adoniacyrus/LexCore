import api from './api';
import { getErrorMessage } from './authService';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function listCaseTasks(access, caseId, params = {}) {
  const url = caseId ? `/cases/${caseId}/tasks/` : '/cases/tasks/';
  const { data } = await api.get(url, {
    ...authHeaders(access),
    params,
  });
  return data;
}

export async function getTaskDetail(access, taskId) {
  const { data } = await api.get(`/cases/tasks/${taskId}/`, authHeaders(access));
  return data;
}

export async function createCaseTask(access, caseId, payload) {
  const { data } = await api.post(`/cases/${caseId}/tasks/`, payload, authHeaders(access));
  return data;
}

export async function updateCaseTask(access, taskId, payload) {
  const { data } = await api.patch(`/cases/tasks/${taskId}/`, payload, authHeaders(access));
  return data;
}

export async function listTaskDocuments(access, taskId) {
  const { data } = await api.get(`/cases/tasks/${taskId}/documents/`, authHeaders(access));
  return data;
}

export async function uploadTaskDocument(access, taskId, formData) {
  const { data } = await api.post(`/cases/tasks/${taskId}/documents/`, formData, {
    headers: {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export { getErrorMessage };
