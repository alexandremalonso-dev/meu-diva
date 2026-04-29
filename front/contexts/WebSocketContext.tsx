'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface TypingUser {
  userId: number;
  timeout: NodeJS.Timeout;
}

interface WebSocketContextType {
  isConnected: boolean;
  activeThreadId: number | null;
  messages: Message[];
  typingUsers: number[];
  sendMessage: (message: string) => boolean;
  sendTyping: (isTyping: boolean) => void;
  markAsRead: (messageId: number) => void;
  setActiveThread: (threadId: number | null) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const typingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const {
    isConnected,
    sendMessage: wsSendMessage,
    sendTyping: wsSendTyping,
    sendReadReceipt,
    lastMessage
  } = useWebSocket(activeThreadId, {
    onMessage: (data) => {
      if (data.type === 'message' && data.id && data.sender_id && data.message) {
        const newMessage: Message = {
          id: data.id,
          thread_id: data.thread_id!,
          sender_id: data.sender_id,
          sender_name: data.sender_name || 'Usuário',
          message: data.message,
          created_at: data.created_at || new Date().toISOString(),
          is_read: data.is_read || false
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // Se a mensagem veio de outro usuário, marcar como lida automaticamente
        if (data.sender_id !== user?.id) {
          sendReadReceipt(data.id);
        }
      }
    },
    onTyping: (userId, isTyping) => {
      if (isTyping) {
        setTypingUsers(prev => {
          if (!prev.includes(userId)) {
            return [...prev, userId];
          }
          return prev;
        });
        
        // Limpar timeout existente
        const existingTimeout = typingTimeoutsRef.current.get(userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Remover após 2 segundos sem digitar
        const timeout = setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== userId));
          typingTimeoutsRef.current.delete(userId);
        }, 2000);
        typingTimeoutsRef.current.set(userId, timeout);
      } else {
        setTypingUsers(prev => prev.filter(id => id !== userId));
        const timeout = typingTimeoutsRef.current.get(userId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(userId);
        }
      }
    },
    onReadReceipt: (userId, messageId) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    },
    onConnect: () => {
      console.log('🔌 WebSocket conectado para thread:', activeThreadId);
    },
    onDisconnect: () => {
      console.log('🔌 WebSocket desconectado');
    }
  });

  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) return false;
    return wsSendMessage(message);
  }, [wsSendMessage]);

  const sendTyping = useCallback((isTyping: boolean) => {
    wsSendTyping(isTyping);
  }, [wsSendTyping]);

  const markAsRead = useCallback((messageId: number) => {
    sendReadReceipt(messageId);
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, is_read: true } : msg
      )
    );
  }, [sendReadReceipt]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Limpar timeouts ao desmontar
  useEffect(() => {
    return () => {
      typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        activeThreadId,
        messages,
        typingUsers,
        sendMessage,
        sendTyping,
        markAsRead,
        setActiveThread: setActiveThreadId,
        addMessage,
        clearMessages
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}