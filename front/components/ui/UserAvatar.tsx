"use client";

import { useState } from "react";
import { getFotoSrc } from "@/lib/utils";

interface UserAvatarProps {
  foto_url?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showStatus?: boolean;
  isOnline?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base"
};

const statusSizeClasses = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3"
};

export function UserAvatar({ 
  foto_url, 
  name, 
  size = "md", 
  className = "",
  showStatus = false,
  isOnline = false
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const src = getFotoSrc(foto_url);
  const initial = name?.charAt(0).toUpperCase() || "U";
  
  if (!src || hasError) {
    return (
      <div className="relative inline-block">
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0 ${className}`}>
          <span className="text-white font-bold">{initial}</span>
        </div>
        {showStatus && isOnline && (
          <div className={`absolute -bottom-0.5 -right-0.5 ${statusSizeClasses[size]} bg-green-500 rounded-full border-2 border-white animate-pulse`} />
        )}
      </div>
    );
  }
  
  return (
    <div className="relative inline-block">
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
        <img 
          src={src} 
          alt={name}
          className={`w-full h-full object-cover transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
      </div>
      {showStatus && isOnline && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${statusSizeClasses[size]} bg-green-500 rounded-full border-2 border-white animate-pulse`} />
      )}
    </div>
  );
}