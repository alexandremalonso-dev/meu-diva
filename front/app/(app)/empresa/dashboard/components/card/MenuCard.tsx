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
  const cls = "w-4 h-4 sm:w-5 sm:h-5";
  switch (iconName) {
    case "dashboard": return <LayoutDashboard className={cls} />;
    case "calendar":  return <Calendar className={cls} />;
    case "users":     return <Users className={cls} />;
    case "wallet":    return <Wallet className={cls} />;
    case "user":
    case "profile":   return <User className={cls} />;
    case "search":    return <Search className={cls} />;
    case "reports":
    case "chart":     return <BarChart2 className={cls} />;
    case "invites":
    case "send":      return <Send className={cls} />;
    case "settings":  return <Settings className={cls} />;
    case "admin":
    case "shield":    return <Shield className={cls} />;
    default:          return <LayoutDashboard className={cls} />;
  }
};

const GRADIENTS = {
  blue:   "linear-gradient(135deg, #2F80D3 0%, rgba(47,128,211,0.8) 100%)",
  pink:   "linear-gradient(135deg, #E03673 0%, rgba(224,54,115,0.8) 100%)",
  green:  "linear-gradient(135deg, #10B981 0%, rgba(16,185,129,0.8) 100%)",
  orange: "linear-gradient(135deg, #F59E0B 0%, rgba(245,158,11,0.8) 100%)",
  teal:   "linear-gradient(135deg, #14B8A6 0%, rgba(20,184,166,0.8) 100%)"
};

export function MenuCard({ href, icon, title, description, color = 'blue' }: MenuCardProps) {
  const bgGradient = GRADIENTS[color as keyof typeof GRADIENTS] || GRADIENTS.blue;

  return (
    <Link
      href={href}
      style={{ background: bgGradient }}
      className="text-white p-2 sm:p-3 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-center min-h-[64px] sm:min-h-[72px] overflow-hidden"
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {getIcon(icon)}
      </div>
      <div className="min-w-0 w-full px-0.5">
        <p className="font-semibold text-[10px] sm:text-xs leading-tight truncate">{title}</p>
        <p className="text-[9px] sm:text-[10px] lg:text-xs text-white/75 leading-tight truncate hidden sm:block">{description}</p>
      </div>
    </Link>
  );
}