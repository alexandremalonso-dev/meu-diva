"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useApi } from '@/lib/useApi';
import { useAuth } from './AuthContext';
import { useWebSocketContext } from './WebSocketContext';

export interface ChatMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  sender_name?: string;
}

export interface Conversation {
  thread_id: number;
  appointment_id: number | null;
  other_user_id: number;
  other_user_name: string;
  other_user_foto_url?: string;
  other_user_role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface ChatContextType {
  conversations: Conversation[];
  currentMessages: ChatMessage[];
  activeThreadId: number | null;
  loading: boolean;
  sending: boolean;
  isWebSocketConnected: boolean;
  typingUsers: number[];
  loadConversations: () => Promise<void>;
  loadMessages: (threadId: number) => Promise<void>;
  sendMessage: (threadId: number, message: string) => Promise<void>;
  setActiveThreadId: (threadId: number | null) => void;
  markAsRead: (messageId: number) => Promise<void>;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { execute: apiCall } = useApi();
  const { user } = useAuth();
  
  // 🔥 Integrar com WebSocket (opcional, não quebra se não disponível)
  let webSocketContext = null;
  try {
    webSocketContext = useWebSocketContext();
  } catch (e) {
    // WebSocketContext não está disponível - usar apenas REST
  }
  
  const {
    activeThreadId: wsActiveThreadId,
    messages: wsMessages,
    typingUsers = [],
    isConnected: isWebSocketConnected = false,
    sendMessage: wsSendMessage,
    sendTyping: wsSendTyping,
    markAsRead: wsMarkAsRead,
    setActiveThread: wsSetActiveThread,
    clearMessages: wsClearMessages,
    addMessage: wsAddMessage
  } = webSocketContext || {
    activeThreadId: null,
    messages: [],
    typingUsers: [],
    isConnected: false,
    sendMessage: null,
    sendTyping: null,
    markAsRead: null,
    setActiveThread: null,
    clearMessages: null,
    addMessage: null
  };

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadIdState] = useState<number | null>(null);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);

  // Sincronizar activeThreadId com WebSocket
  const setActiveThreadId = useCallback((threadId: number | null) => {
    setActiveThreadIdState(threadId);
    if (wsSetActiveThread) {
      wsSetActiveThread(threadId);
    }
    if (threadId) {
      loadMessages(threadId);
    } else {
      if (wsClearMessages) wsClearMessages();
      setCurrentMessages([]);
    }
  }, [wsSetActiveThread, wsClearMessages]);

  // Sincronizar mensagens do WebSocket com o estado local
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const convertedMessages: ChatMessage[] = wsMessages.map((msg: any) => ({
        id: msg.id,
        thread_id: msg.thread_id,
        sender_id: msg.sender_id,
        message: msg.message,
        is_read: msg.is_read,
        created_at: msg.created_at,
        read_at: msg.is_read ? new Date().toISOString() : undefined,
        sender_name: msg.sender_name
      }));
      setCurrentMessages(convertedMessages);
    }
  }, [wsMessages]);

  // 🔥 Carregar conversas - ADMIN usa endpoint diferente
  const loadConversations = useCallback(async () => {
    if (!user) return;
    if (!['patient', 'therapist', 'admin'].includes(user.role)) return;
    
    try {
      let data;
      
      // 🔥 Se for admin, carrega conversas do admin
      if (user.role === 'admin') {
        try {
          data = await apiCall({ 
            url: '/api/chat/admin/conversations', 
            requireAuth: true,
            silent: true  // Silencioso para não mostrar erro
          });
        } catch (adminErr) {
          // Se falhar, tenta endpoint normal
          console.debug('Admin conversations endpoint not available, falling back');
          data = await apiCall({ 
            url: '/api/chat/conversations', 
            requireAuth: true,
            silent: true
          });
        }
      } else {
        // Usuário normal (paciente ou terapeuta)
        data = await apiCall({ 
          url: '/api/chat/conversations', 
          requireAuth: true,
          silent: true
        });
      }
      
      const convs = Array.isArray(data) ? data : [];
      setConversations(convs);
      
      // Calcular unreadCount localmente
      const totalUnread = convs.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setLocalUnreadCount(totalUnread);
      
      // Log para debug (apenas em desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Conversas atualizadas: ${convs.length}, não lidas: ${totalUnread}, role: ${user.role}`);
      }
    } catch (error) {
      // Não logar erro 403 - é esperado para usuários sem permissão
      if ((error as any)?.message?.includes('403') || (error as any)?.message?.includes('Permissão')) {
        console.debug('Sem permissão para carregar conversas');
      } else {
        console.error('Erro ao carregar conversas:', error);
      }
    }
  }, [user, apiCall]);

  const loadMessages = useCallback(async (threadId: number) => {
    setLoading(true);
    try {
      const data = await apiCall({ 
        url: `/api/chat/messages/${threadId}`, 
        requireAuth: true,
        silent: true
      });
      const messages = Array.isArray(data) ? data : [];
      setCurrentMessages(messages);
      
      // Limpar mensagens no WebSocket e adicionar as carregadas
      if (wsClearMessages) wsClearMessages();
      if (wsAddMessage) {
        messages.forEach((msg: any) => {
          wsAddMessage({
            id: msg.id,
            thread_id: msg.thread_id,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name || '',
            message: msg.message,
            created_at: msg.created_at,
            is_read: msg.is_read
          });
        });
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  }, [apiCall, wsClearMessages, wsAddMessage]);

  const sendMessage = useCallback(async (threadId: number, message: string) => {
    if (!message.trim()) return;
    setSending(true);
    
    try {
      // Priorizar WebSocket se disponível
      if (isWebSocketConnected && wsSendMessage) {
        const sent = wsSendMessage(message);
        if (!sent) {
          // Fallback para REST se WebSocket falhar
          await apiCall({
            url: '/api/chat/messages',
            method: 'POST',
            body: { thread_id: threadId, message: message.trim() },
            requireAuth: true,
            silent: true
          });
        }
      } else {
        // Fallback para REST API
        await apiCall({
          url: '/api/chat/messages',
          method: 'POST',
          body: { thread_id: threadId, message: message.trim() },
          requireAuth: true,
          silent: true
        });
      }
      
      // Atualizar conversas para atualizar o badge
      await loadConversations();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    } finally {
      setSending(false);
    }
  }, [isWebSocketConnected, wsSendMessage, apiCall, loadConversations]);

  const markAsRead = useCallback(async (messageId: number) => {
    try {
      // Priorizar WebSocket
      if (isWebSocketConnected && wsMarkAsRead) {
        wsMarkAsRead(messageId);
      } else {
        await apiCall({
          url: `/api/chat/messages/${messageId}/read`,
          method: 'PATCH',
          requireAuth: true,
          silent: true
        });
      }
      
      // Atualizar conversas para atualizar o badge
      await loadConversations();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  }, [isWebSocketConnected, wsMarkAsRead, apiCall, loadConversations]);

  // 🔥 Usar o unreadCount local calculado das conversas
  const unreadCount = localUnreadCount;

  // Polling mais frequente para badge (10 segundos)
  useEffect(() => {
    if (!user?.id) return;

    // Carregar imediatamente
    loadConversations();

    const interval = setInterval(() => {
      loadConversations();
    }, 10000); // Atualiza a cada 10 segundos para badge responsivo

    return () => clearInterval(interval);
  }, [user?.id, loadConversations]);

  // Log para debug do badge (apenas desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && unreadCount > 0) {
      console.log(`🔔 Badge do chat atualizado: ${unreadCount} não lidas`);
    }
  }, [unreadCount]);

  return (
    <ChatContext.Provider value={{
      conversations,
      currentMessages,
      activeThreadId,
      loading,
      sending,
      isWebSocketConnected,
      typingUsers: typingUsers || [],
      loadConversations,
      loadMessages,
      sendMessage,
      setActiveThreadId,
      markAsRead,
      unreadCount
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}