"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function DeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    let listenerHandle: any;

    (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      listenerHandle = await App.addListener("appUrlOpen", async (data: { url: string }) => {
        try {
          await Browser.close();
        } catch {
          // Browser pode já estar fechado, ignora
        }

        const url = new URL(data.url);

        if (url.protocol !== "meudiva:") return;

        const params = new URLSearchParams(url.search);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const error = params.get("error");

        if (error) {
          router.push("/mobile/login");
          return;
        }

        if (accessToken && refreshToken) {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
          router.push("/mobile/dashboard");
        }
      });
    })();

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [router]);

  return null;
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <DeepLinkListener />
        {children}
      </SidebarProvider>
    </AuthProvider>
  );
}