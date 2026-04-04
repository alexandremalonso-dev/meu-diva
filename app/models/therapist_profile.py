from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import ForeignKey, String, Text, Numeric, DateTime, Integer, Boolean, JSON, Enum as SQLEnum, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import enum
from app.db.database import Base

# 🔥 ENUM PARA TRATAMENTO
class TreatmentType(str, enum.Enum):
    DR = "Dr."
    DRA = "Dra."
    SR = "Sr."
    SRA = "Sra."

# 🔥 ENUM PARA TIPO DE CHAVE PIX
class PixKeyType(str, enum.Enum):
    CPF = "cpf"
    CNPJ = "cnpj"
    EMAIL = "email"
    PHONE = "phone"
    RANDOM = "random"

class TherapistProfile(Base):
    __tablename__ = "therapist_profiles"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    # ==========================
    # 🔥 NOME DO TERAPEUTA
    # ==========================
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        server_default="",
        comment="Nome completo do terapeuta (copiado da tabela users)"
    )

    # ==========================
    # 🔥 CAMPOS PARA O PACIENTE (Dados pessoais)
    # ==========================
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Celular do terapeuta"
    )
    birth_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Data de nascimento do terapeuta"
    )
    education_level: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Nível de escolaridade do terapeuta"
    )
    show_phone_to_patients: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se o celular aparece para pacientes"
    )
    show_birth_date_to_patients: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se a data de nascimento aparece para pacientes"
    )

    # ==========================
    # 🔥 NOVOS CAMPOS - REGISTRO PROFISSIONAL E TRATAMENTO
    # ==========================
    professional_registration: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Registro profissional (CRP, CRM, CRO, etc.)"
    )
    
    treatment: Mapped[TreatmentType | None] = mapped_column(
        SQLEnum(TreatmentType),
        nullable=True,
        comment="Tratamento: Dr., Dra., Sr., Sra."
    )

    # ==========================
    # 🔥 NOVOS CAMPOS - REDES SOCIAIS
    # ==========================
    instagram_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="URL do Instagram do terapeuta"
    )
    signature_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="URL da imagem da assinatura (fundo transparente)"
    )
    video_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Link do YouTube para vídeo de apresentação"
    )

    # ==========================
    # 🔥 NOVOS CAMPOS - FINANCEIRO (PJ/PF)
    # ==========================
    cnpj: Mapped[str | None] = mapped_column(
        String(18),
        nullable=True,
        comment="CNPJ do terapeuta (PJ)"
    )
    cpf: Mapped[str | None] = mapped_column(
        String(14),
        nullable=True,
        comment="CPF do terapeuta (opcional, com LGPD)"
    )
    bank_agency: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="Agência bancária (sem dígito)"
    )
    bank_account: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Número da conta bancária"
    )
    bank_account_digit: Mapped[str | None] = mapped_column(
        String(2),
        nullable=True,
        comment="Dígito verificador da conta"
    )

    # ==========================
    # 🔥 NOVOS CAMPOS - PIX
    # ==========================
    pix_key_type: Mapped[PixKeyType | None] = mapped_column(
        SQLEnum(PixKeyType),
        nullable=True,
        comment="Tipo da chave PIX"
    )
    pix_key: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Chave PIX para recebimento"
    )

    # ==========================
    # 🔥 LGPD - CONSENTIMENTO E MASCARAMENTO
    # ==========================
    lgpd_consent: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Consentimento para uso de dados conforme LGPD"
    )
    lgpd_consent_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Data do consentimento LGPD"
    )
    cpf_masked: Mapped[str | None] = mapped_column(
        String(14),
        nullable=True,
        comment="CPF com mascaramento (ex: ***.***.123-45) para exibição"
    )

    # ==========================
    # 🔥 REGRA DE ALTERAÇÃO FINANCEIRA
    # ==========================
    payment_change_deadline: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        default="last_day_of_month",
        comment="Prazo para alterações financeiras (last_day_of_month)"
    )
    payment_change_deadline_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default="Alterações devem ser feitas até o último dia do mês para refletirem no próximo pagamento.",
        comment="Mensagem informativa sobre prazo para alterações"
    )

    # ==========================
    # CAMPOS EXISTENTES
    # ==========================
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    specialties: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    session_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    rating: Mapped[float] = mapped_column(
        Numeric(2, 1),
        nullable=False,
        default=0.0,
        comment="Avaliação média do terapeuta"
    )
    reviews_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Número de avaliações"
    )
    sessions_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Número de sessões realizadas"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Data de criação do perfil"
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
        comment="Data da última atualização"
    )
    foto_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="URL da foto de perfil do terapeuta"
    )
    experiencia: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Descrição da experiência profissional"
    )
    abordagem: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Abordagem terapêutica (separada por vírgulas)"
    )
    idiomas: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Idiomas falados (separados por vírgulas)"
    )

    # ==========================
    # 🔥 CAMPOS PARA BUSCA E FILTROS
    # ==========================
    
    # Gênero
    gender: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Gênero do terapeuta (homem, mulher, nao_binario, genero_fluido)"
    )
    # Etnia
    ethnicity: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Etnia (branca, preta, parda, amarela, indigena)"
    )
    # 🔥 SEPARAR LGBTQIAPN+ EM DUAS COLUNAS
    lgbtqia_ally: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se é aliado da comunidade LGBTQIAPN+"
    )
    lgbtqia_belonging: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se pertence à comunidade LGBTQIAPN+"
    )
    # Formação acadêmica
    formation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Formação (doutorado, mestrado, especializacao, pos_graduacao)"
    )
    # Abordagens (array)
    approaches: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array de abordagens terapêuticas"
    )
    # Lista de especialidades (array) - substitui o campo specialties string
    specialties_list: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array de especialidades"
    )
    # Motivos que atende (array)
    reasons: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array de motivos que atende"
    )
    # Tipos de serviço (array)
    service_types: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array de tipos de serviço (psicologo, psicanalista, coach, etc)"
    )
    # Lista de idiomas (array) - substitui o campo idiomas string
    languages_list: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Array de idiomas falados"
    )
    # Distribuição de avaliações
    rating_distribution: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Distribuição de avaliações (ex: {'5': 10, '4': 5, '3': 2})"
    )
    # Total de sessões realizadas
    total_sessions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total de sessões realizadas"
    )
    # Profissional verificado
    verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se o profissional é verificado"
    )
    # Profissional em destaque
    featured: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se aparece em destaque na busca"
    )

    # ==========================
    # 🔥 DURAÇÃO DAS SESSÕES
    # ==========================
    session_duration_30min: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Se atende sessões de 30 minutos"
    )
    session_duration_50min: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Se atende sessões de 50 minutos"
    )

    # ==========================
    # 🔥 POLÍTICA DE REMARCAÇÃO
    # ==========================
    cancellation_policy: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Política de cancelamento e remarcação do terapeuta"
    )

    # ==========================
    # 🔥 NOVOS RELACIONAMENTOS - ASSINATURA E COMISSÃO
    # ==========================
    subscription = relationship(
        "app.models.subscription.Subscription",
        back_populates="therapist",
        uselist=False,
        cascade="all, delete-orphan"
    )
    
    commissions = relationship(
        "app.models.commission.Commission",
        back_populates="therapist",
        cascade="all, delete-orphan"
    )

    # ==========================
    # RELACIONAMENTOS EXISTENTES
    # ==========================
    user = relationship(
        "app.models.user.User",
        back_populates="therapist_profile",
        lazy="joined",
    )
    availabilities = relationship(
        "app.models.therapist_availability.TherapistAvailability",
        back_populates="therapist_profile",
        cascade="all, delete-orphan"
    )
    availability_periods = relationship(
        "app.models.availability.AvailabilityPeriod",
        back_populates="therapist_profile",
        cascade="all, delete-orphan"
    )