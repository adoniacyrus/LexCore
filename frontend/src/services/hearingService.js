import api from './api';

function authHeaders(access) {
  return {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  };
}

export async function listHearings(token, params = {}) {
  const { data } = await api.get('/hearings/', {
    ...authHeaders(token),
    params,
  });
  return data;
}

export async function getHearingStatistics(token) {
  const { data } = await api.get('/hearings/statistics/', authHeaders(token));
  return data;
}

export async function listCaseProceedings(token, caseId) {
  const { data } = await api.get(`/cases/${caseId}/proceedings/`, authHeaders(token));
  return data;
}

export async function createCaseProceeding(token, caseId, payload) {
  const { data } = await api.post(`/cases/${caseId}/proceedings/`, payload, authHeaders(token));
  return data;
}

export async function listNotifications(token) {
  const { data } = await api.get('/notifications/', authHeaders(token));
  return data;
}

export async function markNotificationRead(token, notificationId) {
  const { data } = await api.post(`/notifications/${notificationId}/mark-read/`, {}, authHeaders(token));
  return data;
}
