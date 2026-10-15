"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, User, MessageSquare, ArrowLeft, Search, X, Shield } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.meudivaonline.com";
const getFotoSrc = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
};

interface AdminChatUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  foto_url?: string | null;
}

interface AdminChatDrawerContentProps {
  userRole?: string;
}

export function AdminChatDrawerContent({ userRole }: AdminChatDrawerContentProps = {}) {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const {
    conversations,
    currentMessages,
    activeThreadId,
    loading,
    sending,
    setActiveThreadId,
    loadMessages,
    loadConversations,
    sendMessage,
    markAsRead
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<{ id: number; message: string } | null>(null);

  // 🔥 Busca/seleção de usuário para iniciar nova conversa
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | 'therapist' | 'patient'>('');
  const [foundUsers, setFoundUsers] = useState<AdminChatUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  // 🔥 CORRIGIDO DE VEZ: scrollIntoView() rola TODOS os containers
  // roláveis ancestrais (inclusive a página inteira), não só o chat —
  // era isso que causava o "bumerangue". Setando scrollTop direto no
  // container do próprio chat, nada fora dele é afetado.
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // 🔥 CORRIGIDO: só rola pra baixo quando a QUANTIDADE de mensagens
  // aumenta de verdade (mensagem nova). Antes disparava em qualquer
  // atualização de referência do array (inclusive o polling automático
  // sem mensagem nova), causando o efeito "bumerangue" — puxando a tela
  // pra baixo o tempo todo mesmo enquanto o usuário rolava pra cima.
  // 🔥 REMOVIDO 100% — nenhum auto-scroll reagindo a currentMessages,
  // nem por contagem. A rolagem só acontece de forma explícita, dentro de
  // handleSendMessage/handleSendImage, logo após o PRÓPRIO usuário enviar
  // algo. Nunca por causa do polling ou de mensagens recebidas.

  useEffect(() => {
    if (activeThreadId) setTimeout(() => scrollToBottom('instant'), 100);
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId || !user) return;
    const unread = currentMessages.filter(msg => !msg.is_read && msg.sender_id !== user.id);
    unread.forEach(msg => markAsRead(msg.id));
  }, [currentMessages, activeThreadId, user, markAsRead]);

  const handleSelectConversation = (threadId: number) => {
    setActiveThreadId(threadId);
    loadMessages(threadId);
    setReplyTo(null);
  };

  const handleSendMessage = async (message: string) => {
    if (!activeThreadId) return;
    await sendMessage(activeThreadId, message);
    setReplyTo(null);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const [fileError, setFileError] = useState<string | null>(null);
  const handleSendImage = async (file: File) => {
    if (!activeThreadId) return;
    setFileError(null);
    if (file.size > 5 * 1024 * 1024) {
      setFileError('Arquivo muito grande. Máximo 5MB.');
      setTimeout(() => setFileError(null), 3000);
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const isImageFile = file.type.startsWith('image/');
        const prefixed = isImageFile ? `[IMAGE]${base64}` : `[DOC:${file.name}]${base64}`;
        await sendMessage(activeThreadId, prefixed);
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } catch {
      setFileError('Erro ao enviar arquivo.');
      setTimeout(() => setFileError(null), 3000);
    }
  };

  // 🔥 Buscar usuários para iniciar nova conversa
  useEffect(() => {
    if (!showUserPicker) return;
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const params = new URLSearchParams();
        if (userSearch.trim()) params.set('search', userSearch.trim());
        if (roleFilter) params.set('role_filter', roleFilter);
        const data = await apiCall({ url: `/api/chat/admin/users?${params.toString()}`, requireAuth: true });
        setFoundUsers(data || []);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        setFoundUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [showUserPicker, userSearch, roleFilter, apiCall]);

  const handleStartChat = async (targetUserId: number) => {
    setStartingChat(true);
    try {
      const data = await apiCall({
        url: `/api/chat/admin/thread/${targetUserId}`,
        method: 'POST',
        requireAuth: true
      });
      setShowUserPicker(false);
      setUserSearch('');
      await loadConversations();
      setActiveThreadId(data.thread_id);
      loadMessages(data.thread_id);
    } catch (err) {
      console.error('Erro ao iniciar conversa:', err);
    } finally {
      setStartingChat(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const activeConversation = conversations.find((c: any) => c.thread_id === activeThreadId);

  // 🔥 SELETOR DE USUÁRIO — nova conversa
  if (showUserPicker) {
    return (
      <div className="w-full flex flex-col h-full">
        <div className="flex items-center gap-2 p-3 border-b border-gray-100">
          <button onClick={() => setShowUserPicker(false)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">Nova conversa</span>
        </div>

        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E03673]/30"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            {(['', 'therapist', 'patient'] as const).map(r => (
              <button
                key={r || 'todos'}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  roleFilter === r ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {r === '' ? 'Todos' : r === 'therapist' ? 'Terapeutas' : 'Pacientes'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchingUsers ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
          ) : foundUsers.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Nenhum usuário encontrado</div>
          ) : (
            foundUsers.map(u => {
              const foto = getFotoSrc(u.foto_url);
              return (
                <button
                  key={u.id}
                  onClick={() => handleStartChat(u.id)}
                  disabled={startingChat}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {foto ? <img src={foto} alt={u.full_name} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-gray-400">{u.role === 'therapist' ? 'Terapeuta' : 'Paciente'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── LISTA DE CONVERSAS ───────────────────────────────────────
  if (!activeThreadId) {
    return (
      <div className="w-full flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#E03673]" /> Chat Admin
          </span>
          <button
            onClick={() => setShowUserPicker(true)}
            className="text-xs px-3 py-1.5 bg-[#E03673] text-white rounded-full hover:bg-[#c02c5e] transition-colors"
          >
            Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && conversations.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma conversa ainda</p>
            </div>
          ) : (
            conversations.map((conv: any) => {
              const foto = getFotoSrc(conv.other_user_foto_url);
              return (
                <button
                  key={conv.thread_id}
                  onClick={() => handleSelectConversation(conv.thread_id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {foto ? <img src={foto} alt={conv.other_user_name} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{conv.other_user_name}</p>
                      {conv.last_message_at && <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(conv.last_message_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400 truncate">{conv.other_user_role}</p>
                      {conv.unread_count > 0 && (
                        <span className="bg-[#E03673] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── CONVERSA ATIVA ───────────────────────────────────────
  const activeFoto = getFotoSrc(activeConversation?.other_user_foto_url);

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <button onClick={() => setActiveThreadId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {activeFoto ? <img src={activeFoto} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{activeConversation?.other_user_name}</p>
          <p className="text-xs text-gray-400">{activeConversation?.other_user_role}</p>
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3">
        {loading && currentMessages.length === 0 ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
        ) : (
          <>
            {currentMessages.map((msg: any) => (
              <ChatMessage
                key={msg.id}
                id={msg.id}
                sender_id={msg.sender_id}
                message={msg.message}
                is_read={msg.is_read}
                created_at={msg.created_at}
                read_at={msg.read_at}
                onReply={(m) => setReplyTo(m)}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {fileError && <div className="px-4 pb-1 text-xs text-red-600">{fileError}</div>}

      <ChatInput
        onSendMessage={handleSendMessage}
        onSendImage={handleSendImage}
        disabled={loading}
        sending={sending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
