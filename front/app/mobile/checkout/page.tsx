"use client";
// asaas-sessao-mobile v1: sessão avulsa pelo Asaas (cartão: POST /api/asaas/sessao/cartao; Pix: POST /api/asaas/sessao/pix).

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, QrCode, Copy, CheckCircle2, Loader2, Clock, Shield, User, Calendar, Wallet } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const COUNTDOWN = 10 * 60;

const fmtCurrency = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const getPhotoSrc = (url: string | null) => !url ? "/avatar-placeholder.png" : url.startsWith("http") ? url : `https://api.meudivaonline.com${url}`;
const maskCard = (v: string) => v.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim().slice(0, 19);
const maskExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };
const maskCpf = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`; if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`; return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`; };
const maskCep = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d; };
const maskPhone = (v: string) => {
  let d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};
function cpfValido(raw: string): boolean {
  const d = raw.replace(/\D/g, ""); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
const inputSt = (f?: boolean) => ({ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 15, border: `1.5px solid ${f ? COLORS.primary : "#E5E7EB"}`, outline: "none", background: "white", color: COLORS.dark, boxSizing: "border-box" as const });
const labelSt = { fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" } as const;

function CardForm({ paymentId, onSuccess }: any) {
  const [name, setName] = useState(""); const [cpf, setCpf] = useState(""); const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState(""); const [cvv, setCvv] = useState("");
  const [cep, setCep] = useState(""); const [rua, setRua] = useState(""); const [addrNumber, setAddrNumber] = useState("");
  const [complemento, setComplemento] = useState(""); const [bairro, setBairro] = useState(""); const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [naoRepetir, setNaoRepetir] = useState(false);
  const [error, setError] = useState<string | null>(null); const [focused, setFocused] = useState("");
  const numeroRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<any>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  const [avisoCep, setAvisoCep] = useState<string | null>(null); const [buscandoCep, setBuscandoCep] = useState(false);

  // Mesma lógica dos perfis: ao completar o CEP busca o endereço e preenche rua, bairro, cidade e UF (editáveis)
  useEffect(() => {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) { setAvisoCep(null); return; }
    let ativo = true;
    setBuscandoCep(true);
    (async () => {
      try {
        const r: any = await api(`/api/patients/cep/${d}`, { silent: true } as any);
        if (!ativo) return;
        if (r && !r.erro) {
          setRua(r.logradouro || ""); setBairro(r.bairro || ""); setCidade(r.localidade || ""); setUf(String(r.uf || "").toUpperCase());
          setAvisoCep(null); numeroRef.current?.focus();
        } else setAvisoCep("CEP não encontrado. Preencha o endereço manualmente.");
      } catch (e: any) {
        if (!ativo) return;
        setAvisoCep(String(e?.message || "").includes("não encontrado") ? "CEP não encontrado. Preencha o endereço manualmente." : "Não foi possível buscar o endereço agora. Preencha manualmente.");
      } finally { if (ativo) setBuscandoCep(false); }
    })();
    return () => { ativo = false; };
  }, [cep]);

  const f = (k: string) => ({ onFocus: () => setFocused(k), onBlur: () => setFocused(""), style: inputSt(focused === k) });

  const handleSubmit = useCallback(async () => {
    if (loading || naoRepetir) return;
    if (name.trim().split(/\s+/).length < 2) { setError("Informe nome e sobrenome, como estão no cartão."); return; }
    if (cardNumber.replace(/\s/g, "").length < 13) { setError("Número do cartão inválido."); return; }
    if (expiry.length < 5) { setError("Validade inválida."); return; }
    if (cvv.length < 3) { setError("CVV inválido."); return; }
    if (!cpfValido(cpf)) { setError("CPF inválido. Confira os números."); return; }
    if (cep.replace(/\D/g, "").length !== 8) { setError("CEP inválido."); return; }
    if (rua.trim().length < 3) { setError("Informe a rua do endereço."); return; }
    if (!addrNumber.trim()) { setError("Informe o número do endereço (ou S/N)."); return; }
    if (cidade.trim().length < 2) { setError("Informe a cidade."); return; }
    if (!/^[A-Za-z]{2}$/.test(uf.trim())) { setError("Informe o estado (UF)."); return; }
    { const ph = phone.replace(/\D/g, ""); if (ph.length !== 11 || ph[2] !== "9") { setError("Celular inválido. Informe o DDD e o número com 9 dígitos, sem +55."); return; } }
    setLoading(true); setError(null);
    try {
      const result: any = await api("/api/asaas/sessao/cartao", { method: "POST", body: JSON.stringify({
        payment_id: paymentId,
        cartao: { nome: name.trim(), numero: cardNumber.replace(/\s/g, ""), validade: expiry, ccv: cvv },
        titular: { cpf: cpf.replace(/\D/g, ""), cep: cep.replace(/\D/g, ""), rua: rua.trim(), numero: addrNumber.trim(), complemento: complemento.trim(), bairro: bairro.trim(), cidade: cidade.trim(), uf: uf.trim().toUpperCase(), celular: phone.replace(/\D/g, "") },
      }) });
      setCardNumber(""); setCvv("");
      // A recusa volta com HTTP 200 e status "rejected"
      if (result?.status === "approved") onSuccess();
      else if (result?.status === "pending") {
        // Confirmando com o banco: consulta o status a cada 3 s por ~2 min e trava o botão para não cobrar duas vezes
        setNaoRepetir(true);
        setError("Confirmando com o banco… aguarde alguns instantes. Não tente de novo: sua sessão é confirmada sozinha se o pagamento passar.");
        let n = 0;
        pollRef.current = setInterval(async () => {
          n++;
          if (n > 40) { clearInterval(pollRef.current); return; }
          try {
            const s: any = await api(`/api/payments/status/${paymentId}`, { silent: true } as any);
            if (s?.status === "paid" || !!s?.paid_at) { clearInterval(pollRef.current); onSuccess(); }
          } catch {}
        }, 3000);
      }
      else setError(result?.detail || "Pagamento não aprovado. Tente outro cartão.");
    } catch (e: any) {
      // 504 (timeout do Asaas): NÃO repetir, a sessão confirma sozinha se o pagamento tiver passado
      if (e?.status === 504) { setNaoRepetir(true); setError("O pagamento está sendo confirmado. Não tente de novo: se tiver passado, sua sessão é confirmada sozinha em instantes."); }
      else setError(e?.message || "Não foi possível processar o pagamento agora.");
    } finally { setLoading(false); }
  }, [loading, naoRepetir, name, cpf, cardNumber, expiry, cvv, cep, rua, addrNumber, complemento, bairro, cidade, uf, phone, paymentId, onSuccess]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><label style={labelSt}>Nome no cartão</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Como está no cartão" autoComplete="cc-name" {...f("name")} /></div>
      <div><label style={labelSt}>CPF do titular</label>
        <input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" {...f("cpf")} /></div>
      <div><label style={labelSt}>Número do cartão</label>
        <input value={cardNumber} onChange={e => setCardNumber(maskCard(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" {...f("card")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelSt}>Validade</label>
          <input value={expiry} onChange={e => setExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" {...f("exp")} /></div>
        <div><label style={labelSt}>CVV</label>
          <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" type="password" inputMode="numeric" autoComplete="cc-csc" {...f("cvv")} /></div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>Endereço do titular do cartão</div>
      <div><label style={labelSt}>CEP *</label>
        <input value={cep} onChange={e => setCep(maskCep(e.target.value))} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" {...f("cep")} />
        {(buscandoCep || avisoCep) && <div style={{ fontSize: 12, marginTop: 6, color: avisoCep ? "#b45309" : "#6b7280" }}>{buscandoCep ? "Buscando endereço…" : avisoCep}</div>}
      </div>
      <div><label style={labelSt}>Rua *</label>
        <input value={rua} onChange={e => setRua(e.target.value)} autoComplete="address-line1" {...f("rua")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelSt}>Número *</label>
          <input ref={numeroRef} value={addrNumber} onChange={e => setAddrNumber(e.target.value.slice(0, 10))} placeholder="123 ou S/N" {...f("num")} /></div>
        <div><label style={labelSt}>Complemento</label>
          <input value={complemento} onChange={e => setComplemento(e.target.value.slice(0, 60))} placeholder="Apto, bloco, sala" autoComplete="address-line2" {...f("comp")} /></div>
      </div>
      <div><label style={labelSt}>Bairro</label>
        <input value={bairro} onChange={e => setBairro(e.target.value)} {...f("bairro")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
        <div><label style={labelSt}>Cidade *</label>
          <input value={cidade} onChange={e => setCidade(e.target.value)} autoComplete="address-level2" {...f("cidade")} /></div>
        <div><label style={labelSt}>UF *</label>
          <input value={uf} onChange={e => setUf(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))} maxLength={2} placeholder="MG" autoComplete="address-level1" {...f("uf")} /></div>
      </div>
      <div><label style={labelSt}>Celular do titular</label>
        <input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" {...f("phone")} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>O endereço e o celular do titular são exigidos pelo Asaas para liberar a cobrança no cartão. No celular, informe só o DDD e o número, sem +55.</div>
      </div>

      {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</div>}
      <button onClick={handleSubmit} disabled={loading || naoRepetir} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: loading || naoRepetir ? "not-allowed" : "pointer", opacity: loading || naoRepetir ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><Loader2 size={18} className="animate-spin" /> Processando...</> : <><CreditCard size={18} /> Pagar agora</>}
      </button>
    </div>
  );
}

function PixForm({ paymentId, onSuccess }: any) {
  const [cpf, setCpf] = useState(""); const [pix, setPix] = useState<any>(null); const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false); const [error, setError] = useState<string | null>(null); const [polling, setPolling] = useState(false); const [focused, setFocused] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const generate = async () => {
    if (!cpfValido(cpf)) { setError("CPF inválido. Confira os números."); return; }
    setLoading(true); setError(null);
    try {
      const result: any = await api("/api/asaas/sessao/pix", { method: "POST", body: JSON.stringify({ payment_id: paymentId, payer_cpf: cpf.replace(/\D/g, "") }) });
      setPix(result);
      let attempts = 0;
      setPolling(true);
      intervalRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 60) { clearInterval(intervalRef.current); setPolling(false); return; }
        try {
          const s: any = await api(`/api/payments/status/${paymentId}`, { silent: true } as any);
          if (!!s?.paid_at || s?.status === "paid" || s?.status === "approved") { clearInterval(intervalRef.current); setPolling(false); onSuccess(); }
        } catch {}
      }, 5000);
    } catch (e: any) {
      if (e?.status === 504) setError("A geração do Pix demorou. Aguarde um instante antes de tentar de novo.");
      else setError(e?.message || "Erro ao gerar Pix.");
    } finally { setLoading(false); }
  };

  const copy = () => { if (pix?.qr_code) { navigator.clipboard.writeText(pix.qr_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); } };
  const expira = pix?.expires_at ? new Date(pix.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

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
      {expira && <div style={{ fontSize: 12, color: "#6B7280" }}>Este código expira às {expira}.</div>}
      {polling && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B7280" }}><Loader2 size={14} className="animate-spin" color={COLORS.primary} /> Aguardando pagamento...</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#1D4ED8", display: "flex", gap: 8 }}>
        <QrCode size={16} style={{ flexShrink: 0 }} /> Gere o código, pague no app do seu banco e a sessão é confirmada sozinha.
      </div>
      <div><label style={labelSt}>Seu CPF</label>
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
            <Calendar size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{appointment_date && fmtDate(appointment_date)} às {appointment_time}
          </div>
          {wallet_balance > 0 && <div style={{ background: "#D1FAE5", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#065F46", marginTop: 8 }}><Wallet size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Saldo usado: {fmtCurrency(wallet_balance)} — Restante: {fmtCurrency(amount)}</div>}
        </div>

        {payment_id ? (
          <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 4 }}>Forma de pagamento</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Escolha como deseja pagar</div>
            {Number(amount) > 0 && Number(amount) < 5 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 16 }}>
                O valor mínimo de cobrança é R$ 5,00. A diferença fica como saldo na sua carteira.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ key: "card", label: "Cartão", icon: <CreditCard size={15} /> }, { key: "pix", label: "Pix", icon: <QrCode size={15} /> }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: "10px 0", border: `2px solid ${tab === t.key ? COLORS.primary : "#E5E7EB"}`, borderRadius: 10, background: tab === t.key ? "#FFF0F5" : "white", color: tab === t.key ? COLORS.primary : "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {tab === "card"
              ? <CardForm paymentId={payment_id} onSuccess={() => setSuccess(true)} />
              : <PixForm paymentId={payment_id} onSuccess={() => setSuccess(true)} />}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              {["Asaas", "Conexão segura", "Não guardamos seu cartão"].map(b => <span key={b} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#F3F4F6", color: "#6B7280" }}>{b}</span>)}
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
