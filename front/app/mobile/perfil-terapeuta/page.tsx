"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Camera, CheckCircle, AlertCircle, Loader2, Save,
  Mail, IdCard, Eye, EyeOff, Star, CreditCard, Search, Shield, Heart, Home, Plus, Trash2
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const BACKEND_URL = "https://api.meudivaonline.com";

function SignatureModal({ onClose, onSuccess, onError }: { onClose:()=>void; onSuccess:(url:string)=>void; onError:(msg:string)=>void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{x:number;y:number}|null>(null);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ratio=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*ratio; canvas.height=rect.height*ratio;
    const ctx=canvas.getContext("2d");
    if(ctx){ctx.scale(ratio,ratio);ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#111827";}
  },[]);

  const getPos=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=canvasRef.current!.getBoundingClientRect();
    return {x:e.clientX-rect.left,y:e.clientY-rect.top};
  };

  const handleSave=async()=>{
    const canvas=canvasRef.current; if(!canvas||isEmpty)return;
    setSaving(true);
    try{
      const blob:Blob|null=await new Promise(r=>canvas.toBlob(r,"image/png"));
      if(!blob)throw new Error("Erro ao gerar assinatura");
      const file=new File([blob],`signature-${Date.now()}.png`,{type:"image/png"});
      const fd=new FormData(); fd.append("file",file,file.name);
      const token=localStorage.getItem("access_token");
      const res=await fetch(`${BACKEND_URL}/api/therapists/me/profile/signature`,{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{},body:fd});
      const data=await res.json();
      if(!res.ok)throw new Error(data.detail||"Erro ao salvar");
      onSuccess(data.signature_url); onClose();
    }catch(e:any){onError(e.message||"Erro ao salvar assinatura");}
    finally{setSaving(false);}
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50}}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:480}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:16,fontWeight:600,color:"#111827"}}>Assinatura digital</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:20}}>✕</button>
        </div>
        <div style={{fontSize:13,color:"#6B7280",marginBottom:10}}>Assine com o dedo ou mouse abaixo.</div>
        <canvas ref={canvasRef}
          style={{width:"100%",height:200,border:"2px dashed #D1D5DB",borderRadius:12,background:"white",touchAction:"none",display:"block"}}
          onPointerDown={e=>{e.preventDefault();canvasRef.current?.setPointerCapture(e.pointerId);drawingRef.current=true;lastPointRef.current=getPos(e);}}
          onPointerMove={e=>{if(!drawingRef.current)return;e.preventDefault();const ctx=canvasRef.current?.getContext("2d");const pos=getPos(e);if(ctx&&lastPointRef.current){ctx.beginPath();ctx.moveTo(lastPointRef.current.x,lastPointRef.current.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();}lastPointRef.current=pos;setIsEmpty(false);}}
          onPointerUp={()=>{drawingRef.current=false;lastPointRef.current=null;}}
          onPointerLeave={()=>{drawingRef.current=false;lastPointRef.current=null;}}
        />
        <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:14}}>
          <button onClick={()=>{const ctx=canvasRef.current?.getContext("2d");const c=canvasRef.current;if(ctx&&c)ctx.clearRect(0,0,c.width,c.height);setIsEmpty(true);}}
            disabled={isEmpty||saving}
            style={{flex:1,background:"white",border:"1px solid #E5E7EB",borderRadius:10,padding:"11px 0",fontSize:14,cursor:"pointer",opacity:isEmpty?0.4:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            Limpar
          </button>
          <button onClick={handleSave} disabled={isEmpty||saving}
            style={{flex:2,background:"#E03673",color:"white",border:"none",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:600,cursor:"pointer",opacity:isEmpty||saving?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {saving?<><Loader2 size={16} className="animate-spin"/>Salvando...</>:<>Salvar assinatura</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputSt: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:14, outline:"none", background:"white", boxSizing:"border-box" };
const textareaSt: React.CSSProperties = { ...inputSt, resize:"vertical" as const, minHeight:90 };

const APPROACHES = ["Psicanálise","TCC","Humanista","Gestalt","Sistêmica","Psicodrama","Cognitivo-Comportamental","Fenomenológica","Junguiana","Logoterapia","ACT","DBT","EMDR","Neuropsicanálise","Terapia de Casal","Terapia Familiar"];
const REASONS = ["Ansiedade","Depressão","Estresse","Burnout","Relacionamentos","Luto","Autoestima","Autoconhecimento","Trabalho e carreira","Conflitos familiares","Sexualidade","Trauma","Fobias","TOC","Pânico","Dependência Química","Gênero","Abuso"];
const SERVICE_MODALITIES = ["Atendimento individual","Atendimento de casal","Atendimento familiar","Atendimento em grupo","Atendimento corporativo"];
const LANGUAGES = ["Português","Inglês","Espanhol","Francês","Alemão","Italiano","Mandarim","Japonês"];
const SERVICE_TYPES = ["Psicólogo(a)","Psicanalista","Coach","Nutricionista","Psiquiatra","Terapeuta"];
const PIX_TYPES = [{value:"cpf",label:"CPF"},{value:"cnpj",label:"CNPJ"},{value:"email",label:"E-mail"},{value:"phone",label:"Telefone"},{value:"random",label:"Chave aleatória"}];

type Section = "perfil"|"especialidades"|"busca"|"enderecos"|"financeiro"|"conta";

function TherapistAddressTab() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [form, setForm] = useState({ street:"", number:"", complement:"", neighborhood:"", city:"", state:"", zipcode:"", country:"Brasil", address_type:"residential", is_default:false });

  useEffect(()=>{ load(); },[]);

  async function load() {
    try { const d=await api("/api/therapists/me/address"); setAddresses(d||[]); }
    catch {} finally { setLoading(false); }
  }

  async function lookupCep(cep: string) {
    const clean=cep.replace(/\D/g,""); if(clean.length!==8)return;
    setCepLoading(true);
    try {
      const d=await api(`/api/patients/cep/${clean}`);
      if(d&&!d.erro) setForm(f=>({...f,street:d.logradouro||"",neighborhood:d.bairro||"",city:d.localidade||"",state:d.uf||"",zipcode:cep}));
    } catch {} finally { setCepLoading(false); }
  }

  async function handleSubmit() {
    if(!form.street||!form.city||!form.state||!form.zipcode){setError("Preencha os campos obrigatórios.");return;}
    setSaving(true); setError("");
    try {
      if(editingId) await api(`/api/therapists/me/address/${editingId}`,{method:"PUT",body:JSON.stringify(form)});
      else await api("/api/therapists/me/address",{method:"POST",body:JSON.stringify(form)});
      await load(); setShowForm(false); setEditingId(null);
      setForm({street:"",number:"",complement:"",neighborhood:"",city:"",state:"",zipcode:"",country:"Brasil",address_type:"residential",is_default:false});
    } catch(e:any){setError(e.message||"Erro ao salvar.");}
    finally {setSaving(false);}
  }

  async function handleDelete(id: number) {
    try { await api(`/api/therapists/me/address/${id}`,{method:"DELETE"}); await load(); }
    catch(e:any){setError(e.message||"Erro ao remover.");}
  }

  async function handleSetDefault(id: number) {
    try { await api(`/api/therapists/me/address/${id}/default`,{method:"PUT"}); await load(); }
    catch {}
  }

  function startEdit(addr: any) {
    setForm({street:addr.street,number:addr.number||"",complement:addr.complement||"",neighborhood:addr.neighborhood||"",city:addr.city,state:addr.state,zipcode:addr.zipcode,country:addr.country||"Brasil",address_type:addr.address_type||"residential",is_default:addr.is_default});
    setEditingId(addr.id); setShowForm(true);
  }

  const inputSt2: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:14, outline:"none", background:"white", boxSizing:"border-box" };

  if(loading) return <div style={{textAlign:"center",padding:32}}><Loader2 size={24} className="animate-spin" color="#E03673" /></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {error && <div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:10,padding:"10px 14px",fontSize:13}}>{error}</div>}
      {!showForm && (
        <button onClick={()=>setShowForm(true)}
          style={{background:"#E03673",color:"white",border:"none",borderRadius:12,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Plus size={16}/> Novo endereço
        </button>
      )}
      {showForm && (
        <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
          <div style={{fontSize:14,fontWeight:600,color:"#3A3B21",marginBottom:14}}>{editingId?"Editar":"Novo endereço"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>CEP *</label>
              <div style={{position:"relative"}}>
                <input value={form.zipcode} onChange={e=>{setForm(f=>({...f,zipcode:e.target.value}));lookupCep(e.target.value);}} placeholder="00000-000" inputMode="numeric" style={inputSt2}/>
                {cepLoading && <Loader2 size={14} className="animate-spin" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}} color="#E03673"/>}
              </div>
            </div>
            <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Rua *</label><input value={form.street} onChange={e=>setForm(f=>({...f,street:e.target.value}))} style={inputSt2}/></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Número</label><input value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))} style={inputSt2}/></div>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Complemento</label><input value={form.complement} onChange={e=>setForm(f=>({...f,complement:e.target.value}))} style={inputSt2}/></div>
            </div>
            <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Bairro *</label><input value={form.neighborhood} onChange={e=>setForm(f=>({...f,neighborhood:e.target.value}))} style={inputSt2}/></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Cidade *</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inputSt2}/></div>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Estado *</label><input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} maxLength={2} style={inputSt2}/></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setForm(f=>({...f,is_default:!f.is_default}))}
                style={{width:44,height:24,borderRadius:12,background:form.is_default?"#E03673":"#D1D5DB",border:"none",cursor:"pointer",position:"relative",flexShrink:0}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form.is_default?23:3,transition:"left 0.2s"}}/>
              </button>
              <span style={{fontSize:14,color:"#3A3B21"}}>Endereço padrão</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowForm(false);setEditingId(null);}} style={{flex:1,background:"#F3F4F6",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{flex:1,background:"#E03673",color:"white",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {saving?<Loader2 size={14} className="animate-spin"/>:"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {addresses.length===0&&!showForm ? (
        <div style={{background:"white",borderRadius:14,padding:32,textAlign:"center",border:"0.5px solid #E5E7EB"}}>
          <Home size={32} color="#D1D5DB" style={{margin:"0 auto 8px"}}/><div style={{fontSize:13,color:"#9CA3AF"}}>Nenhum endereço cadastrado</div>
        </div>
      ) : addresses.map(addr=>(
        <div key={addr.id} style={{background:"white",borderRadius:14,padding:14,border:`1px solid ${addr.is_default?"#E03673"+"40":"#E5E7EB"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Home size={16} color="#E03673"/>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#3A3B21"}}>{addr.street}{addr.number?`, ${addr.number}`:""}</div>
                <div style={{fontSize:12,color:"#6B7280"}}>{addr.neighborhood} · {addr.city}/{addr.state}</div>
                <div style={{fontSize:11,color:"#9CA3AF"}}>CEP: {addr.zipcode}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              {!addr.is_default&&<button onClick={()=>handleSetDefault(addr.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11}}>⭐</button>}
              <button onClick={()=>startEdit(addr)} style={{background:"#EFF6FF",border:"none",borderRadius:8,padding:"4px 8px",fontSize:12,color:"#2F80D3",cursor:"pointer"}}>Editar</button>
              <button onClick={()=>handleDelete(addr.id)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"4px 8px",fontSize:12,color:"#DC2626",cursor:"pointer"}}><Trash2 size={12}/></button>
            </div>
          </div>
          {addr.is_default&&<span style={{fontSize:11,background:"#E03673"+"15",color:"#E03673",padding:"2px 8px",borderRadius:20,fontWeight:600}}>Padrão</span>}
        </div>
      ))}
    </div>
  );
}

function AccordionSection({ title, icon: Icon, open, onToggle, children }: { title:string; icon:any; open:boolean; onToggle:()=>void; children:React.ReactNode }) {
  return (
    <div style={{ background:"white", borderRadius:14, border:`1px solid ${open?"#E03673":"#E5E7EB"}`, overflow:"hidden" }}>
      <button onClick={onToggle} style={{ width:"100%", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:open?"#E03673":"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon size={16} color={open?"white":"#6B7280"} />
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:"#3A3B21" }}>{title}</span>
        </div>
        <span style={{ color:"#9CA3AF", fontSize:18, lineHeight:1 }}>{open?"−":"+"}</span>
      </button>
      {open && <div style={{ padding:"0 16px 16px", borderTop:"0.5px solid #F3F4F6" }}>{children}</div>}
    </div>
  );
}

function CheckboxGroup({ options, selected, onChange }: { options: string[], selected: string[], onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(x=>x!==opt) : [...selected, opt]);
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
      {options.map(opt => (
        <button key={opt} onClick={()=>toggle(opt)}
          style={{ padding:"6px 12px", borderRadius:20, border:`1.5px solid ${selected.includes(opt) ? COLORS.primary : "#E5E7EB"}`, background:selected.includes(opt) ? COLORS.primary+"15" : "white", color:selected.includes(opt) ? COLORS.primary : "#374151", fontSize:12, cursor:"pointer" }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function PerfilTerapeutaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [openSection, setOpenSection] = useState<Section|null>("perfil");
  const toggleSection = (s: Section) => setOpenSection(prev => prev === s ? null : s);
  const [userData, setUserData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCpf, setShowCpf] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [form, setForm] = useState<any>({
    full_name:"", bio:"", crp:"", professional_type:"", therapeutic_approach:"",
    integrative_practice:"", target_audience:"", demand_focus:"", specialties:"",
    session_price:"", experiencia:"", treatment:"",
    approaches:[], specialties_list:[], reasons:[], service_types:[], languages_list:[], service_modalities:[],
    gender:"", ethnicity:"", lgbtqia_ally:false, formation:"", education_level:"",
    session_duration_30min:true, session_duration_50min:true, custom_session_duration:"",
    instagram_url:"", phone:"", birth_date:"",
    show_phone_to_patients:false, show_birth_date_to_patients:false,
    pix_key_type:"", pix_key:"", bank_agency:"", bank_account:"", bank_account_digit:"",
    cpf:"", cnpj:"", accepts_corporate_sessions:false,
    _showDeletion:false,
    lgpd_consent:false,
    lgpd_consent_date:"",
  });

  const set = (k: string, v: any) => setForm((f: any) => ({...f, [k]: v}));

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [ud, pd] = await Promise.all([api("/api/users/me"), api("/api/therapists/me/profile")]);
      setUserData(ud); setProfile(pd);
      setForm((f: any) => ({
        ...f,
        full_name: ud.full_name || "",
        bio: pd.bio || "",
        specialties: pd.specialties || "",
        integrative_practice: pd.integrative_practice || "",
        target_audience: pd.target_audience || "",
        demand_focus: pd.demand_focus || "",
        crp: pd.crp || "",
        professional_type: pd.professional_type || "",
        therapeutic_approach: pd.therapeutic_approach || "",
        session_price: pd.session_price || "",
        experiencia: pd.experiencia || "",
        treatment: pd.treatment || "",
        approaches: pd.approaches || [],
        specialties_list: pd.specialties_list || [],
        reasons: pd.reasons || [],
        service_types: pd.service_types || [],
        languages_list: pd.languages_list || [],
        service_modalities: pd.service_modalities || [],
        gender: pd.gender || "",
        ethnicity: pd.ethnicity || "",
        lgbtqia_ally: pd.lgbtqia_ally || false,
        formation: pd.formation || "",
        education_level: pd.education_level || "",
        session_duration_30min: pd.session_duration_30min !== false,
        session_duration_50min: pd.session_duration_50min !== false,
        custom_session_duration: pd.custom_session_duration || "",
        instagram_url: pd.instagram_url || "",
        phone: pd.phone || "",
        birth_date: pd.birth_date ? pd.birth_date.split("T")[0] : "",
        show_phone_to_patients: pd.show_phone_to_patients || false,
        show_birth_date_to_patients: pd.show_birth_date_to_patients || false,
        pix_key_type: pd.pix_key_type || "",
        pix_key: pd.pix_key || "",
        bank_agency: pd.bank_agency || "",
        bank_account: pd.bank_account || "",
        bank_account_digit: pd.bank_account_digit || "",
        cpf: pd.cpf || "",
        cnpj: pd.cnpj || "",
        accepts_corporate_sessions: pd.accepts_corporate_sessions || false,
        lgpd_consent: pd.lgpd_consent || false,
        lgpd_consent_date: pd.lgpd_consent_date || "",
      }));
    } catch { setError("Erro ao carregar perfil."); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess("");
    try {
      // Salvar nome separadamente se mudou
      await api("/api/therapists/me/profile", { method: "POST", body: JSON.stringify({
        ...form,
        session_price: form.session_price ? Number(form.session_price) : null,
        custom_session_duration: form.custom_session_duration ? Number(form.custom_session_duration) : null,
      }) });
      setSuccess("Perfil salvo com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message || "Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${BACKEND_URL}/api/therapists/me/photo`, { method:"POST", headers:{Authorization:`Bearer ${token}`}, body:fd });
      if(!res.ok) throw new Error("Erro ao enviar foto");
      await load(); setSuccess("Foto atualizada!"); setTimeout(()=>setSuccess(""),3000);
    } catch (e: any) { setError(e.message || "Erro ao enviar foto."); }
    finally { setUploadingPhoto(false); }
  }

  async function handleEmailChange() {
    setEmailSaving(true); setEmailError("");
    try {
      await api("/api/auth/change-email", { method:"POST", body:JSON.stringify({ new_email:newEmail, password:emailPassword }) });
      setUserData((prev: any) => ({...prev, email:newEmail}));
      setShowEmailModal(false); setNewEmail(""); setEmailPassword("");
      setSuccess("E-mail alterado! Verifique sua caixa de entrada.");
      setTimeout(()=>setSuccess(""),5000);
    } catch (e: any) { setEmailError(e.message || "Erro ao alterar e-mail."); }
    finally { setEmailSaving(false); }
  }

  const fotoUrl = profile?.foto_url ? (profile.foto_url.startsWith("http") ? profile.foto_url : `${BACKEND_URL}${profile.foto_url}`) : null;

  const TABS: {key:Tab; label:string; icon:any}[] = [
    {key:"perfil", label:"Perfil", icon:User},
    {key:"especialidades", label:"Especialidades", icon:Star},
    {key:"busca", label:"Busca", icon:Search},
    {key:"enderecos", label:"Endereços", icon:Home},
    {key:"financeiro", label:"Financeiro", icon:CreditCard},
    {key:"conta", label:"Conta", icon:Shield},
  ];

  if (loading) return <div style={{ minHeight:"100vh", background:"#f7f0f5", display:"flex", alignItems:"center", justifyContent:"center" }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>;

  return (
    <div style={{ minHeight:"100vh", background:"#f7f0f5", paddingBottom:100 }}>
      <div style={{ background:COLORS.primary, padding:"16px 16px 0" }}>
        <button onClick={()=>router.push('/mobile/dashboard')} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, padding:"6px 10px", color:"white", display:"flex", alignItems:"center", gap:6, marginBottom:12, cursor:"pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color:"white", fontSize:20, fontWeight:600 }}>Meu Perfil</div>
        <div style={{ color:"rgba(255,255,255,0.8)", fontSize:13, marginTop:4 }}>Toque em cada seção para expandir</div>
      </div>

      <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        {error && <div style={{ background:"#FEE2E2", color:"#991B1B", borderRadius:10, padding:"10px 14px", fontSize:13, display:"flex", gap:8, alignItems:"center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background:"#D1FAE5", color:"#065F46", borderRadius:10, padding:"10px 14px", fontSize:13, display:"flex", gap:8, alignItems:"center" }}><CheckCircle size={16} /> {success}</div>}

        {/* ACORDEÃO */}

        <div style={{ background:"white", borderRadius:14, padding:16, border:"0.5px solid #E5E7EB", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <div style={{ width:72, height:72, borderRadius:"50%", overflow:"hidden", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid rgba(224,54,115,0.3)" }}>
              {fotoUrl ? <img src={fotoUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <User size={32} color="#9CA3AF" />}
            </div>
            <button onClick={()=>fileRef.current?.click()} disabled={uploadingPhoto}
              style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", background:COLORS.primary, border:"2px solid white", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              {uploadingPhoto ? <Loader2 size={12} className="animate-spin" color="white" /> : <Camera size={12} color="white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:COLORS.dark }}>{userData?.full_name}</div>
            <div style={{ fontSize:12, color:"#9CA3AF" }}>Terapeuta</div>
            {profile?.verified && <div style={{ fontSize:12, color:"#059669", display:"flex", alignItems:"center", gap:4 }}><CheckCircle size={12} /> Verificado</div>}
          </div>
        </div>

        <AccordionSection title="Perfil Profissional" icon={User} open={openSection==="perfil"} onToggle={()=>toggleSection("perfil")}>
          <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:12 }}>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Nome completo</label><input value={form.full_name} onChange={e=>set("full_name",e.target.value)} style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>CRP</label><input value={form.crp} onChange={e=>set("crp",e.target.value)} placeholder="00/00000" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Tipo de profissional</label>
              <select value={form.professional_type} onChange={e=>set("professional_type",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{SERVICE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Tratamento</label>
              <select value={form.treatment} onChange={e=>set("treatment",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{["Dr.","Dra.","Sr.","Sra."].map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Valor da sessão (R$)</label><input value={form.session_price} onChange={e=>set("session_price",e.target.value)} inputMode="decimal" placeholder="200.00" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Bio / Apresentação</label><textarea value={form.bio} onChange={e=>set("bio",e.target.value)} style={textareaSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Experiência</label><textarea value={form.experiencia} onChange={e=>set("experiencia",e.target.value)} style={textareaSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Especialidades (texto livre)</label><input value={form.specialties} onChange={e=>set("specialties",e.target.value)} placeholder="Ex: Ansiedade, TCC" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Prática integrativa</label><input value={form.integrative_practice} onChange={e=>set("integrative_practice",e.target.value)} style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Público-alvo</label><input value={form.target_audience} onChange={e=>set("target_audience",e.target.value)} placeholder="Ex: Adultos, Adolescentes" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Foco de demanda</label><input value={form.demand_focus} onChange={e=>set("demand_focus",e.target.value)} style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Nível de formação</label>
              <select value={form.education_level} onChange={e=>set("education_level",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{["Ensino Superior completo","Pós-graduação (especialização)","Mestrado","Doutorado"].map(e=><option key={e} value={e}>{e}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Instagram</label><input value={form.instagram_url} onChange={e=>set("instagram_url",e.target.value)} placeholder="@seuinstagram" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Vídeo (URL)</label><input value={form.video_url||""} onChange={e=>set("video_url",e.target.value)} placeholder="https://youtube.com/..." style={inputSt} /></div>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Assinatura digital</label>
              {form.signature_url ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <img src={form.signature_url.startsWith("http") ? form.signature_url : BACKEND_URL+form.signature_url} alt="Assinatura" style={{ height:48, border:"1px solid #E5E7EB", borderRadius:8, background:"white", padding:4 }} />
                  <button onClick={()=>setShowSignature(true)} style={{ background:"none", border:"none", color:COLORS.secondary, fontSize:13, cursor:"pointer" }}>Refazer</button>
                </div>
              ) : (
                <button onClick={()=>setShowSignature(true)} style={{ background:"#F9FAFB", border:"1.5px dashed #E5E7EB", borderRadius:10, padding:"12px 0", width:"100%", fontSize:13, color:"#6B7280", cursor:"pointer" }}>+ Adicionar assinatura digital</button>
              )}
            </div>
            <div style={{ borderTop:"0.5px solid #F3F4F6", paddingTop:12 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:10 }}>Duração das sessões</div>
              {[{key:"session_duration_30min",label:"30 minutos"},{key:"session_duration_50min",label:"50 minutos"}].map(d=>(
                <div key={d.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:14, color:COLORS.dark }}>{d.label}</span>
                  <button onClick={()=>set(d.key,!form[d.key])} style={{ width:44, height:24, borderRadius:12, background:form[d.key]?COLORS.primary:"#D1D5DB", border:"none", cursor:"pointer", position:"relative" }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, left:form[d.key]?23:3, transition:"left 0.2s" }} />
                  </button>
                </div>
              ))}
              <input value={form.custom_session_duration} onChange={e=>set("custom_session_duration",e.target.value)} inputMode="numeric" placeholder="Duração personalizada (ex: 45)" style={inputSt} />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="Especialidades" icon={Star} open={openSection==="especialidades"} onToggle={()=>toggleSection("especialidades")}>
          <div style={{ display:"flex", flexDirection:"column", gap:14, paddingTop:12 }}>
            <div><div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>Abordagens</div><CheckboxGroup options={APPROACHES} selected={form.approaches} onChange={v=>set("approaches",v)} /></div>
            <div><div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>Especialidades</div><CheckboxGroup options={REASONS.slice(0,10)} selected={form.specialties_list} onChange={v=>set("specialties_list",v)} /></div>
            <div><div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>Motivos que atende</div><CheckboxGroup options={REASONS} selected={form.reasons} onChange={v=>set("reasons",v)} /></div>
            <div><div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>Modalidades</div><CheckboxGroup options={SERVICE_MODALITIES} selected={form.service_modalities} onChange={v=>set("service_modalities",v)} /></div>
            <div><div style={{ fontSize:13, fontWeight:600, color:COLORS.dark, marginBottom:8 }}>Idiomas</div><CheckboxGroup options={LANGUAGES} selected={form.languages_list} onChange={v=>set("languages_list",v)} /></div>
          </div>
        </AccordionSection>

        <AccordionSection title="Busca Avançada" icon={Search} open={openSection==="busca"} onToggle={()=>toggleSection("busca")}>
          <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:12 }}>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Gênero</label>
              <select value={form.gender} onChange={e=>set("gender",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{["homem","mulher","nao_binario","genero_fluido"].map(g=><option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Etnia</label>
              <select value={form.ethnicity} onChange={e=>set("ethnicity",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{["branca","preta","parda","amarela","indigena"].map(e=><option key={e} value={e}>{e}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Formação</label>
              <select value={form.formation} onChange={e=>set("formation",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{["doutorado","mestrado","especializacao","pos_graduacao"].map(f=><option key={f} value={f}>{f}</option>)}
              </select></div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>set("lgbtqia_ally",!form.lgbtqia_ally)} style={{ width:44, height:24, borderRadius:12, background:form.lgbtqia_ally?COLORS.primary:"#D1D5DB", border:"none", cursor:"pointer", position:"relative", flexShrink:0 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, left:form.lgbtqia_ally?23:3, transition:"left 0.2s" }} />
              </button>
              <span style={{ fontSize:14, color:COLORS.dark }}>Aliado/pertencente à comunidade LGBTQIAPN+</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>set("accepts_corporate_sessions",!form.accepts_corporate_sessions)} style={{ width:44, height:24, borderRadius:12, background:form.accepts_corporate_sessions?COLORS.primary:"#D1D5DB", border:"none", cursor:"pointer", position:"relative", flexShrink:0 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, left:form.accepts_corporate_sessions?23:3, transition:"left 0.2s" }} />
              </button>
              <span style={{ fontSize:14, color:COLORS.dark }}>Aceita sessões corporativas</span>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="Endereços" icon={Home} open={openSection==="enderecos"} onToggle={()=>toggleSection("enderecos")}>
          <div style={{ paddingTop:12 }}><TherapistAddressTab /></div>
        </AccordionSection>

        <AccordionSection title="Dados Financeiros" icon={CreditCard} open={openSection==="financeiro"} onToggle={()=>toggleSection("financeiro")}>
          <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:12 }}>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Tipo de chave PIX</label>
              <select value={form.pix_key_type} onChange={e=>set("pix_key_type",e.target.value)} style={{...inputSt}}>
                <option value="">Selecione</option>{PIX_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Chave PIX</label><input value={form.pix_key} onChange={e=>set("pix_key",e.target.value)} style={inputSt} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Agência</label><input value={form.bank_agency} onChange={e=>set("bank_agency",e.target.value)} style={inputSt} /></div>
              <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Conta</label><input value={form.bank_account} onChange={e=>set("bank_account",e.target.value)} style={inputSt} /></div>
            </div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Dígito</label><input value={form.bank_account_digit} onChange={e=>set("bank_account_digit",e.target.value)} style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>CPF</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)} inputMode="numeric" placeholder="000.000.000-00" style={inputSt} /></div>
            <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>CNPJ</label><input value={form.cnpj} onChange={e=>set("cnpj",e.target.value)} inputMode="numeric" placeholder="00.000.000/0001-00" style={inputSt} /></div>
          </div>
        </AccordionSection>

        <AccordionSection title="Conta e Segurança" icon={Shield} open={openSection==="conta"} onToggle={()=>toggleSection("conta")}>
          <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:12 }}>
            <div style={{ background:"#F9FAFB", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, color:"#9CA3AF" }}>E-mail</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:14, fontWeight:500, color:COLORS.dark }}>{userData?.email}</div>
                <button onClick={()=>setShowEmailModal(true)} style={{ background:"none", border:"none", color:COLORS.primary, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}><Mail size={12} /> Alterar</button>
              </div>
            </div>
            <div style={{ background:"#F9FAFB", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, color:"#9CA3AF" }}>Telefone</div>
              <input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="(11) 99999-9999" style={{ border:"none", background:"transparent", fontSize:14, outline:"none", width:"100%", padding:0, marginTop:2 }} />
            </div>
            {[{key:"show_phone_to_patients",label:"Mostrar telefone para pacientes"},{key:"show_birth_date_to_patients",label:"Mostrar data de nascimento"}].map(item=>(
              <div key={item.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, color:COLORS.dark }}>{item.label}</span>
                <button onClick={()=>set(item.key,!form[item.key])} style={{ width:44, height:24, borderRadius:12, background:form[item.key]?COLORS.primary:"#D1D5DB", border:"none", cursor:"pointer", position:"relative" }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, left:form[item.key]?23:3, transition:"left 0.2s" }} />
                </button>
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <button onClick={()=>set("lgpd_consent",!form.lgpd_consent)} style={{ width:44, height:24, borderRadius:12, background:form.lgpd_consent?COLORS.primary:"#D1D5DB", border:"none", cursor:"pointer", position:"relative", flexShrink:0, marginTop:2 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, left:form.lgpd_consent?23:3, transition:"left 0.2s" }} />
              </button>
              <div>
                <div style={{ fontSize:14, color:COLORS.dark, fontWeight:500 }}>Autorizo o tratamento dos meus dados conforme a LGPD</div>
                {form.lgpd_consent_date && <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>Consentimento em: {new Date(form.lgpd_consent_date).toLocaleDateString("pt-BR")}</div>}
              </div>
            </div>
            <div>
              <button onClick={()=>set("_showDeletion",!form._showDeletion)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", cursor:"pointer", padding:"10px 0" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#6B7280" }}><span>⚠️</span> Exclusão de conta e dados</div>
                <span style={{ color:"#9CA3AF" }}>{form._showDeletion?"▲":"▼"}</span>
              </button>
              {form._showDeletion && (
                <div style={{ background:"#FEF2F2", borderRadius:12, padding:14, border:"1px solid #FECACA" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#991B1B", marginBottom:4 }}>Esta ação é permanente e irreversível</div>
                  <div style={{ fontSize:12, color:"#DC2626", marginBottom:12 }}>Todos os seus dados serão removidos. Registros fiscais podem ser mantidos por até 5 anos.</div>
                  <button onClick={()=>router.push("/mobile/delete-account")} style={{ width:"100%", padding:"11px 0", background:"white", color:"#DC2626", border:"1px solid #DC2626", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer" }}>Excluir minha conta permanentemente</button>
                </div>
              )}
            </div>
          </div>
        </AccordionSection>

        <button onClick={handleSave} disabled={saving}
          style={{ background:COLORS.primary, color:"white", border:"none", borderRadius:12, padding:"14px 0", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:saving?0.7:1 }}>
          {saving ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar alterações</>}
        </button>
      </div>

      {showSignature && (
        <SignatureModal
          onClose={()=>setShowSignature(false)}
          onSuccess={(url)=>{ set("signature_url",url); setSuccess("Assinatura salva!"); setTimeout(()=>setSuccess(""),3000); }}
          onError={(msg)=>setError(msg)}
        />
      )}

      {/* Modal alterar e-mail */}
      {showEmailModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:50 }}>
          <div style={{ background:"white", borderRadius:"16px 16px 0 0", padding:24, width:"100%", maxWidth:480 }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:4, color:COLORS.dark }}>Alterar e-mail</div>
            <div style={{ fontSize:13, color:"#6B7280", marginBottom:16 }}>Digite o novo e-mail e sua senha atual.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Novo e-mail</label>
                <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email" style={inputSt} /></div>
              <div><label style={{ fontSize:12, color:"#6B7280", marginBottom:4, display:"block" }}>Senha atual</label>
                <input value={emailPassword} onChange={e=>setEmailPassword(e.target.value)} type="password" style={inputSt} /></div>
              {emailError && <div style={{ background:"#FEE2E2", color:"#991B1B", borderRadius:10, padding:"10px 14px", fontSize:13 }}>{emailError}</div>}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>{setShowEmailModal(false);setEmailError("");}} style={{ flex:1, background:"#F3F4F6", border:"none", borderRadius:10, padding:"12px 0", fontSize:14, cursor:"pointer" }}>Cancelar</button>
                <button onClick={handleEmailChange} disabled={emailSaving}
                  style={{ flex:1, background:COLORS.primary, color:"white", border:"none", borderRadius:10, padding:"12px 0", fontSize:14, fontWeight:600, cursor:"pointer", opacity:emailSaving?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {emailSaving ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
