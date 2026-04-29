import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RealtimeEvent {
  type: string;
  payload: Record<string, any>;
  timestamp: string;
}

type EventHandler = (payload: Record<string, any>) => void;

class RealtimeEventManager {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private token: string | null = null;
  private userId: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isBrowser = false;

  private getWsUrl(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsUrl}/ws/events?token=${this.token}`;
  }

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    if (this.isBrowser) {
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (!this.isBrowser) return;

    window.addEventListener('auth:login', () => {
      this.token = localStorage.getItem('access_token');
      this.connect();
    });

    window.addEventListener('auth:logout', () => {
      this.disconnect();
    });
  }

  setUser(userId: number | null, token: string | null) {
    this.userId = userId;
    this.token = token;
    if (userId && token && this.isBrowser) {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  private connect() {
    if (!this.isBrowser || !this.token || this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // ✅ FIX: não tenta se já atingiu o máximo
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = this.getWsUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          this.notifyHandlers(data.type, data.payload);
        } catch (error) {
          console.error('Erro ao processar evento:', error);
        }
      };

      this.ws.onclose = () => {
        this.stopPingInterval();
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      // ✅ FIX: silencia erros de conexão recusada — esperado quando backend não tem WebSocket
      this.ws.onerror = () => {
        // Silencioso — WebSocket pode não estar disponível no backend
      };

    } catch (error) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private pingInterval: NodeJS.Timeout | null = null;

  private startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (!this.isBrowser) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    this.stopPingInterval();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  on(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => {
      this.handlers.get(eventType)?.delete(handler);
      if (this.handlers.get(eventType)?.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  private notifyHandlers(eventType: string, payload: Record<string, any>) {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Erro no handler do evento ${eventType}:`, error);
        }
      });
    }

    const allHandlers = this.handlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler({ type: eventType, ...payload });
        } catch (error) {
          console.error(`Erro no handler genérico:`, error);
        }
      });
    }
  }
}

let eventManager: RealtimeEventManager | null = null;

const getEventManager = () => {
  if (typeof window === 'undefined') return null;
  if (!eventManager) {
    eventManager = new RealtimeEventManager();

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (key === 'access_token' && value) {
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { token: value } }));
      }
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (key === 'access_token') {
        window.dispatchEvent(new Event('auth:logout'));
      }
    };
  }
  return eventManager;
};

export function useRealtimeEvents() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const manager = getEventManager();
    if (!manager) return;

    const token = localStorage.getItem('access_token');
    manager.setUser(user?.id || null, token || null);

    const interval = setInterval(() => {
      const isWsConnected = (manager as any).ws?.readyState === WebSocket.OPEN;
      setIsConnected(isWsConnected);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [user, isClient]);

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    const manager = getEventManager();
    if (!manager) return () => {};

    const unsubscribe = manager.on(eventType, (payload) => {
      setLastEvent({ type: eventType, payload, timestamp: new Date().toISOString() });
      handler(payload);
    });

    subscriptionsRef.current.set(eventType, unsubscribe);
    return unsubscribe;
  }, []);

  const subscribeAll = useCallback((handler: (event: RealtimeEvent) => void) => {
    const manager = getEventManager();
    if (!manager) return () => {};

    return manager.on('*', (data) => {
      const event = data as unknown as RealtimeEvent;
      setLastEvent(event);
      handler(event);
    });
  }, []);

  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  return {
    isConnected,
    lastEvent,
    subscribe,
    subscribeAll,
    disconnect: () => {
      const manager = getEventManager();
      manager?.disconnect();
    },
    reconnect: () => {
      const manager = getEventManager();
      if (manager) {
        const token = localStorage.getItem('access_token');
        manager.setUser(user?.id || null, token || null);
      }
    }
  };
}

export type { RealtimeEvent, EventHandler };