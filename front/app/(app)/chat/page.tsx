"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import { Loader2, Send, ArrowLeft, MessageCircle } from "lucide-react";

interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { execute: apiCall } = useApi();

  const threadId = searchParams?.get("thread");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const loadMessages = async () => {
    if (!threadId) return;
    try {
      const data = await apiCall({
        url: `/api/chat/messages/${threadId}`,
        requireAuth: true,
      });
      setMessages(Array.isArray(data) ? data : []);
      setError("");
    } catch (err: any) {
      console.error("Erro ao carregar mensagens:", err);
      setError(err.message || "Não foi possível carregar essa conversa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/chat?thread=${threadId || ""}`)}`);
      return;
    }
    if (!threadId) {
      setLoading(false);
      setError("Conversa não especificada.");
      return;
    }
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, threadId]);

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !threadId || sending) return;
    setSending(true);
    try {
      const newMsg = await apiCall({
        url: "/api/chat/messages",
        method: "POST",
        body: { thread_id: Number(threadId), message: trimmed },
        requireAuth: true,
      });
      setMessages((prev) => [...prev, newMsg]);
      setText("");
    } catch (err: any) {
      setError(err.message || "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const dashboardByRole: Record<string, string> = {
    patient: "/patient/dashboard",
    therapist: "/therapist/dashboard",
    admin: "/admin/dashboard",
    empresa: "/empresa/dashboard",
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push(dashboardByRole[user?.role || ""] || "/")}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <MessageCircle className="w-5 h-5 text-[#E03673]" />
        <h1 className="text-base font-semibold text-gray-900">Conversa</h1>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {!error && messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">Nenhuma mensagem ainda.</p>
        )}

        <div className="space-y-3">
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-line ${
                    isMine
                      ? "bg-[#E03673] text-white rounded-br-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {threadId && !error && (
        <div className="bg-white border-t border-gray-100 p-3 sticky bottom-0">
          <div className="max-w-2xl w-full mx-auto flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Digite sua mensagem..."
              className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E03673] outline-none"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="p-3 bg-[#E03673] text-white rounded-xl hover:bg-[#c02c5e] disabled:opacity-50 flex items-center justify-center"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
