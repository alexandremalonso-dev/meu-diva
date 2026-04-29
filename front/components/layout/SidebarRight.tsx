"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, MessageSquare, FileText, ChevronRight, Loader2, Calendar, ChevronDown, User, Clock, History, Eye, ChevronLeft, FileWarning, Star } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useApi } from "@/lib/useApi";
import { ProntuarioForm } from "@/components/sidebar/ProntuarioForm";
import { QueixaForm } from "@/components/sidebar/QueixaForm";
import { ChatDrawerContent } from "@/components/chat/ChatDrawerContent";
import { AdminChatDrawerContent } from "@/components/chat/AdminChatDrawerContent";
import { ReviewModal } from "@/components/ReviewModal";
import type { Appointment } from "@/types/appointment";
import { getFotoSrc } from '@/lib/utils';

interface SidebarRightProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: "therapist" | "patient" | "admin";
}

type SectionTab = "today" | "pending" | "history";

interface SectionData {
  list: Appointment[];
  count: number;
  readOnly: boolean;
}

export function SidebarRight({ isOpen, onClose, userRole }: SidebarRightProps) {
  const router = useRouter();
  const { execute: apiCall } = useApi();
  const {
    selectedAppointmentId, openProntuario, openQueixa,
    isReadOnly, closeSidebar, activeTab, setActiveTab,
  } = useSidebar();

  const [loading, setLoading] = useState(false);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<SectionTab>("today");
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);

  // ✅ Review
  const [pendingReviews, setPendingReviews] = useState<Appointment[]>([]);
  const [reviewAppointmentId, setReviewAppointmentId] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const formatTime = (d?: string) => {
    if (!d) return "--:--";
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (d?: string) => {
    if (!d) return "--/--/----";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const appointments = await apiCall({ url: "/api/appointments/me/details", requireAuth: true }) as Appointment[];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      if (userRole === "therapist" || userRole === "admin") {
        const todays = appointments
          .filter((apt: Appointment) => {
            if (!apt.starts_at) return false;
            const d = new Date(apt.starts_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime() && apt.status === "confirmed";
          })
          .sort((a: Appointment, b: Appointment) => {
            if (!a.starts_at || !b.starts_at) return 0;
            return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
          });

        const history = appointments
          .filter((apt: Appointment) => {
            if (!apt.starts_at) return false;
            const d = new Date(apt.starts_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime() < today.getTime() && apt.status === "completed";
          })
          .sort((a: Appointment, b: Appointment) => {
            if (!a.starts_at || !b.starts_at) return 0;
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          });

        const potentialPending = appointments
          .filter((apt: Appointment) => {
            if (!apt.starts_at) return false;
            const d = new Date(apt.starts_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime() < today.getTime() && apt.status === "confirmed";
          })
          .sort((a: Appointment, b: Appointment) => {
            if (!a.starts_at || !b.starts_at) return 0;
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          });

        const pendingWithNoRecord: Appointment[] = [];
        for (const apt of potentialPending) {
          try {
            const record = await apiCall({ url: `/api/appointments/${apt.id}/medical-record`, requireAuth: true, silent: true });
            if (!record || !record.id) pendingWithNoRecord.push(apt);
          } catch {
            pendingWithNoRecord.push(apt);
          }
        }

        setTodaysAppointments(todays);
        setHistoryAppointments(history);
        setPendingAppointments(pendingWithNoRecord);

        if (todays.length > 0) {
          setActiveSectionTab("today");
          setSelectedAppointment(todays[0]);
          openProntuario(todays[0].id, false);
        } else if (pendingWithNoRecord.length > 0 && !selectedAppointmentId) {
          setActiveSectionTab("pending");
          setSelectedAppointment(pendingWithNoRecord[0]);
          openProntuario(pendingWithNoRecord[0].id, false);
          setActiveTab("prontuario");
        } else if (history.length > 0) {
          setActiveSectionTab("history");
        }
      } else if (userRole === "patient") {
        const todays = appointments
          .filter((apt: Appointment) => {
            if (!apt.starts_at) return false;
            const d = new Date(apt.starts_at);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime() && apt.status === "confirmed";
          })
          .sort((a: Appointment, b: Appointment) => {
            if (!a.starts_at || !b.starts_at) return 0;
            return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
          });
        setTodaysAppointments(todays);
        if (todays.length > 0 && !selectedAppointmentId) {
          setSelectedAppointment(todays[0]);
          openQueixa(todays[0].id);
        } else if (todays.length > 0 && !selectedAppointment) {
          setSelectedAppointment(todays[0]);
        }

        // ✅ Verifica sessões completadas sem review
        const completed = appointments
          .filter((apt: Appointment) => apt.status === "completed")
          .sort((a: Appointment, b: Appointment) => {
            if (!a.starts_at || !b.starts_at) return 0;
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          })
          .slice(0, 5);

        const pending: Appointment[] = [];
        for (const apt of completed) {
          try {
            const check = await apiCall({ url: `/api/reviews/appointment/${apt.id}/check`, requireAuth: true, silent: true });
            if (check && !check.has_review) pending.push(apt);
          } catch {
            pending.push(apt);
          }
        }
        setPendingReviews(pending);
      }
    } catch (err) {
      console.error("Erro ao carregar sessões:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole) loadAppointments();
  }, [userRole]);

  useEffect(() => {
    const handleAppointmentUpdate = () => { loadAppointments(); };
    window.addEventListener('appointmentStatusChanged', handleAppointmentUpdate);
    window.addEventListener('appointmentConfirmed', handleAppointmentUpdate);
    window.addEventListener('appointmentCancelled', handleAppointmentUpdate);
    return () => {
      window.removeEventListener('appointmentStatusChanged', handleAppointmentUpdate);
      window.removeEventListener('appointmentConfirmed', handleAppointmentUpdate);
      window.removeEventListener('appointmentCancelled', handleAppointmentUpdate);
    };
  }, [userRole]);

  useEffect(() => {
    if (selectedAppointmentId) {
      const all = [...todaysAppointments, ...historyAppointments, ...pendingAppointments];
      const found = all.find(a => a.id === selectedAppointmentId);
      if (found) setSelectedAppointment(found);
    }
  }, [selectedAppointmentId, todaysAppointments, historyAppointments, pendingAppointments]);

  const handleSelectAppointment = (apt: Appointment, readOnly: boolean = false) => {
    setSelectedAppointment(apt);
    setSectionDropdownOpen(false);
    if (userRole === "therapist" || userRole === "admin") openProntuario(apt.id, readOnly);
    else openQueixa(apt.id);
  };

  const handleStartSession = (apt: Appointment) => {
    if (apt.id) {
      const role = userRole === "therapist" ? "therapist" : "patient";
      router.push(`/${role}/videochamada/${apt.id}`);
    }
    openProntuario(apt.id, false);
    setSectionDropdownOpen(false);
  };

  const handleSuccess = (message: string) => {
    setToastMessage({ type: "success", message });
    setTimeout(() => setToastMessage(null), 3000);
    loadAppointments();
    window.dispatchEvent(new CustomEvent('prontuarioSaved'));
  };

  const handleError = (message: string) => {
    setToastMessage({ type: "error", message });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sectionData: Record<SectionTab, SectionData> = {
    today:   { list: todaysAppointments,  count: todaysAppointments.length,  readOnly: false },
    pending: { list: pendingAppointments, count: pendingAppointments.length, readOnly: false },
    history: { list: historyAppointments, count: historyAppointments.length, readOnly: true  },
  };

  const currentSection = sectionData[activeSectionTab];

  const getFoto = (apt: Appointment): string | null => {
    const url = userRole === "patient" ? apt.therapist?.foto_url : apt.patient?.foto_url;
    return getFotoSrc(url);
  };

  const getName = (apt: Appointment): string => {
    if (userRole === "patient") {
      return apt.therapist?.full_name || `Terapeuta ${apt.therapist_user_id}`;
    }
    return apt.patient?.full_name || apt.therapist?.full_name || `Sessão ${apt.id}`;
  };

  if (isMinimized) {
    return (
      <button onClick={() => setIsMinimized(false)}
        className="fixed right-4 top-72 z-50 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-3 shadow-lg transition-all hover:scale-105"
        title="Expandir sidebar">
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="w-[420px] h-full bg-white border-l border-gray-200 shadow-lg flex flex-col relative flex-shrink-0">
      <button onClick={() => setIsMinimized(true)}
        className="absolute -left-3 top-72 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-2 shadow-md z-20 transition-all hover:scale-105"
        title="Recolher sidebar">
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-3">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab(userRole === "patient" ? "queixa" : "prontuario")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "prontuario" || activeTab === "queixa" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <FileText className="w-4 h-4 inline mr-1" />
              {userRole === "patient" ? "Queixas" : "Prontuário"}
            </button>
            <button onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "chat" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Chat
            </button>
          </div>
          <button onClick={closeSidebar} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">

          {(activeTab === "prontuario" || activeTab === "queixa") && (
            <div className="w-full">

              {/* TERAPEUTA / ADMIN */}
              {(userRole === "therapist" || userRole === "admin") && (
                <div className="mb-4">
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-2">
                    <button
                      onClick={() => { setActiveSectionTab("today"); setSectionDropdownOpen(true); }}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${activeSectionTab === "today" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Hoje</span>
                      </div>
                      <span className={`text-xs font-bold ${activeSectionTab === "today" ? "text-white/90" : "text-[#E03673]"}`}>
                        {todaysAppointments.length}
                      </span>
                    </button>

                    <button
                      onClick={() => { setActiveSectionTab("pending"); setSectionDropdownOpen(true); }}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 flex flex-col items-center gap-0.5 ${activeSectionTab === "pending" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                      <div className="flex items-center gap-1">
                        <FileWarning className="w-3 h-3" />
                        <span>Pendentes</span>
                      </div>
                      <span className={`text-xs font-bold ${activeSectionTab === "pending" ? "text-white/90" : pendingAppointments.length > 0 ? "text-orange-500" : "text-gray-400"}`}>
                        {pendingAppointments.length}
                      </span>
                    </button>

                    <button
                      onClick={() => { setActiveSectionTab("history"); setSectionDropdownOpen(true); }}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 flex flex-col items-center gap-0.5 ${activeSectionTab === "history" ? "bg-[#2F80D3] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                      <div className="flex items-center gap-1">
                        <History className="w-3 h-3" />
                        <span>Histórico</span>
                      </div>
                      <span className={`text-xs font-bold ${activeSectionTab === "history" ? "text-white/90" : "text-[#2F80D3]"}`}>
                        {historyAppointments.length}
                      </span>
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                  ) : currentSection.list.length === 0 ? (
                    <div className="text-center py-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-400">
                        {activeSectionTab === "today" && "Nenhuma sessão agendada para hoje"}
                        {activeSectionTab === "pending" && "Nenhum prontuário pendente"}
                        {activeSectionTab === "history" && "Nenhuma sessão no histórico"}
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          activeSectionTab === "pending"
                            ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
                            : activeSectionTab === "history"
                            ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {activeSectionTab === "pending" && <FileWarning className="w-3.5 h-3.5 text-orange-500" />}
                            {activeSectionTab === "history" && <History className="w-3.5 h-3.5 text-[#2F80D3]" />}
                            {activeSectionTab === "today" && <Calendar className="w-3.5 h-3.5 text-[#E03673]" />}
                            <span className={`text-sm font-medium ${activeSectionTab === "pending" ? "text-orange-700" : activeSectionTab === "history" ? "text-[#2F80D3]" : "text-gray-700"}`}>
                              {currentSection.list.length} sessão{currentSection.list.length !== 1 ? "ões" : ""}
                            </span>
                          </div>
                          {selectedAppointment && currentSection.list.some(a => a.id === selectedAppointment.id) && (
                            <span className="text-xs text-gray-400 truncate">
                              · {getName(selectedAppointment)}
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${sectionDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {sectionDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                          {currentSection.list.map((apt: Appointment) => (
                            <div key={apt.id}
                              className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 ${selectedAppointment?.id === apt.id ? "bg-[#FCE4EC]" : ""}`}
                              onClick={() => handleSelectAppointment(apt, currentSection.readOnly)}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    {getFoto(apt)
                                      ? <img src={getFoto(apt)!} alt={getName(apt)} className="w-full h-full object-cover" />
                                      : <User className="w-4 h-4 text-gray-500" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{getName(apt)}</p>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                      <span>{formatDate(apt.starts_at)}</span>
                                      <span>·</span>
                                      <span>{formatTime(apt.starts_at)}</span>
                                    </div>
                                  </div>
                                </div>
                                {activeSectionTab === "today" && apt.status !== "cancelled_by_patient" && apt.status !== "cancelled_by_therapist" && (
                                  <button onClick={e => { e.stopPropagation(); handleStartSession(apt); }}
                                    className="px-2 py-1 text-xs bg-[#10B981] hover:bg-[#059669] text-white rounded flex-shrink-0 transition-colors">
                                    Iniciar
                                  </button>
                                )}
                                {activeSectionTab === "pending" && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <FileText className="w-3 h-3 text-orange-500" />
                                    <span className="text-xs text-orange-500">Registrar</span>
                                  </div>
                                )}
                                {activeSectionTab === "history" && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Eye className="w-3 h-3 text-blue-500" />
                                    <span className="text-xs text-blue-500">Ver</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PACIENTE */}
              {userRole === "patient" && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-[#E03673]" /> Sessões de hoje
                    </label>
                    {todaysAppointments.length > 0 && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {todaysAppointments.length} sessão{todaysAppointments.length !== 1 ? "ões" : ""}
                      </span>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                  ) : todaysAppointments.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Nenhuma sessão agendada para hoje</p>
                    </div>
                  ) : todaysAppointments.length === 1 ? (
                    // ✅ UMA SESSÃO: mostra card direto sem dropdown
                    <div className="flex items-center gap-2 p-2 bg-pink-50 border border-pink-200 rounded-lg">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#E03673]/10 flex items-center justify-center flex-shrink-0">
                        {getFotoSrc(todaysAppointments[0]?.therapist?.foto_url)
                          ? <img src={getFotoSrc(todaysAppointments[0]?.therapist?.foto_url) || ""} alt="" className="w-full h-full object-cover" />
                          : <User className="w-4 h-4 text-[#E03673]" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">{todaysAppointments[0]?.therapist?.full_name}</p>
                        <p className="text-xs text-gray-500">{formatTime(todaysAppointments[0]?.starts_at)}</p>
                      </div>
                    </div>
                  ) : (
                    // ✅ MÚLTIPLAS SESSÕES: dropdown
                    <div className="relative">
                      <button onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
                        className="w-full flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#E03673]/10 flex items-center justify-center">
                            {getFotoSrc(selectedAppointment?.therapist?.foto_url)
                              ? <img src={getFotoSrc(selectedAppointment?.therapist?.foto_url) || ""} alt="" className="w-full h-full object-cover" />
                              : <User className="w-4 h-4 text-[#E03673]" />}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">{selectedAppointment?.therapist?.full_name || "Selecione uma sessão"}</p>
                            {selectedAppointment && <p className="text-xs text-gray-500">{formatTime(selectedAppointment.starts_at)}</p>}
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      {sectionDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                          {todaysAppointments.map((apt: Appointment) => (
                            <div key={apt.id}
                              className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 ${selectedAppointment?.id === apt.id ? "bg-[#FCE4EC]" : ""}`}
                              onClick={() => handleSelectAppointment(apt, false)}>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                  {getFotoSrc(apt.therapist?.foto_url)
                                    ? <img src={getFotoSrc(apt.therapist?.foto_url) || ""} alt="" className="w-full h-full object-cover" />
                                    : <User className="w-4 h-4 text-gray-500" />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{apt.therapist?.full_name || `Terapeuta ${apt.therapist_user_id}`}</p>
                                  <p className="text-xs text-gray-500">{formatDate(apt.starts_at)} · {formatTime(apt.starts_at)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ CARD DE AVALIAÇÕES PENDENTES */}
                  {pendingReviews.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs font-medium text-yellow-700 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {pendingReviews.length} sessão{pendingReviews.length !== 1 ? "es" : ""} para avaliar
                      </p>
                      {pendingReviews.slice(0, 2).map(apt => (
                        <button key={apt.id}
                          onClick={() => { setReviewAppointmentId(apt.id); setShowReviewModal(true); }}
                          className="w-full text-left text-xs p-1.5 hover:bg-yellow-100 rounded flex justify-between items-center transition-colors">
                          <span className="text-gray-700 truncate">{apt.therapist?.full_name}</span>
                          <span className="text-yellow-600 flex-shrink-0 ml-1">{formatDate(apt.starts_at)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(userRole === "therapist" || userRole === "admin") &&
                todaysAppointments.length === 0 && historyAppointments.length === 0 &&
                pendingAppointments.length === 0 && !loading && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-100">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Nenhuma sessão encontrada</p>
                  <p className="text-xs text-gray-400 mt-1">Agende sessões para começar</p>
                </div>
              )}
              {userRole === "patient" && todaysAppointments.length === 0 && !loading && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-100">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Nenhuma sessão agendada para hoje</p>
                </div>
              )}

              {(userRole === "therapist" || userRole === "admin") ? (
                <ProntuarioForm
                  appointmentId={selectedAppointment?.id || 0}
                  therapistUserId={selectedAppointment?.therapist_user_id}
                  readOnly={isReadOnly}
                  totalPendingCount={pendingAppointments.length}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              ) : (selectedAppointmentId || selectedAppointment?.id) ? (
                <QueixaForm
                  appointmentId={selectedAppointmentId || selectedAppointment?.id || 0}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              ) : null}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="w-full">
              {userRole === "admin"
                ? <AdminChatDrawerContent userRole={userRole} />
                : <ChatDrawerContent userRole={userRole} />}
            </div>
          )}
        </div>
      </div>

      {/* ✅ MODAL DE AVALIAÇÃO */}
      {showReviewModal && reviewAppointmentId && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => { setShowReviewModal(false); setReviewAppointmentId(null); loadAppointments(); }}
          appointmentId={reviewAppointmentId}
          therapistName={pendingReviews.find(a => a.id === reviewAppointmentId)?.therapist?.full_name || ""}
          onSuccess={() => loadAppointments()}
        />
      )}

      {toastMessage && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className={`p-2 rounded-lg shadow-lg text-center text-sm ${toastMessage.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
            {toastMessage.message}
          </div>
        </div>
      )}
    </div>
  );
}