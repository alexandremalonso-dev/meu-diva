"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AgendarButtonProps {
  therapistId: number;
  therapistName: string;
  sessionPrice: number;
  selectedSlot?: {
    starts_at: string;
    ends_at: string;
    duration_minutes: number;
  } | null;
  disabled?: boolean;
}

export function AgendarButton({ 
  therapistId, 
  therapistName, 
  sessionPrice,
  selectedSlot,
  disabled 
}: AgendarButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const handleAgendar = async () => {
    if (!selectedSlot) {
      alert('Selecione um horário disponível');
      return;
    }
    
    setLoading(true);
    
    try {
      // Verificar se usuário está logado
      const token = document.cookie.includes('token=');
      
      if (!token) {
        // Redirecionar para login com return URL
        const returnUrl = encodeURIComponent(`/terapeuta/${therapistId}?slot=${encodeURIComponent(JSON.stringify(selectedSlot))}`);
        router.push(`/login?returnUrl=${returnUrl}`);
        return;
      }
      
      // Usuário logado, tentar agendar
      const response = await fetch('/api/booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: therapistId,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          duration_minutes: selectedSlot.duration_minutes
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Erro ao agendar');
      }
      
      if (data.status === 'scheduled') {
        // Agendamento direto (com saldo)
        router.push(`/agendamento/sucesso?appointment_id=${data.appointment_id}`);
      } else if (data.status === 'payment_required') {
        // Precisa de pagamento
        router.push(`/checkout?pending_id=${data.pending_booking_id}`);
      }
      
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleAgendar}
      disabled={disabled || loading || !selectedSlot}
      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Processando...' : 
       !selectedSlot ? 'Selecione um horário' : 
       `Agendar • R$ ${sessionPrice.toFixed(2).replace('.', ',')}`}
    </button>
  );
}