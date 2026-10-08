"use client";

import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

interface StatView {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
}

interface RotatingStatCardProps {
  views: StatView[];
  onClick?: () => void;
  intervalMs?: number;
  gradient?: string;
}

export function RotatingStatCard({ views, onClick, intervalMs = 4000, gradient = "from-[#E03673] to-[#E03673]/80" }: RotatingStatCardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (views.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % views.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [views.length, intervalMs]);

  const current = views[index];
  const Icon = current.icon;

  return (
    <div
      onClick={onClick}
      className={`h-full flex flex-col justify-center bg-gradient-to-r ${gradient} rounded-lg shadow-sm px-3 py-2 text-white transition-all hover:shadow-md hover:scale-[1.01] overflow-hidden min-w-0 relative ${onClick ? "cursor-pointer" : ""}`}
    >
      <div key={index} className="animate-[fadeIn_0.4s_ease-in-out]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-fluid-2xs font-medium text-white/80 truncate">{current.title}</span>
          <Icon className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
        </div>
        <p className="text-lg sm:text-xl font-bold truncate leading-tight">{current.value}</p>
        <p className="text-fluid-2xs text-white/70 truncate">{current.subtitle}</p>
      </div>

      {views.length > 1 && (
        <div className="flex gap-1 mt-1 justify-center">
          {views.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
