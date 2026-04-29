"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useUserPhotos } from "@/hooks/useUserPhotos";
import { UserAvatar } from "@/components/ui/UserAvatar";
import Link from "next/link";
import {
  CalendarDays, Clock, Plus, Trash2, Save, X,
  AlertCircle, CheckCircle, Loader2, Search,
  Filter, ChevronLeft, ChevronRight, Edit
} from "lucide-react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface AvailabilitySlot {
  id: number;
  period_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

interface AvailabilityPeriod {
  id: number;
  therapist_profile_id: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  slots: AvailabilitySlot[];
  therapist_name?: string;
  therapist_user_id?: number;
  foto_url?: string;
}

interface Therapist {
  id: number;
  user_id: number;
  profile_id: number;
  full_name: string;
  email: string;
  foto_url?: string;
}

export default function AdminAvailabilityPage() {
  const { execute: apiCall } = useApi();
  const { enrichWithPhotos } = useUserPhotos();

  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedTherapistId, setSelectedTherapistId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AvailabilityPeriod | null>(null);
  const [editingSlots, setEditingSlots] = useState<Omit<AvailabilitySlot, "id" | "period_id" | "created_at">[]>([]);
  const [saving, setSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ Carregar terapeutas usando o hook de fotos
  const loadTherapists = useCallback(async () => {
    try {
      const therapistsData = await apiCall({ url: "/api/therapists" }) as any[];
      const comFotos = await enrichWithPhotos(therapistsData);

      const therapistsList: Therapist[] = comFotos.map((t: any) => ({
        id: t.user_id,
        user_id: t.user_id,
        profile_id: t.id,
        full_name: t.full_name || t.user?.full_name || `Terapeuta ${t.user_id}`,
        email: t.user?.email || "",
        foto_url: t.foto_url ?? undefined,
      }));

      setTherapists(therapistsList);
      return therapistsList;
    } catch (err) {
      console.error("Erro ao carregar terapeutas:", err);
      return [];
    }
  }, [apiCall, enrichWithPhotos]);

  // ✅ Carregar disponibilidade com fotos via hook
  const loadAvailability = useCallback(async (therapistsList: Therapist[]) => {
    try {
      setLoading(true);

      const data = await apiCall({ url: "/api/admin/availability/all" }) as any[];

      if (!data || data.length === 0) {
        setPeriods([]);
        setError("Nenhum terapeuta cadastrou disponibilidade ainda.");
        return;
      }

      // Montar mapa de fotos a partir dos terapeutas já carregados
      const fotoMap = new Map<number, string>();
      therapistsList.forEach(t => {
        if (t.user_id && t.foto_url) fotoMap.set(t.user_id, t.foto_url);
      });

      const allPeriods: AvailabilityPeriod[] = [];

      for (const therapist of data) {
        const fotoUrl = fotoMap.get(therapist.therapist_id) ?? undefined;

        for (const period of therapist.periods) {
          allPeriods.push({
            id: period.id,
            therapist_profile_id: therapist.therapist_profile_id,
            start_date: period.start_date,
            end_date: period.end_date,
            created_at: "",
            updated_at: "",
            slots: period.slots.map((slot: any) => ({
              id: slot.id,
              period_id: period.id,
              weekday: slot.weekday,
              start_time: slot.start_time,
              end_time: slot.end_time,
              created_at: "",
            })),
            therapist_name: therapist.therapist_name,
            therapist_user_id: therapist.therapist_id,
            foto_url: fotoUrl,
          });
        }
      }

      allPeriods.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
      setPeriods(allPeriods);
      setError("");
    } catch (err: any) {
      console.error("Erro ao carregar disponibilidade:", err);
      setError(err.message || "Erro ao carregar disponibilidade");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // ✅ Carrega terapeutas primeiro, depois disponibilidade — sem duplicar chamadas de API
  useEffect(() => {
    loadTherapists().then(therapistsList => {
      loadAvailability(therapistsList);
    });
  }, []);

  const filteredPeriods = periods.filter(p => {
    if (selectedTherapistId && p.therapist_user_id !== parseInt(selectedTherapistId)) return false;
    if (searchTerm && !p.therapist_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (startDateFilter && p.start_date < startDateFilter) return false;
    if (endDateFilter && p.end_date > endDateFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredPeriods.length / itemsPerPage);
  const paginatedPeriods = filteredPeriods.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const handleEditPeriod = (period: AvailabilityPeriod) => {
    setEditingPeriod(period);
    setEditingSlots(period.slots.map(s => ({
      weekday: s.weekday,
      start_time: s.start_time.substring(0, 5),
      end_time: s.end_time.substring(0, 5),
    })));
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPeriod) return;
    setSaving(true);
    try {
      for (const slot of editingPeriod.slots) {
        await apiCall({ url: `/api/therapist/availability/slots/${slot.id}`, method: "DELETE" });
      }
      for (const slot of editingSlots) {
        await apiCall({
          url: `/api/therapist/availability/slots`,
          method: "POST",
          body: { period_id: editingPeriod.id, ...slot },
        });
      }
      setSuccess("Disponibilidade atualizada com sucesso!");
      setShowEditModal(false);
      const therapistsList = await loadTherapists();
      await loadAvailability(therapistsList);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    if (!confirm("Remover este período e todos os horários?")) return;
    try {
      await apiCall({ url: `/api/therapist/availability/periods/${periodId}`, method: "DELETE" });
      setSuccess("Período removido com sucesso!");
      const therapistsList = await loadTherapists();
      await loadAvailability(therapistsList);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao remover");
      setTimeout(() => setError(""), 3000);
    }
  };

  const timeOptions = () => {
    const opts = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const v = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        opts.push(<option key={v} value={v}>{v}</option>);
      }
    }
    return opts;
  };

  const hasFilters = selectedTherapistId || searchTerm || startDateFilter || endDateFilter;

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Disponibilidade dos Terapeutas</h1>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar ao dashboard
          </Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">Visualize e gerencie a disponibilidade de todos os terapeutas</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />{success}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#E03673]" />Filtros
            </h3>
            {hasFilters && (
              <button
                onClick={() => { setSelectedTherapistId(""); setSearchTerm(""); setStartDateFilter(""); setEndDateFilter(""); setCurrentPage(1); }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
              <select
                value={selectedTherapistId}
                onChange={e => { setSelectedTherapistId(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              >
                <option value="">Todos os terapeutas</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Nome do terapeuta..."
                  className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input type="date" value={startDateFilter}
                onChange={e => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input type="date" value={endDateFilter}
                onChange={e => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de períodos", value: periods.length },
            { label: "Terapeutas cadastrados", value: therapists.length },
            { label: "Total de horários", value: periods.reduce((s, p) => s + p.slots.length, 0) },
            { label: "Com disponibilidade", value: therapists.filter(t => periods.some(p => p.therapist_user_id === t.id)).length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabela */}
        {filteredPeriods.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum período encontrado</p>
            <p className="text-xs text-gray-400 mt-2">Os terapeutas precisam cadastrar sua disponibilidade</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Período</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Horários</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedPeriods.map((period) => (
                    <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {/* ✅ Usa UserAvatar do hook */}
                          <UserAvatar
                            foto_url={period.foto_url}
                            name={period.therapist_name || "T"}
                            size="md"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{period.therapist_name}</p>
                            <p className="text-xs text-gray-500">ID: {period.therapist_user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-gray-700">
                          {formatDate(period.start_date)} até {formatDate(period.end_date)}
                        </p>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {period.slots.slice(0, 3).map(slot => (
                            <span key={slot.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              <Clock className="w-2 h-2" />
                              {WEEKDAYS[slot.weekday].substring(0, 3)} {slot.start_time.substring(0, 5)}-{slot.end_time.substring(0, 5)}
                            </span>
                          ))}
                          {period.slots.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{period.slots.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center text-sm text-gray-700">{period.slots.length}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditPeriod(period)}
                            className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeletePeriod(period.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {showEditModal && editingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Editar disponibilidade</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {/* ✅ Usa UserAvatar no modal também */}
                  <UserAvatar
                    foto_url={editingPeriod.foto_url}
                    name={editingPeriod.therapist_name || "T"}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{editingPeriod.therapist_name}</p>
                    <p className="text-xs text-gray-500">
                      Período: {formatDate(editingPeriod.start_date)} até {formatDate(editingPeriod.end_date)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-700">Horários de atendimento</label>
                <button
                  onClick={() => setEditingSlots([...editingSlots, { weekday: 1, start_time: "07:00", end_time: "08:00" }])}
                  className="text-sm bg-[#E03673] text-white px-3 py-1.5 rounded-lg hover:bg-[#c02c5e] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Adicionar horário
                </button>
              </div>

              <div className="space-y-3">
                {editingSlots.map((slot, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded-lg">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Dia</label>
                      <select
                        value={slot.weekday}
                        onChange={e => { const s = [...editingSlots]; s[i] = { ...s[i], weekday: parseInt(e.target.value) }; setEditingSlots(s); }}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {WEEKDAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Início</label>
                      <select
                        value={slot.start_time}
                        onChange={e => { const s = [...editingSlots]; s[i] = { ...s[i], start_time: e.target.value }; setEditingSlots(s); }}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {timeOptions()}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fim</label>
                      <select
                        value={slot.end_time}
                        onChange={e => { const s = [...editingSlots]; s[i] = { ...s[i], end_time: e.target.value }; setEditingSlots(s); }}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {timeOptions()}
                      </select>
                    </div>
                    <button
                      onClick={() => setEditingSlots(editingSlots.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                  : <><Save className="w-4 h-4" />Salvar alterações</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}