"use client";

import { Check, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessageProps {
  id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export function ChatMessage({ id, sender_id, message, is_read, created_at, read_at }: ChatMessageProps) {
  const { user } = useAuth();
  const isOwn = sender_id === user?.id;
  const isImage = message.startsWith('[IMAGE]');
  const imageData = isImage ? message.slice(7) : null; // remove prefixo [IMAGE]

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl overflow-hidden ${
        isOwn
          ? 'bg-[#E03673] text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
      } ${isImage ? 'p-1' : 'px-3 py-2'}`}>

        {isImage ? (
          // ✅ Renderizar imagem
          <div>
            <img
              src={imageData!}
              alt="Imagem enviada"
              className="max-w-full rounded-xl cursor-pointer"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
              onClick={() => window.open(imageData!, '_blank')}
            />
            <div className={`text-xs px-2 pb-1 flex items-center gap-1 justify-end mt-1 ${
              isOwn ? 'text-white/70' : 'text-gray-400'
            }`}>
              <span>{formatTime(created_at)}</span>
              {isOwn && (is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
            </div>
          </div>
        ) : (
          // ✅ Renderizar texto
          <>
            <p className="text-sm break-words whitespace-pre-wrap">{message}</p>
            <div className={`text-xs mt-1 flex items-center gap-1 justify-end ${
              isOwn ? 'text-white/70' : 'text-gray-400'
            }`}>
              <span>{formatTime(created_at)}</span>
              {isOwn && (is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}