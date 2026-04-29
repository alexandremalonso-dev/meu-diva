import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useMobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isMobile = pathname?.startsWith("/mobile");

  const navigateToVideochamada = useCallback((appointmentId: number) => {
    if (isMobile) {
      router.push(`/mobile/videochamada/${appointmentId}`);
    } else {
      const role = pathname?.startsWith("/therapist") ? "therapist" : "patient";
      router.push(`/${role}/videochamada/${appointmentId}`);
    }
  }, [isMobile, pathname, router]);

  const navigateTo = useCallback((mobilePath: string, webPath: string) => {
    if (isMobile) {
      router.push(mobilePath);
    } else {
      router.push(webPath);
    }
  }, [isMobile, router]);

  return {
    isMobile,
    navigateToVideochamada,
    navigateTo,
  };
}