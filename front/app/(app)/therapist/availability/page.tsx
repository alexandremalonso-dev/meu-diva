"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AvailabilityPeriod, AvailabilitySlot, WEEKDAYS, CreateAvailabilityPayload } from "./types";
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle,
  Settings,
  CalendarDays,
  Timer,
  TrendingUp,
  Loader2
} from "lucide-react";

export default function TherapistAvailabilityPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // 🔥 USANDO O HOOK useApi
  const { execute: apiCall, loading: apiLoading, error: apiError } = useApi();
  
  const [periods, setPeriods] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Estado para novo período
  const [period, setPeriod] = useState({
    start_date: "",
    end_date: ""
  });

  // Estado para slots do novo período
  const [slots, setSlots] = useState<Omit<AvailabilitySlot, 'id' | 'period_id' | 'created_at'>[]>([
    { weekday: 1, start_time: "07:00", end_time: "08:00" }
  ]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;
    const y = year.toString();
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${d}/${m}/${y}`;
  };

  // 🔥 REFATORADO: USANDO apiCall EM VEZ DE api()
  const loadPeriods = useCallback(async () => {
    try {
      const data = await apiCall({ 
        url: "/api/therapist/availability/periods",
        requireAuth: true 
      });
      setPeriods(Array.isArray(data) ? data : []);
      setError("");
    } catch (error: any) {
      console.error("Erro ao carregar períodos:", error);
      setError(error.message || "Erro ao carregar períodos");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const getNextSuggestedSlot = useCallback(() => {
    if (slots.length === 0) {
      return { weekday: 1, start_time: "07:00", end_time: "08:00" };
    }

    const lastSlot = slots[slots.length - 1];
    const [lastStartHour, lastStartMin] = lastSlot.start_time.split(':').map(Number);
    const [lastEndHour, lastEndMin] = lastSlot.end_time.split(':').map(Number);
    
    const lastStartMinutes = lastStartHour * 60 + lastStartMin;
    const lastEndMinutes = lastEndHour * 60 + lastEndMin;
    const duration = lastEndMinutes - lastStartMinutes;
    
    const nextStartMinutes = lastEndMinutes;
    const nextEndMinutes = nextStartMinutes + duration;
    
    if (nextEndMinutes > 24 * 60) {
      return { weekday: lastSlot.weekday, start_time: "07:00", end_time: "08:00" };
    }
    
    const nextStartHour = Math.floor(nextStartMinutes / 60).toString().padStart(2, '0');
    const nextStartMin = (nextStartMinutes % 60).toString().padStart(2, '0');
    const nextEndHour = Math.floor(nextEndMinutes / 60).toString().padStart(2, '0');
    const nextEndMin = (nextEndMinutes % 60).toString().padStart(2, '0');
    
    return { weekday: lastSlot.weekday, start_time: `${nextStartHour}:${nextStartMin}`, end_time: `${nextEndHour}:${nextEndMin}` };
  }, [slots]);

  const addSlot = useCallback(() => {
    const suggestedSlot = getNextSuggestedSlot();
    setSlots(prevSlots => [...prevSlots, suggestedSlot]);
  }, [getNextSuggestedSlot]);

  const removeSlot = useCallback((index: number) => {
    setSlots(prevSlots => prevSlots.filter((_, i) => i !== index));
  }, []);

  const updateSlot = useCallback((index: number, field: keyof Omit<AvailabilitySlot, 'id' | 'period_id' | 'created_at'>, value: any) => {
    setSlots(prevSlots => {
      const updatedSlots = [...prevSlots];
      updatedSlots[index] = { ...updatedSlots[index], [field]: value };
      return updatedSlots;
    });
  }, []);

  const hasOverlappingSlots = useCallback((slotsToCheck: typeof slots): { hasOverlap: boolean; message: string } => {
    const slotsByDay: { [key: number]: { start: number; end: number; index: number }[] } = {};

    for (let i = 0; i < slotsToCheck.length; i++) {
      const slot = slotsToCheck[i];
      const [startHour, startMin] = slot.start_time.split(':').map(Number);
      const [endHour, endMin] = slot.end_time.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (!slotsByDay[slot.weekday]) {
        slotsByDay[slot.weekday] = [];
      }
      
      for (const existing of slotsByDay[slot.weekday]) {
        if ((startMinutes >= existing.start && startMinutes < existing.end) ||
            (endMinutes > existing.start && endMinutes <= existing.end) ||
            (startMinutes <= existing.start && endMinutes >= existing.end)) {
          return { hasOverlap: true, message: `Horário sobreposto em ${WEEKDAYS[slot.weekday]}: ${slot.start_time}-${slot.end_time}` };
        }
      }
      
      slotsByDay[slot.weekday].push({ start: startMinutes, end: endMinutes, index: i });
    }

    return { hasOverlap: false, message: "" };
  }, []);

  const hasDuplicatePeriod = useCallback((startDate: string, endDate: string): boolean => {
    return periods.some(p => p.start_date === startDate && p.end_date === endDate);
  }, [periods]);

  const validateDates = (startDate: string, endDate: string): boolean => {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    return start <= end;
  };

  // 🔥 REFATORADO: USANDO apiCall EM VEZ DE api()
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!period.start_date || !period.end_date) {
      setError("Preencha as datas do período");
      setSaving(false);
      return;
    }

    if (!validateDates(period.start_date, period.end_date)) {
      setError("Data inicial não pode ser maior que data final");
      setSaving(false);
      return;
    }

    if (hasDuplicatePeriod(period.start_date, period.end_date)) {
      setError("Já existe um período cadastrado com estas datas");
      setSaving(false);
      return;
    }

    if (slots.length === 0) {
      setError("Adicione pelo menos um horário");
      setSaving(false);
      return;
    }

    for (const slot of slots) {
      if (slot.start_time >= slot.end_time) {
        setError("Horário de início deve ser anterior ao fim");
        setSaving(false);
        return;
      }
    }

    const overlapCheck = hasOverlappingSlots(slots);
    if (overlapCheck.hasOverlap) {
      setError(overlapCheck.message);
      setSaving(false);
      return;
    }

    try {
      const payload: CreateAvailabilityPayload = {
        start_date: period.start_date,
        end_date: period.end_date,
        slots: slots
      };

      // 🔥 USANDO apiCall EM VEZ DE api()
      const data = await apiCall({
        url: "/api/therapist/availability/periods",
        method: "POST",
        body: payload,
        requireAuth: true
      });

      setPeriods(prevPeriods => [data, ...prevPeriods]);
      setSuccess("Período adicionado com sucesso!");
      
      setPeriod({ start_date: "", end_date: "" });
      setSlots([{ weekday: 1, start_time: "07:00", end_time: "08:00" }]);
      
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (err: any) {
      console.error("Erro ao adicionar:", err);
      setError(err.message || "Erro ao adicionar período");
    } finally {
      setSaving(false);
    }
  }

  // 🔥 REFATORADO: USANDO apiCall EM VEZ DE api()
  async function deletePeriod(id: number) {
    if (!confirm("Remover este período e todos os seus horários?")) return;

    try {
      const numericId = Number(id);
      if (isNaN(numericId)) {
        throw new Error("ID inválido");
      }

      // 🔥 USANDO apiCall EM VEZ DE api()
      await apiCall({
        url: `/api/therapist/availability/periods/${numericId}`,
        method: "DELETE",
        requireAuth: true
      });

      setPeriods(prevPeriods => prevPeriods.filter(p => p.id !== numericId));
      setSuccess("Período removido com sucesso!");
      
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (err: any) {
      console.error("Erro ao remover:", err);
      setError(err.message || "Erro ao remover período");
    }
  }

  const timeOptions = useCallback(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(<option key={value} value={value}>{value}</option>);
      }
    }
    return options;
  }, []);

  // 🔥 CORREÇÃO: REMOVER MAINLAYOUT
  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      {/* MENSAGEM DE BOAS-VINDAS */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Disponibilidade</h1>
        </div>
        <p className="text-gray-600 mt-1">Defina períodos e horários de atendimento</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Formulário para adicionar novo período */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-[#E03673]" />
            <h2 className="text-lg font-semibold">Adicionar novo período</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datas do período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Data inicial
                </label>
                <input
                  type="date"
                  value={period.start_date}
                  onChange={(e) => setPeriod({ ...period, start_date: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Data final
                </label>
                <input
                  type="date"
                  value={period.end_date}
                  onChange={(e) => setPeriod({ ...period, end_date: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Slots de horário */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Horários recorrentes
                </label>
                <button
                  type="button"
                  onClick={addSlot}
                  className="text-sm bg-[#E03673] text-white px-3 py-1.5 rounded-lg hover:bg-[#c02c5e] transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar horário
                </button>
              </div>

              <div className="space-y-3">
                {slots.map((slot, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded-lg">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Dia</label>
                      <select
                        value={slot.weekday}
                        onChange={(e) => updateSlot(index, 'weekday', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {WEEKDAYS.map((day, i) => (
                          <option key={i} value={i}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Início</label>
                      <select
                        value={slot.start_time}
                        onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {timeOptions()}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fim</label>
                      <select
                        value={slot.end_time}
                        onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        {timeOptions()}
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {slots.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Dica: Ao adicionar novos horários, o sistema sugere automaticamente o próximo horário baseado no último.
                </p>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Salvando..." : "Salvar período"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de períodos existentes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-[#E03673]" />
            <h2 className="text-lg font-semibold">Períodos cadastrados</h2>
          </div>
          
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum período cadastrado.</p>
              <p className="text-sm text-gray-400 mt-1">Adicione seu primeiro período de disponibilidade acima.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {periods.map((period) => (
                <div key={period.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#E03673]" />
                        {formatDate(period.start_date)} até {formatDate(period.end_date)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {period.slots.length} {period.slots.length === 1 ? 'horário' : 'horários'}
                      </p>
                    </div>
                    <button
                      onClick={() => period.id && deletePeriod(period.id)}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover período
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                    {period.slots.map((slot) => (
                      <div key={slot.id} className="bg-gray-50 p-2 rounded-lg text-sm flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="font-medium">{WEEKDAYS[slot.weekday]}</span>
                        <span className="text-gray-600">
                          {slot.start_time.substring(0,5)} - {slot.end_time.substring(0,5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}