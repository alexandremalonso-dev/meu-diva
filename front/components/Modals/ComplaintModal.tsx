"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, Loader2, CheckCircle, AlertCircle, Target, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

// 🔥 LISTA DE OBJETIVOS TERAPÊUTICOS
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
  { id: "genero", label: "Identidade de Gênero - Apoio e compreensão" }
];

interface ComplaintModalProps {
  show: boolean;
  appointmentId: number;
  therapistName: string;
  sessionDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ComplaintModal({
  show,
  appointmentId,
  therapistName,
  sessionDate,
  onClose,
  onSuccess
}: ComplaintModalProps) {
  const [complaint, setComplaint] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (show && appointmentId) {
      loadExistingData();
    }
  }, [show, appointmentId]);

  const loadExistingData = async () => {
    setLoading(true);
    try {
      try {
        const goalsData = await api("/api/patient/goals");
        console.log("Objetivos carregados:", goalsData);
        
        if (Array.isArray(goalsData)) {
          if (goalsData.length > 0 && typeof goalsData[0] === 'object') {
            const goalStrings = (goalsData as any[]).map((g: any) => g.goal_type || g.name || String(g));
            setGoals(goalStrings);
          } else {
            setGoals(goalsData as string[]);
          }
        } else if (goalsData && typeof goalsData === 'object' && 'goals' in goalsData) {
          const goalsArray = (goalsData as { goals: any[] }).goals;
          if (Array.isArray(goalsArray)) {
            const goalStrings = goalsArray.map((g: any) => g.goal_type || g.name || String(g));
            setGoals(goalStrings);
          } else {
            setGoals([]);
          }
        } else {
          setGoals([]);
        }
      } catch (err) {
        console.log("Nenhum objetivo encontrado", err);
        setGoals([]);
      }

      try {
        const medicalRecord = await api(`/api/appointments/${appointmentId}/medical-record`);
        if (medicalRecord?.patient_reasons && medicalRecord.patient_reasons.length > 0) {
          setComplaint(medicalRecord.patient_reasons.join("\n\n"));
        }
      } catch (err) {
        console.log("Nenhuma queixa existente");
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal) return;
    
    setAddingGoal(true);
    try {
      await api("/api/patient/goals", {
        method: "POST",
        body: JSON.stringify({ goal_type: newGoal })
      });
      
      setGoals([...goals, newGoal]);
      setNewGoal("");
      setError("");
    } catch (error: any) {
      console.error("Erro ao adicionar objetivo:", error);
      setError(error.message || "Erro ao adicionar objetivo");
    } finally {
      setAddingGoal(false);
    }
  };

  const handleRemoveGoal = async (goalToRemove: string) => {
    try {
      await api("/api/patient/goals", {
        method: "DELETE",
        body: JSON.stringify({ goal_type: goalToRemove })
      });
      
      setGoals(goals.filter(g => g !== goalToRemove));
    } catch (error: any) {
      setError(error.message || "Erro ao remover objetivo");
    }
  };

  const handleSave = async () => {
    if (!complaint.trim()) {
      setError("Por favor, escreva sua queixa antes de salvar");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api(`/api/patient/sessions/${appointmentId}/complaint`, {
        method: "POST",
        body: JSON.stringify({ complaint: complaint.trim() })
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar queixa");
    } finally {
      setSaving(false);
    }
  };

  const getGoalLabel = (goalId: string) => {
    const found = availableGoals.find(g => g.id === goalId);
    return found?.label || goalId;
  };

  const availableGoalsToAdd = availableGoals.filter(goal => !goals.includes(goal.id));

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Registrar Queixa</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Informações da sessão */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Terapeuta:</span> {therapistName}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Sessão:</span> {sessionDate}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
            </div>
          ) : (
            <>
              {/* 🔥 OBJETIVOS TERAPÊUTICOS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-[#E03673]" />
                  <label className="text-sm font-medium text-gray-700">Objetivos Terapêuticos</label>
                </div>
                
                {/* Objetivos selecionados */}
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3 border border-gray-100 rounded-lg p-2 bg-gray-50">
                  {goals.length > 0 ? (
                    goals.map((goal, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg group shadow-sm">
                        <span className="text-xs text-gray-700 flex-1">{getGoalLabel(goal)}</span>
                        <button
                          onClick={() => handleRemoveGoal(goal)}
                          className="text-gray-400 hover:text-red-500 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">Nenhum objetivo definido</p>
                  )}
                </div>
                
                {/* Select para escolher novo objetivo */}
                <select
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-white mb-2"
                >
                  <option value="">Selecione um objetivo...</option>
                  {availableGoalsToAdd.map(goal => (
                    <option key={goal.id} value={goal.id}>{goal.label}</option>
                  ))}
                </select>
                
                {/* Botão Adicionar - ABAIXO DO SELECT */}
                <button
                  onClick={handleAddGoal}
                  disabled={addingGoal || !newGoal}
                  className="w-full py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                >
                  {addingGoal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Adicionar Objetivo
                </button>
              </div>

              {/* 🔥 QUEIXA PRINCIPAL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  O que gostaria de compartilhar com seu terapeuta?
                </label>
                <textarea
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="Escreva aqui o que gostaria de falar na sessão de hoje..."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none resize-none"
                  rows={5}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sua queixa será compartilhada com o terapeuta antes da sessão.
                </p>
              </div>
            </>
          )}

          {/* Mensagem de sucesso */}
          {success && (
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">✅ Queixa salva com sucesso!</p>
            </div>
          )}

          {/* Mensagem de erro */}
          {error && (
            <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || success || loading}
              className="flex-1 bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Salvar Queixa
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}