"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Mail, IdCard, Camera, CheckCircle, AlertCircle,
  Loader2, Eye, EyeOff, Save, Home, Plus, Trash2, Star, Target,
  Shield, AlertTriangle, ChevronDown, ChevronUp, GraduationCap
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const BACKEND_URL = "https://api.meudivaonline.com";

const inputSt: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E5E7EB", fontSize:14, outline:"none", background:"white", boxSizing:"border-box" };

function maskCpf(v: string) {
  const d=v.replace(/\D/g,'').slice(0,11);
  if(d.length<=3)return d; if(d.length<=6)return `${d.slice(0,3)}.${d.slice(3)}`;
  if(d.length<=9)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function hideCpf(cpf: string) {
  const d=cpf.replace(/\D/g,'');
  if(d.length===11) return `${d.slice(0,2)}***.***-${d.slice(-2)}`;
  return cpf;
}

type Section = "perfil"|"enderecos"|"objetivos";

// ===================== ABA ENDEREÇOS =====================
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

function AddressTab({ patientId }: { patientId: number }) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [form, setForm] = useState({ street:"", number:"", complement:"", neighborhood:"", city:"", state:"", zipcode:"", country:"Brasil", address_type:"residential", is_default:false });

  useEffect(() => { load(); }, []);

  async function load() {
    try { const d = await api("/api/patient/profile/address"); setAddresses(d||[]); }
    catch {}  finally { setLoading(false); }
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g,'');
    if(clean.length !== 8) return;
    setCepLoading(true);
    try {
      const d = await api(`/api/patients/cep/${clean}`);
      if(d && !d.erro) setForm(f=>({...f, street:d.logradouro||"", neighborhood:d.bairro||"", city:d.localidade||"", state:d.uf||"", zipcode:cep}));
    } catch {} finally { setCepLoading(false); }
  }

  async function handleSubmit() {
    if(!form.street||!form.city||!form.state||!form.zipcode){setError("Preencha os campos obrigatórios.");return;}
    setSaving(true); setError("");
    try {
      if(editingId) await api(`/api/patient/profile/address/${editingId}`, {method:"PUT",body:JSON.stringify(form)});
      else await api("/api/patient/profile/address", {method:"POST",body:JSON.stringify(form)});
      await load(); setShowForm(false); setEditingId(null);
      setForm({street:"",number:"",complement:"",neighborhood:"",city:"",state:"",zipcode:"",country:"Brasil",address_type:"residential",is_default:false});
    } catch(e:any){setError(e.message||"Erro ao salvar.");}
    finally {setSaving(false);}
  }

  async function handleDelete(id: number) {
    try { await api(`/api/patient/profile/address/${id}`, {method:"DELETE"}); await load(); }
    catch(e:any){setError(e.message||"Erro ao remover.");}
  }

  async function handleSetDefault(id: number) {
    try { await api(`/api/patient/profile/address/${id}`, {method:"PUT",body:JSON.stringify({is_default:true})}); await load(); }
    catch {}
  }

  function startEdit(addr: any) {
    setForm({street:addr.street,number:addr.number||"",complement:addr.complement||"",neighborhood:addr.neighborhood||"",city:addr.city,state:addr.state,zipcode:addr.zipcode,country:addr.country||"Brasil",address_type:addr.address_type||"residential",is_default:addr.is_default});
    setEditingId(addr.id); setShowForm(true);
  }

  if(loading) return <div style={{textAlign:"center",padding:32}}><Loader2 size={24} className="animate-spin" color={COLORS.primary} /></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {error && <div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:10,padding:"10px 14px",fontSize:13}}>{error}</div>}

      {!showForm && (
        <button onClick={()=>setShowForm(true)}
          style={{background:COLORS.primary,color:"white",border:"none",borderRadius:12,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Plus size={16}/> Novo endereço
        </button>
      )}

      {showForm && (
        <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
          <div style={{fontSize:14,fontWeight:600,color:COLORS.dark,marginBottom:14}}>{editingId?"Editar endereço":"Novo endereço"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>CEP *</label>
              <div style={{position:"relative"}}>
                <input value={form.zipcode} onChange={e=>{setForm(f=>({...f,zipcode:e.target.value}));lookupCep(e.target.value);}}
                  placeholder="00000-000" inputMode="numeric" style={inputSt} />
                {cepLoading && <Loader2 size={14} className="animate-spin" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}} color={COLORS.primary} />}
              </div>
            </div>
            <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Rua *</label>
              <input value={form.street} onChange={e=>setForm(f=>({...f,street:e.target.value}))} style={inputSt} /></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Número</label>
                <input value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))} style={inputSt} /></div>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Complemento</label>
                <input value={form.complement} onChange={e=>setForm(f=>({...f,complement:e.target.value}))} style={inputSt} /></div>
            </div>
            <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Bairro *</label>
              <input value={form.neighborhood} onChange={e=>setForm(f=>({...f,neighborhood:e.target.value}))} style={inputSt} /></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Cidade *</label>
                <input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inputSt} /></div>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Estado *</label>
                <input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} maxLength={2} style={inputSt} /></div>
            </div>
            <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Tipo</label>
              <select value={form.address_type} onChange={e=>setForm(f=>({...f,address_type:e.target.value}))} style={{...inputSt}}>
                <option value="residential">Residencial</option>
                <option value="commercial">Comercial</option>
                <option value="other">Outro</option>
              </select></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setForm(f=>({...f,is_default:!f.is_default}))}
                style={{width:44,height:24,borderRadius:12,background:form.is_default?COLORS.primary:"#D1D5DB",border:"none",cursor:"pointer",position:"relative",flexShrink:0}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form.is_default?23:3,transition:"left 0.2s"}} />
              </button>
              <span style={{fontSize:14,color:COLORS.dark}}>Endereço padrão</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowForm(false);setEditingId(null);}} style={{flex:1,background:"#F3F4F6",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{flex:1,background:COLORS.primary,color:"white",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {saving?<Loader2 size={14} className="animate-spin"/>:"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div style={{background:"white",borderRadius:14,padding:32,textAlign:"center",border:"0.5px solid #E5E7EB"}}>
          <Home size={32} color="#D1D5DB" style={{margin:"0 auto 8px"}} />
          <div style={{fontSize:13,color:"#9CA3AF"}}>Nenhum endereço cadastrado</div>
        </div>
      ) : (
        addresses.map(addr => (
          <div key={addr.id} style={{background:"white",borderRadius:14,padding:14,border:`1px solid ${addr.is_default?COLORS.primary+"40":"#E5E7EB"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Home size={16} color={COLORS.primary} />
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:COLORS.dark}}>{addr.street}{addr.number?`, ${addr.number}`:""}</div>
                  <div style={{fontSize:12,color:"#6B7280"}}>{addr.neighborhood} · {addr.city}/{addr.state}</div>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>CEP: {addr.zipcode}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {!addr.is_default && <button onClick={()=>handleSetDefault(addr.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11}}>⭐ Padrão</button>}
                <button onClick={()=>startEdit(addr)} style={{background:"#EFF6FF",border:"none",borderRadius:8,padding:"4px 8px",fontSize:12,color:COLORS.secondary,cursor:"pointer"}}>Editar</button>
                <button onClick={()=>handleDelete(addr.id)} style={{background:"#FEE2E2",border:"none",borderRadius:8,padding:"4px 8px",fontSize:12,color:"#DC2626",cursor:"pointer"}}><Trash2 size={12}/></button>
              </div>
            </div>
            {addr.is_default && <span style={{fontSize:11,background:COLORS.primary+"15",color:COLORS.primary,padding:"2px 8px",borderRadius:20,fontWeight:600}}>Padrão</span>}
          </div>
        ))
      )}
    </div>
  );
}

// ===================== ABA OBJETIVOS =====================
function GoalsTab() {
  const [goals, setGoals] = useState<any[]>([]);
  const [goalTypes, setGoalTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api("/api/patient/goals"),
      api("/api/patient/goals/types"),
    ]).then(([g,t])=>{setGoals(g||[]);setGoalTypes(t||[]);}).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  async function handleAdd() {
    if(!selectedType) return;
    setSaving(true); setError("");
    try {
      const newGoal = await api("/api/patient/goals", {method:"POST",body:JSON.stringify({goal_type:selectedType,is_active:true})});
      setGoals(prev=>[...prev,newGoal]); setSelectedType(""); setShowForm(false);
    } catch(e:any){setError(e.message||"Erro ao adicionar.");}
    finally {setSaving(false);}
  }

  async function handleToggle(goal: any) {
    try {
      const updated = await api(`/api/patient/goals/${goal.id}`, {method:"PUT",body:JSON.stringify({is_active:!goal.is_active,completed_at:!goal.is_active?new Date().toISOString():null})});
      setGoals(prev=>prev.map(g=>g.id===goal.id?updated:g));
    } catch {}
  }

  async function handleDelete(id: number) {
    try { await api(`/api/patient/goals/${id}`, {method:"DELETE"}); setGoals(prev=>prev.filter(g=>g.id!==id)); }
    catch(e:any){setError(e.message||"Erro ao remover.");}
  }

  const getName = (goalType: any) => typeof goalType==="string"?goalType:goalType?.name||"Objetivo";
  const activeGoals = goals.filter(g=>g.is_active===true);
  const completedGoals = goals.filter(g=>g.is_active===false);

  if(loading) return <div style={{textAlign:"center",padding:32}}><Loader2 size={24} className="animate-spin" color={COLORS.primary} /></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {error && <div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:10,padding:"10px 14px",fontSize:13}}>{error}</div>}

      {!showForm && goalTypes.length > 0 && (
        <button onClick={()=>setShowForm(true)}
          style={{background:COLORS.secondary,color:"white",border:"none",borderRadius:12,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Plus size={16}/> Novo objetivo
        </button>
      )}

      {showForm && (
        <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
          <div style={{fontSize:14,fontWeight:600,color:COLORS.dark,marginBottom:12}}>Adicionar objetivo</div>
          <select value={selectedType} onChange={e=>setSelectedType(e.target.value)} style={{...inputSt,marginBottom:12}}>
            <option value="">Selecione um objetivo</option>
            {goalTypes.map(t=><option key={t.id} value={t.name}>{t.name}{t.description?` - ${t.description}`:""}</option>)}
          </select>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setShowForm(false);setSelectedType("");}} style={{flex:1,background:"#F3F4F6",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,cursor:"pointer"}}>Cancelar</button>
            <button onClick={handleAdd} disabled={!selectedType||saving}
              style={{flex:1,background:COLORS.secondary,color:"white",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",opacity:!selectedType||saving?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {saving?<Loader2 size={14} className="animate-spin"/>:"Adicionar"}
            </button>
          </div>
        </div>
      )}

      {activeGoals.length > 0 && (
        <>
          <div style={{fontSize:12,fontWeight:600,color:"#6B7280",letterSpacing:"0.05em"}}>EM ANDAMENTO</div>
          {activeGoals.map(goal=>(
            <div key={goal.id} style={{background:"#F5F3FF",borderRadius:14,padding:14,border:"1px solid #DDD6FE",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#7C3AED",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Target size={18} color="white" />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"#4C1D95"}}>{getName(goal.goal_type)}</div>
                <div style={{fontSize:11,color:"#7C3AED"}}>Desde: {new Date(goal.selected_at||goal.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>handleToggle(goal)} style={{background:"#D1FAE5",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#065F46",cursor:"pointer"}}>✅ Concluir</button>
                <button onClick={()=>handleDelete(goal.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626"}}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </>
      )}

      {completedGoals.length > 0 && (
        <>
          <div style={{fontSize:12,fontWeight:600,color:"#6B7280",letterSpacing:"0.05em",marginTop:8}}>CONCLUÍDOS</div>
          {completedGoals.map(goal=>(
            <div key={goal.id} style={{background:"#F9FAFB",borderRadius:14,padding:14,border:"0.5px solid #E5E7EB",display:"flex",alignItems:"center",gap:12,opacity:0.7}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500,color:"#6B7280",textDecoration:"line-through"}}>{getName(goal.goal_type)}</div>
                {goal.completed_at && <div style={{fontSize:11,color:"#9CA3AF"}}>Concluído: {new Date(goal.completed_at).toLocaleDateString("pt-BR")}</div>}
              </div>
              <button onClick={()=>handleDelete(goal.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626"}}><Trash2 size={16}/></button>
            </div>
          ))}
        </>
      )}

      {goals.length === 0 && !showForm && (
        <div style={{background:"white",borderRadius:14,padding:32,textAlign:"center",border:"0.5px solid #E5E7EB"}}>
          <Target size={32} color="#D1D5DB" style={{margin:"0 auto 8px"}} />
          <div style={{fontSize:13,color:"#9CA3AF"}}>Nenhum objetivo definido</div>
        </div>
      )}
    </div>
  );
}

// ===================== PÁGINA PRINCIPAL =====================
export default function PerfilPacientePage() {
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showDeletion, setShowDeletion] = useState(false);

  const [form, setForm] = useState({
    full_name:"", phone:"", birth_date:"", cpf:"", gender:"",
    how_did_you_find_us:"", bio:"", education_level:"",
    timezone:"America/Sao_Paulo", preferred_language:"pt-BR",
    lgpd_consent:false, lgpd_consent_date:"",
    show_phone_to_patients:false,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [ud, pd] = await Promise.all([api("/api/users/me"), api("/api/patient/profile")]);
      setUserData(ud); setProfile(pd);
      setForm({
        full_name: ud.full_name || "",
        phone: pd.phone || "",
        birth_date: pd.birth_date ? pd.birth_date.split("T")[0] : "",
        cpf: pd.cpf || "",
        gender: pd.gender || "",
        how_did_you_find_us: pd.how_did_you_find_us || "",
        bio: pd.bio || "",
        education_level: pd.education_level || "",
        timezone: pd.timezone || "America/Sao_Paulo",
        preferred_language: pd.preferred_language || "pt-BR",
        lgpd_consent: pd.lgpd_consent || false,
        lgpd_consent_date: pd.lgpd_consent_date || "",
        show_phone_to_patients: pd.show_phone_to_patients || false,
      });
    } catch { setError("Erro ao carregar perfil."); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess("");
    try {
      await api("/api/patient/profile", { method:"PUT", body:JSON.stringify(form) });
      setSuccess("Perfil salvo com sucesso!");
      setTimeout(()=>setSuccess(""),3000);
    } catch(e:any){setError(e.message||"Erro ao salvar.");}
    finally {setSaving(false);}
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return;
    setUploadingPhoto(true);
    try {
      const fd=new FormData(); fd.append("file",file);
      const token=localStorage.getItem("access_token");
      const res=await fetch(`${BACKEND_URL}/api/patient/profile/photo`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
      if(!res.ok)throw new Error("Erro ao enviar foto");
      await load(); setSuccess("Foto atualizada!"); setTimeout(()=>setSuccess(""),3000);
    } catch(e:any){setError(e.message||"Erro ao enviar foto.");}
    finally {setUploadingPhoto(false);}
  }

  async function handleEmailChange() {
    setEmailSaving(true); setEmailError("");
    try {
      await api("/api/auth/change-email",{method:"POST",body:JSON.stringify({new_email:newEmail,password:emailPassword})});
      setUserData((prev:any)=>({...prev,email:newEmail}));
      setShowEmailModal(false); setNewEmail(""); setEmailPassword("");
      setSuccess("E-mail alterado!"); setTimeout(()=>setSuccess(""),5000);
    } catch(e:any){setEmailError(e.message||"Erro ao alterar e-mail.");}
    finally {setEmailSaving(false);}
  }

  const fotoUrl = profile?.foto_url ? (profile.foto_url.replace("/pages/","/patients/").startsWith("http") ? profile.foto_url.replace("/pages/","/patients/") : `${BACKEND_URL}${profile.foto_url.replace("/pages/","/patients/")}`) : null;

  const TABS: {key:Tab;label:string}[] = [
    {key:"perfil",label:"Perfil"},
    {key:"enderecos",label:"Endereços"},
    {key:"objetivos",label:"Objetivos"},
  ];

  if(loading) return <div style={{minHeight:"100vh",background:"#f7f0f5",display:"flex",alignItems:"center",justifyContent:"center"}}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>;

  return (
    <div style={{minHeight:"100vh",background:"#f7f0f5",paddingBottom:100}}>
      <div style={{background:COLORS.primary,padding:"16px 16px 0"}}>
        <button onClick={()=>router.push('/mobile/dashboard')} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,padding:"6px 10px",color:"white",display:"flex",alignItems:"center",gap:6,marginBottom:12,cursor:"pointer"}}>
          <ArrowLeft size={16}/> Voltar
        </button>
        <div style={{color:"white",fontSize:20,fontWeight:600}}>Meu Perfil</div>
        <div style={{color:"rgba(255,255,255,0.8)",fontSize:13,marginTop:4}}>Toque em cada seção para expandir</div>
      </div>

      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {error && <div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:10,padding:"10px 14px",fontSize:13,display:"flex",gap:8,alignItems:"center"}}><AlertCircle size={16}/> {error}</div>}
        {success && <div style={{background:"#D1FAE5",color:"#065F46",borderRadius:10,padding:"10px 14px",fontSize:13,display:"flex",gap:8,alignItems:"center"}}><CheckCircle size={16}/> {success}</div>}

        {/* FOTO — sempre visível */}
        <div style={{background:"white", borderRadius:14, padding:16, border:"0.5px solid #E5E7EB", display:"flex", alignItems:"center", gap:14}}>
          <div style={{position:"relative", flexShrink:0}}>
            <div style={{width:72, height:72, borderRadius:"50%", overflow:"hidden", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid rgba(224,54,115,0.3)"}}>
              {fotoUrl ? <img src={fotoUrl} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}}/> : <User size={32} color="#9CA3AF"/>}
            </div>
            <button onClick={()=>fileRef.current?.click()} disabled={uploadingPhoto}
              style={{position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", background:"#E03673", border:"2px solid white", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
              {uploadingPhoto?<Loader2 size={12} className="animate-spin" color="white"/>:<Camera size={12} color="white"/>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
          </div>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:"#3A3B21"}}>{userData?.full_name}</div>
            <div style={{fontSize:12, color:"#9CA3AF"}}>Paciente · #{userData?.formatted_id}</div>
          </div>
        </div>

        <AccordionSection title="Perfil e Dados Pessoais" icon={User} open={openSection==="perfil"} onToggle={()=>toggleSection("perfil")}>
          <div style={{paddingTop:12}}>
            {/* Foto */}
            <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB",display:"flex",alignItems:"center",gap:14}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${COLORS.primary}30`}}>
                  {fotoUrl ? <img src={fotoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <User size={32} color="#9CA3AF"/>}
                </div>
                <button onClick={()=>fileRef.current?.click()} disabled={uploadingPhoto}
                  style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",background:COLORS.primary,border:"2px solid white",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  {uploadingPhoto?<Loader2 size={12} className="animate-spin" color="white"/>:<Camera size={12} color="white"/>}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto} />
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:COLORS.dark}}>{userData?.full_name}</div>
                <div style={{fontSize:12,color:"#9CA3AF"}}>Paciente · #{userData?.formatted_id}</div>
                <div style={{fontSize:12,color:"#9CA3AF"}}>Desde {userData?.created_at?new Date(userData.created_at).toLocaleDateString("pt-BR"):"—"}</div>
              </div>
            </div>

            {/* Identificação */}
            <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><IdCard size={16} color={COLORS.primary}/><div style={{fontSize:14,fontWeight:600,color:COLORS.dark}}>Identificação</div></div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{background:"#F9FAFB",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>E-mail</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:2}}>
                    <div style={{fontSize:14,fontWeight:500,color:COLORS.dark}}>{userData?.email}</div>
                    <button onClick={()=>setShowEmailModal(true)} style={{background:"none",border:"none",color:COLORS.primary,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                      <Mail size={12}/> Alterar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dados pessoais */}
            <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
              <div style={{fontSize:14,fontWeight:600,color:COLORS.dark,marginBottom:14}}>Dados pessoais</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Nome completo</label>
                  <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} style={inputSt}/></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Telefone</label>
                  <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="(11) 99999-9999" style={inputSt}/></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>CPF</label>
                  <input value={maskCpf(form.cpf)} onChange={e=>setForm(f=>({...f,cpf:e.target.value.replace(/\D/g,'')}))} placeholder="000.000.000-00" inputMode="numeric" style={inputSt}/>
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>Aparecerá como: {form.cpf?hideCpf(form.cpf):"***.***.***-**"}</div></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Data de nascimento</label>
                  <input type="date" value={form.birth_date} onChange={e=>setForm(f=>({...f,birth_date:e.target.value}))} style={inputSt}/></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Nível de escolaridade</label>
                  <select value={form.education_level} onChange={e=>setForm(f=>({...f,education_level:e.target.value}))} style={{...inputSt}}>
                    <option value="">Selecione</option>
                    {["Ensino Fundamental incompleto","Ensino Fundamental completo","Ensino Médio incompleto","Ensino Médio completo","Ensino Superior incompleto","Ensino Superior completo","Pós-graduação (especialização)","Mestrado","Doutorado"].map(l=><option key={l} value={l}>{l}</option>)}
                  </select></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Gênero</label>
                  <select value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))} style={{...inputSt}}>
                    <option value="">Selecione</option>
                    {["homem","mulher","nao_binario","genero_fluido"].map(g=><option key={g} value={g}>{g}</option>)}
                  </select></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Fuso horário</label>
                  <select value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))} style={{...inputSt}}>
                    <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                    <option value="America/Belem">Belém (GMT-3)</option>
                  </select></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Idioma preferido</label>
                  <select value={form.preferred_language} onChange={e=>setForm(f=>({...f,preferred_language:e.target.value}))} style={{...inputSt}}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Como nos encontrou?</label>
                  <select value={form.how_did_you_find_us} onChange={e=>setForm(f=>({...f,how_did_you_find_us:e.target.value}))} style={{...inputSt}}>
                    <option value="">Selecione</option>
                    {["Instagram","Google","Indicação","Facebook","LinkedIn","Outro"].map(o=><option key={o} value={o}>{o}</option>)}
                  </select></div>
                <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Sobre mim</label>
                  <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} placeholder="Conte um pouco sobre você..." style={{...inputSt,resize:"vertical",minHeight:80}} /></div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{background:COLORS.primary,color:"white",border:"none",borderRadius:12,padding:"14px 16px",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:saving?0.7:1,width:"100%",boxSizing:"border-box"}}>
              {saving?<><Loader2 size={18} className="animate-spin"/> Salvando...</>:<><Save size={18}/> Salvar alterações</>}
            </button>
          </div>
        </AccordionSection>

        <AccordionSection title="Endereços" icon={Home} open={openSection==="enderecos"} onToggle={()=>toggleSection("enderecos")}>
          <div style={{paddingTop:12}}>
            {profile && <AddressTab patientId={profile.id} />}
          </div>
        </AccordionSection>

        <AccordionSection title="Objetivos Terapêuticos" icon={Target} open={openSection==="objetivos"} onToggle={()=>toggleSection("objetivos")}>
          <div style={{paddingTop:12}}>
            <GoalsTab />
          </div>
        </AccordionSection>

        <AccordionSection title="Privacidade e LGPD" icon={Shield} open={openSection==="lgpd" as any} onToggle={()=>(setOpenSection as any)(prev => prev === "lgpd" ? null : "lgpd")}>
          <div style={{paddingTop:12}}>
{/* Privacidade e LGPD */}
            <div style={{background:"white",borderRadius:14,padding:16,border:"0.5px solid #E5E7EB"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Shield size={16} color={COLORS.primary}/><div style={{fontSize:14,fontWeight:600,color:COLORS.dark}}>Privacidade e LGPD</div></div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <button onClick={()=>setForm(f=>({...f,lgpd_consent:!f.lgpd_consent}))}
                    style={{width:44,height:24,borderRadius:12,background:form.lgpd_consent?COLORS.primary:"#D1D5DB",border:"none",cursor:"pointer",position:"relative",flexShrink:0,marginTop:2}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form.lgpd_consent?23:3,transition:"left 0.2s"}} />
                  </button>
                  <div>
                    <div style={{fontSize:14,color:COLORS.dark,fontWeight:500}}>Autorizo o tratamento dos meus dados pessoais conforme a LGPD</div>
                    <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>Seus dados serão utilizados apenas para fins de agendamento e atendimento terapêutico.</div>
                    {form.lgpd_consent_date && <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>Consentimento em: {new Date(form.lgpd_consent_date).toLocaleDateString("pt-BR")}</div>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={()=>setForm(f=>({...f,show_phone_to_patients:!f.show_phone_to_patients}))}
                    style={{width:44,height:24,borderRadius:12,background:form.show_phone_to_patients?COLORS.primary:"#D1D5DB",border:"none",cursor:"pointer",position:"relative",flexShrink:0}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form.show_phone_to_patients?23:3,transition:"left 0.2s"}} />
                  </button>
                  <span style={{fontSize:14,color:COLORS.dark}}>Mostrar telefone para terapeutas</span>
                </div>

                {/* Exclusão de conta — colapsável */}
                <div style={{borderTop:"0.5px solid #F3F4F6",paddingTop:12}}>
                  <button onClick={()=>setShowDeletion(!showDeletion)}
                    style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#6B7280"}}>
                      <AlertTriangle size={14}/> Exclusão de conta e dados
                    </div>
                    {showDeletion?<ChevronUp size={16} color="#9CA3AF"/>:<ChevronDown size={16} color="#9CA3AF"/>}
                  </button>
                  {showDeletion && (
                    <div style={{background:"#FEF2F2",borderRadius:12,padding:14,marginTop:10,border:"1px solid #FECACA"}}>
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        <AlertTriangle size={16} color="#DC2626" style={{flexShrink:0,marginTop:2}}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:"#991B1B"}}>Esta ação é permanente e irreversível</div>
                          <div style={{fontSize:12,color:"#DC2626",marginTop:4}}>Todos os seus dados serão removidos permanentemente — incluindo perfil, histórico de sessões e dados pessoais. Registros fiscais podem ser mantidos por até 5 anos.</div>
                        </div>
                      </div>
                      <button onClick={()=>router.push("/mobile/delete-account")}
                        style={{width:"100%",padding:"11px 0",background:"white",color:"#DC2626",border:"1px solid #DC2626",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                        <Trash2 size={14}/> Quero excluir minha conta permanentemente
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </AccordionSection>

      </div>

      {/* Modal alterar e-mail */}
      {showEmailModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50}}>
          <div style={{background:"white",borderRadius:"16px 16px 0 0",padding:24,width:"100%",maxWidth:480}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:4,color:COLORS.dark}}>Alterar e-mail</div>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:16}}>Digite seu novo e-mail e sua senha atual para confirmar.</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Novo e-mail</label>
                <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email" style={inputSt}/></div>
              <div><label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Senha atual</label>
                <input value={emailPassword} onChange={e=>setEmailPassword(e.target.value)} type="password" style={inputSt}/></div>
              {emailError && <div style={{background:"#FEE2E2",color:"#991B1B",borderRadius:10,padding:"10px 14px",fontSize:13}}>{emailError}</div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{setShowEmailModal(false);setEmailError("");}} style={{flex:1,background:"#F3F4F6",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,cursor:"pointer"}}>Cancelar</button>
                <button onClick={handleEmailChange} disabled={emailSaving}
                  style={{flex:1,background:COLORS.primary,color:"white",border:"none",borderRadius:10,padding:"12px 0",fontSize:14,fontWeight:600,cursor:"pointer",opacity:emailSaving?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  {emailSaving?<Loader2 size={14} className="animate-spin"/>:"Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
