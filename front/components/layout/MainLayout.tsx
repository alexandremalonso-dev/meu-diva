"use client";
import { ReactNode, useState, useEffect, useLayoutEffect, useRef } from "react";
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

// Usa o maior scrollHeight entre as colunas presentes (sidebar esquerda,
// conteúdo principal, sidebar direita) como altura mínima da linha central.
// Isso garante que as colunas fiquem visualmente com a mesma altura e que
// o footer sempre comece exatamente onde a linha termina — sem depender
// de nenhum comportamento de stretch/percentual do CSS (que se mostrou
// ambíguo nessa combinação de min-height + grid/flex aninhado).
function useEqualRowHeight(refs: React.RefObject<HTMLElement | null>[]) {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const elements = refs.map(r => r.current).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const recompute = () => {
      const max = Math.max(...elements.map(el => el.scrollHeight));
      setHeight(max);
    };

    recompute();

    const ro = new ResizeObserver(() => recompute());
    elements.forEach(el => ro.observe(el));

    // Também recalcula quando a janela muda de tamanho (ex: rotação, resize)
    window.addEventListener("resize", recompute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return height;
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

  const showLeftSidebar = isAuthenticated && !isMobile;
  const showAdminSidebar = !isMobile && isAuthenticated && userRole === "admin";
  const showEmpresaSidebar = !isMobile && isAuthenticated && userRole === "empresa";
  const showRightSidebar = !isMobile && isAuthenticated && isOpen && (userRole === "therapist" || userRole === "patient");
  const showAnyRightColumn = showAdminSidebar || showEmpresaSidebar || showRightSidebar;

  const leftRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const activeRefs = [
    mainRef,
    ...(showLeftSidebar ? [leftRef] : []),
    ...(showAnyRightColumn ? [rightRef] : []),
  ];
  const rowHeight = useEqualRowHeight(activeRefs);

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

      {/* Linha central: altura mínima definida em PIXELS via JS (a maior
          entre as colunas presentes). Isso é o que garante que todas as
          colunas fiquem com a mesma altura visual e que o footer comece
          exatamente onde a linha termina, sem depender de nenhuma
          ambiguidade de cálculo do CSS Grid/Flexbox. */}
      <div className="flex" style={{ minHeight: rowHeight ? `${rowHeight}px` : undefined }}>
        {/* Sidebar esquerda — oculta no mobile */}
        {showLeftSidebar && (
          <div ref={leftRef} className="w-16 flex-shrink-0 flex">
            <Sidebar />
          </div>
        )}

        {/* Conteúdo principal */}
        <main ref={mainRef} className="flex-1 min-w-0">
          {children}
        </main>

        {/* Sidebars direitas — ocultas no mobile (só uma por vez é exibida) */}
        {showAdminSidebar && (
          <div ref={rightRef} className="flex" style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <AdminSidebar
              isOpen={true}
              onClose={() => {}}
              openOnChat={adminOpenChat}
              onChatOpened={() => setAdminOpenChat(false)}
              onUnreadChange={setAdminUnreadCount}
            />
          </div>
        )}

        {showEmpresaSidebar && (
          <div ref={rightRef} className="flex" style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <EmpresaSidebar />
          </div>
        )}

        {showRightSidebar && (
          <div ref={rightRef} className="flex" style={{ width: "420px", minWidth: "420px", maxWidth: "420px", flexShrink: 0 }}>
            <SidebarRight
              isOpen={isOpen}
              onClose={closeSidebar}
              userRole={userRole as "therapist" | "patient"}
            />
          </div>
        )}
      </div>

      {/* Footer — oculto no mobile. Sempre logo após a linha central. */}
      {!isMobile && <PublicFooter />}
    </div>
  );
}