"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getFotoSrc } from '@/lib/utils';
import { 
  Mail, 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  Tag, 
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from "lucide-react";

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Invite = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  therapist?: {
    full_name: string;
    email: string;
    specialties?: string;
    bio?: string;
    foto_url?: string;
    session_price?: number;
  };
  duration_minutes?: number;
};

export default function PatientInvitesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const data = await api("/api/invites/me");
      console.log("📥 Convites carregados:", data);
      setInvites(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error("Erro ao carregar convites:", error);
      setError("Erro ao carregar convites");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmInvite(invite: Invite) {
    console.log("📝 Confirmando convite:", invite.id);
    
    setResponding(prev => ({ ...prev, [invite.id]: true }));
    setError(null);
    setSuccess(null);
    
    try {
      const sessionPrice = typeof invite.therapist?.session_price === 'number' 
        ? invite.therapist.session_price 
        : 200;
      const appointmentId = invite.id;
      
      console.log('💰 Verificando saldo...');
      const walletData = await api('/api/wallet/balance');
      const balance = walletData.balance || 0;
      console.log(`💰 Saldo atual: R$ ${balance}`);
      
      if (balance < sessionPrice) {
        console.log('⚠️ Saldo insuficiente, redirecionando para Stripe...');
        
        const successUrl = `${window.location.origin}/patient/dashboard?payment_success=true&appointment_id=${appointmentId}`;
        const cancelUrl = `${window.location.origin}/patient/invites?cancel=true`;
        
        const stripeData = await api('/api/payments/create-checkout', {
          method: "POST",
          body: JSON.stringify({
            appointment_id: appointmentId,
            amount: sessionPrice,
            success_url: successUrl,
            cancel_url: cancelUrl
          })
        });
        
        alert("Saldo insuficiente. Redirecionando para pagamento...");
        window.location.href = stripeData.checkout_url;
        return;
      }
      
      console.log('✅ Saldo suficiente, confirmando convite...');
      
      await api(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" })
      });
      
      setSuccess("✅ Sessão confirmada! Valor debitado da sua carteira.");
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error("❌ Erro ao confirmar convite:", err);
      
      if (err.message?.toLowerCase().includes('ocupado') || err.message?.toLowerCase().includes('conflict')) {
        setError("❌ Este horário já foi ocupado. O convite não pode ser confirmado.");
        setInvites(prev => prev.filter(i => i.id !== invite.id));
      } else {
        setError(err.message || "Erro ao confirmar convite");
      }
    } finally {
      setResponding(prev => ({ ...prev, [invite.id]: false }));
      setTimeout(() => setError(null), 3000);
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  async function handleDeclineInvite(inviteId: number) {
    console.log("❌ Recusando convite:", inviteId);
    
    setResponding(prev => ({ ...prev, [inviteId]: true }));
    setError(null);
    setSuccess(null);
    
    try {
      await api(`/api/appointments/${inviteId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "declined" })
      });
      
      setSuccess("Convite recusado com sucesso!");
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      
    } catch (err: any) {
      console.error("❌ Erro ao recusar convite:", err);
      setError(err.message || "Erro ao recusar convite");
    } finally {
      setResponding(prev => ({ ...prev, [inviteId]: false }));
      setTimeout(() => setError(null), 3000);
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  const isInvite = (invite: Invite) => invite.status === 'proposed';

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Mail className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Meus Convites</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Gerencie os convites recebidos dos terapeutas
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        
        {invites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum convite pendente.</p>
            <p className="text-sm text-gray-400 mt-1">Quando um terapeuta te convidar, aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map(invite => {
              const duration = invite.duration_minutes || 
                Math.round((new Date(invite.ends_at).getTime() - new Date(invite.starts_at).getTime()) / 60000);
              const sessionPrice = typeof invite.therapist?.session_price === 'number' 
                ? invite.therapist.session_price 
                : 200;
              const fotoUrl = getFotoUrl(invite.therapist?.foto_url);
              const isInviteOnly = invite.status === 'proposed';
              
              return (
                <div key={invite.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-14 w-14 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xl font-bold">
                      {fotoUrl ? (
                        <img 
                          src={fotoUrl} 
                          alt={invite.therapist?.full_name || 'Terapeuta'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {invite.therapist?.full_name || 'Terapeuta'}
                          </h3>
                          
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {invite.therapist?.email}
                          </p>
                          
                          {invite.therapist?.specialties && (
                            <p className="text-xs text-[#E03673] mt-1 flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {invite.therapist.specialties}
                            </p>
                          )}
                          
                          <p className="text-sm font-medium text-[#3A3B21] mt-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            R$ {sessionPrice.toFixed(2)} / sessão
                          </p>
                          
                          {invite.therapist?.bio && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2 flex items-start gap-1">
                              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {invite.therapist.bio}
                            </p>
                          )}
                        </div>
                        
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          invite.status === 'proposed' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : invite.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invite.status === 'proposed' ? '⏳ Convite pendente' : 
                           invite.status === 'confirmed' ? '✅ Confirmado' : 
                           invite.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Data</p>
                        <p className="text-sm font-medium">
                          {new Date(invite.starts_at).toLocaleDateString('pt-BR', { 
                            weekday: 'short', 
                            day: '2-digit', 
                            month: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Horário</p>
                        <p className="text-sm font-medium">
                          {new Date(invite.starts_at).toLocaleTimeString('pt-BR').slice(0,5)} - 
                          {new Date(invite.ends_at).toLocaleTimeString('pt-BR').slice(0,5)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Duração</p>
                        <p className="text-sm font-medium">{duration} minutos</p>
                      </div>
                    </div>
                  </div>
                  
                  {isInviteOnly && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Este é um convite. Você pode confirmar ou recusar a qualquer momento.
                      </p>
                    </div>
                  )}
                  
                  {/* 🔥 BOTÕES APENAS CONFIRMAR E RECUSAR - CORES DA PALETA */}
                  {invite.status === 'proposed' && (
                    <div className="flex gap-3 mt-5">
                      {/* Botão Confirmar - Rosa */}
                      <button
                        onClick={() => handleConfirmInvite(invite)}
                        disabled={responding[invite.id]}
                        className="flex-1 bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 px-4 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                      >
                        {responding[invite.id] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Confirmando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Confirmar
                          </>
                        )}
                      </button>
                      
                      {/* Botão Recusar - Azul */}
                      <button
                        onClick={() => handleDeclineInvite(invite.id)}
                        disabled={responding[invite.id]}
                        className="flex-1 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 px-4 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                      >
                        {responding[invite.id] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Recusando...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Recusar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}