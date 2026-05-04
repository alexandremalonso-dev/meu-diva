// ✅ Detecta o backend correto baseado no hostname
function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  // Sempre usa a variável de ambiente se disponível
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  const host = window.location.hostname;
  if (host.includes("app.meudivaonline.com")) {
    return "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";
  }
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

const SILENT_STATUSES = [404];

export async function api(
  endpoint: string,
  options?: RequestInit & { silent?: boolean; requireAuth?: boolean }
) {
  const baseUrl = getApiBaseUrl();

  const fullUrl = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint}`;

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const buildHeaders = (token: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const doRequest = async (token: string | null) => {
    return fetch(fullUrl, {
      ...options,
      headers: buildHeaders(token),
      credentials: 'include',
    });
  };

  let res = await doRequest(getToken());

  if (res.status === 401 && !endpoint.includes('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const refreshToken = typeof window !== 'undefined'
            ? localStorage.getItem('refresh_token')
            : null;
          if (!refreshToken) throw new Error('Sem refresh token');
          const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (!refreshRes.ok) throw new Error('Refresh falhou');
          const data = await refreshRes.json();
          if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
          }
        } catch (err) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
            window.location.href = '/auth/login';
          }
          throw err;
        } finally {
          isRefreshing = false;
        }
      })();
    }
    try {
      await refreshPromise;
      res = await doRequest(getToken());
    } catch {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json') && res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorMessage = data?.error || data?.detail || `Erro ${res.status}`;
    const isSilent = SILENT_STATUSES.includes(res.status) || options?.silent;
    if (!isSilent) console.error(`❌ API ${res.status}: ${fullUrl}`, data);
    throw new Error(errorMessage);
  }

  return data;
}