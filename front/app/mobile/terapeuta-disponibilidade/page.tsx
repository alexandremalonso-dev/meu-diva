"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Plus, Trash2, Save, AlertCircle, CheckCircle, Loader2, Pencil, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const WEEKDAYS: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

function fmt(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function TerapeutaDisponibilidadePage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState([{ weekday: 1, start_time: "07:00", end_time: "08:00" }]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api("/api/therapist/availability/periods");
      setPeriods(Array.isArray(data) ? data : []);
    } catch { setError("Erro ao carregar disponibilidade."); }
    finally { setLoading(false); }
  }

  function addSlot() {
    const last = slots[slots.length - 1];
    const [h, m] = last.end_time.split(":").map(Number);
    const nextStart = h * 60 + m;
    const nextEnd = nextStart + (h * 60 + m - (Number(last.start_time.split(":")[0]) * 60 + Number(last.start_time.split(":")[1])));
    if (nextEnd > 24 * 60) { setSlots(s => [...s, { weekday: last.weekday, start_time: "07:00", end_time: "08:00" }]); return; }
    const ns = `${String(Math.floor(nextStart / 60)).padStart(2, "0")}:${String(nextStart % 60).padStart(2, "0")}`;
    const ne = `${String(Math.floor(nextEnd / 60)).padStart(2, "0")}:${String(nextEnd % 60).padStart(2, "0")}`;
    setSlots(s => [...s, { weekday: last.weekday, start_time: ns, end_time: ne }]);
  }

  function removeSlot(i: number) { setSlots(s => s.filter((_, idx) => idx !== i)); }
  function updateSlot(i: number, field: string, value: any) { setSlots(s => s.map((slot, idx) => idx === i ? { ...slot, [field]: value } : slot)); }

  function startEdit(period: any) {
    setEditingId(period.id);
    setStartDate(period.start_date);
    setEndDate(period.end_date);
    setSlots(period.slots.map((s: any) => ({ weekday: s.weekday, start_time: s.start_time.substring(0, 5), end_time: s.end_time.substring(0, 5) })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditingId(null); setStartDate(""); setEndDate(""); setSlots([{ weekday: 1, start_time: "07:00", end_time: "08:00" }]); setError(""); }

  async function handleSave() {
    if (!startDate || !endDate) { setError("Preencha as datas do período."); return; }
    if (slots.length === 0) { setError("Adicione pelo menos um horário."); return; }
    setSaving(true); setError("");
    try {
      const payload = { start_date: startDate, end_date: endDate, slots };
      if (editingId) {
        await api(`/api/therapist/availability/periods/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setSuccess("Período atualizado com sucesso!");
      } else {
        await api("/api/therapist/availability/periods", { method: "POST", body: JSON.stringify(payload) });
        setSuccess("Período criado com sucesso!");
      }
      cancelEdit(); await load(); setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message || "Erro ao salvar período."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await api(`/api/therapist/availability/periods/${id}`, { method: "DELETE" });
      setConfirmDelete(null); setSuccess("Período removido."); await load(); setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message || "Erro ao remover período."); }
    finally { setDeleting(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Disponibilidade</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Gerencie seus períodos e horários</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}

        {/* Formulário */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, marginBottom: 14 }}>{editingId ? "Editar período" : "Novo período"}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Data início</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
            <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Data fim</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>HORÁRIOS</div>
          {slots.map((slot, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select value={slot.weekday} onChange={e => updateSlot(i, "weekday", Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }}>
                {Object.entries(WEEKDAYS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="time" value={slot.start_time} onChange={e => updateSlot(i, "start_time", e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }} />
              <input type="time" value={slot.end_time} onChange={e => updateSlot(i, "end_time", e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }} />
              <button onClick={() => addSlot()} style={{ background: COLORS.primary + "15", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={14} color={COLORS.primary} />
              </button>
              <button onClick={() => removeSlot(i)} disabled={slots.length === 1} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: slots.length === 1 ? 0.4 : 1 }}>
                <Trash2 size={14} color="#DC2626" />
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {editingId && <button onClick={cancelEdit} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Cancelar</button>}
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {editingId ? "Salvar alterações" : "Salvar período"}</>}
            </button>
          </div>
        </div>

        {/* Lista de períodos */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, marginBottom: 12 }}>Períodos cadastrados</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20 }}><Loader2 size={24} className="animate-spin" color={COLORS.primary} /></div>
          ) : periods.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Calendar size={32} color="#D1D5DB" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum período cadastrado</div>
            </div>
          ) : (
            periods.map(period => (
              <div key={period.id} style={{ border: "0.5px solid #E5E7EB", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={13} color={COLORS.primary} /> {fmt(period.start_date)} até {fmt(period.end_date)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{period.slots.length} horário(s)</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(period)} style={{ background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: COLORS.secondary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setConfirmDelete(period.id)} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {period.slots.map((s: any) => (
                    <span key={s.id} style={{ fontSize: 11, background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", color: COLORS.dark, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} color="#9CA3AF" /> {WEEKDAYS[s.weekday]} {s.start_time.substring(0, 5)}-{s.end_time.substring(0, 5)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, background: "#FEE2E2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark }}>Remover período?</div>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Esta ação removerá o período e todos os seus horários. Não pode ser desfeita.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} style={{ flex: 1, background: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
