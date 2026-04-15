from logging.config import fileConfig
import os
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

from app.core.config import settings
from app.db.database import Base

# ✅ IMPORTANTE:
# importa o pacote app.models (e dentro dele, todos os models)
# garantindo que o Base.metadata esteja completo para autogenerate
import app.models  # noqa: F401

# Alembic Config
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ✅ Metadata para autogenerate
target_metadata = Base.metadata

# 🔥 Forçar a URL do banco a partir da variável de ambiente ou settings
def get_database_url() -> str:
    """Retorna a URL do banco de dados priorizando variável de ambiente"""
    # Primeiro, tenta pegar da variável de ambiente (DATABASE_URL)
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    
    # Segundo, tenta pegar do settings (config.py)
    if hasattr(settings, "database_url") and settings.database_url:
        return settings.database_url
    
    # Fallback para desenvolvimento local
    return "postgresql://meudiva_user:meudiva_password@localhost:5432/meudiva"

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # ajuda a detectar mudanças de tipo
        compare_server_default=True,  # compara valores padrão do servidor
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # garante que o alembic use a URL do ambiente
    database_url = get_database_url()
    config.set_main_option("sqlalchemy.url", database_url)

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()