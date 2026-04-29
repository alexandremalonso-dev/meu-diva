import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Detecta o backend correto baseado no ambiente
function getApiBaseUrl(): string {
  // Para React Native, podemos usar uma variável fixa ou detectar por build
  // Vamos usar a URL de produção por padrão
  return process.env.EXPO_PUBLIC_API_URL || "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";
}

const API_BASE_URL = getApiBaseUrl();

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

const SILENT_STATUSES = [404];

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('access_token');
  } catch {
    return null;
  }
}

async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem('access_token', token);
}

async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem('access_token');
  await AsyncStorage.removeItem('refresh_token');
}

export async function api(
  endpoint: string,
  options?: RequestInit & { silent?: boolean; requireAuth?: boolean }
) {
  const baseUrl = API_BASE_URL;

  const fullUrl = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint}`;

  const buildHeaders = async (): Promise<HeadersInit> => {
    const token = await getToken();
    return {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const doRequest = async () => {
    return fetch(fullUrl, {
      ...options,
      headers: await buildHeaders(),
      credentials: 'include',
    });
  };

  let res = await doRequest();

  if (res.status === 401 && !endpoint.includes('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const refreshToken = await AsyncStorage.getItem('refresh_token');
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
            await setToken(data.access_token);
          }
        } catch (err) {
          await removeToken();
          throw err;
        } finally {
          isRefreshing = false;
        }
      })();
    }
    try {
      await refreshPromise;
      res = await doRequest();
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

export default api;