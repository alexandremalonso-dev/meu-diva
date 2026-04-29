"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getFotoSrc } from '@/lib/utils';
import { 
  Calendar, 
  Loader2,
  FileText,
  ChevronRight,
  User,
  Clock,
  Download,
  Mail,
  CalendarPlus
} from "lucide-react";
import type { Appointment } from "../../dashboard/types";

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ReceiptData = {
  appointment_id: number;
  therapist_name: string;
  therapist_crp: string;
  patient_name: string;
  patient_cpf: string;
  session_date: string;
  session_id: string;
};

export default function PatientCompletedSessionsPage() {
  const { user } = useAuth();

  // Hook centralizado useApi
  const { execute: apiCall } = useApi();
  const router = useRouter();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState<Appointment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Carregar sessões realizadas
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 Carregando histórico do paciente...");
      
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      console.log("✅ Appointments carregados:", appointmentsData?.length);
      
      const patientAppointments = appointmentsData.filter(
        (apt: Appointment) => apt.patient_user_id === user?.id
      );
      
      // Filtrar apenas sessões realizadas (status completed)
      const completedAppointments = patientAppointments.filter((apt: Appointment) => 
        apt.status === "completed"
      );
      
      // Ordenar por data decrescente (mais recentes primeiro)
      completedAppointments.sort((a: any, b: any) => 
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      );
      
      setAppointments(completedAppointments);
      
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
      setError("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Gerar recibo
  const generateReceipt = (apt: Appointment) => {
    const receipt: ReceiptData = {
      appointment_id: apt.id,
      therapist_name: apt.therapist?.full_name || "Terapeuta",
      therapist_crp: (apt.therapist as any)?.crp || "A definir",
      patient_name: user?.full_name || "Paciente",
      patient_cpf: (user as any)?.cpf || "***.***.***-**",
      session_date: formatDateForReceipt(apt.starts_at),
      session_id: apt.id.toString()
    };
    setReceiptData(receipt);
    setSelectedSession(apt);
    setShowReceiptModal(true);
  };
  
  // Enviar recibo por e-mail
  const sendReceiptByEmail = async () => {
    if (!receiptData) return;
    
    setSendingEmail(true);
    try {
      await apiCall({ url: "/api/sessions/send-receipt", method: "POST", body: {
          appointment_id: receiptData.appointment_id,
          patient_email: user?.email
        }, requireAuth: true });
      alert("✅ Recibo enviado por e-mail com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      alert("❌ Erro ao enviar recibo. Tente novamente.");
    } finally {
      setSendingEmail(false);
    }
  };
  
  // Baixar recibo como HTML
  const downloadReceipt = () => {
    if (!receiptData) return;
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo de Sessão - Meu Divã</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #E03673;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 14px;
            color: #666;
          }
          .content {
            margin: 30px 0;
          }
          .row {
            margin: 15px 0;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
          }
          .label {
            font-weight: bold;
            width: 200px;
            display: inline-block;
          }
          .signature {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            text-align: center;
          }
          .footer {
            margin-top: 40px;
            font-size: 10px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Declaração de Atendimento</div>
          <div class="subtitle">Meu Divã - Plataforma de Teleterapia</div>
        </div>
        
        <div class="content">
          <div class="row">
            <span class="label">Terapeuta:</span>
            <span>${receiptData.therapist_name}</span>
          </div>
          <div class="row">
            <span class="label">CRP:</span>
            <span>${receiptData.therapist_crp}</span>
          </div>
          <div class="row">
            <span class="label">Paciente:</span>
            <span>${receiptData.patient_name}</span>
          </div>
          <div class="row">
            <span class="label">CPF:</span>
            <span>${receiptData.patient_cpf}</span>
          </div>
          <div class="row">
            <span class="label">ID da sessão:</span>
            <span>${receiptData.session_id}</span>
          </div>
          <div class="row">
            <span class="label">Data da sessão:</span>
            <span>${receiptData.session_date}</span>
          </div>
        </div>
        
        <div class="signature">
          _________________________________<br/>
          ${receiptData.therapist_name}<br/>
          Terapeuta Responsável
        </div>
        
        <div class="footer">
          Este documento foi produzido com o fim exclusivo de atender às solicitações de reembolso.<br/>
          Para dedução no Imposto de Renda, utilize os dados da nota fiscal emitida pelo prestador dos serviços.
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo_sessao_${receiptData.session_id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };
  
  const formatDateForReceipt = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };
  
  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };
  
  const handleNewSession = (therapistId: number) => {
    router.push(`/terapeuta/${therapistId}`);
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }
  
  return (
    <>
      {/* Cabeçalho */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Histórico de Sessões</h1>
          </div>
          <p className="text-gray-600 mt-1">
            Visualize suas sessões realizadas e baixe os recibos
          </p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mensagens de erro */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        
        {/* Lista de sessões realizadas */}
        {appointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma sessão realizada ainda.</p>
            <p className="text-sm text-gray-400 mt-1">
              Suas sessões aparecerão aqui após o terapeuta registrar o atendimento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointments.map((apt, index) => {
              const fotoUrl = getFotoUrl(apt.therapist?.foto_url);
              const date = new Date(apt.starts_at);
              const formattedDate = date.toLocaleDateString('pt-BR');
              const formattedTime = date.toLocaleTimeString('pt-BR').slice(0,5);
              const isMostRecent = index === 0;
              
              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all"
                >
                  {/* Foto e nome do terapeuta */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white">
                      {fotoUrl ? (
                        <img 
                          src={fotoUrl} 
                          alt={apt.therapist?.full_name || "Terapeuta"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {apt.therapist?.full_name || "Terapeuta"}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formattedDate} às {formattedTime}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Badge realizado */}
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      ✅ Realizada
                    </span>
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      onClick={() => generateReceipt(apt)}
                      className="flex items-center justify-center gap-2 w-full py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar recibo
                    </button>
                    
                    {isMostRecent && (
                      <button
                        onClick={() => handleNewSession(apt.therapist_user_id)}
                        className="flex items-center justify-center gap-2 w-full py-2 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        Agendar nova sessão
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Modal de Recibo */}
      {showReceiptModal && receiptData && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Cabeçalho do modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E03673]" />
                Recibo da Sessão
              </h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedSession(null);
                  setReceiptData(null);
                }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Conteúdo do modal */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Terapeuta:</strong> {receiptData.therapist_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>CRP:</strong> {receiptData.therapist_crp}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Paciente:</strong> {receiptData.patient_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>CPF:</strong> {receiptData.patient_cpf}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>ID da sessão:</strong> {receiptData.session_id}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Data:</strong> {receiptData.session_date}
                </p>
              </div>
              
              <p className="text-xs text-gray-500 mb-4">
                Este documento foi produzido com o fim exclusivo de atender às solicitações de reembolso.
                Para dedução no Imposto de Renda, utilize os dados da nota fiscal emitida pelo prestador dos serviços.
              </p>
            </div>
            
            {/* Rodapé do modal */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={sendReceiptByEmail}
                disabled={sendingEmail}
                className="px-4 py-2 text-sm bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Enviar por e-mail
              </button>
              <button
                onClick={downloadReceipt}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}