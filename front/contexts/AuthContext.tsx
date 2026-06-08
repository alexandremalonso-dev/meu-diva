"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

interface User {
  id: number;
  email: string;
  role: "patient" | "therapist" | "admin" | "empresa";
  full_name: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loadMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helpers de token centralizados
const TokenStorage = {
  getAccess: () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  getRefresh: () =>
    typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null,
  setAccess: (t: string) => localStorage.setItem("access_token", t),
  setRefresh: (t: string) => localStorage.setItem("refresh_token", t),
  setBiometricEmail: (email: string) =>
    localStorage.setItem("biometric_email", email),
  clear: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    // Mantém biometric_email intencionalmente
  },
};

/**
 * Retorna true APENAS quando rodando dentro do app Capacitor nativo (iOS/Android).
 * Acesso via browser — mesmo em rotas /mobile/* — retorna false.
 */
function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Decide para onde redirecionar após login.
 * - App nativo: sempre /mobile/dashboard
 * - Web: por role
 */
function redirectByRole(role: string | undefined, native: boolean): string {
  if (native) return "/mobile/dashboard";
  if (role === "therapist") return "/therapist/dashboard";
  if (role === "patient") return "/patient/dashboard";
  if (role === "admin") return "/admin/dashboard";
  if (role === "empresa") return "/empresa/dashboard";
  return "/busca";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadMe = useCallback(async () => {
    const data = await api("/api/users/me");
    setUser(data);
    return data;
  }, []);

  const refreshUser = loadMe;

  const login = useCallback(async (email: string, password: string) => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.access_token) TokenStorage.setAccess(data.access_token);
    if (data.refresh_token) TokenStorage.setRefresh(data.refresh_token);
    TokenStorage.setBiometricEmail(email);

    const userData = data.user || (await api("/api/users/me"));
    setUser(userData);

    window.location.href = redirectByRole(userData?.role, isNativeApp());
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    } finally {
      TokenStorage.clear();
      setUser(null);
      // No logout, usa isNativeApp() — não a URL
      window.location.href = isNativeApp() ? "/mobile/login" : "/auth/login";
    }
  }, []);

  // Inicialização — tenta carregar usuário com token existente
  useEffect(() => {
    const publicRoutes = [
      "/auth/login",
      "/auth/signup",
      "/auth/forgot-password",
      "/busca",
      "/terapeuta",
      "/",
      "/como-funciona",
      "/precos",
      "/mobile/login",
      "/mobile/signup",
      "/mobile/splash",
      "/politica-privacidade",
      "/termos-uso",
      "/delete-account",
      "/excluir-conta",
    ];

    const isPublicRoute = publicRoutes.some((r) => pathname?.startsWith(r));
    const native = isNativeApp();
    const token = TokenStorage.getAccess();

    if (!token && !isPublicRoute) {
      setLoading(false);
      // Redireciona para login correto conforme ambiente
      router.push(
        native
          ? "/mobile/login"
          : `/auth/login?returnUrl=${encodeURIComponent(pathname || "")}`
      );
      return;
    }

    if (!token) {
      setLoading(false);
      return;
    }

    loadMe()
      .then((userData: any) => {
        // Se já logado e está na tela de login, redireciona para dashboard
        const isLoginPage =
          pathname === "/auth/login" || pathname === "/mobile/login";
        if (isLoginPage && userData) {
          router.push(redirectByRole(userData.role, native));
        }
      })
      .catch(() => {
        TokenStorage.clear();
        setUser(null);
        if (!isPublicRoute) {
          router.push(
            native
              ? "/mobile/login"
              : `/auth/login?returnUrl=${encodeURIComponent(pathname || "")}`
          );
        }
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
}