"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Plus, Trash2, Save, AlertCircle, CheckCircle, Loader2, AlertTriangle, Pencil, X, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const WEEKDAYS: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

const fmt = (d: string) => { if (!d) return ""; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };

type Slot = { weekday: number; start_time: string; end_time: string };

export default function TerapeutaDisponibilidadePage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([{ weekday: 1, start_time: "07:00", end_time: "08:00" }]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api("/api/therapist/availability/periods");
      setPeriods(Array.isArray(data) ? data : []);
    } catch { setError("Erro ao carregar períodos."); }
    finally { setLoading(false); }
  }

  const getNextSlot = useCallback((base?: Slot): Slot => {
    const ref = base ?? slots[slots.length - 1];
    if (!ref) return { weekday: 1, start_time: "07:00", end_time: "08:00" };
    const [sh, sm] = ref.start_time.split(":").map(Number);
    const [eh, em] = ref.end_time.split(":").map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    const ns = eh * 60 + em;
    const ne = ns + dur;
    if (ne > 1440) return { weekday: ref.weekday, start_time: "07:00", end_time: "08:00" };
    const pad = (n: number) => String(Math.floor(n / 60)).padStart(2,"0") + ":" + String(n % 60).padStart(2,"0");
    return { weekday: ref.weekday, start_time: pad(ns), end_time: pad(ne) };
  }, [slots]);

  function addSlot(afterIndex?: number) {
    if (afterIndex === undefined) {
      setSlots(s => [...s, getNextSlot()]);
    } else {
      setSlots(s => { const next = getNextSlot(s[afterIndex]); const u = [...s]; u.splice(afterIndex + 1, 0, next); return u; });
    }
  }

  function removeSlot(i: number) { setSlots(s => s.filter((_, idx) => idx !== i)); }
  function updateSlot(i: number, field: keyof Slot, value: any) { setSlots(s => s.map((sl, idx) => idx === i ? { ...sl, [field]: value } : sl)); }

  function checkOverlap(slotsToCheck: Slot[]): string {
    const byDay: Record<number, { start: number; end: number }[]> = {};
    for (const s of slotsToCheck) {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      const st = sh * 60 + sm, en = eh * 60 + em;
      if (!byDay[s.weekday]) byDay[s.weekday] = [];
      for (const ex of byDay[s.weekday]) {
        if ((st >= ex.start && st < ex.end) || (en > ex.start && en <= ex.end) || (st <= ex.start && en >= ex.end))
          return `Horário sobreposto em ${WEEKDAYS[s.weekday]}: ${s.start_time}-${s.end_time}`;
      }
      byDay[s.weekday].push({ start: st, end: en });
    }
    return "";
  }

  function hasDuplicate(sd: string, ed: string): boolean {
    return periods.some(p => p.start_date === sd && p.end_date === ed && p.id !== editingId);
  }

  function startEdit(period: any) {
    setEditingId(period.id);
    setStartDate(period.start_date);
    setEndDate(period.end_date);
    setSlots(period.slots.map((s: any) => ({ weekday: s.weekday, start_time: s.start_time.substring(0,5), end_time: s.end_time.substring(0,5) })));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditingId(null); setStartDate(""); setEndDate(""); setSlots([{ weekday: 1, start_time: "07:00", end_time: "08:00" }]); setError(""); }

  async function handleSave() {
    if (!startDate || !endDate) { setError("Preencha as datas do período."); return; }
    if (new Date(startDate) > new Date(endDate)) { setError("A data de início deve ser anterior à data de fim."); return; }
    if (slots.length === 0) { setError("Adicione pelo menos um horário."); return; }
    const overlapMsg = checkOverlap(slots);
    if (overlapMsg) { setError(overlapMsg); return; }
    if (hasDuplicate(startDate, endDate)) { setError("Já existe um período com essas datas."); return; }

    setSaving(true); setError("");
    try {
      if (editingId) {
        await api(`/api/therapist/availability/periods/${editingId}`, { method: "PUT", body: JSON.stringify({ start_date: startDate, end_date: endDate, slots }) });
        setSuccess("Período atualizado!");
      } else {
        await api("/api/therapist/availability/periods", { method: "POST", body: JSON.stringify({ start_date: startDate, end_date: endDate, slots }) });
        setSuccess("Período criado!");
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
    } catch (e: any) { setError(e.message || "Erro ao remover."); }
    finally { setDeleting(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 100 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          ← Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Disponibilidade</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Gerencie seus períodos e horários</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}

        {/* Formulário */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{editingId ? "Editar período" : "Novo período"}</div>
            {editingId && <button onClick={cancelEdit} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><X size={12} /> Cancelar edição</button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block" }}>Data início *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block" }}>Data fim *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>HORÁRIOS ({slots.length})</div>
            <button onClick={() => addSlot()} style={{ background: COLORS.primary + "15", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: COLORS.primary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Adicionar horário
            </button>
          </div>

          {slots.map((slot, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 32px 32px", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <select value={slot.weekday} onChange={e => updateSlot(i, "weekday", Number(e.target.value))}
                style={{ padding: "8px 6px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, outline: "none" }}>
                {Object.entries(WEEKDAYS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="time" value={slot.start_time} onChange={e => updateSlot(i, "start_time", e.target.value)}
                style={{ padding: "8px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, outline: "none" }} />
              <input type="time" value={slot.end_time} onChange={e => updateSlot(i, "end_time", e.target.value)}
                style={{ padding: "8px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, outline: "none" }} />
              <button onClick={() => addSlot(i)} style={{ background: COLORS.primary + "15", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={14} color={COLORS.primary} />
              </button>
              <button onClick={() => removeSlot(i)} disabled={slots.length === 1} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: slots.length === 1 ? 0.4 : 1 }}>
                <Trash2 size={14} color="#DC2626" />
              </button>
            </div>
          ))}

          {slots.length > 0 && (
            <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
              <TrendingUp size={11} /> O sistema sugere o próximo horário automaticamente ao adicionar.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {editingId && (
              <button onClick={cancelEdit} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {editingId ? "Salvar alterações" : "Salvar período"}</>}
            </button>
          </div>
        </div>

        {/* Lista de períodos */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} color={COLORS.primary} /> Períodos cadastrados
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}><Loader2 size={24} className="animate-spin" color={COLORS.primary} /></div>
          ) : periods.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Calendar size={32} color="#D1D5DB" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum período cadastrado.</div>
              <div style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4 }}>Adicione seu primeiro período acima.</div>
            </div>
          ) : (
            periods.map(p => (
              <div key={p.id} style={{ border: "0.5px solid #E5E7EB", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={13} color={COLORS.primary} /> {fmt(p.start_date)} até {fmt(p.end_date)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{p.slots.length} {p.slots.length === 1 ? "horário" : "horários"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(p)} style={{ background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: COLORS.secondary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setConfirmDelete(p.id)} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.slots.map((s: any) => (
                    <span key={s.id} style={{ fontSize: 11, background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "4px 8px", color: COLORS.dark, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} color="#9CA3AF" /> {WEEKDAYS[s.weekday]} {s.start_time.substring(0,5)}–{s.end_time.substring(0,5)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal confirmar deleção */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 360, overflow: "hidden" }}>
            <div style={{ padding: 20, borderBottom: "0.5px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, background: "#FEE2E2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={20} color="#DC2626" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark }}>Remover período?</div>
              </div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>
                Esta ação removerá o período e <strong>todos os seus horários</strong>. Não pode ser desfeita.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: 16, background: "#F9FAFB" }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ flex: 1, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 0", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                style={{ flex: 1, background: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <><Trash2 size={14} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
