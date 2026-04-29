"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { 
  Video, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  PhoneOff,
  ChevronLeft,
  Loader2,
  Target,
  FileText,
  Plus,
  X,
  ExternalLink
} from "lucide-react";
import type { Appointment } from "../../dashboard/types";

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

export default function PatientSessionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  // Hook useApi
  const { execute: apiCall } = useApi();
  
  const [session, setSession] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estado do Meet
  const [meetUrl, setMeetUrl] = useState("");
  const [meetOpened, setMeetOpened] = useState(false);
  
  // Estado dos objetivos e queixa
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Carregar dados da sessão
  useEffect(() => {
    loadSession();
    loadPatientGoals();
  }, [id]);
  
  // 🔥 ALTERADO: Redireciona para página embed do Jitsi em vez de abrir nova aba
  useEffect(() => {
    if (meetUrl && !meetOpened) {
      // Redireciona para a página embed do Jitsi
      router.push(`/patient/videochamada/${id}`);
      setMeetOpened(true);
    }
  }, [meetUrl, meetOpened, router, id]);
  
  const loadSession = async () => {
    try {
      const data = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const found = data.find((apt: Appointment) => apt.id === Number(id));
      
      if (!found) {
        setError("Sessão não encontrada");
        return;
      }
      
      setSession(found);
      setMeetUrl(found.video_call_url || "");
      
      // Carregar queixa existente se houver - ignorar erro 404
      if (found.id) {
        try {
          const medicalRecord = await apiCall({ 
            url: `/api/appointments/${found.id}/medical-record`, 
            requireAuth: true 
          });
          if (medicalRecord?.patient_complaint) {
            setComplaint(medicalRecord.patient_complaint);
          }
        } catch (err: any) {
          // 404 é esperado quando não há prontuário
          if (err.message?.includes("404") || err.message?.includes("Prontuário")) {
            console.log("Nenhum prontuário registrado ainda");
          } else {
            console.error("Erro ao carregar queixa:", err);
          }
        }
      }
      
    } catch (error) {
      console.error("Erro ao carregar sessão:", error);
      setError("Erro ao carregar dados da sessão");
    } finally {
      setLoading(false);
    }
  };
  
  const loadPatientGoals = async () => {
    try {
      const data = await apiCall({ url: "/api/patient/goals", requireAuth: true });
      setGoals(data.goals || []);
    } catch (error) {
      console.error("Erro ao carregar objetivos:", error);
      setGoals([]);
    }
  };
  
  const handleAddGoal = async () => {
    if (!newGoal) return;
    
    setAddingGoal(true);
    try {
      await apiCall({ 
        url: "/api/patient/goals", 
        method: "POST", 
        body: { goal: newGoal },
        requireAuth: true 
      });
      
      setGoals([...goals, newGoal]);
      setNewGoal("");
    } catch (error: any) {
      console.error("Erro ao adicionar objetivo:", error);
      const errorMsg = error.message || "Erro ao adicionar objetivo";
      alert(errorMsg);
    } finally {
      setAddingGoal(false);
    }
  };
  
  const handleRemoveGoal = async (goalToRemove: string) => {
    try {
      await apiCall({ 
        url: "/api/patient/goals", 
        method: "DELETE", 
        body: { goal: goalToRemove },
        requireAuth: true 
      });
      
      setGoals(goals.filter(g => g !== goalToRemove));
    } catch (error) {
      console.error("Erro ao remover objetivo:", error);
      alert("Erro ao remover objetivo");
    }
  };
  
  const getGoalLabel = (goalId: string) => {
    const found = availableGoals.find(g => g.id === goalId);
    return found?.label || goalId;
  };
  
  const handleSaveComplaint = async () => {
    if (!complaint.trim()) return;
    
    setSaving(true);
    try {
      await apiCall({ 
        url: `/api/sessions/${id}/complaint`, 
        method: "POST", 
        body: { complaint: complaint.trim() },
        requireAuth: true 
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
    } catch (error) {
      console.error("Erro ao salvar queixa:", error);
      alert("Erro ao salvar queixa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };
  
  const handleOpenMeet = () => {
    if (meetUrl) {
      router.push(`/patient/videochamada/${id}`);
      setMeetOpened(true);
    }
  };
  
  const handleEndCall = () => {
    if (confirm("Deseja encerrar a sessão?")) {
      router.push("/patient/dashboard");
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }
  
  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-red-500 mb-4">{error || "Sessão não encontrada"}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e]"
        >
          Voltar
        </button>
      </div>
    );
  }
  
  // Objetivos disponíveis que ainda não foram selecionados
  const availableGoalsToAdd = availableGoals.filter(goal => !goals.includes(goal.id));
  
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-white hover:text-gray-300 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h1 className="text-white font-medium">
            {session.therapist?.full_name || "Terapeuta"}
          </h1>
          <p className="text-gray-400 text-sm">
            {new Date(session.starts_at).toLocaleDateString('pt-BR')} às{" "}
            {new Date(session.starts_at).toLocaleTimeString('pt-BR').slice(0,5)}
          </p>
        </div>
        <div className="w-6" />
      </div>
      
      {/* 🔥 Conteúdo principal: 2/3 para conteúdo + 1/3 para painel */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Área principal - 2/3 */}
        <div className="flex-1 md:flex-[2] bg-gray-100 relative min-h-[300px] flex flex-col items-center justify-center">
          <div className="text-center p-8">
            <Video className="w-24 h-24 text-[#E03673] mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Sessão com {session.therapist?.full_name || "Terapeuta"}
            </h2>
            <p className="text-gray-600 mb-6">
              {new Date(session.starts_at).toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })} às {new Date(session.starts_at).toLocaleTimeString('pt-BR').slice(0,5)}
            </p>
            
            {meetUrl ? (
              <button
                onClick={handleOpenMeet}
                className="inline-flex items-center gap-2 bg-[#E03673] hover:bg-[#c02c5e] text-white px-6 py-3 rounded-lg font-medium transition-colors text-lg"
              >
                <ExternalLink className="w-5 h-5" />
                Abrir videochamada
              </button>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
                <p className="text-yellow-800">Link da videochamada ainda não disponível.</p>
                <p className="text-sm text-yellow-600 mt-1">Aguarde o terapeuta iniciar a sessão.</p>
              </div>
            )}
            
            {meetOpened && meetUrl && (
              <p className="text-sm text-green-600 mt-4 flex items-center justify-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Redirecionando para videochamada...
              </p>
            )}
          </div>
        </div>
        
        {/* 🔥 Painel lateral - 1/3 - COM SCROLL */}
        <div className="w-full md:w-1/3 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          {/* Objetivos do paciente */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-[#E03673]" />
              <h2 className="font-semibold text-gray-900">Objetivos Terapêuticos</h2>
            </div>
            
            {/* Objetivos selecionados */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {goals.length > 0 ? (
                goals.map((goal, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-[#E03673] text-sm">•</span>
                      <p className="text-sm text-gray-700">{getGoalLabel(goal)}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveGoal(goal)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhum objetivo definido</p>
              )}
            </div>
            
            {/* Adicionar novo objetivo */}
            <div className="mt-2">
              <select
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none mb-2"
              >
                <option value="">Selecione um objetivo...</option>
                {availableGoalsToAdd.map(goal => (
                  <option key={goal.id} value={goal.id}>{goal.label}</option>
                ))}
              </select>
              <button
                onClick={handleAddGoal}
                disabled={addingGoal || !newGoal}
                className="w-full py-2 bg-[#E03673] text-white text-sm rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {addingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar Objetivo
              </button>
            </div>
          </div>
          
          {/* Queixa do dia */}
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[#E03673]" />
              <h2 className="font-semibold text-gray-900">Como você está se sentindo hoje?</h2>
            </div>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Compartilhe como você está se sentindo, o que gostaria de falar na sessão de hoje..."
              className="w-full h-40 p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none text-sm"
            />
            <button
              onClick={handleSaveComplaint}
              disabled={saving || !complaint.trim()}
              className="mt-3 w-full py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </button>
            {saved && (
              <p className="text-xs text-green-600 mt-2 text-center">
                ✅ Queixa salva com sucesso!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}