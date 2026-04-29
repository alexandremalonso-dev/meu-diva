"use client";

import { User, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  thread_id: number;
  appointment_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_foto_url?: string;
  other_user_role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface ChatListProps {
  conversations: Conversation[];
  activeThreadId: number | null;
  loading: boolean;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ChatList({ conversations, activeThreadId, loading, onSelectConversation }: ChatListProps) {
  const { user } = useAuth();

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm">Nenhuma conversa ativa</p>
        <p className="text-xs mt-1">As conversas aparecerão após a primeira sessão</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <button
          key={conv.thread_id}
          onClick={() => onSelectConversation(conv)}
          className={`w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
            activeThreadId === conv.thread_id ? 'bg-[#FCE4EC]' : ''
          }`}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
            {conv.other_user_foto_url ? (
              <img 
                src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${conv.other_user_foto_url}`}
                alt={conv.other_user_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
          </div>
          
          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline">
              <p className="font-medium text-gray-900 truncate">{conv.other_user_name}</p>
              {conv.last_message_at && (
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {formatTime(conv.last_message_at)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500 truncate flex-1">
                {conv.last_message || 'Nenhuma mensagem ainda'}
              </p>
              {conv.unread_count > 0 && (
                <span className="bg-[#E03673] text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0 ml-2">
                  {conv.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}