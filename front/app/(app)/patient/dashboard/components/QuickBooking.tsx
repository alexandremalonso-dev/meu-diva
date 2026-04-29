"use client";

import React, { useState, useEffect } from 'react';
import type { Therapist } from '../types';
import { Calendar, Clock, Sparkles, Star, User, ChevronRight, Loader2, Search, X, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface QuickBookingProps {
  therapists: Therapist[];
  frequentTherapists: Therapist[];
  quickTherapist: string;
  quickDate: string;
  quickTime: string;
  quickLoading: boolean;
  loadingSlots: boolean;
  suggestion: any;
  timeOptions: React.ReactNode[];
  onTherapistChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onQuickSuggestion?: (slot: any) => void;
}

interface AvailableSlot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
}

interface TherapistWithSlots {
  therapist: Therapist;
  profileId: number;
  nextSlots: AvailableSlot[];
  loading: boolean;
}

export function QuickBooking({ therapists, frequentTherapists, suggestion }: QuickBookingProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [therapistsWithSlots, setTherapistsWithSlots] = useState<TherapistWithSlots[]>([]);
  const [modalSlots, setModalSlots] = useState<{ therapist: Therapist; profileId: number; slots: AvailableSlot[] } | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    if (frequentTherapists.length === 0) return;
    loadAllSlots();
  }, [frequentTherapists]);

  const loadAllSlots = async () => {
    // Inicializa com loading
    setTherapistsWithSlots(frequentTherapists.map(t => ({
      therapist: t, profileId: 0, nextSlots: [], loading: true
    })));

    // Busca profile_ids de uma vez
    const therapistsData = await api('/api/therapists').catch(() => []);

    // Carrega slots de cada terapeuta em paralelo
    const results = await Promise.all(
      frequentTherapists.map(async (therapist) => {
        try {
          const profile = therapistsData.find((t: any) => t.user_id === therapist.user_id);
          if (!profile?.id) return { therapist, profileId: 0, nextSlots: [], loading: false };

          const res = await fetch(`${BACKEND_URL}/public/terapeutas/${profile.id}/slots?days=14`);
          if (!res.ok) return { therapist, profileId: profile.id, nextSlots: [], loading: false };

          const data = await res.json();
          const slots: AvailableSlot[] = (data.slots || [])
            .filter((s: any) => new Date(s.starts_at) > new Date())
            .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
            .slice(0, 3); // Apenas os 3 próximos

          return { therapist, profileId: profile.id, nextSlots: slots, loading: false };
        } catch {
          return { therapist, profileId: 0, nextSlots: [], loading: false };
        }
      })
    );

    setTherapistsWithSlots(results);
  };

  const openModal = async (item: TherapistWithSlots) => {
    if (!item.profileId) return;
    setLoadingModal(true);
    setModalSlots({ therapist: item.therapist, profileId: item.profileId, slots: [] });
    try {
      const res = await fetch(`${BACKEND_URL}/public/terapeutas/${item.profileId}/slots?days=30`);
      if (res.ok) {
        const data = await res.json();
        const slots: AvailableSlot[] = (data.slots || [])
          .filter((s: any) => new Date(s.starts_at) > new Date())
          .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setModalSlots({ therapist: item.therapist, profileId: item.profileId, slots });
      }
    } catch {}
    finally { setLoadingModal(false); }
  };

  // ✅ Lógica de payment igual ao CardTerapeuta — sem criar appointment antes do Stripe
  const handleAgendar = async (slot: AvailableSlot, therapist: Therapist) => {
    const key = `${therapist.user_id}_${slot.starts_at}`;
    if (isLoading) return;
    setIsLoading(key);

    try {
      const walletData = await api('/api/wallet/balance');
      const balance = walletData.balance || 0;
      const preco = therapist.session_price || 200;

      const startsAt = new Date(slot.starts_at);
      const therapistName = encodeURIComponent(therapist.full_name || "Terapeuta");
      const date = encodeURIComponent(startsAt.toLocaleDateString('pt-BR'));
      const time = encodeURIComponent(startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      const duration = slot.duration_minutes || 50;

      if (balance >= preco) {
        // ✅ Saldo suficiente — cria e confirma direto
        const bookingData = await api('/api/appointments', {
          method: "POST",
          body: JSON.stringify({
            therapist_user_id: therapist.user_id,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            duration_minutes: duration,
          })
        });
        await api(`/api/appointments/${bookingData.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "confirmed" })
        });
        setModalSlots(null);
        router.push(`/patient/dashboard?payment_success=true&appointment_id=${bookingData.id}&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${preco}`);
        return;
      }

      // ✅ Saldo insuficiente — vai pro Stripe SEM criar appointment antes
      const residual = preco - balance;
      const successUrl = `${window.location.origin}/patient/dashboard?payment_success=true&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${preco}`;
      const cancelUrl = `${window.location.origin}/patient/dashboard`;

      const stripeData = await api('/api/payments/create-checkout', {
        method: "POST",
        body: JSON.stringify({
          amount: residual,
          success_url: successUrl,
          cancel_url: cancelUrl,
          therapist_user_id: therapist.user_id,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          duration_minutes: duration,
        })
      });
      window.location.href = stripeData.checkout_url;

    } catch (err: any) {
      if (err.message?.toLowerCase().includes('ocupado') || err.message?.toLowerCase().includes('conflict')) {
        alert("❌ Este horário já foi ocupado. Escolha outro.");
        loadAllSlots();
      } else {
        alert(err.message || "Erro ao agendar sessão");
      }
    } finally {
      setIsLoading(null);
    }
  };

  const formatSlot = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#E03673]" />
          <span>Agendamento Rápido</span>
        </h2>

        {/* SUGESTÃO INTELIGENTE */}
        {suggestion?.slot && (
          <div className="mb-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Sugestão inteligente</span>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-3">
              {suggestion.therapist_name} tem horário disponível para você
            </p>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-[#E03673]" /> {suggestion.date}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-[#E03673]" /> {suggestion.time}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const therapist = therapists.find(t => t.full_name === suggestion.therapist_name);
                  if (therapist && suggestion.slot) await handleAgendar(suggestion.slot, therapist);
                }}
                disabled={!!isLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Agendar agora
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('dismiss-suggestion'))}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TERAPEUTAS FREQUENTES COM PRÓXIMOS SLOTS */}
        {therapistsWithSlots.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" /> Seus terapeutas frequentes
            </p>
            {therapistsWithSlots.map((item) => {
              const fotoUrl = item.therapist.foto_url ? getFotoSrc(item.therapist.foto_url) ?? "" : null;
              return (
                <div key={item.therapist.user_id} className="border border-gray-100 rounded-xl p-3">
                  {/* Info terapeuta */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {fotoUrl
                        ? <img src={fotoUrl} alt={item.therapist.full_name} className="w-full h-full object-cover" />
                        : <User className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{item.therapist.full_name}</p>
                      <p className="text-xs text-gray-400">R$ {item.therapist.session_price || 200}</p>
                    </div>
                    <button
                      onClick={() => openModal(item)}
                      className="text-xs text-[#2F80D3] hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      Ver todos <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Próximos slots */}
                  {item.loading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 text-[#E03673] animate-spin" />
                    </div>
                  ) : item.nextSlots.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-1">Nenhum horário disponível</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {item.nextSlots.map((slot, idx) => {
                        const { date, time } = formatSlot(slot.starts_at);
                        const key = `${item.therapist.user_id}_${slot.starts_at}`;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAgendar(slot, item.therapist)}
                            disabled={!!isLoading}
                            className="flex-1 min-w-[80px] bg-gray-50 hover:bg-[#FDE8F0] border border-gray-200 hover:border-[#E03673] rounded-lg p-2 text-center transition-all disabled:opacity-50"
                          >
                            <p className="text-xs font-medium text-gray-700">{date}</p>
                            <p className="text-xs text-[#E03673] font-semibold">{time}</p>
                            {isLoading === key && <Loader2 className="w-3 h-3 animate-spin mx-auto mt-1 text-[#E03673]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link
          href="/busca"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Search className="w-4 h-4" />
          Buscar mais terapeutas
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* MODAL COM TODOS OS SLOTS */}
      {modalSlots && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setModalSlots(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  {modalSlots.therapist.foto_url
                    ? <img src={getFotoSrc(modalSlots.therapist.foto_url) ?? ""} alt="" className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-gray-400" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{modalSlots.therapist.full_name}</p>
                  <p className="text-xs text-gray-400">R$ {modalSlots.therapist.session_price || 200} por sessão</p>
                </div>
              </div>
              <button onClick={() => setModalSlots(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slots */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingModal ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
                </div>
              ) : modalSlots.slots.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum horário disponível</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {modalSlots.slots.map((slot, idx) => {
                    const { date, time } = formatSlot(slot.starts_at);
                    const key = `${modalSlots.therapist.user_id}_${slot.starts_at}`;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAgendar(slot, modalSlots.therapist)}
                        disabled={!!isLoading}
                        className="bg-gray-50 hover:bg-[#FDE8F0] border border-gray-200 hover:border-[#E03673] rounded-xl p-3 text-center transition-all disabled:opacity-50"
                      >
                        <p className="text-xs text-gray-500">{date}</p>
                        <p className="text-sm font-semibold text-[#E03673]">{time}</p>
                        <p className="text-xs text-gray-400">{slot.duration_minutes} min</p>
                        {isLoading === key && <Loader2 className="w-3 h-3 animate-spin mx-auto mt-1 text-[#E03673]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}