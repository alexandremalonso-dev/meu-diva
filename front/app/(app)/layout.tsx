"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Script from "next/script";

// Mapeamento de rotas para títulos
const getTitleFromPath = (pathname: string): string => {
  // Paciente
  if (pathname.includes("/patient/dashboard")) return "Dashboard";
  if (pathname.includes("/patient/sessions/upcoming")) return "Próximas Sessões";
  if (pathname.includes("/patient/sessions/completed")) return "Sessões Realizadas";
  if (pathname.includes("/patient/profile")) return "Meu Perfil";
  if (pathname.includes("/patient/wallet")) return "Minha Carteira";
  if (pathname.includes("/patient/invites")) return "Meus Convites";
  if (pathname.includes("/patient/schedule")) return "Minha Agenda";

  // Terapeuta
  if (pathname.includes("/therapist/dashboard")) return "Dashboard";
  if (pathname.includes("/therapist/sessions/upcoming")) return "Próximas Sessões";
  if (pathname.includes("/therapist/sessions/completed")) return "Sessões Realizadas";
  if (pathname.includes("/therapist/profile")) return "Perfil Profissional";
  if (pathname.includes("/therapist/patients")) return "Meus Pacientes";
  if (pathname.includes("/therapist/availability")) return "Disponibilidade";
  if (pathname.includes("/therapist/invites")) return "Convites Enviados";
  if (pathname.includes("/therapist/schedule")) return "Minha Agenda";
  if (pathname.includes("/therapist/wallet")) return "Minha Carteira";

  // ADMIN
  if (pathname.includes("/admin/dashboard")) return "Admin Dashboard";
  if (pathname.includes("/admin/users")) return "Gerenciar Usuários";
  if (pathname.includes("/admin/therapists")) return "Gerenciar Terapeutas";
  if (pathname.includes("/admin/patients")) return "Gerenciar Pacientes";
  if (pathname.includes("/admin/sessions")) return "Todas as Sessões";
  if (pathname.includes("/admin/invites")) return "Todos os Convites";
  if (pathname.includes("/admin/availability")) return "Disponibilidade dos Terapeutas";
  if (pathname.includes("/admin/reports")) return "Relatório Financeiro";
  if (pathname.includes("/admin/empresas")) return "Gestão de Empresas";
  if (pathname.includes("/admin/empresas/assinaturas")) return "Assinaturas Empresariais";
  if (pathname.includes("/admin/empresas/faturamento")) return "Faturamento Empresarial";
  if (pathname.includes("/admin/valor-empresa")) return "Planos Empresariais";

  // EMPRESA
  if (pathname.includes("/empresa/dashboard")) return "Dashboard Empresarial";
  if (pathname.includes("/empresa/colaboradores")) return "Colaboradores";
  if (pathname.includes("/empresa/sessions")) return "Sessões";
  if (pathname.includes("/empresa/reports/financeiro")) return "Relatório Financeiro";
  if (pathname.includes("/empresa/reports/assinaturas")) return "Relatório de Assinaturas";
  if (pathname.includes("/empresa/reports/analytics")) return "Analytics de Saúde Mental";
  if (pathname.includes("/empresa/faturamento")) return "Notas Fiscais";
  if (pathname.includes("/empresa/profile")) return "Perfil da Empresa";

  return "";
};

// Componente interno para pegar o usuário e passar a role para o MainLayout
function LayoutContent({ children, title }: { children: React.ReactNode; title: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 🔥 Onboarding do terapeuta novo (plano primeiro). Só redireciona quando o
  // servidor está com ONBOARDING_ENFORCE ligado (padrão: desligado). Falha
  // "aberto": qualquer erro deixa o usuário passar.
  useEffect(() => {
    if (!user || user.role !== "therapist") return;
    if (pathname?.startsWith("/therapist/subscription")) return;
    const key = `onb_ok_${user.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    let active = true;
    api("/api/therapist/onboarding/status", { silent: true })
      .then((st: any) => {
        if (!active || !st) return;
        if (!st.needs_plan) {
          try { sessionStorage.setItem(key, "1"); } catch {}
          return;
        }
        if (st.enforce) router.replace("/adesao");
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.role, pathname]);

  // 🔥 Recursos por plano (tabela de permissões do admin). Só trava a TELA; falha "aberto".
  const GATED_ROUTES: Record<string, string> = { "/therapist/financial-report": "financial_reports" };
  const gatedFeature = Object.entries(GATED_ROUTES).find(([r]) => pathname?.startsWith(r))?.[1];
  const [featureMap, setFeatureMap] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!user || user.role !== "therapist" || !gatedFeature || featureMap) return;
    api("/api/therapist/onboarding/features", { silent: true })
      .then((r: any) => setFeatureMap(r?.features || {}))
      .catch(() => setFeatureMap({}));
  }, [user?.id, user?.role, gatedFeature]);
  const gateActive = !!gatedFeature && user?.role === "therapist";
  const gateBlocked = gateActive && !!featureMap && featureMap[gatedFeature as string] === false;
  const gateLoading = gateActive && featureMap === null;


  return (
    <MainLayout title={title} userRole={user?.role}>
      {gateLoading ? null : gateBlocked ? (
        <div className="max-w-xl mx-auto mt-16 px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Recurso não incluído no seu plano</h2>
            <p className="text-sm text-gray-600 mb-6">Este recurso não está disponível no seu plano atual. Veja os planos para liberá-lo.</p>
            <a href="/therapist/subscription" className="inline-block px-5 py-2.5 rounded-xl bg-[#E03673] text-white text-sm font-semibold hover:bg-[#c42d63] transition-colors">Ver planos</a>
          </div>
        </div>
      ) : children}
    </MainLayout>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = getTitleFromPath(pathname);

  return (
    <AuthProvider>
      <WebSocketProvider>
        <SidebarProvider>
          <ChatProvider>
            <LayoutContent title={title}>{children}</LayoutContent>
          </ChatProvider>
        </SidebarProvider>
      </WebSocketProvider>

      {/* 🔥 Widget de suporte interno (Huggy.chat) — carrega globalmente
          em todas as telas autenticadas, cria sua própria bolha
          flutuante (posicionamento controlado pela própria ferramenta). */}
      <Script id="huggy-chat-widget" strategy="afterInteractive">
        {`var $_Huggy = { defaultCountry: '+55', uuid: '8dd54bf5-e3ea-472f-bdcc-308156f2783a' , company: '328310', afterLoad: function () { if (window.Huggy) window.Huggy.hideButton(); } }; (function(i,s,o,g,r,a,m){ i[r]={context:{id:'1f67d9e29497fcb5b865e6c4c4cc64bf'}};a=o;o=s.createElement(o); o.async=1;o.src=g;m=s.getElementsByTagName(a)[0];m.parentNode.insertBefore(o,m); })(window,document,'script','https://js.huggy.chat/widget.min.js','pwz');`}
      </Script>
    </AuthProvider>
  );
}