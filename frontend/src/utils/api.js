// API helper module for QR Attendance
const BASE_URL = '';

export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token && !options.headers?.Authorization ? { Authorization: `Bearer ${token}` } : {})
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.clear();
    if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
      window.location.href = '/login?expired=1';
    }
  }

  return response;
}
