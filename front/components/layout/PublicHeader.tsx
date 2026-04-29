"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { api } from "@/lib/api";
import type { PatientProfile } from "@/types/patient";
import type { TherapistProfile } from "@/types/therapist";
import { BACKEND_URL } from "@/config";
import { User, LogOut, Home, MessageSquare } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { getFotoSrc } from '@/lib/utils';

interface PublicHeaderProps {
  showBackButton?: boolean;
  backTo?: string;
  title?: string;
  onChatClick?: () => void;
  adminUnreadCount?: number;
}

export function PublicHeader({ showBackButton = false, backTo = "/", title, onChatClick, adminUnreadCount }: PublicHeaderProps) {
  const { user, logout } = useAuth();
  const { unreadCount } = useChat();
  const router = useRouter();
  const [profile, setProfile] = useState<PatientProfile | TherapistProfile | null>(null);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [userRole, setUserRole] = useState<'patient' | 'therapist' | 'admin' | 'empresa' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role) setUserRole(user.role as 'patient' | 'therapist' | 'admin' | 'empresa');
  }, [user]);

  const loadProfile = useCallback(async () => {
    if (!userRole) return;
    setLoading(true);
    try {
      if (userRole === 'admin') {
        try {
          const profileData = await api('/api/admin/profile/me');
          setProfile(profileData);
        } catch {
          setProfile({ id: 0, user_id: user?.id || 0, full_name: user?.full_name, email: user?.email || '', foto_url: null } as any);
        }
      } else if (userRole === 'patient') {
        const profileData = await api('/api/patient/profile');
        setProfile(profileData);
      } else if (userRole === 'therapist') {
        try {
          const profileData = await api('/api/therapists/me/profile');
          setProfile(profileData);
        } catch (error) {
          setProfile({ id: 0, user_id: user?.id || 0, full_name: user?.full_name, email: user?.email || '', foto_url: null } as any);
        }
      } else if (userRole === 'empresa') {
        try {
          const profileData = await api('/api/empresa/profile/me');
          setProfile(profileData);
        } catch {
          setProfile({ id: 0, user_id: user?.id || 0, full_name: user?.full_name, email: user?.email || '', foto_url: null } as any);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }, [userRole, user]);

  useEffect(() => {
    if (user?.id && userRole) {
      loadProfile();
      // ✅ Atualiza foto no header após upload bem-sucedido
      window.addEventListener('refreshProfile', loadProfile);
      return () => window.removeEventListener('refreshProfile', loadProfile);
    }
  }, [user, userRole, loadProfile]);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const handleBack = () => {
    if (backTo === "dashboard") {
      if (userRole === "therapist") router.push("/therapist/dashboard");
      else if (userRole === "patient") router.push("/patient/dashboard");
      else if (userRole === "admin") router.push("/admin/dashboard");
      else if (userRole === "empresa") router.push("/empresa/dashboard");
      else router.push("/");
    } else {
      router.push(backTo);
    }
  };

  const getInitial = () => {
    if (profile?.full_name) return profile.full_name.charAt(0).toUpperCase();
    if (user?.full_name) return user.full_name.charAt(0).toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const profileLink = userRole === 'therapist'
    ? '/therapist/profile'
    : userRole === 'admin'
    ? '/admin/profile'
    : userRole === 'empresa'
    ? '/empresa/profile'
    : '/patient/profile';

  const dashboardLink = userRole === 'therapist'
    ? '/therapist/dashboard'
    : userRole === 'admin'
    ? '/admin/dashboard'
    : userRole === 'empresa'
    ? '/empresa/dashboard'
    : '/patient/dashboard';

  const displayName = profile?.full_name || user?.full_name || user?.email;

  // ✅ Corrigido: evita duplicar BACKEND_URL se foto já for URL completa do GCS
  const fotoUrl = profile?.foto_url
    ? (profile.foto_url.startsWith('http') ? profile.foto_url : `${BACKEND_URL}${profile.foto_url}`)
    : null;

  const logoHref = user ? dashboardLink : "/";

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", borderBottom: "1px solid #eef2f9" }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "128px" }}>

          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-4">
            {showBackButton && (
              <button onClick={handleBack} className="flex items-center gap-2 hover:opacity-80 transition-opacity" style={{ color: "#2F80D3" }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-base font-medium hidden sm:inline">Voltar</span>
              </button>
            )}
            <Link href={logoHref} className="flex items-center gap-3 sm:gap-4">
              <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ width: "144px", height: "144px", background: "transparent" }}>
                <Image
                  src="/favicon-meudiva.png"
                  alt="Meu Divã"
                  width={144}
                  height={144}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#2F80D3" }}>Meu Divã</h1>
            </Link>
          </div>

          {/* Direita */}
          <div className="flex items-center gap-4 sm:gap-6">
            {title && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium" style={{ color: "#2F80D3" }}>{title}</span>
                <span className="text-xl" style={{ color: "#2F80D3", opacity: 0.3 }}>|</span>
                {user && (
                  <Link href={dashboardLink} className="p-2 rounded-lg transition-all duration-200 flex items-center" style={{ color: "#2F80D3" }} title="Voltar ao Dashboard">
                    <Home className="w-5 h-5" />
                  </Link>
                )}
              </div>
            )}

            {user && <NotificationBell />}

            {user && onChatClick && (
              <button
                onClick={onChatClick}
                className="relative p-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                style={{ color: "#2F80D3", background: "rgba(47,128,211,0.08)" }}
                title="Chat"
              >
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Chat</span>
                {(() => {
                  const count = userRole === 'admin' ? (adminUnreadCount || 0) : unreadCount;
                  return count > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-[#E03673] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null;
                })()}
              </button>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                  className="flex items-center gap-3 sm:gap-4 group focus:outline-none"
                  disabled={loading}
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-base font-medium group-hover:opacity-80" style={{ color: "#2F80D3" }}>
                      {displayName}
                    </p>
                    <p className="text-sm" style={{ color: "#2F80D3", opacity: 0.6 }}>
                      {userRole === 'admin' ? 'Administrador' : userRole === 'empresa' ? 'Empresa' : 'Meu Perfil'}
                    </p>
                  </div>
                  {/* Foto de perfil — lógica 100% preservada */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl overflow-hidden ring-2 shadow-md" style={{ backgroundColor: "#E03673", ringColor: "rgba(224,54,115,0.3)" }}>
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt={displayName || "Foto"}
                        className="object-cover w-full h-full"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-white text-xl sm:text-2xl">
                        {loading ? '...' : getInitial()}
                      </span>
                    )}
                  </div>
                </button>

                {showLogoutMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowLogoutMenu(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20 border" style={{ borderColor: "#eef2f9" }}>
                      <Link href={profileLink} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowLogoutMenu(false)}>
                        <User className="w-4 h-4" style={{ color: "#E03673" }} />
                        Meu Perfil
                      </Link>
                      <button onClick={handleLogout} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                        <LogOut className="w-4 h-4 text-red-500" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!user && (
              <div className="flex items-center gap-3">
                <Link href="/auth/login" className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ color: "#2F80D3", border: "1px solid #2F80D3" }}>
                  Entrar
                </Link>
                <Link href="/auth/register" className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90" style={{ backgroundColor: "#E03673" }}>
                  Cadastrar
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}