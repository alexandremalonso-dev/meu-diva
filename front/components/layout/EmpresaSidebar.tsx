"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  User, LogOut, MessageSquare, Activity,
  Loader2, ChevronRight, ChevronLeft, Search, ArrowLeft
} from "lucide-react";
import { useApi } from "@/lib/useApi";
import { ChatInput } from "@/components/chat/ChatInput";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface ColaboradorData {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  foto_url?: string;
  is_active: boolean;
  created_at: string;
  access_ends_at?: string;
}

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

interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export default function EmpresaSidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"monitor" | "chat">("monitor");
  
  // MONITOR
  const [colaboradores, setColaboradores] = useState<ColaboradorData[]>([]);
  const [monitorFilter, setMonitorFilter] = useState<"all" | "active" | "inactive">("all");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    inativos: 0,
    novosMes: 0,
    baixadosMes: 0
  });
  
  // CHAT
  const [chatView, setChatView] = useState<"conversations" | "new" | "messages">("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeThread, setActiveThread] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchUsers, setSearchUsers] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadCount = conversations.reduce((s, c) => s + c.unread_count, 0);
  
  const calculateStats = useCallback((colabs: ColaboradorData[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const ativos = colabs.filter(c => c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > now));
    const inativos = colabs.filter(c => !c.is_active || (c.access_ends_at && new Date(c.access_ends_at) <= now));
    const novosMes = colabs.filter(c => {
      const d = new Date(c.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const baixadosMes = colabs.filter(c => {
      if (!c.access_ends_at) return false;
      const d = new Date(c.access_ends_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    setStats({
      total: colabs.length,
      ativos: ativos.length,
      inativos: inativos.length,
      novosMes: novosMes.length,
      baixadosMes: baixadosMes.length
    });
  }, []);
  
  const loadColaboradores = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const data = await apiCall({ url: "/api/empresa/colaboradores", requireAuth: true });
      if (data && Array.isArray(data)) {
        setColaboradores(data);
        calculateStats(data);
      }
    } catch (err) {
      console.error("Erro ao carregar colaboradores:", err);
    } finally {
      setMonitorLoading(false);
    }
  }, [apiCall, calculateStats]);
  
  const filteredColaboradores = colaboradores.filter(c => {
    if (monitorFilter === "active" && (!c.is_active || (c.access_ends_at && new Date(c.access_ends_at) <= new Date()))) return false;
    if (monitorFilter === "inactive" && c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > new Date())) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return c.full_name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term);
    }
    return true;
  });
  
  const loadConversations = useCallback(async () => {
    setChatLoading(true);
    try {
      const data = await apiCall({ url: "/api/chat/empresa/conversations", requireAuth: true });
      setConversations(data || []);
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      setChatLoading(false);
    }
  }, [apiCall]);
  
  const loadMessages = useCallback(async (threadId: number) => {
    try {
      const data = await apiCall({ url: `/api/chat/messages/${threadId}`, requireAuth: true });
      setMessages(Array.isArray(data) ? data : []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  }, [apiCall]);
  
  const searchForUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await apiCall({ url: `/api/chat/empresa/users?search=${searchUsers}`, requireAuth: true });
      setUsersList(data || []);
    } catch (err) {
      console.error("Erro ao buscar usuarios:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [apiCall, searchUsers]);
  
  const openChatWith = async (targetUserId: number) => {
    try {
      const data = await apiCall({ url: `/api/chat/empresa/thread/${targetUserId}`, method: "POST", requireAuth: true });
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
  
  const handleSendMessage = async (message: string) => {
    if (!activeThread) return;
    setSending(true);
    try {
      const newMsg = await apiCall({ url: "/api/chat/messages", method: "POST", body: { thread_id: activeThread.thread_id, message }, requireAuth: true });
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
  
  useEffect(() => {
    if (activeTab === "monitor") {
      loadColaboradores();
      const interval = setInterval(loadColaboradores, 30000);
      return () => clearInterval(interval);
    }
    if (activeTab === "chat" && chatView === "conversations") {
      loadConversations();
    }
  }, [activeTab, loadColaboradores, loadConversations, chatView]);
  
  useEffect(() => {
    if (chatView === "new" && searchUsers) {
      const timer = setTimeout(searchForUsers, 500);
      return () => clearTimeout(timer);
    }
  }, [chatView, searchUsers, searchForUsers]);
  
  useEffect(() => {
    if (activeThread) loadMessages(activeThread.thread_id);
    const interval = setInterval(() => { if (activeThread) loadMessages(activeThread.thread_id); }, 5000);
    return () => clearInterval(interval);
  }, [activeThread, loadMessages]);
  
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  
  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };
  
  if (isMinimized) {
    return (
      <button onClick={() => setIsMinimized(false)}
        className="fixed right-4 top-72 z-50 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105">
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <div className="w-[420px] h-full bg-white border-l border-gray-200 shadow-lg flex flex-col relative flex-shrink-0">
      <button onClick={() => setIsMinimized(true)}
        className="absolute -left-3 top-72 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-full p-2 shadow-md z-20 transition-all hover:scale-105">
        <ChevronRight className="w-4 h-4" />
      </button>
      
      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-3">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("monitor")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "monitor" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <Activity className="w-4 h-4 inline mr-1" />
              Monitor
            </button>
            <button onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "chat" ? "bg-[#E03673] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Chat
              {unreadCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* ABA MONITOR */}
        {activeTab === "monitor" && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-xs text-white/80">Total</p>
              </div>
              <div className="bg-gradient-to-br from-[#10B981] to-[#10B981]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{stats.ativos}</p>
                <p className="text-xs text-white/80">Ativos</p>
              </div>
              <div className="bg-gradient-to-br from-[#F59E0B] to-[#F59E0B]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{stats.inativos}</p>
                <p className="text-xs text-white/80">Inativos</p>
              </div>
              <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{stats.novosMes}</p>
                <p className="text-xs text-white/80">Novos (mês)</p>
              </div>
              <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/60 rounded-lg p-2 text-white text-center">
                <p className="text-lg font-bold">{stats.baixadosMes}</p>
                <p className="text-xs text-white/80">Baixados (mês)</p>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
            
            <div className="flex gap-1">
              {(["all", "active", "inactive"] as const).map(f => (
                <button key={f} onClick={() => setMonitorFilter(f)}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${monitorFilter === f ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
                </button>
              ))}
            </div>
            
            {monitorLoading && colaboradores.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {filteredColaboradores.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <UserAvatar foto_url={c.foto_url} name={c.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > new Date()) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active && (!c.access_ends_at || new Date(c.access_ends_at) > new Date()) ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                ))}
                {filteredColaboradores.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum colaborador encontrado</p>
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
                <button onClick={() => { setChatView("new"); setSearchUsers(""); }}
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
                      <button key={conv.thread_id} onClick={() => { setActiveThread(conv); setChatView("messages"); loadMessages(conv.thread_id); }}
                        className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3">
                        <UserAvatar foto_url={conv.other_user_foto_url} name={conv.other_user_name} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className="font-medium text-gray-900 text-sm truncate">{conv.other_user_name}</p>
                            {conv.last_message_at && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message || "Nenhuma mensagem"}</p>
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
                  <p className="text-sm font-medium text-gray-800">Escolher usuário</p>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" value={searchUsers} onChange={e => setSearchUsers(e.target.value)}
                    placeholder="Nome ou email..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                
                {usersLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                ) : (
                  <div className="space-y-1">
                    {usersList.map(u => (
                      <button key={u.id} onClick={() => openChatWith(u.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <UserAvatar foto_url={u.foto_url} name={u.full_name} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </button>
                    ))}
                    {usersList.length === 0 && !usersLoading && searchUsers && (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhum usuário encontrado</p>
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
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-2 rounded-lg ${msg.sender_id === user?.id ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="text-sm break-words">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">{new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="border-t border-gray-100 px-4 pt-2 pb-3 flex-shrink-0">
                  <ChatInput onSendMessage={handleSendMessage} onSendImage={() => {}} disabled={sending} placeholder="Mensagem como empresa..." />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Logout */}
      <div className="p-2 border-t border-gray-200 flex-shrink-0">
        <div className="w-12 h-12 flex items-center justify-center mb-2 mx-auto">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            <User className="w-5 h-5 text-gray-500" />
          </div>
        </div>
        <div className="group relative w-12 h-12 mx-auto">
          <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-200">
            <LogOut className="w-5 h-5" />
          </button>
          <div className="fixed left-[calc(4rem+0.5rem)] top-auto transform -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] shadow-lg pointer-events-none">
            Sair
          </div>
        </div>
      </div>
    </div>
  );
}