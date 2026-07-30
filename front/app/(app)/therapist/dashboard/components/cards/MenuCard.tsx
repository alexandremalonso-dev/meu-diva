"use client";

import Link from "next/link";
import { 
  LayoutDashboard, Calendar, Users, Wallet, User, Search,
  BarChart2, Send, Settings, Shield, Clock, TrendingUp,
  UserPlus, UserCheck, MessageSquare, CreditCard, Activity,
  Building2, DollarSign, FileCheck
} from "lucide-react";

interface MenuCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  color?: 'blue' | 'pink';
}

const getIcon = (iconName: string) => {
  const cls = "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0";
  switch (iconName) {
    case 'dashboard':     return <LayoutDashboard className={cls} />;
    case 'users':         return <Users className={cls} />;
    case 'therapists':    return <Shield className={cls} />;
    case 'patients':
    case 'profile':       return <User className={cls} />;
    case 'sessions':
    case 'calendar':      return <Calendar className={cls} />;
    case 'invites':
    case 'send':          return <Send className={cls} />;
    case 'availability':
    case 'clock':         return <Clock className={cls} />;
    case 'reports':
    case 'chart':         return <BarChart2 className={cls} />;
    case 'financial':
    case 'trending':      return <TrendingUp className={cls} />;
    case 'settings':      return <Settings className={cls} />;
    case 'search':        return <Search className={cls} />;
    case 'wallet':        return <Wallet className={cls} />;
    case 'userplus':      return <UserPlus className={cls} />;
    case 'usercheck':     return <UserCheck className={cls} />;
    case 'messagesquare': return <MessageSquare className={cls} />;
    case 'creditcard':    return <CreditCard className={cls} />;
    case 'activity':      return <Activity className={cls} />;
    case 'building2':     return <Building2 className={cls} />;
    case 'dollarsign':    return <DollarSign className={cls} />;
    case 'filecheck':     return <FileCheck className={cls} />;
    default:              return <LayoutDashboard className={cls} />;
  }
};

export function MenuCard({ href, icon, title, description, color = 'blue' }: MenuCardProps) {
  return (
    <Link
      href={href}
      className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-2.5 sm:p-3 lg:p-4 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0"
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {getIcon(icon)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[11px] sm:text-xs lg:text-sm leading-tight truncate">
          {title}
        </p>
        <p className="text-[10px] sm:text-[11px] lg:text-xs text-white/80 leading-tight truncate hidden sm:block">
          {description}
        </p>
      </div>
    </Link>
  );
}