"use client";

import Link from "next/link";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Wallet, 
  User, 
  Search,
  BarChart2,
  Send,
  Settings,
  Shield,
  Mail,
  Clock,
  TrendingUp,
  UserPlus,
  UserCheck,
  MessageSquare,
  CreditCard,
  Activity,
  Building2,
  DollarSign,
  FileCheck
} from "lucide-react";

interface MenuCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  color?: 'blue' | 'pink'; // Mantido para compatibilidade, mas todos serão azul
}

// Cores da paleta do projeto
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
};

// Mapeamento de ícones baseado no nome do ícone passado
const getIcon = (iconName: string) => {
  switch (iconName) {
    // Dashboard
    case 'dashboard':
      return <LayoutDashboard className="w-5 h-5" />;
    // Usuários
    case 'users':
      return <Users className="w-5 h-5" />;
    // Terapeutas
    case 'therapists':
      return <Shield className="w-5 h-5" />;
    // Pacientes
    case 'patients':
      return <User className="w-5 h-5" />;
    // Sessões
    case 'sessions':
    case 'calendar':
      return <Calendar className="w-5 h-5" />;
    // Convites
    case 'invites':
    case 'send':
      return <Send className="w-5 h-5" />;
    // Disponibilidade
    case 'availability':
    case 'clock':
      return <Clock className="w-5 h-5" />;
    // Relatórios
    case 'reports':
    case 'chart':
      return <BarChart2 className="w-5 h-5" />;
    // Financeiro
    case 'financial':
    case 'trending':
      return <TrendingUp className="w-5 h-5" />;
    // Configurações
    case 'settings':
      return <Settings className="w-5 h-5" />;
    // Busca
    case 'search':
      return <Search className="w-5 h-5" />;
    // Carteira
    case 'wallet':
      return <Wallet className="w-5 h-5" />;
    // Perfil
    case 'profile':
      return <User className="w-5 h-5" />;
    // UserPlus
    case 'userplus':
      return <UserPlus className="w-5 h-5" />;
    // UserCheck
    case 'usercheck':
      return <UserCheck className="w-5 h-5" />;
    // MessageSquare
    case 'messagesquare':
      return <MessageSquare className="w-5 h-5" />;
    // CreditCard
    case 'creditcard':
      return <CreditCard className="w-5 h-5" />;
    // Activity
    case 'activity':
      return <Activity className="w-5 h-5" />;
    // Building2
    case 'building2':
      return <Building2 className="w-5 h-5" />;
    // DollarSign
    case 'dollarsign':
      return <DollarSign className="w-5 h-5" />;
    // FileCheck
    case 'filecheck':
      return <FileCheck className="w-5 h-5" />;
    default:
      return <LayoutDashboard className="w-5 h-5" />;
  }
};

export function MenuCard({ href, icon, title, description, color = 'blue' }: MenuCardProps) {
  // Todas as cores agora usam o azul da paleta #2F80D3
  // O parâmetro color é mantido para compatibilidade, mas ignorado
  
  return (
    <Link
      href={href}
      className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-4 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        {getIcon(icon)}
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-white/80">{description}</p>
      </div>
    </Link>
  );
}