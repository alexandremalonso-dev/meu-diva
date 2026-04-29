import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 🔥 Detectar ambiente pela URL atual
const getFotosBucketUrl = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: usar padrão PROD
    return "https://storage.googleapis.com/meudiva-prod-fotos";
  }
  
  const hostname = window.location.hostname;
  if (hostname.includes('homologacao') || hostname.includes('non-prod')) {
    return "https://storage.googleapis.com/meudiva-fotos";
  }
  return "https://storage.googleapis.com/meudiva-prod-fotos";
};

const FOTOS_BUCKET_URL = getFotosBucketUrl();

export const getFotoSrc = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  
  // Sempre usar o bucket para fotos
  if (url.startsWith("/uploads/")) {
    const path = url.replace("/uploads/", "");
    return `${FOTOS_BUCKET_URL}/${path}`;
  }
  
  return url;
};

export const getFotoUrl = (url?: string | null) => {
  return getFotoSrc(url) || '';
};

export const getFileUrl = (url?: string | null) => {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) {
    const path = url.replace("/uploads/", "");
    return `${FOTOS_BUCKET_URL}/${path}`;
  }
  return url;
};