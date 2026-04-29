"use client";
import { ReactNode, useState, useEffect } from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import Sidebar from "./Sidebar";
import { SidebarRight } from "./SidebarRight";
import { AdminSidebar } from "./AdminSidebar";
import EmpresaSidebar from "./EmpresaSidebar";
import MobileHeader from "@/components/mobile/MobileHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";

interface MainLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  backTo?: string;
  title?: string;
  userRole?: "patient" | "therapist" | "admin" | "empresa";
}

const CORES = { cinzaClaro: "#F9F5FF" };

function useIsCapacitor() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    const isNarrow = window.innerWidth < 768;
    setIsMobile(isCapacitor || isNarrow);
  }, []);
  return isMobile;
}

export function MainLayout({
  children,
  showBackButton = false,
  backTo = "/",
  title,
  userRole: propUserRole
}: MainLayoutProps) {
  const { user } = useAuth();
  const { isOpen, closeSidebar, openChat } = useSidebar();
  const isMobile = useIsCapacitor();

  const [adminOpenChat, setAdminOpenChat] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  const isAuthenticated = !!user;
  const userRole = propUserRole || (
    user?.role === "therapist" ? "therapist"
    : user?.role === "patient" ? "patient"
    : user?.role === "admin" ? "admin"
    : user?.role === "empresa" ? "empresa"
    : undefined
  );

  const handleAdminChatClick = () => setAdminOpenChat(true);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CORES.cinzaClaro }}>

      {/* Header — mobile ou web */}
      {isMobile ? (
        <MobileHeader showBack={showBackButton} backTo={backTo === "/" ? undefined : backTo} title={title} />
      ) : (
        <PublicHeader
          showBackButton={showBackButton}
          backTo={backTo}
          title={title}
          onChatClick={userRole === "admin" ? handleAdminChatClick : openChat}
          adminUnreadCount={userRole === "admin" ? adminUnreadCount : undefined}
        />
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar esquerda — oculta no mobile */}
        {isAuthenticated && !isMobile && (
          <div className="w-16 flex-shrink-0">
            <Sidebar />
          </div>
        )}

        {/* Conteúdo principal */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>

        {/* Sidebars direitas — ocultas no mobile */}
        {!isMobile && isAuthenticated && userRole === "admin" && (
          <div style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <AdminSidebar
              isOpen={true}
              onClose={() => {}}
              openOnChat={adminOpenChat}
              onChatOpened={() => setAdminOpenChat(false)}
              onUnreadChange={setAdminUnreadCount}
            />
          </div>
        )}

        {!isMobile && isAuthenticated && userRole === "empresa" && (
          <div style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <EmpresaSidebar />
          </div>
        )}

        {!isMobile && isAuthenticated && isOpen && (userRole === "therapist" || userRole === "patient") && (
          <div style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <SidebarRight
              isOpen={isOpen}
              onClose={closeSidebar}
              userRole={userRole as "therapist" | "patient"}
            />
          </div>
        )}
      </div>

      {/* Footer — oculto no mobile */}
      {!isMobile && <PublicFooter />}
    </div>
  );
}