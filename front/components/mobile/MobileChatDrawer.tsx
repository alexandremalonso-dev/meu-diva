"use client";

import { useEffect, useState, useRef } from "react";
import { Send, ArrowLeft, User } from "lucide-react";
import MobileDrawer from "./MobileDrawer";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from "@/lib/utils";

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
}

interface MobileChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return formatTime(dateStr);
  if (days === 1) return "ontem";
  return date.toLocaleDateString("pt-BR");
}

export default function MobileChatDrawer({ isOpen, onClose }: MobileChatDrawerProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) loadConversations();
  }, [isOpen]);

  useEffect(() => {
    if (selectedThread) loadMessages(selectedThread.thread_id);
  }, [selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await api("/api/chat/conversations");
      setConversations(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: number) => {
    setLoading(true);
    try {
      const data = await api(`/api/chat/messages/${threadId}`);
      setMessages(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    setSending(true);
    try {
      const msg = await api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          thread_id: selectedThread.thread_id,
          message: newMessage.trim(),
        }),
      });
      setMessages(prev => [...prev, msg]);
      setNewMessage("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    setSelectedThread(null);
    setMessages([]);
    loadConversations();
  };

  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={selectedThread ? selectedThread.other_user_name : `Chat${totalUnread > 0 ? ` (${totalUnread})` : ""}`}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>

        {/* LISTA DE CONVERSAS */}
        {!selectedThread && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                Carregando...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <p style={{ color: "#9CA3AF", fontSize: 14 }}>Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.thread_id}
                  onClick={() => setSelectedThread(conv)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid #F9FAFB",
                    cursor: "pointer",
                    background: conv.unread_count > 0 ? "#FFF5F8" : "white",
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {getFotoSrc(conv.other_user_foto_url) ? (
                      <img src={getFotoSrc(conv.other_user_foto_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <User size={20} color="#9CA3AF" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: conv.unread_count > 0 ? 600 : 500, color: "#111827", margin: 0 }}>
                        {conv.other_user_name}
                      </p>
                      {conv.last_message_at && (
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDate(conv.last_message_at)}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                        {conv.last_message || "Nenhuma mensagem ainda"}
                      </p>
                      {conv.unread_count > 0 && (
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>{conv.unread_count}</span>
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>{conv.other_user_role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MENSAGENS */}
        {selectedThread && (
          <>
            {/* BOTÃO VOLTAR */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #F3F4F6" }}>
              <button
                onClick={handleBack}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.secondary, fontSize: 13, cursor: "pointer", padding: 0 }}
              >
                <ArrowLeft size={16} />
                Voltar para conversas
              </button>
            </div>

            {/* LISTA DE MENSAGENS */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Carregando...</div>
              ) : messages.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Nenhuma mensagem ainda</div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "75%",
                        padding: "8px 12px",
                        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: isMe ? COLORS.primary : "#F3F4F6",
                        color: isMe ? "white" : "#111827",
                      }}>
                        <p style={{ fontSize: 14, margin: 0, lineHeight: 1.4 }}>{msg.message}</p>
                        <p style={{ fontSize: 10, margin: "4px 0 0", opacity: 0.7, textAlign: "right" }}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid #F3F4F6",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Digite uma mensagem..."
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 20,
                  border: "1px solid #E5E7EB",
                  fontSize: 14,
                  outline: "none",
                  background: "#F9FAFB",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: newMessage.trim() ? COLORS.primary : "#E5E7EB",
                  border: "none",
                  cursor: newMessage.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={16} color="white" />
              </button>
            </div>
          </>
        )}
      </div>
    </MobileDrawer>
  );
}