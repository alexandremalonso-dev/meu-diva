// Stub — funcionalidade de impersonation ainda não implementada

export interface ImpersonationInfo {
  targetId: number;
  targetName: string;
  targetRole: string;
}

export function getImpersonationInfo(): ImpersonationInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("impersonation");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function endImpersonation(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("impersonation");
  localStorage.removeItem("impersonation_token");
}
