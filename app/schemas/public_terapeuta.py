from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import time

class TerapeutaPublico(BaseModel):
    id: int
    nome: str
    foto_url: Optional[str] = None
    especialidades: List[str]
    preco_sessao: float
    bio: Optional[str] = None
    abordagem: List[str] = []
    idiomas: List[str] = []
    experiencia: Optional[str] = None
    duracao_padrao: int = 50  # 30 ou 50 minutos
    politica_cancelamento: Optional[str] = None
    modalidade: str = "online"  # online, presencial, ambos
    perfil_validado: bool = False
    
    model_config = ConfigDict(from_attributes=True)

class SlotDisponivel(BaseModel):
    id: str
    starts_at: str
    ends_at: str
    data: str
    hora: str

class AgendaResumida(BaseModel):
    hoje: List[SlotDisponivel]
    amanha: List[SlotDisponivel]
    proximos_dias: List[SlotDisponivel]