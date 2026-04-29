"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, User, Loader2, Receipt, CheckCircle, Search, X } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";

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
  session_price?: number;
  duration_minutes?: number;
  therapist?: {
    full_name?: string;
    foto_url?: string;
  };
}

export default function MobileSessoesRealizadasPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filtered, setFiltered] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<Appointment | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(appointments);
    } else {
      const t = search.toLowerCase();
      setFiltered(appointments.filter(a =>
        a.therapist?.full_name?.toLowerCase().includes(t)
      ));
    }
  }, [search, appointments]);

  const loadAppointments = async () => {
    try {
      const data = await api("/api/appointments/me/details");
      const completed = (data || [])
        .filter((a: any) => a.status === "completed")
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      setAppointments(completed);
      setFiltered(completed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const formatCurrency = (v?: number) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const totalGasto = appointments.reduce((s, a) => s + (a.session_price || 0), 0);

  const handlePrintReceipt = (apt: Appointment) => {
    setSelectedReceipt(apt);
  };

  const printReceipt = () => {
    if (!selectedReceipt) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Recibo — Sessão #${selectedReceipt.id}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
            h1 { color: #E03673; font-size: 20px; }
            .label { color: #6B7280; font-size: 12px; margin-top: 12px; }
            .value { color: #111827; font-size: 15px; font-weight: 600; }
            .total { font-size: 20px; color: #10B981; margin-top: 20px; }
            hr { border: none; border-top: 1px solid #E5E7EB; margin: 16px 0; }
            .footer { font-size: 11px; color: #9CA3AF; margin-top: 24px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Meu Divã — Recibo de Sessão</h1>
          <hr/>
          <div class="label">Sessão #</div>
          <div class="value">${selectedReceipt.id}</div>
          <div class="label">Terapeuta</div>
          <div class="value">${selectedReceipt.therapist?.full_name || "—"}</div>
          <div class="label">Data</div>
          <div class="value">${formatDate(selectedReceipt.starts_at)}</div>
          <div class="label">Horário</div>
          <div class="value">${formatTime(selectedReceipt.starts_at)}</div>
          <div class="label">Duração</div>
          <div class="value">${selectedReceipt.duration_minutes || 50} minutos</div>
          <hr/>
          <div class="label">Valor pago</div>
          <div class="total">${formatCurrency(selectedReceipt.session_price)}</div>
          <div class="footer">Gerado em ${new Date().toLocaleDateString("pt-BR")} — meudivaonline.com</div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
    setSelectedReceipt(null);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Sessões Realizadas" showBack backTo="/mobile/dashboard" />

      {/* HERO */}
      <div style={{ backgroundColor: COLORS.secondary, padding: "16px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={22} color="white" />
            <div>
              <p style={{ color: "white", fontSize: 15, fontWeight: 600, margin: 0 }}>Sessões realizadas</p>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>{appointments.length} sessões no total</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, margin: 0 }}>Total investido</p>
            <p style={{ color: "white", fontSize: 16, fontWeight: 700, margin: 0 }}>{formatCurrency(totalGasto)}</p>
          </div>
        </div>
      </div>

      {/* BUSCA */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ position: "relative" }}>
          <Search size={15} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por terapeuta..."
            style={{
              width: "100%", padding: "10px 12px 10px 34px",
              borderRadius: 10, border: `1px solid ${COLORS.grayBorder}`,
              fontSize: 13, outline: "none", backgroundColor: "white",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
              <X size={14} color="#9CA3AF" />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Loader2 size={40} color={COLORS.primary} className="animate-spin" style={{ margin: "0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <CheckCircle size={48} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14 }}>
              {search ? "Nenhuma sessão encontrada" : "Nenhuma sessão realizada ainda"}
            </p>
          </div>
        ) : (
          filtered.map((apt) => {
            const fotoUrl = getFotoSrc(apt.therapist?.foto_url);
            return (
              <div
                key={apt.id}
                style={{
                  backgroundColor: "white", borderRadius: 14, padding: "14px 16px",
                  marginBottom: 10, border: `1px solid ${COLORS.grayBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {apt.therapist?.full_name || "Terapeuta"}
                    </p>
                    <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={10} /> {formatDate(apt.starts_at)} às {formatTime(apt.starts_at)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
                        {formatCurrency(apt.session_price)}
                      </span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {apt.duration_minutes || 50} min
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePrintReceipt(apt)}
                    style={{
                      backgroundColor: COLORS.gray, color: COLORS.secondary,
                      border: `1px solid ${COLORS.grayBorder}`, borderRadius: 8,
                      padding: "6px 10px", fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                    }}
                  >
                    <Receipt size={12} /> Recibo
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL RECIBO */}
      {selectedReceipt && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            style={{ backgroundColor: "white", borderRadius: "20px 20px 0 0", width: "100%", padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.secondary, marginBottom: 16 }}>
              Recibo da Sessão
            </h3>

            {[
              { label: "Sessão #", value: `${selectedReceipt.id}` },
              { label: "Terapeuta", value: selectedReceipt.therapist?.full_name || "—" },
              { label: "Data", value: formatDate(selectedReceipt.starts_at) },
              { label: "Horário", value: formatTime(selectedReceipt.starts_at) },
              { label: "Duração", value: `${selectedReceipt.duration_minutes || 50} minutos` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{value}</span>
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${COLORS.grayBorder}`, marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>Total pago</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#10B981" }}>{formatCurrency(selectedReceipt.session_price)}</span>
            </div>

            <button
              onClick={printReceipt}
              style={{
                width: "100%", marginTop: 20, padding: "14px",
                backgroundColor: COLORS.secondary, color: "white",
                border: "none", borderRadius: 12, fontSize: 15,
                fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Receipt size={18} /> Imprimir / Salvar PDF
            </button>

            <button
              onClick={() => setSelectedReceipt(null)}
              style={{
                width: "100%", marginTop: 10, padding: "12px",
                backgroundColor: COLORS.gray, color: "#6B7280",
                border: `1px solid ${COLORS.grayBorder}`, borderRadius: 12,
                fontSize: 14, cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}