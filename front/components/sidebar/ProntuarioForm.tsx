"use client";
import { useState, useEffect, useRef } from "react";
import { Loader2, User, Calendar, MapPin, CreditCard, Eye, History, FileText, Mic, MicOff, FileWarning, Edit3 } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { ReagendamentoModal } from "@/components/Modals/ReagendamentoModal";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const outcomeOptions = [
  { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
  { value: "ALTA_CLINICA", label: "Alta clínica" },
  { value: "ALTA_A_PEDIDO", label: "Alta a pedido" },
  { value: "ENCAMINHAMENTO_ESPECIALISTA", label: "Encaminhamento especialista" },
  { value: "ENCAMINHAMENTO_EMERGENCIAL", label: "Encaminhamento emergencial" }
];

const notOccurredOptions = [
  { value: "CLIENTE_NAO_COMPARECEU", label: "Cliente não compareceu" },
  { value: "PROBLEMAS_VIDEOCHAMADA", label: "Problemas com a videochamada" },
  { value: "CONFLITO_AGENDA", label: "Conflito de agenda do terapeuta" },
  { value: "OUTROS", label: "Outros" }
];

const getNotOccurredLabel = (reason: string) => ({
  CLIENTE_NAO_COMPARECEU: "Cliente não compareceu",
  PROBLEMAS_VIDEOCHAMADA: "Problemas com a videochamada",
  CONFLITO_AGENDA: "Conflito de agenda do terapeuta",
  OUTROS: "Outros",
}[reason] || reason);

const rescheduleReasons = ["PROBLEMAS_VIDEOCHAMADA", "CONFLITO_AGENDA", "OUTROS"];

const patientReasonOptions = [
  { id: "ansiedade", label: "Ansiedade" }, { id: "depressao", label: "Depressão" },
  { id: "estresse", label: "Estresse" }, { id: "relacionamento", label: "Relacionamentos" },
  { id: "autoestima", label: "Autoestima" }, { id: "carreira", label: "Carreira" },
  { id: "luto", label: "Luto" }, { id: "trauma", label: "Trauma" },
  { id: "burnout", label: "Burnout" }, { id: "panico", label: "Pânico" },
  { id: "fobias", label: "Fobias" }, { id: "toc", label: "TOC" },
  { id: "alimentares", label: "Transtornos Alimentares" }, { id: "sexualidade", label: "Sexualidade" },
  { id: "tdah", label: "TDAH" },
  { id: "tea", label: "TEA" },
  { id: "conflitos_familiares", label: "Conflitos Familiares" },
  { id: "ciumes", label: "Ciúmes" },
  { id: "lgbt", label: "LGBT+" },
];

const calculateAge = (birthDate: string | null) => {
  if (!birthDate) return null;
  const today = new Date(), birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() - birth.getMonth() < 0 || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};

const maskCpf = (cpf: string | null) => {
  if (!cpf || cpf === "***.***.***-**") return "***.***.***-**";
  const n = cpf.replace(/\D/g, "");
  return n.length !== 11 ? cpf : `${n.substring(0,2)}***.***-${n.substring(9,11)}`;
};

const getOutcomeLabel = (outcome: string) => ({
  EM_ACOMPANHAMENTO: "Em acompanhamento", ALTA_CLINICA: "Alta clínica",
  ALTA_A_PEDIDO: "Alta a pedido", ENCAMINHAMENTO_ESPECIALISTA: "Encaminhamento especialista",
  ENCAMINHAMENTO_EMERGENCIAL: "Encaminhamento emergencial",
}[outcome] || outcome);

interface ProntuarioFormProps {
  appointmentId: number;
  therapistUserId?: number;
  readOnly?: boolean;
  /** ✅ Contagem total de pendentes vinda do SidebarRight — garante consistência entre os dois */
  totalPendingCount?: number;
  onSave?: () => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface HistorySession {
  id: number; starts_at: string; evolution?: string; outcome?: string;
  activity_instructions?: string; session_not_occurred?: boolean; not_occurred_reason?: string;
}
interface PendingSession { id: number; starts_at: string; status: string; patient_name?: string; }

declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; } }

export function ProntuarioForm({ appointmentId, therapistUserId, readOnly = false, totalPendingCount, onSave, onError, onSuccess }: ProntuarioFormProps) {
  const { execute: apiCall } = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [internalTab, setInternalTab] = useState<"prontuario" | "historico" | "pendentes">("prontuario");
  const [currentSessionDate, setCurrentSessionDate] = useState<Date | null>(null);
  const [isFutureSession, setIsFutureSession] = useState(false);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);

  const [patientName, setPatientName] = useState("");
  const [patientFotoUrl, setPatientFotoUrl] = useState<string | null>(null);
  const [patientCpf, setPatientCpf] = useState<string | null>(null);
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientCity, setPatientCity] = useState("");
  const [patientState, setPatientState] = useState("");

  const [sessionNotOccurred, setSessionNotOccurred] = useState(false);
  const [notOccurredReason, setNotOccurredReason] = useState("");
  const [evolution, setEvolution] = useState("");
  const [outcome, setOutcome] = useState("");
  const [patientReasons, setPatientReasons] = useState<string[]>([]);
  const [patientComplaints, setPatientComplaints] = useState<string[]>([]);
  const [privateNotes, setPrivateNotes] = useState("");
  const [activityInstructions, setActivityInstructions] = useState("");
  const [links, setLinks] = useState<string[]>([]);

  // 🎙️ Groq Whisper — gravação em chunks
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => { if (appointmentId) loadData(); }, [appointmentId]);
  useEffect(() => { if (readOnly && isCompleted) setInternalTab("historico"); }, [readOnly, isCompleted]);

  // ✅ Envia um chunk de áudio para o backend (Groq Whisper)
  const sendChunk = async (blob: Blob) => {
    if (blob.size < 1000) return; // ignora chunks muito pequenos (silêncio)
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio_file", blob, "chunk.webm");
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${BACKEND_URL}/api/appointments/${appointmentId}/transcribe`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (res.ok) {
        const data = await res.json();
        const text: string = data.transcription || "";
        if (text.trim()) {
          setEvolution(prev => {
            const trimmed = prev.trimEnd();
            return trimmed ? trimmed + " " + text.trim() : text.trim();
          });
          setChunkCount(c => c + 1);
        }
      }
    } catch (e) {
      console.error("Erro ao transcrever chunk:", e);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ✅ Inicia gravação contínua em chunks de 12 segundos
  const startRecording = async () => {
    if (isRecordingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsRecording(true);
      setChunkCount(0);

      const startNewChunk = () => {
        if (!isRecordingRef.current) return;
        audioChunksRef.current = [];
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          sendChunk(blob);
          // ✅ Inicia próximo chunk automaticamente
          if (isRecordingRef.current) startNewChunk();
        };

        mr.start();
        // Para o chunk após 12 segundos
        setTimeout(() => {
          if (mr.state === "recording") mr.stop();
        }, 12000);
      };

      startNewChunk();
      onSuccess?.("🎙️ Gravando... Os trechos serão transcritos automaticamente.");
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        onError?.("Permissão do microfone negada. Verifique as configurações do navegador.");
      } else {
        onError?.("Não foi possível acessar o microfone.");
      }
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const fetchMedicalRecord = async (id: number) => {
    try { return await apiCall({ url: `/api/appointments/${id}/medical-record`, requireAuth: true, silent: true }); }
    catch { return null; }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const apts = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const current = apts?.find((a: any) => a.id === appointmentId);

      if (current?.starts_at) {
        const d = new Date(current.starts_at);
        setCurrentSessionDate(d);
        setIsFutureSession(d > new Date());
      }
      if (current?.patient) {
        setPatientName(current.patient.full_name || "Não informado");
        setPatientFotoUrl(current.patient.foto_url ? getFotoSrc(current.patient.foto_url) ?? "" : null);
        setPatientCpf(current.patient.cpf || null);
        if (current.patient.birth_date) setPatientAge(calculateAge(current.patient.birth_date));
      }
      try {
        const pd = await apiCall({ url: `/api/therapists/appointment/${appointmentId}/patient-data`, requireAuth: true });
        if (pd?.address) { setPatientCity(pd.address.city || "--"); setPatientState(pd.address.state || "--"); }
      } catch {}

      const patientUserId = current?.patient_user_id;
      const patientApts = apts?.filter((a: any) => a.patient_user_id === patientUserId) || [];
      const today = new Date(); today.setHours(0,0,0,0);

      // Histórico — sessões completadas deste paciente
      const completed = patientApts
        .filter((a: any) => a.status === "completed" && a.id !== appointmentId)
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      const historyRecords: HistorySession[] = [];
      for (const a of completed) {
        const rec = await fetchMedicalRecord(a.id);
        if (rec?.id) historyRecords.push({ id: a.id, starts_at: a.starts_at, evolution: rec.evolution, outcome: rec.outcome, activity_instructions: rec.activity_instructions, session_not_occurred: rec.session_not_occurred || false, not_occurred_reason: rec.not_occurred_reason });
      }
      setHistorySessions(historyRecords);

      // ✅ Pendentes — sessões DESTE PACIENTE sem prontuário (contexto do prontuário aberto)
      const potentialPending = patientApts.filter((a: any) => {
        const d = new Date(a.starts_at); d.setHours(0,0,0,0);
        return d < today && ["confirmed","scheduled"].includes(a.status) && a.id !== appointmentId;
      }).sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      const pendingNoRecord: PendingSession[] = [];
      for (const a of potentialPending) {
        const rec = await fetchMedicalRecord(a.id);
        if (!rec?.id) pendingNoRecord.push({ id: a.id, starts_at: a.starts_at, status: a.status, patient_name: a.patient?.full_name });
      }
      setPendingSessions(pendingNoRecord);

      const record = await fetchMedicalRecord(appointmentId);
      if (record?.id) {
        setHasRecord(true);
        setSessionNotOccurred(record.session_not_occurred || false);
        setNotOccurredReason(record.not_occurred_reason || "");
        setEvolution(record.evolution || "");
        setOutcome(record.outcome || "");
        setPatientReasons(record.patient_reasons || []);
        setPatientComplaints(record.patient_reasons || []);
        setPrivateNotes(record.private_notes || "");
        setActivityInstructions(record.activity_instructions || "");
        setLinks(record.links || []);
        setIsCompleted(!!(record.evolution?.trim() && record.outcome));
      } else {
        setHasRecord(false); setIsCompleted(false);
      }
    } catch (e) { console.error(e); onError?.("Erro ao carregar dados"); }
    finally { setLoading(false); }
  };

  const loadPendingRecord = async (sessionId: number) => {
    setSelectedPendingId(sessionId);
    setInternalTab("prontuario");
    try {
      const rec = await fetchMedicalRecord(sessionId);
      setEvolution(rec?.evolution || ""); setOutcome(rec?.outcome || "");
      setPatientReasons(rec?.patient_reasons || []); setPrivateNotes(rec?.private_notes || "");
      setActivityInstructions(rec?.activity_instructions || ""); setLinks(rec?.links || []);
      setSessionNotOccurred(rec?.session_not_occurred || false); setNotOccurredReason(rec?.not_occurred_reason || "");
      setHasRecord(!!rec?.id); setIsCompleted(!!(rec?.evolution && rec?.outcome));
    } catch { onError?.("Erro ao carregar sessão pendente"); }
  };

  const validateForm = () => {
    if (readOnly) return true;
    if (sessionNotOccurred) { if (!notOccurredReason) { onError?.("Informe o motivo da não ocorrência"); return false; } return true; }
    if (!evolution.trim()) { onError?.("Preencha a evolução do atendimento"); return false; }
    if (!outcome) { onError?.("Selecione o desfecho clínico"); return false; }
    return true;
  };

  const handleSave = async () => {
    if (readOnly) return;
    if (sessionNotOccurred && rescheduleReasons.includes(notOccurredReason)) { setShowRescheduleModal(true); return; }
    if (!validateForm()) return;
    setConfirmDialog(true);
  };

  const confirmSave = async () => {
    if (readOnly) return;
    setSaving(true); setConfirmDialog(false);
    const id = selectedPendingId || appointmentId;
    try {
      await apiCall({ url: `/api/appointments/${id}/complete`, method: "POST", body: { appointment_id: id, session_not_occurred: sessionNotOccurred, not_occurred_reason: notOccurredReason, evolution, outcome, patient_reasons: patientReasons, private_notes: privateNotes, activity_instructions: activityInstructions, links }, requireAuth: true });
      onSuccess?.("✅ Prontuário salvo com sucesso!");
      setIsCompleted(true); setHasRecord(true);
      onSave?.(); await loadData(); setSelectedPendingId(null); setInternalTab("prontuario");
    } catch (e: any) { onError?.(e.message || "Erro ao salvar prontuário"); }
    finally { setSaving(false); }
  };

  const togglePatientReason = (id: string) => {
    if (readOnly) return;
    if (patientReasons.includes(id)) setPatientReasons(patientReasons.filter(r => r !== id));
    else if (patientReasons.length < 6) setPatientReasons([...patientReasons, id]);
    else { onError?.("Máximo de 6 motivos"); setTimeout(() => onError?.(""), 3000); }
  };

  const isLocked = hasRecord && isCompleted;
  const formatSessionDate = (d: string) => new Date(d).toLocaleDateString("pt-BR") + " às " + new Date(d).toLocaleTimeString("pt-BR").slice(0,5);

  // ✅ Número exibido na aba Pendentes:
  // Usa totalPendingCount (do SidebarRight) se disponível, senão usa o local
  const pendingTabCount = totalPendingCount !== undefined ? totalPendingCount : pendingSessions.length;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-[#E03673] animate-spin" /></div>;

  return (
    <div className="space-y-4 w-full">
      {showRescheduleModal && therapistUserId && (
        <ReagendamentoModal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)}
          appointmentId={appointmentId} therapistUserId={therapistUserId}
          onSuccess={() => { setShowRescheduleModal(false); window.dispatchEvent(new Event("appointmentRescheduled")); onSuccess?.("✅ Sessão reagendada!"); onSave?.(); loadData(); }} />
      )}

      {/* CABEÇALHO PACIENTE */}
      <div className="p-4 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
            {patientFotoUrl ? <img src={patientFotoUrl} alt={patientName} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-white" />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{patientName}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-sm text-white/80">
              <div className="flex items-center gap-1"><CreditCard className="w-3 h-3" /><span>{maskCpf(patientCpf)}</span></div>
              {patientAge !== null && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{patientAge} anos</span></div>}
              {(patientCity !== "--" || patientState !== "--") && <div className="flex items-center gap-1 col-span-2"><MapPin className="w-3 h-3" /><span>{patientCity}/{patientState}</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ ABAS INTERNAS — mesmo estilo compacto com contador */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <button onClick={() => setInternalTab("prontuario")}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${internalTab === "prontuario" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
          <FileText className="w-3.5 h-3.5" />
          Prontuário
        </button>
        <button onClick={() => setInternalTab("historico")}
          className={`flex-1 py-2 text-xs font-medium transition-colors border-l border-gray-200 flex items-center justify-center gap-1 ${internalTab === "historico" ? "bg-[#2F80D3] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
          <History className="w-3.5 h-3.5" />
          Histórico
          <span className={`text-xs font-bold ml-0.5 ${internalTab === "historico" ? "text-white/80" : "text-[#2F80D3]"}`}>
            ({historySessions.length})
          </span>
        </button>
        <button onClick={() => setInternalTab("pendentes")}
          className={`flex-1 py-2 text-xs font-medium transition-colors border-l border-gray-200 flex items-center justify-center gap-1 ${internalTab === "pendentes" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
          <FileWarning className="w-3.5 h-3.5" />
          Pendentes
          {/* ✅ Mostra totalPendingCount (do SidebarRight) — consistente com as abas de cima */}
          <span className={`text-xs font-bold ml-0.5 ${internalTab === "pendentes" ? "text-white/80" : pendingTabCount > 0 ? "text-orange-500" : "text-gray-400"}`}>
            ({pendingTabCount})
          </span>
        </button>
      </div>

      {/* ABA PRONTUÁRIO */}
      {internalTab === "prontuario" && (
        <div>
          {selectedPendingId && (
            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-orange-600" />
                <p className="text-sm text-orange-700">Editando sessão pendente</p>
              </div>
              <button onClick={() => { setSelectedPendingId(null); loadData(); }} className="text-xs text-orange-600 hover:text-orange-800 underline">Voltar</button>
            </div>
          )}
          {isLocked && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center mb-4">
              <span className="text-xs text-blue-700 flex items-center justify-center gap-1"><Eye className="w-3 h-3" />Prontuário já registrado - somente leitura</span>
            </div>
          )}
          {isFutureSession && !hasRecord && !selectedPendingId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /><span className="text-sm text-amber-700">Sessão agendada para {currentSessionDate ? formatSessionDate(currentSessionDate.toISOString()) : "data não informada"}</span></div>
            </div>
          )}
          {patientComplaints.length > 0 && (
            <div className="p-3 bg-[#FCE4EC] rounded-lg border border-[#E03673]/30 mb-4">
              <h4 className="text-sm font-semibold text-[#E03673] mb-2">Queixas do paciente</h4>
              {patientComplaints.map((c, i) => <div key={i} className="p-2 bg-white rounded-lg mb-1"><p className="text-sm text-gray-700">{c}</p></div>)}
            </div>
          )}

          {!isLocked ? (
            <>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sessionNotOccurred} onChange={e => setSessionNotOccurred(e.target.checked)} className="w-4 h-4 text-[#E03673]" />
                  <span className="text-sm font-medium">A sessão NÃO ocorreu</span>
                </label>
              </div>
              {sessionNotOccurred && (
                <select value={notOccurredReason} onChange={e => setNotOccurredReason(e.target.value)} className="w-full p-2 border rounded-lg mb-4">
                  <option value="">Selecione o motivo...</option>
                  {notOccurredOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {!sessionNotOccurred && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Evolução do atendimento *
                      </label>
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#E03673] text-white rounded-lg text-sm hover:bg-[#c02c5e] transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                          Ditar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-xs text-red-500 font-medium">Gravando...</span>
                          </div>
                          <button
                            onClick={stopRecording}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
                          >
                            <MicOff className="w-4 h-4" />
                            Parar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ✅ Textarea com borda ativa durante gravação */}
                    <div className={`relative rounded-lg border-2 transition-all ${isRecording ? "border-[#E03673]" : "border-gray-200"}`}>
                      <textarea
                        ref={textareaRef}
                        value={evolution}
                        onChange={e => setEvolution(e.target.value)}
                        placeholder="Digite a evolução ou clique em Ditar para gravar..."
                        className="w-full p-3 rounded-lg resize-none outline-none bg-transparent"
                        rows={8}
                      />
                      {/* Status da gravação */}
                      {isRecording && (
                        <div className="px-3 pb-2 min-h-[24px]">
                          {isTranscribing ? (
                            <span className="text-[#E03673] text-xs flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Transcrevendo com IA...
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
                              Gravando... fale normalmente
                            </span>
                          )}
                        </div>
                      )}
                      {/* Badge de trechos transcritos */}
                      {isRecording && chunkCount > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#E03673]/10 text-[#E03673] px-2 py-0.5 rounded-full pointer-events-none">
                          <Mic className="w-3 h-3" />
                          <span className="text-xs font-medium">{chunkCount} trecho{chunkCount !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full p-2 border rounded-lg mb-4">
                    <option value="">Selecione o desfecho...</option>
                    {outcomeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {patientReasonOptions.map(o => (
                      <button key={o.id} onClick={() => togglePatientReason(o.id)}
                        className={`px-2 py-1 rounded-full text-xs ${patientReasons.includes(o.id) ? "bg-[#E03673] text-white" : "bg-gray-100"}`}>{o.label}</button>
                    ))}
                  </div>
                  <textarea value={privateNotes} onChange={e => setPrivateNotes(e.target.value)} placeholder="Anotações privadas" className="w-full p-2 border rounded-lg resize-none mb-4" rows={3} />
                  <textarea value={activityInstructions} onChange={e => setActivityInstructions(e.target.value)} placeholder="Orientações / Atividades para casa" className="w-full p-2 border rounded-lg resize-none mb-4" rows={3} />
                  <div className="flex gap-2 mb-4">
                    <input type="url" value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." className="flex-1 p-2 border rounded-lg" />
                    <button onClick={() => { if (newLink.trim() && links.length < 3) { setLinks([...links, newLink.trim()]); setNewLink(""); } }} disabled={links.length >= 3} className="px-3 py-2 bg-[#E03673] text-white rounded-lg">+</button>
                  </div>
                  {links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mb-1">
                      <a href={l} target="_blank" className="text-xs text-blue-600 truncate flex-1">{l}</a>
                      <button onClick={() => setLinks(links.filter((_,j) => j !== i))} className="text-red-500">✕</button>
                    </div>
                  ))}
                </>
              )}
              <button onClick={handleSave} disabled={saving} className="w-full bg-[#E03673] text-white py-3 rounded-lg font-medium">
                {saving ? "Salvando..." : sessionNotOccurred ? "Registrar" : "Finalizar Sessão"}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {sessionNotOccurred && <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-sm text-yellow-700">⚠️ Sessão não ocorreu - {getNotOccurredLabel(notOccurredReason)}</p></div>}
              {!sessionNotOccurred && evolution && <div><h4 className="text-sm font-semibold mb-1">Evolução</h4><div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm whitespace-pre-wrap">{evolution}</p></div></div>}
              {!sessionNotOccurred && outcome && <div><h4 className="text-sm font-semibold mb-1">Desfecho</h4><div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm">{getOutcomeLabel(outcome)}</p></div></div>}
              {!sessionNotOccurred && activityInstructions && <div><h4 className="text-sm font-semibold mb-1">Orientações</h4><div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm whitespace-pre-wrap">{activityInstructions}</p></div></div>}
              {privateNotes && <div><h4 className="text-sm font-semibold text-gray-500 mb-1">Anotações privadas</h4><div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm">{privateNotes}</p></div></div>}
            </div>
          )}
        </div>
      )}

      {/* ABA HISTÓRICO */}
      {internalTab === "historico" && (
        <div>
          {historySessions.length === 0 ? (
            <div className="p-6 text-center bg-gray-50 rounded-lg">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum histórico encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Sessões realizadas aparecerão aqui após o registro do prontuário</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {historySessions.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#2F80D3] bg-blue-50 px-2 py-1 rounded-full">{formatSessionDate(s.starts_at)}</span>
                    {s.session_not_occurred
                      ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Não ocorreu</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Realizada</span>}
                  </div>
                  {s.session_not_occurred && s.not_occurred_reason && <div className="mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200"><p className="text-xs text-yellow-700">Motivo: {getNotOccurredLabel(s.not_occurred_reason)}</p></div>}
                  {s.evolution && <div className="mb-2"><p className="text-xs font-medium text-gray-600">Evolução:</p><p className="text-sm text-gray-700 line-clamp-3">{s.evolution}</p></div>}
                  {s.outcome && <div className="mb-2"><p className="text-xs font-medium text-gray-600">Desfecho:</p><p className="text-sm text-gray-700">{getOutcomeLabel(s.outcome)}</p></div>}
                  {s.activity_instructions && <div><p className="text-xs font-medium text-gray-600">Orientações:</p><p className="text-sm text-gray-700 line-clamp-2">{s.activity_instructions}</p></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA PENDENTES */}
      {internalTab === "pendentes" && (
        <div>
          {pendingSessions.length === 0 ? (
            <div className="p-6 text-center bg-gray-50 rounded-lg">
              <FileWarning className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma sessão pendente para este paciente</p>
              {totalPendingCount !== undefined && totalPendingCount > 0 && (
                <p className="text-xs text-orange-500 mt-2">
                  ⚠️ {totalPendingCount} pendente{totalPendingCount !== 1 ? "s" : ""} no total — selecione outro paciente nas abas acima
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {pendingSessions.map(s => (
                <div key={s.id} className="border border-orange-200 bg-orange-50 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">{formatSessionDate(s.starts_at)}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Prontuário pendente</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button onClick={() => loadPendingRecord(s.id)} className="flex items-center gap-2 px-3 py-1.5 bg-[#E03673] text-white rounded-lg text-sm hover:bg-[#c02c5e] transition-colors">
                      <Edit3 className="w-3 h-3" />Registrar prontuário
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-3">Confirmar ação</h3>
            <p className="text-gray-600 mb-4">{sessionNotOccurred ? "A sessão será registrada como não ocorrida e não poderá ser alterada." : "O prontuário será finalizado e não poderá ser alterado."}</p>
            <div className="flex gap-3">
              <button onClick={confirmSave} className="flex-1 bg-[#E03673] text-white py-2 rounded-lg">Confirmar</button>
              <button onClick={() => setConfirmDialog(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}