"use client";

import Link from "next/link";
import {
  LayoutDashboard, Calendar, Users, Wallet, User,
  Search, BarChart2, Send, Settings, Shield
} from "lucide-react";

interface MenuCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  color?: 'blue' | 'pink' | 'green' | 'orange' | 'teal';
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case "dashboard": return <LayoutDashboard className="w-5 h-5" />;
    case "calendar":  return <Calendar className="w-5 h-5" />;
    case "users":     return <Users className="w-5 h-5" />;
    case "wallet":    return <Wallet className="w-5 h-5" />;
    case "user":
    case "profile":   return <User className="w-5 h-5" />;
    case "search":    return <Search className="w-5 h-5" />;
    case "reports":
    case "chart":     return <BarChart2 className="w-5 h-5" />;
    case "invites":
    case "send":      return <Send className="w-5 h-5" />;
    case "settings":  return <Settings className="w-5 h-5" />;
    case "admin":
    case "shield":    return <Shield className="w-5 h-5" />;
    default:          return <LayoutDashboard className="w-5 h-5" />;
  }
};

// 🔥 Cores da paleta do projeto
const COLORS = {
  blue: '#2F80D3',
  pink: '#E03673',
  green: '#10B981',
  orange: '#F59E0B',
  teal: '#14B8A6'
};

// 🔥 Gradientes por cor
const GRADIENTS = {
  blue: "linear-gradient(135deg, #2F80D3 0%, #2F80D3/80 100%)",
  pink: "linear-gradient(135deg, #E03673 0%, #E03673/80 100%)",
  green: "linear-gradient(135deg, #10B981 0%, #10B981/80 100%)",
  orange: "linear-gradient(135deg, #F59E0B 0%, #F59E0B/80 100%)",
  teal: "linear-gradient(135deg, #14B8A6 0%, #14B8A6/80 100%)"
};

export function MenuCard({ href, icon, title, description, color = 'blue' }: MenuCardProps) {
  // 🔥 Escolhe o gradiente baseado na cor passada
  const bgGradient = GRADIENTS[color as keyof typeof GRADIENTS] || GRADIENTS.blue;
  
  return (
    <Link
      href={href}
      style={{ background: bgGradient }}
      className="text-white p-3 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 flex flex-col items-center justify-center gap-2 text-center min-h-[72px]"
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {getIcon(icon)}
      </div>
      <div className="min-w-0 w-full">
        <p className="font-semibold text-xs leading-tight truncate">{title}</p>
        <p className="text-xs text-white/75 leading-tight truncate">{description}</p>
      </div>
    </Link>
  );
}