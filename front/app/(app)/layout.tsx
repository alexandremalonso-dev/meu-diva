"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePathname } from "next/navigation";

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

  return (
    <MainLayout title={title} userRole={user?.role}>
      {children}
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
    </AuthProvider>
  );
}