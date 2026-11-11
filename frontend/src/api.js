import axios from 'axios';


const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

export const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

export const storeToken = (token, remember) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem('token', token);
};

export const clearToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register') ||
      url.includes('/auth/forgot-password') || url.includes('/auth/reset-password');
    if (err.response?.status === 401 && !isAuthForm) {
      clearToken();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  e.response?.data?.error || (e.request && !e.response ? 'Cannot reach the server. Is the backend running?' : e.message) || 'Something went wrong';

export const fileUrl = (path) => (path ? `${import.meta.env.VITE_FILE_URL || ''}/uploads/${path}` : null);

export async function downloadPrescription(id) {
  const res = await api.get(`/prescriptions/${id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prescription_${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function printPrescription(id) {
  const res = await api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, '_blank');
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
}

export default api;
