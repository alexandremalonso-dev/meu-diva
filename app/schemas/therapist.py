from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict
from enum import Enum

# ==========================
# 🔥 ENUM PARA TRATAMENTO
# ==========================
class TreatmentType(str, Enum):
    DR = "Dr."
    DRA = "Dra."
    SR = "Sr."
    SRA = "Sra."


# ==========================
# BASE - Campos que podem ser enviados/retornados
# ==========================
class TherapistProfileBase(BaseModel):
    # 🔥 NOVO CAMPO - Nome do terapeuta
    full_name: Optional[str] = None
    
    # 🔥 NOVOS CAMPOS - Dados pessoais
    phone: Optional[str] = None
    birth_date: Optional[date] = Field(None, description="Data de nascimento do terapeuta")
    education_level: Optional[str] = Field(None, description="Nível de escolaridade do terapeuta")
    show_phone_to_patients: bool = False
    show_birth_date_to_patients: bool = False
    
    # 🔥 NOVOS CAMPOS - Registro Profissional e Tratamento
    professional_registration: Optional[str] = Field(None, description="Registro profissional (CRP, CRM, etc.)")
    treatment: Optional[TreatmentType] = Field(None, description="Tratamento: Dr., Dra., Sr., Sra.")
    
    # 🔥 REDES SOCIAIS
    instagram_url: Optional[str] = Field(None, description="Link do Instagram")
    signature_url: Optional[str] = Field(None, description="URL da assinatura digital")
    video_url: Optional[str] = Field(None, description="Link do vídeo de apresentação")
    
    # Campos existentes
    bio: Optional[str] = None
    specialties: Optional[str] = None
    session_price: Optional[float] = None
    experience_years: Optional[int] = None
    approach: Optional[str] = None
    languages: Optional[str] = None
    foto_url: Optional[str] = None
    is_online: bool = True
    is_face_to_face: bool = False
    address: Optional[str] = None
    
    # 🔥 NOVOS CAMPOS (versão string para compatibilidade)
    experiencia: Optional[str] = None
    abordagem: Optional[str] = None
    idiomas: Optional[str] = None
    
    # ==========================
    # 🔥 CAMPOS FINANCEIROS
    # ==========================
    cnpj: Optional[str] = None
    cpf: Optional[str] = None
    bank_agency: Optional[str] = None
    bank_account: Optional[str] = None
    bank_account_digit: Optional[str] = None
    pix_key_type: Optional[str] = None
    pix_key: Optional[str] = None
    lgpd_consent: bool = False
    
    # ==========================
    # 🔥 NOVOS CAMPOS PARA BUSCA E FILTROS
    # ==========================
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    lgbtqia_ally: bool = False
    lgbtqia_belonging: bool = False
    formation: Optional[str] = None
    approaches: Optional[List[str]] = None
    specialties_list: Optional[List[str]] = None
    reasons: Optional[List[str]] = None
    service_types: Optional[List[str]] = None
    languages_list: Optional[List[str]] = None
    rating_distribution: Optional[Dict[str, int]] = None
    total_sessions: int = 0
    verified: bool = False
    featured: bool = False
    
    # ==========================
    # 🔥 DURAÇÃO DAS SESSÕES
    # ==========================
    session_duration_30min: bool = True
    session_duration_50min: bool = True
    
    # ==========================
    # 🔥 POLÍTICA DE REMARCAÇÃO
    # ==========================
    cancellation_policy: Optional[str] = None


# ==========================
# CREATE - Para criação de perfil
# ==========================
class TherapistProfileCreate(TherapistProfileBase):
    user_id: int


# ==========================
# UPSERT - Para atualização de perfil (todos campos opcionais)
# ==========================
class TherapistProfileUpsert(BaseModel):
    # 🔥 NOVO CAMPO - Nome
    full_name: Optional[str] = None
    
    # 🔥 NOVOS CAMPOS - Dados pessoais
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    show_phone_to_patients: Optional[bool] = None
    show_birth_date_to_patients: Optional[bool] = None
    
    # 🔥 NOVOS CAMPOS - Registro Profissional e Tratamento
    professional_registration: Optional[str] = None
    treatment: Optional[TreatmentType] = None
    
    # 🔥 REDES SOCIAIS
    instagram_url: Optional[str] = None
    signature_url: Optional[str] = None
    video_url: Optional[str] = None
    
    # Campos existentes
    bio: Optional[str] = None
    specialties: Optional[str] = None
    session_price: Optional[float] = None
    experience_years: Optional[int] = None
    approach: Optional[str] = None
    languages: Optional[str] = None
    foto_url: Optional[str] = None
    is_online: Optional[bool] = None
    is_face_to_face: Optional[bool] = None
    address: Optional[str] = None
    
    # 🔥 NOVOS CAMPOS (versão string para compatibilidade)
    experiencia: Optional[str] = None
    abordagem: Optional[str] = None
    idiomas: Optional[str] = None
    
    # ==========================
    # 🔥 CAMPOS FINANCEIROS
    # ==========================
    cnpj: Optional[str] = None
    cpf: Optional[str] = None
    bank_agency: Optional[str] = None
    bank_account: Optional[str] = None
    bank_account_digit: Optional[str] = None
    pix_key_type: Optional[str] = None
    pix_key: Optional[str] = None
    lgpd_consent: Optional[bool] = None
    
    # ==========================
    # 🔥 NOVOS CAMPOS PARA BUSCA E FILTROS
    # ==========================
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    lgbtqia_ally: Optional[bool] = None
    lgbtqia_belonging: Optional[bool] = None
    formation: Optional[str] = None
    approaches: Optional[List[str]] = None
    specialties_list: Optional[List[str]] = None
    reasons: Optional[List[str]] = None
    service_types: Optional[List[str]] = None
    languages_list: Optional[List[str]] = None
    rating_distribution: Optional[Dict[str, int]] = None
    total_sessions: Optional[int] = None
    verified: Optional[bool] = None
    featured: Optional[bool] = None
    
    # ==========================
    # 🔥 DURAÇÃO DAS SESSÕES
    # ==========================
    session_duration_30min: Optional[bool] = None
    session_duration_50min: Optional[bool] = None
    
    # ==========================
    # 🔥 POLÍTICA DE REMARCAÇÃO
    # ==========================
    cancellation_policy: Optional[str] = None


# ==========================
# OUT - Resposta com todos os campos
# ==========================
class TherapistProfileOut(TherapistProfileBase):
    id: int
    user_id: int
    rating: float = 0.0
    reviews_count: int = 0
    sessions_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # 🔥 INCLUIR OS NOVOS CAMPOS NO OUT
    professional_registration: Optional[str] = None
    treatment: Optional[TreatmentType] = None
    lgbtqia_belonging: bool = False
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    instagram_url: Optional[str] = None
    signature_url: Optional[str] = None
    video_url: Optional[str] = None
    cnpj: Optional[str] = None
    cpf: Optional[str] = None
    bank_agency: Optional[str] = None
    bank_account: Optional[str] = None
    bank_account_digit: Optional[str] = None
    pix_key_type: Optional[str] = None
    pix_key: Optional[str] = None
    lgpd_consent: bool = False
    cancellation_policy: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==========================
# PHOTO RESPONSE - Resposta para upload de foto
# ==========================
class TherapistPhotoResponse(BaseModel):
    foto_url: str
    message: str = "Foto atualizada com sucesso"