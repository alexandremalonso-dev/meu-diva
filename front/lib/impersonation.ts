import { api } from "@/lib/api";

const ADMIN_ACCESS_KEY = "impersonation_admin_access_token";
const ADMIN_REFRESH_KEY = "impersonation_admin_refresh_token";
const LOG_ID_KEY = "impersonation_log_id";
const TARGET_NAME_KEY = "impersonation_target_name";
const TARGET_ROLE_KEY = "impersonation_target_role";

export interface ImpersonationInfo {
  logId: string;
  targetName: string;
  targetRole: string;
}

export function isImpersonating(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(LOG_ID_KEY);
}

export function getImpersonationInfo(): ImpersonationInfo | null {
  if (typeof window === "undefined") return null;
  const logId = localStorage.getItem(LOG_ID_KEY);
  if (!logId) return null;
  return {
    logId,
    targetName: localStorage.getItem(TARGET_NAME_KEY) || "",
    targetRole: localStorage.getItem(TARGET_ROLE_KEY) || "",
  };
}

/**
 * Admin inicia a visualização como outro usuário (terapeuta ou paciente).
 * Guarda as credenciais originais do admin para permitir restaurar depois,
 * troca o token ativo pelo do usuário simulado, e redireciona para o
 * dashboard correspondente.
 */
export async function startImpersonation(userId: number): Promise<void> {
  const data = await api(`/api/admin/impersonation/${userId}/start`, {
    method: "POST",
  });

  const currentAccess = localStorage.getItem("access_token");
  const currentRefresh = localStorage.getItem("refresh_token");
  if (currentAccess) localStorage.setItem(ADMIN_ACCESS_KEY, currentAccess);
  if (currentRefresh) localStorage.setItem(ADMIN_REFRESH_KEY, currentRefresh);

  localStorage.setItem(LOG_ID_KEY, String(data.log_id));
  localStorage.setItem(TARGET_NAME_KEY, data.target_name || "");
  localStorage.setItem(TARGET_ROLE_KEY, data.target_role || "");

  localStorage.setItem("access_token", data.access_token);
  // 🔥 Remove o refresh_token ativo (que pertence ao admin) para evitar que uma
  // renovação automática por 401 devolva silenciosamente a sessão do admin
  // sem que isso fique claro para quem está usando a simulação.
  localStorage.removeItem("refresh_token");

  let dest = "/patient/dashboard";
  if (data.target_role === "therapist") dest = "/therapist/dashboard";
  else if (data.target_role === "empresa") dest = "/empresa/dashboard";
  window.location.href = dest;
}

/**
 * Encerra a simulação: registra o fim no log de auditoria e restaura
 * o token original do admin.
 */
export async function endImpersonation(): Promise<void> {
  const info = getImpersonationInfo();
  if (!info) return;

  try {
    await api(`/api/admin/impersonation/${info.logId}/end`, {
      method: "POST",
      silent: true,
    });
  } catch {
    // segue mesmo se der erro (ex: sessão já encerrada), para não travar o admin
  }

  const adminAccess = localStorage.getItem(ADMIN_ACCESS_KEY);
  const adminRefresh = localStorage.getItem(ADMIN_REFRESH_KEY);

  if (adminAccess) localStorage.setItem("access_token", adminAccess);
  if (adminRefresh) localStorage.setItem("refresh_token", adminRefresh);

  localStorage.removeItem(ADMIN_ACCESS_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
  localStorage.removeItem(LOG_ID_KEY);
  localStorage.removeItem(TARGET_NAME_KEY);
  localStorage.removeItem(TARGET_ROLE_KEY);

  window.location.href = "/admin/dashboard";
}
