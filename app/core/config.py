import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Meu Divã API"
    env: str = "local"
    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 60
    allow_role_on_register: bool = True
    
    # URLs
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # ============================================
    # GOOGLE MEET
    # ============================================
    google_calendar_email: str | None = None
    google_calendar_credentials_path: str | None = None
    
    # ============================================
    # SMTP
    # ============================================
    smtp_host: str = "smtp.mailtrap.io"
    smtp_port: int = 2525
    smtp_user: str | None = None
    smtp_password: str | None = None
    from_email: str = "contato@meudiva.com"
    from_name: str = "Meu Divã"
    
    # ============================================
    # STRIPE - CHAVES POR AMBIENTE
    # ============================================
    stripe_secret_key_local: str | None = None
    stripe_publishable_key_local: str | None = None
    stripe_webhook_secret_local: str | None = None
    
    stripe_secret_key_non_prod: str | None = None
    stripe_publishable_key_non_prod: str | None = None
    stripe_webhook_secret_non_prod: str | None = None
    
    stripe_secret_key_prod: str | None = None
    stripe_publishable_key_prod: str | None = None
    stripe_webhook_secret_prod: str | None = None
    
    model_config = SettingsConfigDict(
        env_file=".env.local",  # 🔥 PADRÃO PARA LOCAL
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    @property
    def stripe_secret_key(self) -> str | None:
        """Retorna a chave secreta do Stripe baseado no ambiente"""
        if self.env == "prod":
            return self.stripe_secret_key_prod
        elif self.env == "non-prod":
            return self.stripe_secret_key_non_prod
        else:
            return self.stripe_secret_key_local
    
    @property
    def stripe_publishable_key(self) -> str | None:
        """Retorna a chave publicável do Stripe baseado no ambiente"""
        if self.env == "prod":
            return self.stripe_publishable_key_prod
        elif self.env == "non-prod":
            return self.stripe_publishable_key_non_prod
        else:
            return self.stripe_publishable_key_local
    
    @property
    def stripe_webhook_secret(self) -> str | None:
        """Retorna o webhook secret do Stripe baseado no ambiente"""
        if self.env == "prod":
            return self.stripe_webhook_secret_prod
        elif self.env == "non-prod":
            return self.stripe_webhook_secret_non_prod
        else:
            return self.stripe_webhook_secret_local

settings = Settings()