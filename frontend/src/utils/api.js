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
    // Session expired: remove auth tokens only, preserve saved settings, themes, and preferences
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
      window.location.href = '/login?expired=1';
    }
  }

  return response;
}

export async function downloadWithAuth(url, defaultFilename = 'download.csv') {
  const token = localStorage.getItem('token');
  const separator = url.includes('?') ? '&' : '?';
  const authenticatedUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url;

  try {
    const res = await apiFetch(url);
    if (!res.ok) {
      window.location.href = authenticatedUrl;
      return;
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;

    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
  } catch (err) {
    window.location.href = authenticatedUrl;
  }
}
