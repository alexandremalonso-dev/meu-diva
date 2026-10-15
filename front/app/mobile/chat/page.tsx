"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, MessageSquare, ArrowLeft, Send, Smile, Paperclip, X } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import MobileHeader from "@/components/mobile/MobileHeader";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const BACKEND_URL = "https://api.meudivaonline.com";
const EMOJIS = ["😊","😂","❤️","👍","🙏","😢","😮","🤝","👋","🎉","💪","🌟","😔","🤗","👏","🙌"];
const ACCEPT_TYPES = "image/*,.pdf,.doc,.docx,.txt";

function getFotoSrc(url?: string|null) {
  if(!url)return null;
  return url.startsWith("http")?url:`${BACKEND_URL}${url}`;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  if(diff < 24*60*60*1000) return date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  return date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

function MessageBubble({ msg, currentUserId }: { msg: any; currentUserId: number }) {
  const isOwn = msg.sender_id === currentUserId;
  const isImage = msg.message?.startsWith("[IMAGE]");
  const isDoc = msg.message?.startsWith("[DOC:");

  return (
    <div style={{ display:"flex", justifyContent:isOwn?"flex-end":"flex-start", marginBottom:6 }}>
      <div style={{
        maxWidth:"75%", padding:"8px 12px", borderRadius:isOwn?"16px 4px 16px 16px":"4px 16px 16px 16px",
        background:isOwn?COLORS.primary:"white", color:isOwn?"white":COLORS.dark,
        fontSize:14, lineHeight:1.4, boxShadow:"0 1px 2px rgba(0,0,0,0.08)",
        border:isOwn?"none":"0.5px solid #E5E7EB"
      }}>
        {isImage ? (
          <img src={msg.message.replace("[IMAGE]","")} alt="imagem" style={{ maxWidth:"100%", borderRadius:8, display:"block" }} />
        ) : isDoc ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Paperclip size={16} />
            <span style={{ fontSize:13 }}>{msg.message.match(/\[DOC:([^\]]+)\]/)?.[1]||"Documento"}</span>
          </div>
        ) : (
          <span style={{ whiteSpace:"pre-wrap" }}>{msg.message}</span>
        )}
        <div style={{ fontSize:10, opacity:0.7, textAlign:"right", marginTop:4 }}>
          {formatTime(msg.created_at)}
          {isOwn && <span style={{ marginLeft:4 }}>{msg.is_read?"✓✓":"✓"}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MobileChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    conversations, currentMessages, activeThreadId, loading, sending,
    setActiveThreadId, loadMessages, sendMessage, markAsRead
  } = useChat();

  const messagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [fileError, setFileError] = useState<string|null>(null);
  const [imageError, setImageError] = useState<string|null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = messagesRef.current;
    if(el) el.scrollTo({top:el.scrollHeight, behavior});
  };

  useEffect(() => {
    if(activeThreadId) setTimeout(()=>scrollToBottom("instant"),100);
  }, [activeThreadId]);

  useEffect(() => {
    if(!activeThreadId||!user)return;
    const unread = currentMessages.filter(m=>!m.is_read&&m.sender_id!==user.id);
    unread.forEach(m=>markAsRead(m.id));
  }, [currentMessages, activeThreadId, user, markAsRead]);

  useEffect(() => {
    if(textareaRef.current){
      textareaRef.current.style.height="auto";
      textareaRef.current.style.height=`${Math.min(textareaRef.current.scrollHeight,120)}px`;
    }
  }, [message]);

  const handleSelectConversation = (threadId: number) => {
    setActiveThreadId(threadId);
    loadMessages(threadId);
  };

  const handleSend = async () => {
    if(!message.trim()||!activeThreadId)return;
    await sendMessage(activeThreadId, message.trim());
    setMessage("");
    setTimeout(()=>scrollToBottom("smooth"),50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}
  };

  const handleFile = (file: File) => {
    if(file.size>5*1024*1024){setFileError("Máximo 5MB.");setTimeout(()=>setFileError(null),3000);return;}
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const prefixed = file.type.startsWith("image/") ? `[IMAGE]${base64}` : `[DOC:${file.name}]${base64}`;
      await sendMessage(activeThreadId!, prefixed);
      setTimeout(()=>scrollToBottom("smooth"),50);
    };
    reader.readAsDataURL(file);
  };

  const activeConversation = conversations.find(c=>c.thread_id===activeThreadId);

  // ─── LISTA DE CONVERSAS ───────────────────────────────────────
  if(!activeThreadId) return (
    <div style={{ minHeight:"100vh", background:"#f7f0f5", paddingBottom:80 }}>
      <MobileHeader />
      <div style={{ background:"white", padding:"14px 16px", borderBottom:"0.5px solid #E5E7EB" }}>
        <div style={{ fontSize:18, fontWeight:600, color:COLORS.dark }}>Mensagens</div>
      </div>

      {loading && conversations.length===0 ? (
        <div style={{ display:"flex", justifyContent:"center", padding:32 }}>
          <Loader2 size={28} className="animate-spin" color={COLORS.primary} />
        </div>
      ) : conversations.length===0 ? (
        <div style={{ textAlign:"center", padding:48 }}>
          <MessageSquare size={48} color="#D1D5DB" style={{ margin:"0 auto 12px" }} />
          <div style={{ fontSize:15, fontWeight:500, color:"#6B7280" }}>Nenhuma conversa ativa</div>
          <div style={{ fontSize:13, color:"#9CA3AF", marginTop:6 }}>As conversas aparecem após a primeira sessão</div>
        </div>
      ) : (
        <div>
          {conversations.map(conv => (
            <button key={conv.thread_id} onClick={()=>handleSelectConversation(conv.thread_id)}
              style={{ width:"100%", padding:"14px 16px", display:"flex", alignItems:"center", gap:12, background:"white", border:"none", borderBottom:"0.5px solid #F3F4F6", cursor:"pointer", textAlign:"left" }}>
              <div style={{ width:48, height:48, borderRadius:"50%", overflow:"hidden", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {conv.other_user_foto_url
                  ? <img src={getFotoSrc(conv.other_user_foto_url)!} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <User size={22} color="#9CA3AF" />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <div style={{ fontSize:15, fontWeight:600, color:COLORS.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{conv.other_user_name}</div>
                  {conv.last_message_at && <div style={{ fontSize:11, color:"#9CA3AF", flexShrink:0, marginLeft:8 }}>{formatTime(conv.last_message_at)}</div>}
                </div>
                <div style={{ fontSize:13, color:"#9CA3AF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2 }}>
                  {conv.last_message?.startsWith("[IMAGE]")?"📷 Imagem":conv.last_message?.startsWith("[DOC:")?"📎 Documento":conv.last_message||"Nenhuma mensagem ainda"}
                </div>
              </div>
              {conv.unread_count>0 && (
                <div style={{ background:COLORS.primary, color:"white", fontSize:11, fontWeight:700, borderRadius:20, padding:"2px 8px", flexShrink:0 }}>
                  {conv.unread_count}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─── CONVERSA ABERTA ─────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#f7f0f5" }}>
      {/* Header da conversa */}
      <div style={{ background:COLORS.primary, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <button onClick={()=>setActiveThreadId(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, padding:"6px 10px", color:"white", cursor:"pointer", display:"flex", alignItems:"center" }}>
          <ArrowLeft size={18} />
        </button>
        {activeConversation && (
          <>
            <div style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", background:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {activeConversation.other_user_foto_url
                ? <img src={getFotoSrc(activeConversation.other_user_foto_url)!} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <User size={18} color="white" />}
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:"white" }}>{activeConversation.other_user_name}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)" }}>{activeConversation.other_user_role}</div>
            </div>
          </>
        )}
      </div>

      {/* Mensagens */}
      <div ref={messagesRef} style={{ flex:1, overflowY:"auto", padding:"12px 16px", minHeight:0 }}>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:32 }}>
            <Loader2 size={24} className="animate-spin" color={COLORS.primary} />
          </div>
        ) : currentMessages.length===0 ? (
          <div style={{ textAlign:"center", padding:48 }}>
            <MessageSquare size={36} color="#D1D5DB" style={{ margin:"0 auto 8px" }} />
            <div style={{ fontSize:14, color:"#9CA3AF" }}>Nenhuma mensagem ainda</div>
          </div>
        ) : (
          currentMessages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} currentUserId={user?.id||0} />
          ))
        )}
      </div>

      {/* Input */}
      <div style={{ background:"white", borderTop:"0.5px solid #E5E7EB", padding:"8px 12px", flexShrink:0, paddingBottom:"calc(8px + env(safe-area-inset-bottom, 0px))" }}>
        {(fileError||imageError) && <div style={{ fontSize:12, color:"#DC2626", marginBottom:6 }}>{fileError||imageError}</div>}

        {showEmoji && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:4, marginBottom:8, background:"#F9FAFB", borderRadius:10, padding:8 }}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>{setMessage(m=>m+e);setShowEmoji(false);}}
                style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6 }}>{e}</button>
            ))}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
          <button onClick={()=>setShowEmoji(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"#9CA3AF" }}>
            <Smile size={22} />
          </button>
          <input ref={fileInputRef} type="file" accept={ACCEPT_TYPES} style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);if(fileInputRef.current)fileInputRef.current.value="";}} />
          <button onClick={()=>fileInputRef.current?.click()} style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"#9CA3AF" }}>
            <Paperclip size={22} />
          </button>
          <textarea ref={textareaRef} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..." rows={1} disabled={sending}
            style={{ flex:1, resize:"none", border:"1.5px solid #E5E7EB", borderRadius:20, padding:"8px 14px", fontSize:14, outline:"none", maxHeight:120, background:sending?"#F9FAFB":"white" }} />
          <button onClick={handleSend} disabled={!message.trim()||sending}
            style={{ width:40, height:40, borderRadius:"50%", background:!message.trim()||sending?"#D1D5DB":COLORS.primary, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Send size={18} color="white" />
          </button>
        </div>
      </div>
    </div>
  );
}
