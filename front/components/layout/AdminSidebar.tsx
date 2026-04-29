"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, ChevronRight, ChevronLeft, MessageSquare,
  User, Search, Loader2, ArrowLeft, UserPlus,
  Activity, CreditCard, Users, Wifi, WifiOff
} from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useUserPhotos } from "@/hooks/useUserPhotos";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getFotoSrc } from '@/lib/utils';

interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  foto_url?: string;
  is_active: boolean;
  created_at: string;
}

interface AdminConversation {
  thread_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_foto_url?: string;
  other_user_role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

interface Subscription {
  therapist_id: number;
  user_id: number;
  name: string;
  email: string;
  foto_url?: string;
  plan: string;
  subscription_status: string;
  total_commission_paid: number;
  total_sessions: number;
  current_period_end?: string;
}

interface OnlineUser {
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  foto_url?: string;
  login_time: string;
  last_activity?: string;
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  openOnChat?: boolean;
  onChatOpened?: () => void;
  onUnreadChange?: (count: number) => void;
}

export function AdminSidebar({ isOpen, onClose, openOnChat, onChatOpened, onUnreadChange }: AdminSidebarProps) {
  const { execute: apiCall } = useApi();
  const { user } = useAuth();
  const { enrichWithPhotos, getPhotoByUserId } = useUserPhotos();

  const [activeTab, setActiveTab] = useState<"monitor" | "online" | "assinaturas" | "chat">("monitor");
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (openOnChat) {
      setActiveTab("chat");
      setIsMinimized(false);
      onChatOpened?.();
    }
  }, [openOnChat]);

  // MONITOR
  const [monitorUsers, setMonitorUsers] = useState<AdminUser[]>([]);
  const [monitorFilter, setMonitorFilter] = useState<"all" | "therapist" | "patient">("all");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ONLINE
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineFilter, setOnlineFilter] = useState<"all" | "therapist" | "patient">("all");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ASSINATURAS
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsFilter, setSubscriptionsFilter] = useState<"all" | "active" | "past_due" | "canceled">("all");
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsStats, setSubscriptionsStats] = useState({
    total: 0,
    ativos: 0,
    atraso: 0,
    cancelados: 0
  });

  // CHAT
  const [chatView, setChatView] = useState<"conversations" | "new" | "messages">("conversations");
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const adminUnreadCount = conversations.reduce((s, c) => s + c.unread_count, 0);

  useEffect(() => {
    onUnreadChange?.(adminUnreadCount);
  }, [adminUnreadCount, onUnreadChange]);

  const [activeThread, setActiveThread] = useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchUsers, setSearchUsers] = useState("");
  const [searchRole, setSearchRole] = useState<"" | "therapist" | "patient">("");
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // MONITOR: carrega usuarios + fotos dos perfis (VERSÃO SIMPLIFICADA)
  const loadMonitorUsers = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const data = await apiCall({ url: "/api/users", requireAuth: true });
      const filtered = [...data]
        .filter(u => u.role !== "admin")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Usa o hook unificado para enriquecer com fotos
      const withFotos = await enrichWithPhotos(filtered) as AdminUser[];
      setMonitorUsers(withFotos);
    } catch (err) {
      console.error("Erro ao carregar usuarios:", err);
    } finally {
      setMonitorLoading(false);
    }
  }, [apiCall, enrichWithPhotos]);

  // ONLINE: WebSocket
  const connectOnlineWebSocket = useCallback(() => {
    if (!user?.id) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = `${BACKEND_URL.replace("http", "ws")}/ws/online?token=${token}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket Online conectado");
        setWsConnected(true);
      };
      
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "online.initial_state") {
            if (data.payload.online_users) {
              const enrichedUsers = await enrichWithPhotos(data.payload.online_users) as OnlineUser[];
              setOnlineUsers(enrichedUsers);
            }
          } 
          else if (data.type === "user.online") {
            setOnlineUsers(prev => {
              const exists = prev.some(u => u.user_id === data.payload.user_id);
              if (exists) {
                return prev.map((u: any) => u.user_id === data.payload.user_id 
                  ? { ...data.payload, foto_url: u.foto_url }
                  : u
                );
              } else {
                const newUser = { ...data.payload };
                const newUsers = [newUser, ...prev];
                getPhotoByUserId(newUser.user_id).then(fotoUrl => {
                  if (fotoUrl) {
                    setOnlineUsers(current => 
                      current.map((u: any) => u.user_id === newUser.user_id 
                        ? { ...u, foto_url: fotoUrl }
                        : u
                      )
                    );
                  }
                });
                return newUsers;
              }
            });
          }
          else if (data.type === "user.offline") {
            setOnlineUsers(prev => prev.filter(u => u.user_id !== data.payload.user_id));
          }
        } catch (err) {
          console.error("Erro ao processar mensagem WebSocket:", err);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket Online erro:", error);
        setWsConnected(false);
      };
      
      ws.onclose = () => {
        console.log("WebSocket Online desconectado");
        setWsConnected(false);
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (activeTab === "online" && isOpen) {
            connectOnlineWebSocket();
          }
        }, 5000);
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error("Erro ao criar WebSocket:", err);
    }
  }, [user?.id, activeTab, isOpen, enrichWithPhotos, getPhotoByUserId]);

  useEffect(() => {
    if (activeTab === "online" && isOpen && user?.id) {
      connectOnlineWebSocket();
    }
    
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [activeTab, isOpen, user?.id, connectOnlineWebSocket]);

  // ASSINATURAS
  const loadSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);
    try {
      const data = await apiCall({ url: "/api/admin/reports/therapists-by-plan", requireAuth: true });
      
      const now = new Date();
      const processed = (data || []).map((t: any) => {
        let isOverdue = false;
        if (t.current_period_end) {
          const endDate = new Date(t.current_period_end);
          isOverdue = endDate < now && t.subscription_status === "active";
        }
        return {
          therapist_id: t.therapist_id,
          user_id: t.user_id,
          name: t.name,
          email: t.email,
          plan: t.plan || "essencial",
          subscription_status: isOverdue ? "past_due" : (t.subscription_status || "canceled"),
          total_commission_paid: t.total_commission_paid || 0,
          total_sessions: t.total_sessions || 0,
          current_period_end: t.current_period_end
        };
      });
      
      const withFotos = await enrichWithPhotos(processed) as Subscription[];
      setSubscriptions(withFotos);
      
      setSubscriptionsStats({
        total: withFotos.length,
        ativos: withFotos.filter(s => s.subscription_status === "active").length,
        atraso: withFotos.filter(s => s.subscription_status === "past_due").length,
        cancelados: withFotos.filter(s => s.subscription_status === "canceled").length
      });
    } catch (err) {
      console.error("Erro ao carregar assinaturas:", err);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [apiCall, enrichWithPhotos]);

  useEffect(() => {
    if (activeTab === "monitor") {
      loadMonitorUsers();
      monitorIntervalRef.current = setInterval(loadMonitorUsers, 30000);
      return () => {
        if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
      };
    }
    if (activeTab === "assinaturas") {
      loadSubscriptions();
      const interval = setInterval(loadSubscriptions, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadMonitorUsers, loadSubscriptions]);

  // CHAT
  const searchForUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchRole) params.append("role_filter", searchRole);
      if (searchUsers) params.append("search", searchUsers);
      const data = await apiCall({
        url: `/api/chat/admin/users?${params.toString()}`,
        requireAuth: true
      });
      const enrichedUsers = await enrichWithPhotos(data) as AdminUser[];
      setUsersList(enrichedUsers);
    } catch (err) {
      console.error("Erro ao buscar usuarios:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [apiCall, searchRole, searchUsers, enrichWithPhotos]);

  const loadConversations = useCallback(async () => {
    setChatLoading(true);
    try {
      const data = await apiCall({
        url: "/api/chat/admin/conversations",
        requireAuth: true
      });
      const enrichedConvs = await enrichWithPhotos(data.map((conv: any) => ({
        ...conv,
        id: conv.other_user_id,
        user_id: conv.other_user_id,
        foto_url: conv.other_user_foto_url
      }))) as any[];
      
      const finalConvs = enrichedConvs.map(conv => ({
        ...conv,
        other_user_foto_url: conv.foto_url
      }));
      
      setConversations(finalConvs);
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      setChatLoading(false);
    }
  }, [apiCall, enrichWithPhotos]);

  const loadMessages = useCallback(async (threadId: number) => {
    try {
      const data = await apiCall({
        url: `/api/chat/messages/${threadId}`,
        requireAuth: true
      });
      setMessages(Array.isArray(data) ? data : []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  }, [apiCall]);

  useEffect(() => {
    if (!activeThread) return;
    loadMessages(activeThread.thread_id);
    const interval = setInterval(() => loadMessages(activeThread.thread_id), 5000);
    return () => clearInterval(interval);
  }, [activeThread, loadMessages]);

  const openChatWith = async (targetUserId: number) => {
    try {
      const data = await apiCall({
        url: `/api/chat/admin/thread/${targetUserId}`,
        method: "POST",
        requireAuth: true
      });
      setActiveThread({
        thread_id: data.thread_id,
        other_user_id: data.other_user_id,
        other_user_name: data.other_user_name,
        other_user_foto_url: data.other_user_foto_url,
        other_user_role: data.other_user_role,
        unread_count: 0
      });
      setChatView("messages");
      loadMessages(data.thread_id);
    } catch (err) {
      console.error("Erro ao abrir conversa:", err);
    }
  };

  useEffect(() => {
    if (chatView === "new") searchForUsers();
  }, [chatView, searchRole, searchUsers, searchForUsers]);

  useEffect(() => {
    if (activeTab === "chat" && chatView === "conversations") {
      loadConversations();
    }
  }, [activeTab, chatView, loadConversations]);

  const handleSendMessage = async (message: string) => {
    if (!activeThread) return;
    setSending(true);
    try {
      const newMsg = await apiCall({
        url: "/api/chat/messages",
        method: "POST",
        body: { thread_id: activeThread.thread_id, message },
        requireAuth: true
      });
      setMessages(prev => [...prev, newMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      loadConversations();
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await handleSendMessage(`[IMAGE]${base64}`);
    };
    reader.readAsDataURL(file);
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatOnlineTime = (loginTime: string) => {
    const login = new Date(loginTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - login.getTime()) / 60000);
    
    if (diffMinutes < 1) return "agora";
    if (diffMinutes < 60) return `ha ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `ha ${diffHours} h`;
    return login.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "essencial": return "bg-gray-100 text-gray-700";
      case "profissional": return "bg-blue-100 text-blue-700";
      case "premium": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPlanLabel = (plan: string) => {
    if (plan === "profissional") return "Profissional";
    if (plan === "premium") return "Premium";
    return "Essencial";
  };

  const getStatusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "past_due") return "bg-orange-100 text-orange-700";
    if (status === "canceled") return "bg-gray-100 text-gray-500";
    return "bg-yellow-100 text-yellow-700";
  };

  const getStatusLabel = (status: string) => {
    if (status === "active") return "Ativa";
    if (status === "past_due") return "Atrasada";
    if (status === "canceled") return "Cancelada";
    return status;
  };

  const filteredUsers = monitorUsers.filter(u =>
    monitorFilter === "all" || u.role === monitorFilter
  );

  const filteredOnlineUsers = onlineUsers.filter(u =>
    onlineFilter === "all" || u.user_role === onlineFilter
  );

  const filteredSubscriptions = subscriptions.filter(s =>
    subscriptionsFilter === "all" || s.subscription_status === subscriptionsFilter
  );

  const therapistCount = monitorUsers.filter(u => u.role === "therapist").length;
  const patientCount = monitorUsers.filter(u => u.role === "patient").length;
  const last7days = monitorUsers.filter(u => {
    const d = new Date(u.created_at);
    return Date.now() - d.getTime() < 7 * 86400000;
  }).length;

  const onlineTherapistCount = onlineUsers.filter(u => u.user_role === "therapist").length;
  const onlinePatientCount = onlineUsers.filter(u => u.user_role === "patient").length;

  if (isMinimized) {
    return (
      <button onClick={() => setIsMinimized(false)}
        className="fixed right-4 top-72 z-50 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105">
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="w-[420px] h-full bg-white border-l border-gray-200 shadow-lg flex flex-col relative flex-shrink-0" >
      <button onClick={() => setIsMinimized(true)}
        className="absolute -left-3 top-72 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-2 shadow-md z-20 transition-all hover:scale-105">
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-3">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("monitor")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "monitor" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <Activity className="w-4 h-4 inline mr-1" />
              Monitor
            </button>
            <button onClick={() => setActiveTab("online")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "online" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {wsConnected ? <Wifi className="w-4 h-4 inline mr-1" /> : <WifiOff className="w-4 h-4 inline mr-1" />}
              Online
              {onlineUsers.length > 0 && (
                <span className="ml-1.5 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {onlineUsers.length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab("assinaturas")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "assinaturas" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <CreditCard className="w-4 h-4 inline mr-1" />
              Assinaturas
            </button>
            <button onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "chat" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Chat
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ABA MONITOR */}
        {activeTab === "monitor" && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{monitorUsers.length}</p>
                <p className="text-xs text-white/80">Total</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{therapistCount}</p>
                <p className="text-xs text-white/80">Terapeutas</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{patientCount}</p>
                <p className="text-xs text-white/80">Pacientes</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">{last7days} novos nos ultimos 7 dias</p>
                <p className="text-xs text-green-600">Atualizado a cada 30s</p>
              </div>
            </div>

            <div className="flex gap-1">
              {(["all", "therapist", "patient"] as const).map(f => (
                <button key={f} onClick={() => setMonitorFilter(f)}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${monitorFilter === f ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f === "all" ? "Todos" : f === "therapist" ? "Terapeutas" : "Pacientes"}
                </button>
              ))}
            </div>

            {monitorLoading && monitorUsers.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-[#E03673] animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <UserAvatar foto_url={u.foto_url} name={u.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${u.role === "therapist" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {u.role === "therapist" ? "Terapeuta" : "Paciente"}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(u.created_at)}</span>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum usuario encontrado</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA ONLINE */}
        {activeTab === "online" && (
          <div className="p-4 space-y-4">
            <div className={`text-xs text-center py-1 rounded-full ${wsConnected ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {wsConnected ? (
                <><Wifi className="w-3 h-3 inline mr-1" /> Conectado em tempo real</>
              ) : (
                <><WifiOff className="w-3 h-3 inline mr-1" /> Reconectando...</>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{onlineUsers.length}</p>
                <p className="text-xs text-white/80">Online agora</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{onlineTherapistCount}</p>
                <p className="text-xs text-white/80">Terapeutas</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-3 text-white text-center">
                <p className="text-xl font-bold">{onlinePatientCount}</p>
                <p className="text-xs text-white/80">Pacientes</p>
              </div>
            </div>

            <div className="flex gap-1">
              {(["all", "therapist", "patient"] as const).map(f => (
                <button key={f} onClick={() => setOnlineFilter(f)}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${onlineFilter === f ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f === "all" ? "Todos" : f === "therapist" ? "Terapeutas" : "Pacientes"}
                </button>
              ))}
            </div>

            {!wsConnected && onlineUsers.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-[#E03673] animate-spin" />
              </div>
            ) : filteredOnlineUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum usuario online no momento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOnlineUsers.map((u: any) => (
                  <div key={u.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <UserAvatar 
                      foto_url={u.foto_url} 
                      name={u.user_name} 
                      size="md"
                      showStatus={true}
                      isOnline={true}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.user_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.user_email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${u.user_role === "therapist" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {u.user_role === "therapist" ? "Terapeuta" : "Paciente"}
                      </span>
                      <span className="text-xs text-green-600">Online {formatOnlineTime(u.login_time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA ASSINATURAS */}
        {activeTab === "assinaturas" && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{subscriptionsStats.total}</p>
                <p className="text-xs text-white/80">Total</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{subscriptionsStats.ativos}</p>
                <p className="text-xs text-white/80">Ativos</p>
              </div>
              <div className="bg-gradient-to-br from-[#F59E0B] to-[#F59E0B]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{subscriptionsStats.atraso}</p>
                <p className="text-xs text-white/80">Atraso</p>
              </div>
              <div className="bg-gradient-to-br from-[#10B981] to-[#10B981]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{subscriptionsStats.cancelados}</p>
                <p className="text-xs text-white/80">Cancelados</p>
              </div>
            </div>

            <div className="flex gap-1">
              {(["all", "active", "past_due", "canceled"] as const).map(f => (
                <button key={f} onClick={() => setSubscriptionsFilter(f)}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${subscriptionsFilter === f ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f === "all" ? "Todos" : f === "active" ? "Ativos" : f === "past_due" ? "Atraso" : "Cancelados"}
                </button>
              ))}
            </div>

            {subscriptionsLoading && subscriptions.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-[#E03673] animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubscriptions.map(s => (
                  <div key={s.therapist_id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar foto_url={s.foto_url} name={s.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPlanColor(s.plan)}`}>
                          {getPlanLabel(s.plan)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.subscription_status)}`}>
                          {getStatusLabel(s.subscription_status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                      <span>{s.total_sessions} sessoes</span>
                      <span>Comissao: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.total_commission_paid)}</span>
                    </div>
                    {s.current_period_end && (
                      <p className="text-xs text-gray-400 mt-1">
                        Vencimento: {new Date(s.current_period_end).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma assinatura encontrada</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA CHAT */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            {chatView === "conversations" && (
              <div className="p-4 space-y-3">
                <button onClick={() => { setChatView("new"); setSearchUsers(""); setSearchRole(""); }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors text-sm font-medium">
                  <MessageSquare className="w-4 h-4" /> Nova conversa
                </button>

                {chatLoading && conversations.length === 0 ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma conversa ainda</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {conversations.map(conv => (
                      <button key={conv.thread_id} onClick={() => { setActiveThread(conv); setChatView("messages"); }}
                        className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3">
                        <UserAvatar foto_url={conv.other_user_foto_url} name={conv.other_user_name} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className="font-medium text-gray-900 text-sm truncate">{conv.other_user_name}</p>
                            {conv.last_message_at && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {conv.last_message?.startsWith("[IMAGE]") ? "Imagem" : conv.last_message || "Nenhuma mensagem"}
                          </p>
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="bg-[#E03673] text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0">{conv.unread_count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {chatView === "new" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setChatView("conversations")} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-medium text-gray-800">Escolher usuario</p>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" value={searchUsers} onChange={e => setSearchUsers(e.target.value)}
                      placeholder="Nome ou email..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                  </div>
                  <select value={searchRole} onChange={e => setSearchRole(e.target.value as any)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-[#E03673] outline-none">
                    <option value="">Todos</option>
                    <option value="therapist">Terapeutas</option>
                    <option value="patient">Pacientes</option>
                  </select>
                </div>

                {usersLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                ) : (
                  <div className="space-y-1">
                    {usersList.map((u: any) => (
                      <button key={u.id} onClick={() => openChatWith(u.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <UserAvatar foto_url={u.foto_url} name={u.full_name} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${u.role === "therapist" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {u.role === "therapist" ? "Terapeuta" : "Paciente"}
                        </span>
                      </button>
                    ))}
                    {usersList.length === 0 && !usersLoading && (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhum usuario encontrado</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {chatView === "messages" && activeThread && (
              <div className="flex flex-col h-[calc(100vh-200px)]">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <button onClick={() => { setChatView("conversations"); setActiveThread(null); setMessages([]); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <UserAvatar foto_url={activeThread.other_user_foto_url} name={activeThread.other_user_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activeThread.other_user_name}</p>
                    <p className="text-xs text-gray-400">{activeThread.other_user_role}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 px-4 py-2">
                  {messages.map(msg => (
                    <ChatMessage key={msg.id} id={msg.id} sender_id={msg.sender_id} message={msg.message}
                      is_read={msg.is_read} created_at={msg.created_at} read_at={msg.read_at} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-gray-100 px-4 pt-2 pb-3 flex-shrink-0">
                  <ChatInput onSendMessage={handleSendMessage} onSendImage={handleSendImage} disabled={sending} placeholder="Mensagem como admin..." />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}