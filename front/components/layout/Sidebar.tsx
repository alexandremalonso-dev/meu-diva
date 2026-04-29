"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wallet,
  User,
  Mail,
  Clock,
  LogOut,
  BarChart3,
  Video,
  Search,
  FileText,
  Inbox,
  UserPlus,
  UserCheck,
  MessageSquare,
  CreditCard,
  Activity,
  Building2,
  DollarSign,
  Shield,
  FileCheck,
  CalendarCheck,
  Receipt,
  Briefcase,
  TrendingUp,
  Settings,
  Store
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

const patientNavItems: NavItem[] = [
  { name: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
  { name: "Próximas sessões", href: "/patient/sessions/upcoming", icon: Video },
  { name: "Agenda", href: "/patient/schedule", icon: Calendar },
  { name: "Meus Convites", href: "/patient/invites", icon: Inbox },
  { name: "Sessões Realizadas", href: "/patient/sessions/completed", icon: CalendarCheck },
  { name: "Buscar terapeutas", href: "/busca", icon: Search },
  { name: "Carteira", href: "/patient/wallet", icon: Wallet },
  { name: "Perfil", href: "/patient/profile", icon: User },
];

const therapistNavItems: NavItem[] = [
  { name: "Dashboard", href: "/therapist/dashboard", icon: LayoutDashboard },
  { name: "Próximas sessões", href: "/therapist/sessions/upcoming", icon: Video },
  { name: "Agenda", href: "/therapist/schedule", icon: Calendar },
  { name: "Pacientes", href: "/therapist/patients", icon: Users },
  { name: "Disponibilidade", href: "/therapist/availability", icon: Clock },
  { name: "Convites", href: "/therapist/invites", icon: Mail },
  { name: "Carteira", href: "/therapist/wallet", icon: Wallet },
  { name: "Relatório Financeiro", href: "/therapist/financial-report", icon: BarChart3 },
  { name: "Perfil", href: "/therapist/profile", icon: User },
  { name: "Sessões Realizadas", href: "/therapist/sessions/completed", icon: CalendarCheck },
  { name: "Documentos", href: "/therapist/documents/required", icon: FileText },
  { name: "Notas Fiscais", href: "/therapist/invoices", icon: Receipt },
];

const adminNavItems: NavItem[] = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Usuários", href: "/admin/users", icon: Users },
  { name: "Terapeutas", href: "/admin/therapists", icon: UserCheck },
  { name: "Validação", href: "/admin/therapists/validation", icon: FileCheck },
  { name: "Pacientes", href: "/admin/patients", icon: UserPlus },
  { name: "Sessões", href: "/admin/sessions", icon: Calendar },
  { name: "Convites", href: "/admin/invites", icon: Mail },
  { name: "Agendas", href: "/admin/availability", icon: Clock },
  { name: "Relatórios", href: "/admin/reports", icon: BarChart3 },
  { name: "Assinaturas", href: "/admin/reports/assinaturas", icon: CreditCard },
  { name: "Preços", href: "/admin/pricing", icon: DollarSign },
  { name: "Planos Empresas", href: "/admin/valor-empresa", icon: Building2 },
  { name: "Gestão de Empresas", href: "/admin/reports/empresas-assinaturas", icon: Store },
  { name: "Monitor", href: "/admin/monitor", icon: Activity },
  { name: "Chat Admin", href: "/admin/chat", icon: MessageSquare },
  { name: "Permissões", href: "/admin/permissions", icon: Shield },
];

const empresaNavItems: NavItem[] = [
  { name: "Dashboard", href: "/empresa/dashboard", icon: LayoutDashboard },
  { name: "Colaboradores", href: "/empresa/colaboradores", icon: Users },
  { name: "Sessões", href: "/empresa/sessions", icon: Calendar },
  { name: "Relatórios", href: "/empresa/reports", icon: BarChart3 },
  { name: "Analytics", href: "/empresa/reports/analytics", icon: TrendingUp },
  { name: "Notas Fiscais", href: "/empresa/invoices", icon: Receipt },
  { name: "Perfil", href: "/empresa/profile", icon: Building2 },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await api('/api/users/me');
        setUserData(data);
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
      }
    };
    if (user) loadUserData();
  }, [user]);

  if (!user) return null;

  const getNavItems = () => {
    if (user.role === "patient") return patientNavItems;
    if (user.role === "therapist") return therapistNavItems;
    if (user.role === "admin") return adminNavItems;
    if (user.role === "empresa") return empresaNavItems;
    return [];
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <aside className="w-16 bg-white border-r border-gray-200 shadow-sm h-full flex flex-col relative">
      <div className="h-16 flex items-center justify-center border-b border-gray-200 flex-shrink-0">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
          <Image 
            src="/logo.png" 
            alt="Meu Divã" 
            width={48} 
            height={48} 
            className="w-full h-full object-cover scale-180"
            priority
          />
        </div>
      </div>

      <nav className="flex-1 py-4 flex flex-col items-center gap-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <div key={`${item.href}-${item.name}`} className="group relative w-12 h-12">
              <Link
                href={item.href}
                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-[#E03673] text-white shadow-md"
                    : "text-gray-500 hover:bg-gray-100 hover:text-[#E03673]"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
              <div className="fixed left-[calc(4rem+0.5rem)] top-auto transform -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] shadow-lg pointer-events-none">
                {item.name}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-200 flex-shrink-0">
        <div className="w-12 h-12 flex items-center justify-center mb-2">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {userData?.formatted_id ? (
              <span className="text-xs font-medium text-gray-600">{userData.formatted_id.slice(-4)}</span>
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        <div className="group relative w-12 h-12">
          <button
            onClick={handleLogout}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="fixed left-[calc(4rem+0.5rem)] top-auto transform -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] shadow-lg pointer-events-none">
            Sair
          </div>
        </div>
      </div>
    </aside>
  );
}