import { useEffect, useState, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  id?: number;
  thread_id?: number;
  sender_id?: number;
  sender_name?: string;
  message?: string;
  created_at?: string;
  is_read?: boolean;
  user_id?: number;
  is_typing?: boolean;
  message_id?: number;
  timestamp?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onTyping?: (userId: number, isTyping: boolean) => void;
  onReadReceipt?: (userId: number, messageId: number) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(threadId: number | null, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const optionsRef = useRef(options);
  const threadIdRef = useRef(threadId);
  const shouldReconnectRef = useRef(true);
  const lastThreadIdRef = useRef<number | null>(null);

  useEffect(() => {
    optionsRef.current = options;
    threadIdRef.current = threadId;
  }, [options, threadId]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnected by user');
      wsRef.current = null;
    }
    setIsConnected(false);
    isConnectingRef.current = false;
    lastThreadIdRef.current = null;
  }, []);

  const connect = useCallback(() => {
    const currentThreadId = threadIdRef.current;
    
    if (!currentThreadId) {
      console.log('ℹ️ Sem threadId, não conectando WebSocket');
      return;
    }
    
    // ✅ VERIFICA SE JÁ ESTÁ CONECTADO NA MESMA THREAD
    if (wsRef.current?.readyState === WebSocket.OPEN && lastThreadIdRef.current === currentThreadId) {
      console.log(`ℹ️ WebSocket já está conectado na thread ${currentThreadId}`);
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('ℹ️ WebSocket já está conectando');
      return;
    }

    isConnectingRef.current = true;
    shouldReconnectRef.current = true;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('❌ Token não encontrado para WebSocket');
      isConnectingRef.current = false;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws/chat/${currentThreadId}?token=${token}`;
    
    console.log(`🔌 Conectando WebSocket: thread ${currentThreadId}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`✅ WebSocket conectado: thread ${currentThreadId}`);
      setIsConnected(true);
      isConnectingRef.current = false;
      lastThreadIdRef.current = currentThreadId;
      optionsRef.current.onConnect?.();

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(data);

        if (data.type === 'message') {
          optionsRef.current.onMessage?.(data);
        } else if (data.type === 'typing') {
          optionsRef.current.onTyping?.(data.user_id!, data.is_typing!);
        } else if (data.type === 'read_receipt') {
          optionsRef.current.onReadReceipt?.(data.user_id!, data.message_id!);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    ws.onclose = (event) => {
      console.log(`❌ WebSocket desconectado: thread ${currentThreadId}, code: ${event.code}`);
      setIsConnected(false);
      isConnectingRef.current = false;
      optionsRef.current.onDisconnect?.();

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (event.code !== 1000 && shouldReconnectRef.current && threadIdRef.current) {
        console.log(`🔄 Tentando reconectar WebSocket em 3 segundos: thread ${threadIdRef.current}`);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current && threadIdRef.current) {
            console.log(`🔄 Reconectando WebSocket: thread ${threadIdRef.current}`);
            connect();
          }
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
      optionsRef.current.onError?.(error);
    };

    wsRef.current = ws;
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', message }));
      return true;
    }
    console.warn('⚠️ WebSocket não está conectado');
    return false;
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
    }
  }, []);

  const sendReadReceipt = useCallback((messageId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'read_receipt', message_id: messageId }));
    }
  }, []);

  useEffect(() => {
    if (threadId) {
      shouldReconnectRef.current = true;
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      shouldReconnectRef.current = false;
      disconnect();
    };
  }, [threadId, connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    sendTyping,
    sendReadReceipt,
    lastMessage,
    disconnect,
    connect
  };
}