"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { 
  Calendar, 
  Clock, 
  User, 
  Video, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  ArrowLeft,
  Copy,
  MessageSquare,
  Save,
  Lock,
  Link as LinkIcon,
  Plus,
  X
} from "lucide-react";

type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  video_call_url?: string;
  patient?: {
    id: number;
    email: string;
    full_name?: string;
    foto_url?: string;
    phone?: string;
  };
};

type MedicalRecord = {
  id: number;
  appointment_id: number;
  session_not_occurred: boolean;
  not_occurred_reason?: string;
  evolution?: string;
  outcome?: string;
  patient_reasons?: string[];
  private_notes?: string;
  activity_instructions?: string;
  links?: string[];
  created_at: string;
  updated_at: string;
};

// Opções de desfecho
const outcomeOptions = [
  { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
  { value: "ALTA_CLINICA", label: "Alta clínica" },
  { value: "ALTA_A_PEDIDO", label: "Alta a pedido" },
  { value: "ENCAMINHAMENTO_ESPECIALISTA", label: "Encaminhamento especialista" },
  { value: "ENCAMINHAMENTO_EMERGENCIAL", label: "Encaminhamento emergencial" }
];

// Opções de motivo para não ocorrência
const notOccurredOptions = [
  { value: "CLIENTE_NAO_COMPARECEU", label: "Cliente não compareceu" },
  { value: "PROBLEMAS_VIDEOCHAMADA", label: "Problemas com a videochamada" },
  { value: "OUTROS", label: "Outros" }
];

// Lista de motivos do paciente (multi-select)
const patientReasonOptions = [
  { id: "ansiedade", label: "Ansiedade" },
  { id: "depressao", label: "Depressão" },
  { id: "estresse", label: "Estresse" },
  { id: "relacionamento", label: "Relacionamentos" },
  { id: "autoestima", label: "Autoestima" },
  { id: "carreira", label: "Carreira" },
  { id: "luto", label: "Luto" },
  { id: "trauma", label: "Trauma" },
  { id: "burnout", label: "Burnout" },
  { id: "panico", label: "Pânico" },
  { id: "fobias", label: "Fobias" },
  { id: "toc", label: "TOC" },
  { id: "alimentares", label: "Transtornos Alimentares" },
  { id: "sexualidade", label: "Sexualidade" }
];

export default function TherapistSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  
  const appointmentId = params?.id as string;
  
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [newLink, setNewLink] = useState("");
  
  // Estados do formulário
  const [sessionNotOccurred, setSessionNotOccurred] = useState(false);
  const [notOccurredReason, setNotOccurredReason] = useState("");
  const [evolution, setEvolution] = useState("");
  const [outcome, setOutcome] = useState("");
  const [patientReasons, setPatientReasons] = useState<string[]>([]);
  const [privateNotes, setPrivateNotes] = useState("");
  const [activityInstructions, setActivityInstructions] = useState("");
  const [links, setLinks] = useState<string[]>([]);

  useEffect(() => {
    if (appointmentId) {
      loadData();
    }
  }, [appointmentId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Carregar dados da sessão - SEM tipo genérico
      const appointmentsData = await apiCall({
        url: "/api/appointments/me/details",
        requireAuth: true
      }) as Appointment[];
      
      const found = appointmentsData.find(
        (apt: Appointment) => apt.id === Number(appointmentId)
      );
      
      if (!found) {
        setError("Sessão não encontrada");
        return;
      }
      
      setAppointment(found);
      
      // Carregar prontuário (se existir) - SEM tipo genérico
      try {
        const record = await apiCall({
          url: `/api/appointments/${appointmentId}/medical-record`,
          requireAuth: true
        }) as MedicalRecord;
        setMedicalRecord(record);
        
        // Preencher formulário com dados existentes
        if (record) {
          setSessionNotOccurred(record.session_not_occurred || false);
          setNotOccurredReason(record.not_occurred_reason || "");
          setEvolution(record.evolution || "");
          setOutcome(record.outcome || "");
          setPatientReasons(record.patient_reasons || []);
          setPrivateNotes(record.private_notes || "");
          setActivityInstructions(record.activity_instructions || "");
          setLinks(record.links || []);
        }
      } catch (err) {
        // Prontuário não existe ainda, normal
        console.log("Prontuário ainda não registrado");
      }
      
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(err.message || "Erro ao carregar dados da sessão");
    } finally {
      setLoading(false);
    }
  };

  // Validação antes de salvar
  const validateForm = () => {
    if (sessionNotOccurred) {
      if (!notOccurredReason) {
        setError("Por favor, informe o motivo da não ocorrência");
        return false;
      }
      return true;
    } else {
      if (!evolution.trim()) {
        setError("Por favor, preencha a evolução do atendimento");
        return false;
      }
      if (!outcome) {
        setError("Por favor, selecione o desfecho clínico");
        return false;
      }
      return true;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setConfirmDialog(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    setError("");
    setConfirmDialog(false);

    try {
      await apiCall({
        url: `/api/appointments/${appointmentId}/complete`,
        method: "POST",
        body: {
          session_not_occurred: sessionNotOccurred,
          not_occurred_reason: notOccurredReason,
          evolution: evolution,
          outcome: outcome,
          patient_reasons: patientReasons,
          private_notes: privateNotes,
          activity_instructions: activityInstructions,
          links: links
        },
        requireAuth: true
      });

      setSuccess("✅ Prontuário salvo com sucesso!");
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar prontuário:", err);
      setError(err.message || "Erro ao salvar prontuário");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = () => {
    if (newLink.trim() && links.length < 3) {
      setLinks([...links, newLink.trim()]);
      setNewLink("");
    }
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const togglePatientReason = (reasonId: string) => {
    if (patientReasons.includes(reasonId)) {
      setPatientReasons(patientReasons.filter(r => r !== reasonId));
    } else {
      if (patientReasons.length < 6) {
        setPatientReasons([...patientReasons, reasonId]);
      } else {
        setError("Máximo de 6 motivos selecionados");
        setTimeout(() => setError(""), 3000);
      }
    }
  };

  // 🔥 ALTERADO: Redireciona para página embed do Jitsi
  const handleJoinMeet = () => {
    if (appointment?.id) {
      router.push(`/therapist/videochamada/${appointment.id}`);
    }
  };

  const handleCopyLink = () => {
    if (appointment?.video_call_url) {
      navigator.clipboard.writeText(appointment.video_call_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    if (status === "scheduled") return "bg-blue-100 text-blue-800";
    if (status === "confirmed") return "bg-green-100 text-green-800";
    if (status === "proposed") return "bg-yellow-100 text-yellow-800";
    if (status === "rescheduled") return "bg-orange-100 text-orange-800";
    if (status?.includes("cancelled")) return "bg-red-100 text-red-800";
    if (status === "completed") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status: string) => {
    if (status === "scheduled") return "Agendada";
    if (status === "confirmed") return "Confirmada";
    if (status === "proposed") return "Convite pendente";
    if (status === "rescheduled") return "Reagendada";
    if (status === "cancelled_by_patient") return "Cancelada pelo paciente";
    if (status === "cancelled_by_therapist") return "Cancelada por você";
    if (status === "completed") return "Realizada";
    return status;
  };

  const isUpcoming = appointment && new Date(appointment.starts_at) > new Date();
  const canEdit = appointment && 
    (appointment.status === "scheduled" || appointment.status === "confirmed" || appointment.status === "rescheduled") &&
    isUpcoming &&
    !medicalRecord;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-700">{error || "Sessão não encontrada"}</p>
          <button
            onClick={() => router.push('/therapist/schedule')}
            className="mt-4 px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] transition-colors"
          >
            Voltar para Agenda
          </button>
        </div>
      </div>
    );
  }

  const patient = appointment.patient;
  const patientName = patient?.full_name || `Paciente ${appointment.patient_user_id}`;
  const hasMeetLink = !!appointment.video_call_url;
  const hasRecord = !!medicalRecord;
  const isLocked = hasRecord;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Botão voltar */}
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-gray-500 hover:text-[#2F80D3] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-6 h-6" />
          <h1 className="text-xl font-semibold">{patientName}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(appointment.starts_at)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTime(appointment.starts_at)} - {formatTime(appointment.ends_at)}
          </span>
        </div>
        <div className="mt-3">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
            {getStatusText(appointment.status)}
          </span>
          {isLocked && (
            <span className="ml-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <Lock className="w-3 h-3" />
              Prontuário finalizado
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="space-y-6">
        {/* Card da videochamada */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-[#2F80D3]" />
            Videochamada
          </h2>
          
          <button
            onClick={handleJoinMeet}
            className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white py-3 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 mb-4"
          >
            <Video className="w-5 h-5" />
            Iniciar Sessão
          </button>
          
          {hasMeetLink && (
            <div className="mt-3 p-3 bg-[#F9F5FF] rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <span>🔗</span> Link da videochamada:
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-[#2F80D3] bg-white p-2 rounded-lg flex-1 truncate font-mono border border-gray-200">
                  {appointment.video_call_url}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="p-2 text-gray-500 hover:text-[#2F80D3] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                  title="Copiar link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 mt-2 text-center">✅ Link copiado!</p>
              )}
            </div>
          )}
        </div>

        {/* Formulário de prontuário */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#E03673]" />
            Prontuário da Sessão
            {hasRecord && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Salvo - Imutável</span>
            )}
          </h2>

          {!canEdit ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                {hasRecord 
                  ? "Prontuário já registrado. Esta sessão não pode mais ser editada."
                  : "Esta sessão não pode mais ser editada."}
              </p>
            </div>
          ) : (
            <>
              {/* Decisão inicial: a sessão ocorreu? */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sessionNotOccurred}
                    onChange={(e) => setSessionNotOccurred(e.target.checked)}
                    className="w-4 h-4 text-[#E03673] rounded focus:ring-[#E03673]"
                  />
                  <span className="text-sm font-medium text-gray-700">A sessão NÃO ocorreu</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Marque esta opção se a sessão não aconteceu. O prontuário clínico será bloqueado.
                </p>
              </div>

              {/* Se não ocorreu: apenas motivo */}
              {sessionNotOccurred && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo da não ocorrência *
                  </label>
                  <select
                    value={notOccurredReason}
                    onChange={(e) => setNotOccurredReason(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
                  >
                    <option value="">Selecione o motivo...</option>
                    {notOccurredOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Se ocorreu: prontuário completo */}
              {!sessionNotOccurred && (
                <>
                  {/* Bloco 1: Evolução (obrigatório) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Evolução do atendimento *
                    </label>
                    <textarea
                      value={evolution}
                      onChange={(e) => setEvolution(e.target.value)}
                      placeholder="Descreva o que aconteceu na sessão: conteúdos abordados, comportamento do paciente, intervenções realizadas..."
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none resize-none"
                      rows={6}
                    />
                    <p className="text-xs text-gray-400 mt-1">Máximo 3000 caracteres</p>
                  </div>

                  {/* Bloco 2: Desfecho (obrigatório) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desfecho clínico *
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
                    >
                      <option value="">Selecione o desfecho...</option>
                      {outcomeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bloco 3: Motivos do paciente (multi-select, máx 6) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivos/Queixas do paciente (máx. 6)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {patientReasonOptions.map(option => (
                        <button
                          key={option.id}
                          onClick={() => togglePatientReason(option.id)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            patientReasons.includes(option.id)
                              ? "bg-[#E03673] text-white shadow-sm"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {patientReasons.length}/6 selecionados
                    </p>
                  </div>

                  {/* Bloco 4: Notas privadas */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Anotações privadas
                    </label>
                    <textarea
                      value={privateNotes}
                      onChange={(e) => setPrivateNotes(e.target.value)}
                      placeholder="Hipóteses clínicas, observações pessoais, estratégia terapêutica..."
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-400 mt-1">Visível apenas para você</p>
                  </div>

                  {/* Bloco 5: Orientações e links */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Orientações / Atividades para casa
                    </label>
                    <textarea
                      value={activityInstructions}
                      onChange={(e) => setActivityInstructions(e.target.value)}
                      placeholder="O que o paciente deve fazer até a próxima sessão..."
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Links (máx 3) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Links de apoio (máx. 3)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none text-sm"
                      />
                      <button
                        onClick={handleAddLink}
                        disabled={links.length >= 3 || !newLink.trim()}
                        className="px-3 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {links.length > 0 && (
                      <div className="space-y-1">
                        {links.map((link, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                            <a href={link} target="_blank" className="text-xs text-[#2F80D3] hover:underline truncate flex-1">
                              {link}
                            </a>
                            <button
                              onClick={() => handleRemoveLink(index)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{links.length}/3 links adicionados</p>
                  </div>
                </>
              )}

              {/* Botão Finalizar */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#2F80D3] hover:bg-[#236bb3] text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {sessionNotOccurred ? 'Registrar Não Ocorrência' : 'Finalizar Sessão'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-yellow-500 to-yellow-600">
              <h3 className="text-lg font-semibold text-white">Confirmar ação</h3>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">
                {sessionNotOccurred 
                  ? "⚠️ Após confirmar que a sessão NÃO ocorreu, o registro será finalizado e não poderá ser alterado."
                  : "⚠️ Após finalizar a sessão, o prontuário será salvo e não poderá ser editado. Você confirma que deseja prosseguir?"}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmSave}
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {saving ? "Salvando..." : "Confirmar"}
                </button>
                <button
                  onClick={() => setConfirmDialog(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens de feedback */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}
      
      {success && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}