"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";

type SidebarTab = "prontuario" | "queixa" | "chat";

interface SidebarContextType {
  isOpen: boolean;
  activeTab: SidebarTab;
  selectedAppointmentId: number | undefined;
  isReadOnly: boolean;
  openProntuario: (appointmentId: number, readOnly?: boolean) => void;
  openQueixa: (appointmentId: number) => void;
  openChat: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
  setActiveTab: (tab: SidebarTab) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // ✅ Admin não usa sidebar — começa fechado e todas as ações são no-op
  const isAdmin = user?.role === "admin";

  const isEmpresa = user?.role === "empresa";
  const [isOpen, setIsOpen] = useState(!isAdmin && !isEmpresa);
  const [activeTab, setActiveTabState] = useState<SidebarTab>("prontuario");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | undefined>();
  const [isReadOnly, setIsReadOnly] = useState(false);

  const openProntuario = (appointmentId: number, readOnly: boolean = false) => {
    if (isAdmin) return;
    setSelectedAppointmentId(appointmentId);
    setActiveTabState("prontuario");
    setIsReadOnly(readOnly);
    setIsOpen(true);
  };

  const openQueixa = (appointmentId: number) => {
    if (isAdmin) return;
    setSelectedAppointmentId(appointmentId);
    setActiveTabState("queixa");
    setIsReadOnly(false);
    setIsOpen(true);
  };

  const openChat = () => {
    if (isAdmin) return;
    setActiveTabState("chat");
    setIsReadOnly(false);
    setIsOpen(true);
  };

  const openSidebar = () => {
    if (isAdmin) return;
    setIsOpen(true);
  };

  const closeSidebar = () => {
    setIsOpen(false);
    setSelectedAppointmentId(undefined);
    setIsReadOnly(false);
  };

  const setActiveTab = (tab: SidebarTab) => {
    setActiveTabState(tab);
  };

  return (
    <SidebarContext.Provider value={{
      isOpen,
      activeTab,
      selectedAppointmentId,
      isReadOnly,
      openProntuario,
      openQueixa,
      openChat,
      openSidebar,
      closeSidebar,
      setActiveTab,
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
