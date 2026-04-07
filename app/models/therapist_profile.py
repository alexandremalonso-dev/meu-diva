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
    # NOME DO TERAPEUTA
    # ==========================
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        server_default="",
        comment="Nome completo do terapeuta (copiado da tabela users)"
    )

    # ==========================
    # DADOS PESSOAIS
    # ==========================
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    education_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    show_phone_to_patients: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    show_birth_date_to_patients: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ==========================
    # REGISTRO PROFISSIONAL E TRATAMENTO
    # ==========================
    professional_registration: Mapped[str | None] = mapped_column(String(100), nullable=True)
    treatment: Mapped[TreatmentType | None] = mapped_column(SQLEnum(TreatmentType), nullable=True)

    # ==========================
    # REDES SOCIAIS
    # ==========================
    instagram_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signature_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ==========================
    # FINANCEIRO (PJ/PF)
    # ==========================
    cnpj: Mapped[str | None] = mapped_column(String(18), nullable=True)
    cpf: Mapped[str | None] = mapped_column(String(14), nullable=True)
    bank_agency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_account_digit: Mapped[str | None] = mapped_column(String(2), nullable=True)

    # ==========================
    # PIX
    # ==========================
    pix_key_type: Mapped[PixKeyType | None] = mapped_column(SQLEnum(PixKeyType), nullable=True)
    pix_key: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ==========================
    # LGPD
    # ==========================
    lgpd_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lgpd_consent_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cpf_masked: Mapped[str | None] = mapped_column(String(14), nullable=True)

    # ==========================
    # REGRA DE ALTERAÇÃO FINANCEIRA
    # ==========================
    payment_change_deadline: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="last_day_of_month"
    )
    payment_change_deadline_message: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        default="Alterações devem ser feitas até o último dia do mês para refletirem no próximo pagamento."
    )

    # ==========================
    # CAMPOS EXISTENTES
    # ==========================
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[str | None] = mapped_column(String(255), nullable=True)
    session_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(2, 1), nullable=False, default=0.0)
    reviews_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    experiencia: Mapped[str | None] = mapped_column(Text, nullable=True)
    abordagem: Mapped[str | None] = mapped_column(String(500), nullable=True)
    idiomas: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ==========================
    # CAMPOS PARA BUSCA E FILTROS
    # ==========================
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ethnicity: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lgbtqia_ally: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lgbtqia_belonging: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    formation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approaches: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    specialties_list: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reasons: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    service_types: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    languages_list: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    rating_distribution: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ==========================
    # DURAÇÃO DAS SESSÕES
    # ==========================
    session_duration_30min: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    session_duration_50min: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ==========================
    # POLÍTICA DE REMARCAÇÃO
    # ==========================
    cancellation_policy: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ==========================
    # STRIPE
    # ==========================
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ==========================
    # 🔥 GOOGLE CALENDAR INTEGRATION
    # ==========================
    google_calendar_token: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Token OAuth do Google Calendar pessoal do terapeuta"
    )
    google_calendar_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se a integração com Google Calendar está ativa"
    )

    # ==========================
    # 🔥 VALIDAÇÃO DE DOCUMENTOS (NOVO)
    # ==========================
    validation_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
        comment="Status de validação: pending, approved, rejected, need_reupload"
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Se o terapeuta foi verificado e aprovado"
    )

    # ==========================
    # RELACIONAMENTOS
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
    
    # ==========================
    # 🔥 NOVOS RELACIONAMENTOS PARA DOCUMENTOS E VALIDAÇÃO
    # ==========================
    documents = relationship(
        "app.models.therapist_document.TherapistDocument",
        back_populates="therapist",
        cascade="all, delete-orphan"
    )
    validation = relationship(
        "app.models.therapist_validation.TherapistValidation",
        back_populates="therapist",
        uselist=False,
        cascade="all, delete-orphan"
    )