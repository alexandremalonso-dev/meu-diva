"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Search, Calendar, MessageSquare, User } from "lucide-react";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const role = user?.role;

  // Não mostra nas páginas de login/signup/splash/checkout/verificar-email
  const hideOn = ["/mobile/login", "/mobile/signup", "/mobile/splash", "/mobile/verificar-email", "/mobile/checkout", "/mobile/videochamada"];
  if (!pathname || hideOn.some(p => pathname.startsWith(p))) return null;

  const patientNav = [
    { label: "Início", icon: Home, path: "/mobile/dashboard" },
    { label: "Buscar", icon: Search, path: "/mobile/busca" },
    { label: "Sessões", icon: Calendar, path: "/mobile/sessoes" },
    { label: "Chat", icon: MessageSquare, path: "/mobile/chat" },
    { label: "Perfil", icon: User, path: "/mobile/perfil-paciente" },
  ];

  const therapistNav = [
    { label: "Início", icon: Home, path: "/mobile/dashboard" },
    { label: "Pacientes", icon: User, path: "/mobile/terapeuta-pacientes" },
    { label: "Sessões", icon: Calendar, path: "/mobile/terapeuta-sessoes" },
    { label: "Chat", icon: MessageSquare, path: "/mobile/chat" },
    { label: "Perfil", icon: User, path: "/mobile/perfil-terapeuta" },
  ];

  const navItems = role === "therapist" ? therapistNav : patientNav;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "white", borderTop: "0.5px solid #E5E7EB",
      display: "flex", alignItems: "stretch",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      boxShadow: "0 -2px 10px rgba(0,0,0,0.08)",
    }}>
      {navItems.map(item => {
        const active = isActive(item.path);
        const Icon = item.icon;
        return (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "10px 4px 8px", border: "none",
              background: "none", cursor: "pointer", gap: 3,
              color: active ? COLORS.primary : "#9CA3AF",
              transition: "color 0.15s",
            }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            {active && (
              <div style={{ position: "absolute", bottom: "env(safe-area-inset-bottom, 0px)", width: 4, height: 4, borderRadius: "50%", background: COLORS.primary }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
