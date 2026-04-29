"use client";

import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Slot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
}

interface SlotsCalendarProps {
  therapistId: number;
  onSelectSlot: (slot: Slot | null) => void;
  selectedSlot: Slot | null;
}

export function SlotsCalendar({ therapistId, onSelectSlot, selectedSlot }: SlotsCalendarProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  
  useEffect(() => {
    loadSlots();
  }, [therapistId]);
  
  const loadSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/publico/terapeuta/${therapistId}/slots?days=30`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar slots');
      }
      
      setSlots(data.slots || []);
      
      // Extrair datas disponíveis
      const dates = data.slots.map((slot: Slot) => {
        const date = parseISO(slot.starts_at);
        date.setHours(0, 0, 0, 0);
        return date;
      });
      
      // Filtrar datas únicas
      const uniqueDates = dates.filter((date: Date, index: number, self: Date[]) =>
        index === self.findIndex((d) => d.getTime() === date.getTime())
      );
      
      setAvailableDates(uniqueDates);
      
      // Selecionar primeira data disponível se houver
      if (uniqueDates.length > 0 && !selectedSlot) {
        setSelectedDate(uniqueDates[0]);
      }
      
    } catch (error) {
      console.error('Erro ao carregar slots:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const slotsForSelectedDate = slots.filter(slot => {
    const slotDate = parseISO(slot.starts_at);
    return isSameDay(slotDate, selectedDate);
  }).sort((a, b) => {
    return parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime();
  });
  
  const formatSlotTime = (isoString: string) => {
    return format(parseISO(isoString), 'HH:mm');
  };
  
  const formatDateHeader = (date: Date) => {
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (slots.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">Nenhum horário disponível no momento</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Calendário de dias */}
      <div className="p-4 border-b overflow-x-auto">
        <div className="flex gap-2">
          {availableDates.map((date, index) => (
            <button
              key={index}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-center transition-colors ${
                isSameDay(date, selectedDate)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <div className="text-xs font-medium">
                {format(date, 'EEE', { locale: ptBR })}
              </div>
              <div className="text-lg font-bold">
                {format(date, 'dd')}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Horários do dia selecionado */}
      <div className="p-4">
        <h3 className="font-medium text-gray-700 mb-3">
          {formatDateHeader(selectedDate)}
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {slotsForSelectedDate.map((slot, index) => {
            const isSelected = selectedSlot?.starts_at === slot.starts_at;
            
            return (
              <button
                key={index}
                onClick={() => onSelectSlot(isSelected ? null : slot)}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                <span className="text-sm font-medium">
                  {formatSlotTime(slot.starts_at)}
                </span>
                <span className="text-xs block opacity-75">
                  {slot.duration_minutes}min
                </span>
              </button>
            );
          })}
        </div>
        
        {slotsForSelectedDate.length === 0 && (
          <p className="text-center text-gray-500 py-4">
            Nenhum horário disponível nesta data
          </p>
        )}
      </div>
    </div>
  );
}