"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, User, Mail, Phone, Calendar, Search, Star, Loader2, AlertCircle, ChevronRight, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function TerapeutaPacientesPage() {
  const router = useRouter();
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSessions, setPatientSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [appointmentsData, patientsData] = await Promise.all([
          api("/api/appointments/me/details"),
          api("/api/patients"),
        ]);

        const map = new Map<number, any>();
        patientsData.forEach((p: any) => {
          map.set(p.id, { ...p, session_count: 0, total_spent: 0, last_session: null });
        });

        appointmentsData.forEach((apt: any) => {
          if (["confirmed", "completed"].includes(apt.status)) {
            const p = map.get(apt.patient_user_id);
            if (p) {
              p.session_count++;
              p.total_spent = (p.total_spent || 0) + (apt.session_price || 0);
              const d = new Date(apt.starts_at);
              if (!p.last_session || d > new Date(p.last_session)) p.last_session = apt.starts_at;
            }
          }
        });

        const list = Array.from(map.values())
          .filter(p => p.session_count > 0)
          .sort((a, b) => b.session_count - a.session_count);

        setAllPatients(list);
      } catch (e: any) {
        setError("Erro ao carregar pacientes.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openPatient(patient: any) {
    setSelectedPatient(patient);
    setLoadingSessions(true);
    try {
      const data = await api("/api/appointments/me/details");
      const sessions = (data || [])
        .filter((a: any) => a.patient_user_id === patient.id)
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      setPatientSessions(sessions);
    } catch { setPatientSessions([]); }
    finally { setLoadingSessions(false); }
  }

  const filtered = allPatients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const STATUS_LABEL: Record<string, string> = {
    confirmed: "Confirmada", completed: "Realizada", cancelled_by_patient: "Cancelada",
    cancelled_by_therapist: "Cancelada", scheduled: "Agendada",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Meus Pacientes</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{allPatients.length} paciente(s) com sessões</div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}

        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..."
            style={{ width: "100%", padding: "12px 12px 12px 38px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" as const }} />
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <Users size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>{search ? "Nenhum resultado" : "Nenhum paciente ainda"}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(p => {
              const photo = getPhotoSrc(p.foto_url);
              return (
                <button key={p.id} onClick={() => openPatient(p)}
                  style={{ background: "white", borderRadius: 14, padding: 14, border: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={22} color="#9CA3AF" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}><Mail size={10} /> {p.email}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, display: "flex", alignItems: "center", gap: 4 }}><Star size={12} /> {p.session_count}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>sessões</div>
                  </div>
                  <ChevronRight size={16} color="#9CA3AF" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedPatient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getPhotoSrc(selectedPatient.foto_url) ? <img src={getPhotoSrc(selectedPatient.foto_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={24} color="#9CA3AF" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark }}>{selectedPatient.full_name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selectedPatient.email}</div>
                </div>
                <button onClick={() => setSelectedPatient(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 20 }}>✕</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Sessões", value: selectedPatient.session_count, color: COLORS.primary },
                  { label: "Total pago", value: brl(selectedPatient.total_spent || 0), color: "#059669" },
                  { label: "Última sessão", value: fmt(selectedPatient.last_session), color: "#6B7280" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>Histórico de sessões</div>
            </div>

            <div style={{ padding: "0 20px 24px" }}>
              {loadingSessions ? (
                <div style={{ textAlign: "center", padding: 20 }}><Loader2 size={24} className="animate-spin" color={COLORS.primary} /></div>
              ) : patientSessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF", fontSize: 13 }}>Nenhuma sessão encontrada</div>
              ) : (
                patientSessions.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #F3F4F6" }}>
                    <div>
                      <div style={{ fontSize: 13, color: COLORS.dark }}>{new Date(s.starts_at).toLocaleDateString("pt-BR")}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{STATUS_LABEL[s.status] || s.status}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{brl(s.session_price)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
