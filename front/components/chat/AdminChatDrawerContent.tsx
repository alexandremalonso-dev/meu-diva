"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, User, MessageSquare, Search } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from './ChatMessage';

interface Conversation {
  thread_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_foto_url?: string;
  other_user_role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface ChatMessageType {
  id: number;
  thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

interface AdminChatDrawerContentProps {
  userRole: "admin";
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AdminChatDrawerContent({ userRole }: AdminChatDrawerContentProps) {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<ChatMessageType[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [currentMessages]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeThreadId) loadMessages(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredConversations(conversations.filter(c =>
        c.other_user_name.toLowerCase().includes(term) ||
        c.other_user_role.toLowerCase().includes(term)
      ));
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchTerm, conversations]);

  const loadConversations = async () => {
    try {
      const data = await apiCall({ url: '/api/admin/chat/conversations', requireAuth: true });
      setConversations(data || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const loadMessages = async (threadId: number) => {
    setLoading(true);
    try {
      const data = await apiCall({ url: `/api/admin/chat/messages/${threadId}`, requireAuth: true });
      setCurrentMessages(data || []);
      const unread = (data || []).filter((msg: ChatMessageType) => !msg.is_read && msg.sender_id !== user?.id);
      for (const msg of unread) {
        await apiCall({ url: `/api/chat/messages/${msg.id}/read`, method: 'PATCH', requireAuth: true });
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeThreadId || sending) return;
    setSending(true);
    try {
      const newMessage = await apiCall({
        url: '/api/admin/chat/messages',
        method: 'POST',
        body: { thread_id: activeThreadId, message: messageInput.trim() },
        requireAuth: true
      });
      setCurrentMessages(prev => [...prev, newMessage]);
      setMessageInput('');
      await loadConversations();
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const activeConversation = conversations.find(c => c.thread_id === activeThreadId);
  const otherParticipant = activeConversation ? {
    name: activeConversation.other_user_name,
    foto_url: activeConversation.other_user_foto_url,
    role: activeConversation.other_user_role === 'therapist' ? 'Terapeuta' : 'Paciente'
  } : null;

  // 🔥 Excluir mensagem da lista local
  const handleMessageDeleted = (messageId: number) => {
    setCurrentMessages(prev => prev.filter(m => m.id !== messageId));
  };

  return (
    <div className="w-full flex flex-col flex flex-col">

      {/* Lista de conversas */}
      {!activeThreadId && (
        <>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou perfil..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.thread_id}
                    onClick={() => setActiveThreadId(conv.thread_id)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {conv.other_user_foto_url
                        ? <img src={`${BACKEND_URL}${conv.other_user_foto_url}`} alt={conv.other_user_name} className="w-full h-full object-cover" />
                        : <User className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="font-medium text-gray-900 truncate">{conv.other_user_name}</p>
                        {conv.last_message_at && (
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-500 truncate flex-1">
                          {conv.last_message?.startsWith('[IMAGE]') ? '📷 Imagem' : conv.last_message || 'Nenhuma mensagem ainda'}
                        </p>
                        <span className="text-xs text-gray-400 ml-2 px-1.5 py-0.5 rounded-full bg-gray-100">
                          {conv.other_user_role === 'therapist' ? 'Terapeuta' : 'Paciente'}
                        </span>
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-[#E03673] text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Conversa ativa */}
      {activeThreadId && (
        <>
          {/* Header */}
          {otherParticipant && (
            <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-lg mb-3 flex items-center gap-3">
              <button onClick={() => setActiveThreadId(null)} className="p-1 text-gray-500 hover:text-gray-700 text-sm">
                ← Voltar
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                {otherParticipant.foto_url
                  ? <img src={`${BACKEND_URL}${otherParticipant.foto_url}`} alt={otherParticipant.name} className="w-full h-full object-cover" />
                  : <User className="w-4 h-4 text-gray-500" />}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{otherParticipant.name}</p>
                <p className="text-xs text-gray-500">{otherParticipant.role}</p>
              </div>
            </div>
          )}

          {/* 🔥 Mensagens — usando ChatMessage com menu de contexto */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 px-1" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
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
                  onDeleted={handleMessageDeleted}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex gap-2">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="flex-1 p-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none text-sm"
                style={{ minHeight: '40px', maxHeight: '100px' }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !messageInput.trim()}
                className="p-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}