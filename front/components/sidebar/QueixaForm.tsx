"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle, Save, Target, Plus, Trash2, User, Calendar, Clock } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { getFotoSrc } from '@/lib/utils';

const availableGoals = [
  { id: "autoconhecimento", label: "Autoconhecimento - Desenvolver maior compreensão de si mesmo" },
  { id: "ansiedade", label: "Ansiedade - Gerenciar e reduzir sintomas de ansiedade" },
  { id: "depressao", label: "Depressão - Lidar com sintomas depressivos" },
  { id: "relacionamentos", label: "Relacionamentos - Melhorar relacionamentos interpessoais" },
  { id: "carreira", label: "Carreira - Questões profissionais e de carreira" },
  { id: "luto", label: "Luto - Processamento de perdas" },
  { id: "autoestima", label: "Autoestima - Fortalecer autoestima e autoconfiança" },
  { id: "estresse", label: "Estresse - Gerenciar níveis de estresse" },
  { id: "burnout", label: "Burnout - Prevenção e tratamento do esgotamento profissional" },
  { id: "trauma", label: "Trauma - Processamento de experiências traumáticas" },
  { id: "fobias", label: "Fobias - Superação de medos específicos" },
  { id: "toc", label: "TOC - Manejo do Transtorno Obsessivo-Compulsivo" },
  { id: "panico", label: "Pânico - Controle de crises de pânico" },
  { id: "alimentares", label: "Transtornos Alimentares - Recuperação de hábitos saudáveis" },
  { id: "sexualidade", label: "Sexualidade - Exploração e aceitação" },
  { id: "genero", label: "Identidade de Gênero - Apoio e compreensão" },
  { id: "tdah", label: "TDAH - Manejo do Transtorno de Déficit de Atenção" },
  { id: "tea", label: "TEA - Suporte para o Transtorno do Espectro Autista" },
  { id: "conflitos_familiares", label: "Conflitos Familiares - Mediação e resolução" },
  { id: "ciumes", label: "Ciúmes - Manejo e autoconhecimento" },
  { id: "lgbt", label: "LGBT+ - Acolhimento e identidade" },
];

interface QueixaFormProps {
  appointmentId: number;
  onSave?: () => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export function QueixaForm({ appointmentId, onSave, onError, onSuccess }: QueixaFormProps) {
  const { execute: apiCall } = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  const [sessionInfo, setSessionInfo] = useState<{
    therapistName: string;
    therapistFotoUrl?: string;
    sessionDate: string;
    sessionTime: string;
    sessionStatus: string;
  }>({
    therapistName: "",
    therapistFotoUrl: "",
    sessionDate: "",
    sessionTime: "",
    sessionStatus: ""
  });

  useEffect(() => {
    if (appointmentId) loadData();
  }, [appointmentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Informações da sessão
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const appointment = appointmentsData?.find((apt: any) => apt.id === appointmentId);

      if (appointment) {
        const sessionDate = new Date(appointment.starts_at);
        setSessionInfo({
          therapistName: appointment.therapist?.full_name || "Terapeuta",
          therapistFotoUrl: appointment.therapist?.foto_url,
          sessionDate: sessionDate.toLocaleDateString("pt-BR"),
          sessionTime: sessionDate.toLocaleTimeString("pt-BR").slice(0, 5),
          sessionStatus:
            appointment.status === "confirmed" ? "Confirmada" :
            appointment.status === "scheduled"  ? "Agendada" :
            appointment.status === "completed"  ? "Realizada" :
            appointment.status
        });
      }

      // Objetivos do paciente
      try {
        const goalsData = await apiCall({ url: "/api/patient/goals", requireAuth: true });
        if (Array.isArray(goalsData)) {
          setGoals(
            goalsData.length > 0 && typeof goalsData[0] === 'object'
              ? goalsData.map((g: any) => g.goal_type || g)
              : goalsData
          );
        }
      } catch {
        // Sem objetivos cadastrados ainda — silencioso
      }

      // ✅ Queixa existente — 404 é esperado quando ainda não há prontuário
      // O api.ts loga o erro internamente, mas aqui tratamos como estado normal
      try {
        const medicalRecord = await apiCall({
          url: `/api/appointments/${appointmentId}/medical-record`,
          requireAuth: true
        });
        if (medicalRecord?.patient_reasons?.length > 0) {
          setComplaint(medicalRecord.patient_reasons.join("\n\n"));
          setHasRecord(true);
        }
      } catch (err: any) {
        // 404 = sessão sem prontuário ainda → comportamento esperado, não propagar
        // Qualquer outro erro também é silenciado aqui pois não impede o uso do form
      }

    } catch (error) {
      console.error("Erro ao carregar dados da sessão:", error);
      onError?.("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal) return;
    setAddingGoal(true);
    try {
      await apiCall({ url: "/api/patient/goals", method: "POST", body: JSON.stringify({ goal_type: newGoal }), requireAuth: true });
      setGoals([...goals, newGoal]);
      setNewGoal("");
    } catch (error: any) {
      onError?.(error.message || "Erro ao adicionar objetivo");
    } finally {
      setAddingGoal(false);
    }
  };

  const handleRemoveGoal = async (goalToRemove: string) => {
    try {
      await apiCall({ url: "/api/patient/goals", method: "DELETE", body: JSON.stringify({ goal_type: goalToRemove }), requireAuth: true });
      setGoals(goals.filter(g => g !== goalToRemove));
    } catch (error: any) {
      onError?.(error.message || "Erro ao remover objetivo");
    }
  };

  const handleSave = async () => {
    if (!complaint.trim()) {
      onError?.("Por favor, escreva sua queixa antes de salvar");
      return;
    }
    setSaving(true);
    try {
      await apiCall({
        url: `/api/patient/sessions/${appointmentId}/complaint`,
        method: "POST",
        body: JSON.stringify({ complaint: complaint.trim() }),
        requireAuth: true
      });
      onSuccess?.("✅ Queixa salva com sucesso!");
      setHasRecord(true);
      onSave?.();
    } catch (err: any) {
      onError?.(err.message || "Erro ao salvar queixa");
    } finally {
      setSaving(false);
    }
  };

  const getGoalLabel = (goalId: string) => availableGoals.find(g => g.id === goalId)?.label || goalId;
  const availableGoalsToAdd = availableGoals.filter(goal => !goals.includes(goal.id));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Card do terapeuta */}
      <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            {sessionInfo.therapistFotoUrl ? (
              <img
                src={getFotoSrc(sessionInfo.therapistFotoUrl) || ""}
                alt={sessionInfo.therapistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{sessionInfo.therapistName}</h3>
            <div className="flex flex-col gap-1 mt-1 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>{sessionInfo.sessionDate}</span>
                <Clock className="w-3 h-3 ml-2" />
                <span>{sessionInfo.sessionTime}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${
                sessionInfo.sessionStatus === "Confirmada" ? "bg-green-500/30" :
                sessionInfo.sessionStatus === "Agendada"   ? "bg-yellow-500/30" :
                "bg-gray-500/30"
              }`}>
                {sessionInfo.sessionStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasRecord && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">✅ Queixa já registrada. Você pode editar se desejar.</p>
        </div>
      )}

      {/* Objetivos terapêuticos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#E03673]" />
          <label className="text-sm font-medium text-gray-700">Objetivos Terapêuticos</label>
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto mb-3 border border-gray-100 rounded-lg p-2 bg-gray-50">
          {goals.length > 0 ? (
            goals.map((goal, index) => (
              <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg shadow-sm">
                <span className="text-xs text-gray-700 flex-1 break-words">{getGoalLabel(goal)}</span>
                <button onClick={() => handleRemoveGoal(goal)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">Nenhum objetivo definido</p>
          )}
        </div>

        <select
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none bg-white mb-2"
        >
          <option value="">Selecione um objetivo...</option>
          {availableGoalsToAdd.map(goal => (
            <option key={goal.id} value={goal.id}>{goal.label}</option>
          ))}
        </select>

        <button
          onClick={handleAddGoal}
          disabled={addingGoal || !newGoal}
          className="w-full py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {addingGoal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Adicionar Objetivo
        </button>
      </div>

      {/* Queixa principal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          O que gostaria de compartilhar com seu terapeuta?
        </label>
        <textarea
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
          placeholder="Escreva aqui o que gostaria de falar na sessão de hoje..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] outline-none resize-none"
          rows={5}
        />
        <p className="text-xs text-gray-400 mt-1">Sua queixa será compartilhada com o terapeuta antes da sessão.</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><Save className="w-4 h-4" />Salvar Queixa</>}
      </button>
    </div>
  );
}