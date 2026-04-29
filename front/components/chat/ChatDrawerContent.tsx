"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2, User, MessageSquare, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatDrawerContentProps {
  userRole: "therapist" | "patient";
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getFotoSrc = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
};

export function ChatDrawerContent({ userRole }: ChatDrawerContentProps) {
  const { user } = useAuth();
  const {
    conversations,
    currentMessages,
    activeThreadId,
    loading,
    sending,
    setActiveThreadId,
    loadMessages,
    sendMessage,
    markAsRead
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // ✅ Scroll sempre para o final quando chegam novas mensagens
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  // Scroll imediato ao abrir conversa (sem animação)
  useEffect(() => {
    if (activeThreadId) {
      setTimeout(() => scrollToBottom('instant'), 100);
    }
  }, [activeThreadId]);

  // Marcar mensagens não lidas como lidas
  useEffect(() => {
    if (!activeThreadId || !user) return;
    const unread = currentMessages.filter(msg => !msg.is_read && msg.sender_id !== user.id);
    unread.forEach(msg => markAsRead(msg.id));
  }, [currentMessages, activeThreadId, user, markAsRead]);

  const handleSelectConversation = (threadId: number) => {
    setActiveThreadId(threadId);
    loadMessages(threadId);
  };

  const handleSendMessage = async (message: string) => {
    if (!activeThreadId) return;
    await sendMessage(activeThreadId, message);
    // Scroll após envio com pequeno delay para o DOM atualizar
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  // ✅ Envio de imagem — converte para base64 e envia como mensagem especial
  const handleSendImage = async (file: File) => {
    if (!activeThreadId) return;
    setImageError(null);

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setImageError('Imagem muito grande. Máximo 5MB.');
      setTimeout(() => setImageError(null), 3000);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        // Envia como mensagem com prefixo especial que o ChatMessage vai renderizar como imagem
        await sendMessage(activeThreadId, `[IMAGE]${base64}`);
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      setImageError('Erro ao enviar imagem.');
      setTimeout(() => setImageError(null), 3000);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const activeConversation = conversations.find(c => c.thread_id === activeThreadId);

  // ─── LISTA DE CONVERSAS ───────────────────────────────────────
  if (!activeThreadId) {
    return (
      <div className="w-full">
        {loading && conversations.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhuma conversa ativa</p>
            <p className="text-xs mt-1 text-gray-400">As conversas aparecerão após a primeira sessão</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((conv) => (
              <button
                key={conv.thread_id}
                onClick={() => handleSelectConversation(conv.thread_id)}
                className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {conv.other_user_foto_url ? (
                    <img
                      src={getFotoSrc(conv.other_user_foto_url)!}
                      alt={conv.other_user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="font-medium text-gray-900 truncate text-sm">{conv.other_user_name}</p>
                    {conv.last_message_at && (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.last_message?.startsWith('[IMAGE]')
                      ? '📷 Imagem'
                      : conv.last_message || 'Nenhuma mensagem ainda'}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-[#E03673] text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0 min-w-[20px] text-center">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── CONVERSA ABERTA ─────────────────────────────────────────
  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>

      {/* Header com botão voltar */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-2 flex-shrink-0">
        <button
          onClick={() => setActiveThreadId(null)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {activeConversation && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {activeConversation.other_user_foto_url ? (
                <img
                  src={getFotoSrc(activeConversation.other_user_foto_url)!}
                  alt={activeConversation.other_user_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{activeConversation.other_user_name}</p>
              <p className="text-xs text-gray-400">{activeConversation.other_user_role}</p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Área de mensagens com scroll — o input fica sempre abaixo */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto space-y-2 px-1 pb-2"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs">Envie uma mensagem para iniciar</p>
          </div>
        ) : (
          currentMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              id={msg.id}
              sender_id={msg.sender_id}
              message={msg.message}
              is_read={msg.is_read}
              created_at={msg.created_at}
              read_at={msg.read_at}
            />
          ))
        )}
        {/* ✅ Âncora de scroll — sempre ao final das mensagens */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — sempre fixo abaixo das mensagens */}
      <div className="border-t border-gray-100 pt-2 flex-shrink-0">
        {imageError && (
          <p className="text-xs text-red-500 mb-1 text-center">{imageError}</p>
        )}
        <ChatInput
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          disabled={sending}
          placeholder="Digite uma mensagem..."
        />
        <p className="text-xs text-gray-300 mt-1 text-center">
          Enter para enviar · Shift+Enter para nova linha · Cole prints com Ctrl+V
        </p>
      </div>
    </div>
  );
}