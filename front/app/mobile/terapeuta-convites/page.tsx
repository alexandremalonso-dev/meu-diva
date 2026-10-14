"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, User, Calendar, Clock, Send, XCircle, Loader2, AlertCircle, CheckCircle, CalendarPlus, Search, Plus } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  proposed: { label: "Aguardando resposta", bg: "#FEF3C7", color: "#92400E" },
  pending:  { label: "Aguardando resposta", bg: "#FEF3C7", color: "#92400E" },
  confirmed:{ label: "Confirmado", bg: "#D1FAE5", color: "#065F46" },
  declined: { label: "Recusado", bg: "#FEE2E2", color: "#991B1B" },
  cancelled_by_therapist: { label: "Cancelado", bg: "#FEE2E2", color: "#991B1B" },
  cancelled_by_patient:   { label: "Cancelado (paciente)", bg: "#FEE2E2", color: "#991B1B" },
};

export default function TerapeutaConvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [duration, setDuration] = useState(50);
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    load();
    api("/api/patients").then(d => setPatients(Array.isArray(d) ? d : [])).catch(() => {});
    api("/api/therapists/me/profile").then(p => setTherapistProfileId(p.id)).catch(() => {});
  }, []);

  async function load() {
    try {
      const data = await api("/api/invites/me");
      setInvites(Array.isArray(data) ? data : []);
    } catch { setError("Erro ao carregar convites."); }
    finally { setLoading(false); }
  }

  async function handleCancel(id: number) {
    setActionLoading(r => ({ ...r, [id]: true }));
    try {
      await api(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelled_by_therapist" }) });
      setSuccess("Convite cancelado."); setTimeout(() => setSuccess(""), 3000); await load();
    } catch (e: any) { setError(e.message || "Erro ao cancelar."); }
    finally { setActionLoading(r => ({ ...r, [id]: false })); }
  }

  async function openModal(patient?: any) {
    setSelectedPatient(patient || null); setSelectedSlot(null); setCustomDate(""); setCustomTime(""); setUseCustom(false); setShowModal(true);
    if (therapistProfileId) {
      setLoadingSlots(true);
      try {
        const data = await api(`/public/terapeutas/${therapistProfileId}/slots?days=30`);
        setSlots(data.slots || []);
      } catch { setSlots([]); }
      finally { setLoadingSlots(false); }
    }
  }

  async function sendInvite() {
    if (!selectedPatient) { setError("Selecione um paciente."); return; }
    if (!useCustom && !selectedSlot) { setError("Selecione um horário."); return; }
    if (useCustom && (!customDate || !customTime)) { setError("Preencha data e hora."); return; }
    setSendingInvite(true); setError("");
    try {
      let startsAt: Date, endsAt: Date;
      if (useCustom) {
        startsAt = new Date(`${customDate}T${customTime}:00`);
        endsAt = new Date(startsAt.getTime() + duration * 60000);
      } else {
        startsAt = new Date(selectedSlot.starts_at);
        endsAt = new Date(selectedSlot.ends_at);
      }
      await api("/api/invites/send", { method: "POST", body: JSON.stringify({ patient_user_id: selectedPatient.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: duration }) });
      setShowModal(false); setSuccess("✅ Convite enviado com sucesso!"); setTimeout(() => setSuccess(""), 3000); await load();
    } catch (e: any) { setError(e.message || "Erro ao enviar convite."); }
    finally { setSendingInvite(false); }
  }

  const filteredPatients = patients.filter(p => p.full_name?.toLowerCase().includes(searchPatient.toLowerCase()) || p.email?.toLowerCase().includes(searchPatient.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Convites</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Convide e acompanhe pacientes</div>
          </div>
          <button onClick={() => openModal()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "8px 14px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Novo convite
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {error && !showModal && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : invites.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <Mail size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>Nenhum convite enviado</div>
            <button onClick={() => openModal()} style={{ marginTop: 8, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enviar primeiro convite</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {invites.map(invite => {
              const st = STATUS[invite.status] || { label: invite.status, bg: "#F3F4F6", color: "#374151" };
              const photo = getPhotoSrc(invite.patient_foto_url);
              const isPending = ["proposed", "pending"].includes(invite.status);
              return (
                <div key={invite.id} style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
                  <div style={{ background: st.bg, padding: "8px 14px", fontSize: 12, color: st.color, fontWeight: 500 }}>{st.label}</div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{invite.patient_name || "Paciente"}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{invite.patient_email}</div>
                      </div>
                    </div>
                    <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6B7280", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={12} /> {fmt(invite.starts_at)} · {invite.duration_minutes || 50} min
                    </div>
                    {isPending && (
                      <button onClick={() => handleCancel(invite.id)} disabled={actionLoading[invite.id]}
                        style={{ width: "100%", background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 8, padding: "10px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading[invite.id] ? 0.5 : 1 }}>
                        {actionLoading[invite.id] ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Cancelar convite</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark }}>Novo convite</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280" }}><XCircle size={20} /></button>
            </div>
            <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Selecionar paciente */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark, marginBottom: 8, display: "block" }}>Paciente</label>
                {selectedPatient ? (
                  <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.primary + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={16} color={COLORS.primary} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{selectedPatient.full_name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{selectedPatient.email}</div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><XCircle size={16} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                      <input value={searchPatient} onChange={e => setSearchPatient(e.target.value)} placeholder="Buscar paciente..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
                    </div>
                    <div style={{ maxHeight: 160, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                      {filteredPatients.slice(0, 10).map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setSearchPatient(""); }}
                          style={{ background: "#F9FAFB", border: "none", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
                          <User size={16} color="#9CA3AF" />
                          <div><div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{p.full_name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.email}</div></div>
                        </button>
                      ))}
                      {filteredPatients.length === 0 && searchPatient && <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 12 }}>Nenhum paciente encontrado</div>}
                    </div>
                  </>
                )}
              </div>

              {/* Duração */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark, marginBottom: 8, display: "block" }}>Duração</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[30, 50].map(d => (
                    <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, padding: "10px 0", border: `2px solid ${duration === d ? COLORS.primary : "#E5E7EB"}`, borderRadius: 10, background: duration === d ? "#FFF0F5" : "white", color: duration === d ? COLORS.primary : "#6B7280", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{d} min</button>
                  ))}
                </div>
              </div>

              {/* Horário */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark, marginBottom: 8, display: "block" }}>Horário</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[{ val: false, label: "Horários sugeridos" }, { val: true, label: "Personalizado" }].map(o => (
                    <button key={String(o.val)} onClick={() => setUseCustom(o.val)} style={{ flex: 1, padding: "10px 0", border: `2px solid ${useCustom === o.val ? COLORS.secondary : "#E5E7EB"}`, borderRadius: 10, background: useCustom === o.val ? "#EFF6FF" : "white", color: useCustom === o.val ? COLORS.secondary : "#6B7280", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{o.label}</button>
                  ))}
                </div>

                {!useCustom ? (
                  loadingSlots ? <div style={{ textAlign: "center", padding: 16 }}><Loader2 size={20} className="animate-spin" color={COLORS.primary} /></div> :
                  slots.length === 0 ? <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 12 }}>Nenhum horário disponível</div> :
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 200, overflow: "auto" }}>
                    {slots.slice(0, 20).map((s, i) => (
                      <button key={i} onClick={() => setSelectedSlot(s)}
                        style={{ padding: "10px 8px", border: `2px solid ${selectedSlot === s ? COLORS.primary : "#E5E7EB"}`, borderRadius: 10, background: selectedSlot === s ? "#FFF0F5" : "white", color: selectedSlot === s ? COLORS.primary : COLORS.dark, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                        {new Date(s.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}<br />
                        {new Date(s.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block" }}>Data</label>
                      <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} min={new Date().toISOString().split("T")[0]} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
                    <div><label style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block" }}>Hora</label>
                      <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
                  </div>
                )}
              </div>

              {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</div>}

              <button onClick={sendInvite} disabled={sendingInvite}
                style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sendingInvite ? 0.7 : 1 }}>
                {sendingInvite ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <><Send size={18} /> Enviar convite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
