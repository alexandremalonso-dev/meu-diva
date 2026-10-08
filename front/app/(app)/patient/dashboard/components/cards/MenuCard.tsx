"use client";

import Link from "next/link";
import { LayoutDashboard, Search, Wallet, User } from "lucide-react";

interface MenuCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
}

const getIcon = (iconName: string) => {
  const cls = "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0";
  switch (iconName) {
    case "dashboard": return <LayoutDashboard className={cls} />;
    case "search":     return <Search className={cls} />;
    case "wallet":     return <Wallet className={cls} />;
    case "profile":
    case "user":       return <User className={cls} />;
    default:           return <LayoutDashboard className={cls} />;
  }
};

export function MenuCard({ href, icon, title, description }: MenuCardProps) {
  return (
    <Link
      href={href}
      className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-2.5 sm:p-3 lg:p-4 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0"
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {getIcon(icon)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[11px] sm:text-xs lg:text-sm leading-tight line-clamp-2">
          {title}
        </p>
        <p className="text-[10px] sm:text-[11px] lg:text-xs text-white/80 leading-tight truncate hidden sm:block">
          {description}
        </p>
      </div>
    </Link>
  );
}
