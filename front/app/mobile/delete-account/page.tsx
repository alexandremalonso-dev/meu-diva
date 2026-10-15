"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2, RefreshCw, ArrowLeft, X } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

export default function MobileDeleteAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<"confirm"|"code">("confirm");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeExpiresIn, setCodeExpiresIn] = useState<number|null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    api("/api/users/me").then((d:any) => setUserEmail(d.email||"")).catch(()=>{});
  }, []);

  useEffect(() => {
    if(step==="code" && codeExpiresIn !== null && codeExpiresIn > 0) {
      const t = setInterval(() => setCodeExpiresIn(p => p !== null && p > 0 ? p-1 : 0), 1000);
      return () => clearInterval(t);
    }
  }, [step, codeExpiresIn]);

  useEffect(() => {
    if(resendCooldown > 0) {
      const t = setInterval(() => setResendCooldown(p => p-1), 1000);
      return () => clearInterval(t);
    }
  }, [resendCooldown]);

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  async function handleRequest() {
    setLoading(true); setError("");
    try {
      await api("/api/users/me/delete-request", { method:"POST" });
      setStep("code");
      setCodeExpiresIn(15*60);
      setResendCooldown(60);
    } catch(e:any) { setError(e.message||"Erro ao solicitar exclusão"); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    if(resendCooldown > 0) { setError(`Aguarde ${resendCooldown}s para reenviar.`); return; }
    setLoading(true); setError("");
    try {
      await api("/api/users/me/delete-request", { method:"POST" });
      setCodeExpiresIn(15*60); setResendCooldown(60);
    } catch(e:any) { setError(e.message||"Erro ao reenviar código"); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if(!code || code.length !== 6) { setError("Digite o código de 6 dígitos."); return; }
    setLoading(true); setError("");
    try {
      await api("/api/users/me/delete-confirm", { method:"POST", body:JSON.stringify({ code }) });
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      router.push("/mobile/login");
    } catch(e:any) { setError(e.message||"Código inválido ou expirado"); }
    finally { setLoading(false); }
  }

  function reset() {
    setStep("confirm"); setCode(""); setError("");
    setResendCooldown(0); setCodeExpiresIn(null);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f7f0f5", paddingBottom:100 }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg, #DC2626, #991B1B)", padding:"16px 16px 20px" }}>
        <button onClick={()=>router.back()} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, padding:"6px 10px", color:"white", display:"flex", alignItems:"center", gap:6, marginBottom:12, cursor:"pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:10, color:"white" }}>
          <Trash2 size={22} />
          <div style={{ fontSize:20, fontWeight:600 }}>Excluir Conta</div>
        </div>
      </div>

      <div style={{ padding:16 }}>
        {step === "confirm" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Ícone */}
            <div style={{ background:"white", borderRadius:14, padding:24, textAlign:"center", border:"0.5px solid #E5E7EB" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:"#FEE2E2", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                <Trash2 size={32} color="#DC2626" />
              </div>
              <div style={{ fontSize:16, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>
                Tem certeza que deseja excluir permanentemente sua conta?
              </div>
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", marginBottom:16, display:"flex", gap:8, alignItems:"flex-start", textAlign:"left" }}>
                <AlertTriangle size={16} color="#DC2626" style={{ flexShrink:0, marginTop:2 }} />
                <div style={{ fontSize:13, color:"#DC2626" }}>Esta ação é irreversível! Um código de verificação será enviado para seu e-mail.</div>
              </div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:13, color:"#6B7280", marginBottom:8 }}>Serão excluídos:</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {["Seu perfil e informações pessoais","Histórico de sessões e prontuários","Dados financeiros e recibos","Carteira e transações"].map((item,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#374151" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#DC2626", flexShrink:0 }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {error && <div style={{ background:"#FEE2E2", color:"#991B1B", borderRadius:10, padding:"10px 14px", fontSize:13 }}>{error}</div>}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>router.back()}
                style={{ flex:1, background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"12px 0", fontSize:14, cursor:"pointer", color:COLORS.dark }}>
                Cancelar
              </button>
              <button onClick={handleRequest} disabled={loading}
                style={{ flex:1, background:"#DC2626", color:"white", border:"none", borderRadius:10, padding:"12px 0", fontSize:14, fontWeight:600, cursor:"pointer", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {loading ? "Enviando..." : "Solicitar exclusão"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"white", borderRadius:14, padding:20, border:"0.5px solid #E5E7EB" }}>
              <div style={{ fontSize:14, color:"#374151", marginBottom:8, lineHeight:1.6 }}>
                Enviamos um código para <strong>{userEmail}</strong>. Digite abaixo para confirmar a exclusão.
              </div>
              {codeExpiresIn !== null && codeExpiresIn > 0 && (
                <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>⏱️ Código expira em {fmt(codeExpiresIn)}</div>
              )}

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, color:"#6B7280", marginBottom:8, display:"block" }}>Código de verificação</label>
                <input
                  type="text" value={code}
                  onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                  placeholder="000000" maxLength={6} autoFocus
                  style={{ width:"100%", padding:"14px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:24, outline:"none", textAlign:"center", letterSpacing:"0.3em", fontWeight:600, boxSizing:"border-box" as const }}
                />
              </div>

              {error && <div style={{ background:"#FEE2E2", color:"#991B1B", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>{error}</div>}

              <button onClick={handleConfirm} disabled={loading||code.length!==6}
                style={{ width:"100%", background:"#DC2626", color:"white", border:"none", borderRadius:10, padding:"13px 0", fontSize:15, fontWeight:700, cursor:"pointer", opacity:loading||code.length!==6?0.5:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:10 }}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verificando...</> : <><Trash2 size={16} /> Confirmar exclusão permanente</>}
              </button>

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>{reset();setStep("confirm");}}
                  style={{ flex:1, background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"10px 0", fontSize:13, cursor:"pointer", color:"#6B7280" }}>
                  Voltar
                </button>
                <button onClick={handleResend} disabled={resendCooldown>0||loading}
                  style={{ flex:1, background:"white", border:`1px solid ${COLORS.secondary}`, borderRadius:10, padding:"10px 0", fontSize:13, cursor:"pointer", color:COLORS.secondary, opacity:resendCooldown>0||loading?0.5:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <RefreshCw size={14} className={resendCooldown>0?"animate-spin":""} />
                  {resendCooldown>0 ? `Reenviar (${resendCooldown}s)` : "Reenviar código"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
