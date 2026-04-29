"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, User, Calendar, Clock, Loader2, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";
import { QueixaForm } from "@/components/sidebar/QueixaForm";
import MobileDrawer from "@/components/mobile/MobileDrawer";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  dark: "#3A3B21",
};

interface Appointment {
  id: number;
  starts_at: string;
  status: string;
  therapist?: {
    full_name?: string;
    foto_url?: string;
  };
}

export default function MobileQueixasPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await api("/api/appointments/me/details");
      const now = new Date();
      const filtered = (data || [])
        .filter((a: any) => ["confirmed", "scheduled", "completed"].includes(a.status))
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .slice(0, 20);
      setAppointments(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDrawerOpen(true);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusLabel = (status: string) => {
    if (status === "confirmed") return { label: "Confirmada", color: "#2F80D3" };
    if (status === "scheduled") return { label: "Agendada", color: "#FB8811" };
    if (status === "completed") return { label: "Realizada", color: "#10B981" };
    return { label: status, color: "#9CA3AF" };
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Queixas" showBack backTo="/mobile/dashboard" />

      {/* HERO */}
      <div style={{ backgroundColor: COLORS.primary, padding: "16px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MessageSquare size={22} color="white" />
          <div>
            <p style={{ color: "white", fontSize: 15, fontWeight: 600, margin: 0 }}>Registrar Queixa</p>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Selecione uma sessão para registrar sua queixa</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Loader2 size={40} color={COLORS.primary} className="animate-spin" style={{ margin: "0 auto" }} />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <MessageSquare size={48} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14 }}>Nenhuma sessão encontrada</p>
          </div>
        ) : (
          appointments.map((apt) => {
            const status = getStatusLabel(apt.status);
            const fotoUrl = getFotoSrc(apt.therapist?.foto_url);
            return (
              <div
                key={apt.id}
                onClick={() => handleOpen(apt)}
                style={{
                  backgroundColor: "white",
                  borderRadius: 14,
                  padding: "14px 16px",
                  marginBottom: 10,
                  border: `1px solid ${COLORS.grayBorder}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.dark, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {apt.therapist?.full_name || "Terapeuta"}
                  </p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} /> {formatDate(apt.starts_at)}
                  </p>
                  <span style={{ fontSize: 11, color: status.color, backgroundColor: status.color + "15", padding: "2px 8px", borderRadius: 8 }}>
                    {status.label}
                  </span>
                </div>
                <ChevronRight size={18} color="#9CA3AF" />
              </div>
            );
          })
        )}
      </div>

      {/* DRAWER COM FORM DE QUEIXA */}
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedAppointment(null); }}
        title={`Queixa — ${selectedAppointment?.therapist?.full_name || "Terapeuta"}`}
      >
        <div style={{ padding: 16 }}>
          {selectedAppointment && (
            <QueixaForm
              appointmentId={selectedAppointment.id}
              onSuccess={(msg) => {
                setToast({ type: "success", message: msg });
                setTimeout(() => setToast(null), 3000);
                setDrawerOpen(false);
              }}
              onError={(msg) => {
                setToast({ type: "error", message: msg });
                setTimeout(() => setToast(null), 3000);
              }}
            />
          )}
        </div>
      </MobileDrawer>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 300,
          backgroundColor: toast.type === "success" ? "#10B981" : "#EF4444",
          color: "white", borderRadius: 12, padding: "12px 16px",
          fontSize: 14, fontWeight: 500, textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}