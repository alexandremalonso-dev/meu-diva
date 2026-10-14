"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, QrCode, Copy, CheckCircle2, Loader2, Clock, Shield, User } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "APP_USR-6dd38a4a-5036-4838-8104-92314dc8414a";
const COUNTDOWN = 10 * 60;

const fmtCurrency = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const getPhotoSrc = (url: string | null) => !url ? "/avatar-placeholder.png" : url.startsWith("http") ? url : `https://api.meudivaonline.com${url}`;
const maskCard = (v: string) => v.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim().slice(0, 19);
const maskExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };
const maskCpf = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`; if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`; return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`; };
const inputSt = (f?: boolean) => ({ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15, border: `1.5px solid ${f ? COLORS.primary : "#E5E7EB"}`, outline: "none", background: "white", color: COLORS.dark, boxSizing: "border-box" as const });

let mpInstance: any = null;
async function loadMp(key: string) {
  if (mpInstance) return mpInstance;
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if ((window as any).MercadoPago) { mpInstance = new (window as any).MercadoPago(key, { locale: "pt-BR" }); return resolve(mpInstance); }
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = () => { mpInstance = new (window as any).MercadoPago(key, { locale: "pt-BR" }); resolve(mpInstance); };
    s.onerror = () => reject(new Error("Falha ao carregar SDK"));
    document.head.appendChild(s);
  });
}

function CardForm({ mpPublicKey, paymentId, amount, payerEmail, onSuccess, onError }: any) {
  const [name, setName] = useState(""); const [cpf, setCpf] = useState(""); const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState(""); const [cvv, setCvv] = useState(""); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [focused, setFocused] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError("Informe o nome no cartão."); return; }
    if (cardNumber.replace(/\s/g, "").length < 16) { setError("Número inválido."); return; }
    if (expiry.length < 5) { setError("Validade inválida."); return; }
    if (cvv.length < 3) { setError("CVV inválido."); return; }
    setLoading(true); setError(null);
    try {
      const mp = await loadMp(mpPublicKey || MP_PUBLIC_KEY);
      const [expMonth, expYear] = expiry.split("/");
      const rawCard = cardNumber.replace(/\s/g, "");
      const tokenResult = await (mp as any).createCardToken({ cardNumber: rawCard, cardholderName: name, cardExpirationMonth: expMonth, cardExpirationYear: `20${expYear}`, securityCode: cvv });
      if (!tokenResult || tokenResult.error) throw new Error(tokenResult?.error?.message || "Erro ao tokenizar.");
      const pmResult = await (mp as any).getPaymentMethods({ bin: rawCard.slice(0, 6) });
      const result = await api("/api/payments/process-payment", { method: "POST", body: JSON.stringify({ payment_id: paymentId, card_token: tokenResult.id, payment_method_id: pmResult?.results?.[0]?.id || "credit_card", issuer_id: pmResult?.results?.[0]?.issuer?.id, payer_email: payerEmail, payer_cpf: cpf.replace(/\D/g, "") }) });
      if (result.status === "approved") onSuccess();
      else if (result.status === "pending") setError("Pagamento em análise. Você receberá confirmação por e-mail.");
      else setError(result.detail || "Pagamento não aprovado. Tente outro cartão.");
    } catch (e: any) { setError(e.message || "Erro ao processar."); onError?.(e.message); }
    finally { setLoading(false); }
  }, [name, cpf, cardNumber, expiry, cvv, paymentId, payerEmail, mpPublicKey, onSuccess, onError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        { label: "Nome no cartão", value: name, onChange: (v: string) => setName(v), key: "name", placeholder: "Como está no cartão" },
      ].map(f => (
        <div key={f.key}><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>{f.label}</label>
          <input value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} onFocus={() => setFocused(f.key)} onBlur={() => setFocused("")} style={inputSt(focused === f.key)} /></div>
      ))}
      <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Número do cartão</label>
        <input value={cardNumber} onChange={e => setCardNumber(maskCard(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" onFocus={() => setFocused("card")} onBlur={() => setFocused("")} style={inputSt(focused === "card")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Validade</label>
          <input value={expiry} onChange={e => setExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" onFocus={() => setFocused("exp")} onBlur={() => setFocused("")} style={inputSt(focused === "exp")} /></div>
        <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>CVV</label>
          <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" type="password" inputMode="numeric" onFocus={() => setFocused("cvv")} onBlur={() => setFocused("")} style={inputSt(focused === "cvv")} /></div>
      </div>
      <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>CPF do titular</label>
        <input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" onFocus={() => setFocused("cpf")} onBlur={() => setFocused("")} style={inputSt(focused === "cpf")} /></div>
      {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</div>}
      <button onClick={handleSubmit} disabled={loading} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><Loader2 size={18} className="animate-spin" /> Processando...</> : <><CreditCard size={18} /> Pagar agora</>}
      </button>
    </div>
  );
}

function PixForm({ paymentId, amount, payerEmail, onSuccess }: any) {
  const [cpf, setCpf] = useState(""); const [pix, setPix] = useState<any>(null); const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false); const [error, setError] = useState<string | null>(null); const [polling, setPolling] = useState(false); const [focused, setFocused] = useState(false);

  const generate = async () => {
    if (!cpf.replace(/\D/g, "")) { setError("Informe seu CPF."); return; }
    setLoading(true); setError(null);
    try {
      const result = await api("/api/payments/create-pix", { method: "POST", body: JSON.stringify({ payment_id: paymentId, payer_email: payerEmail, payer_cpf: cpf.replace(/\D/g, "") }) });
      setPix(result);
      let attempts = 0;
      setPolling(true);
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 60) { clearInterval(interval); setPolling(false); return; }
        try {
          const status = await api(`/api/payments/pix/status/${result.mp_payment_id}`);
          if (status?.status === "approved") { clearInterval(interval); onSuccess(); }
        } catch {}
      }, 5000);
    } catch (e: any) { setError(e.message || "Erro ao gerar Pix."); }
    finally { setLoading(false); }
  };

  const copy = () => { if (pix?.qr_code) { navigator.clipboard.writeText(pix.qr_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); } };

  if (pix) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      {pix.qr_code_base64 && <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR" style={{ width: 200, height: 200, borderRadius: 12, border: "1px solid #E5E7EB" }} />}
      <div style={{ width: "100%", background: "#F9FAFB", borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>Pix Copia e Cola</div>
        <div style={{ fontSize: 11, color: COLORS.dark, wordBreak: "break-all", marginBottom: 10 }}>{pix.qr_code?.slice(0, 60)}...</div>
        <button onClick={copy} style={{ width: "100%", background: copied ? "#059669" : COLORS.secondary, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {copied ? <><CheckCircle2 size={14} /> Copiado!</> : <><Copy size={14} /> Copiar código</>}
        </button>
      </div>
      {polling && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B7280" }}><Loader2 size={14} className="animate-spin" color={COLORS.primary} /> Aguardando pagamento...</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#1D4ED8", display: "flex", gap: 8 }}>
        <QrCode size={16} style={{ flexShrink: 0 }} /> O código Pix expira em 30 minutos.
      </div>
      <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Seu CPF</label>
        <input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputSt(focused)} /></div>
      {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</div>}
      <button onClick={generate} disabled={loading} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><Loader2 size={18} className="animate-spin" /> Gerando...</> : <><QrCode size={18} /> Gerar código Pix</>}
      </button>
    </div>
  );
}

function SuccessScreen({ therapist, date, time }: any) {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <CheckCircle2 size={40} color="#059669" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textAlign: "center" }}>Sessão confirmada!</div>
      <div style={{ fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 }}>
        Sua sessão com <strong>{therapist?.name}</strong> está confirmada para {date && fmtDate(date)} às {time}.
      </div>
      <button onClick={() => router.push("/mobile/dashboard")} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Ir para o dashboard
      </button>
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const appointmentId = params.get("appointment_id");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tab, setTab] = useState<"card" | "pix">("card");
  const [success, setSuccess] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) { try { const p = JSON.parse(atob(token.split(".")[1])); setUserEmail(p.sub || p.email || ""); } catch {} }
  }, []);

  useEffect(() => {
    if (!appointmentId) { setFetchError("Agendamento não encontrado."); setLoading(false); return; }
    api("/api/payments/create-payment-intent", { method: "POST", body: JSON.stringify({ appointment_id: Number(appointmentId) }) })
      .then(data => { setSession(data); if (data.already_paid) setSuccess(true); })
      .catch(e => setFetchError(e.message || "Erro ao carregar checkout."))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  useEffect(() => { if (seconds <= 0) return; const t = setInterval(() => setSeconds(s => s - 1), 1000); return () => clearInterval(t); }, [seconds]);
  useEffect(() => { if (seconds <= 0 && !success) router.push("/mobile/dashboard"); }, [seconds, success]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss2 = String(seconds % 60).padStart(2, "0");

  if (loading) return <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>;
  if (fetchError) return <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}><div style={{ fontSize: 15, color: "#DC2626", marginBottom: 16, textAlign: "center" }}>{fetchError}</div><button onClick={() => router.back()} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, cursor: "pointer" }}>Voltar</button></div>;
  if (success) return <SuccessScreen therapist={session?.therapist} date={session?.appointment_date} time={session?.appointment_time} />;

  const { payment_id, therapist, appointment_date, appointment_time, amount, wallet_balance, total_amount } = session;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Finalizar agendamento</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 10px", marginTop: 6, fontSize: 12, color: "white" }}>
          <Clock size={12} /> Reserva expira em {mm}:{ss2}
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 14, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {therapist?.photo_url ? <img src={getPhotoSrc(therapist.photo_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={24} color="#9CA3AF" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>{therapist?.name}</div>
              {therapist?.crp && <div style={{ fontSize: 12, color: "#9CA3AF" }}>CRP {therapist.crp}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary }}>{fmtCurrency(total_amount)}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{therapist?.session_duration_minutes || 50} min</div>
            </div>
          </div>
          <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#6B7280" }}>
            📅 {appointment_date && fmtDate(appointment_date)} às {appointment_time}
          </div>
          {wallet_balance > 0 && <div style={{ background: "#D1FAE5", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#065F46", marginTop: 8 }}>💰 Saldo usado: {fmtCurrency(wallet_balance)} — Restante: {fmtCurrency(amount)}</div>}
        </div>

        {payment_id ? (
          <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 4 }}>Forma de pagamento</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Escolha como deseja pagar</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ key: "card", label: "Cartão", icon: <CreditCard size={15} /> }, { key: "pix", label: "Pix", icon: <QrCode size={15} /> }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: "10px 0", border: `2px solid ${tab === t.key ? COLORS.primary : "#E5E7EB"}`, borderRadius: 10, background: tab === t.key ? "#FFF0F5" : "white", color: tab === t.key ? COLORS.primary : "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {tab === "card"
              ? <CardForm mpPublicKey={session.mp_public_key || MP_PUBLIC_KEY} paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} onError={() => {}} />
              : <PixForm paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} />}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              {["Mercado Pago", "SSL 256-bit", "PCI DSS"].map(b => <span key={b} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#F3F4F6", color: "#6B7280" }}>{b}</span>)}
            </div>
          </div>
        ) : (
          <div style={{ background: "#D1FAE5", borderRadius: 14, padding: 16, textAlign: "center", border: "0.5px solid #A7F3D0" }}>
            <CheckCircle2 size={32} color="#059669" style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#065F46" }}>Sessão paga com saldo da carteira!</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFF6FF", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#1D4ED8" }}>
          <Shield size={16} style={{ flexShrink: 0 }} /> Cancelamento gratuito até 24h antes da sessão.
        </div>
      </div>
    </div>
  );
}

export default function MobileCheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={32} className="animate-spin" color="#E03673" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
