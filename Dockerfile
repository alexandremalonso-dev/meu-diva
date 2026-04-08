# ============================================
# DOCKERFILE SIMPLIFICADO - APENAS BACKEND
# ============================================

FROM python:3.13-slim

WORKDIR /app

# Instalar dependencias do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo do backend
COPY app/ ./app/

# Copiar diretorios de upload
RUN mkdir -p /app/uploads/patients \
    && mkdir -p /app/uploads/fotos \
    && mkdir -p /app/uploads/admins \
    && mkdir -p /app/uploads/therapist_documents

# Variaveis de ambiente
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expor porta do Cloud Run (8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Comando para iniciar a aplicacao
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]