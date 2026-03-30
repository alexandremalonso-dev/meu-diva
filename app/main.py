from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import traceback
import sys
import os

# 🔥 IMPORTANTE: 'app' DEVE SER DEFINIDO ANTES DE USAR!
app = FastAPI(title="Meu Divã API", version="0.1.0")

# ==========================
# MIDDLEWARE DE TRATAMENTO DE ERROS GLOBAL
# ==========================
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """
    Captura qualquer erro não tratado no servidor e retorna JSON em vez de HTML.
    """
    try:
        return await call_next(request)
    except Exception as e:
        print("\n" + "="*70)
        print("❌❌❌ ERRO NÃO TRATADO NO SERVIDOR ❌❌❌")
        print(f"URL: {request.method} {request.url.path}")
        print(f"Erro: {str(e)}")
        print("-"*70)
        traceback.print_exc()
        print("="*70 + "\n")
        
        return JSONResponse(
            status_code=500,
            content={"detail": f"Erro interno no servidor: {str(e)}"}
        )

# ==========================
# CONFIGURAÇÃO CORS
# ==========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos os métodos
    allow_headers=["*"],  # Permite todos os headers
)

# ==========================
# ARQUIVOS ESTÁTICOS (UPLOADS)
# ==========================
# Criar diretório de uploads se não existir
os.makedirs("uploads/patients", exist_ok=True)
os.makedirs("uploads/fotos", exist_ok=True)

# Servir arquivos estáticos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ==========================
# IMPORTS DAS ROTAS (DEPOIS DA CRIAÇÃO DO APP)
# ==========================
from app.routes.users import router as users_router
from app.routes.auth import router as auth_router
from app.routes.schedule import router as schedule_router
from app.routes.therapists import router as therapists_router
from app.routes.appointments import router as appointments_router
from app.routes.availability import router as availability_router
from app.routes.public_terapeutas import router as public_terapeutas_router
from app.routes.patients import router as patients_router
from app.routes.invites import router as invites_router
from app.routes import patient
from app.routes import wallet
from app.routes import payments
from app.routes import audit
from app.routes import booking
from app.routes import calendar
from app.routes import meet

# ==========================
# ROTAS DA API
# ==========================
app.include_router(users_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(therapists_router, prefix="/api")
app.include_router(appointments_router, prefix="/api")
app.include_router(availability_router, prefix="/api")
app.include_router(public_terapeutas_router)  # 🔥 SEM PREFIXO - router já tem /public/terapeutas
app.include_router(patients_router, prefix="/api")
app.include_router(invites_router, prefix="/api")
app.include_router(patient.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(booking.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(meet.router, prefix="/api")

# ==========================
# DOCUMENTAÇÃO SWAGGER
# ==========================
# 🔐 Declarando esquema de segurança global
bearer_scheme = HTTPBearer()

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Meu Divã API",
        version="0.1.0",
        description="API do projeto Meu Divã",
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }

    openapi_schema["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# ==========================
# ROTA DE TESTE (OPCIONAL)
# ==========================
@app.get("/health")
async def health_check():
    """
    Verifica se a API está funcionando.
    """
    return {"status": "ok", "message": "API do Meu Divã está rodando!"}

# ==========================
# ROTA DE TESTE PARA UPLOADS (OPCIONAL)
# ==========================
@app.get("/test-upload")
async def test_upload():
    """
    Retorna informações sobre o diretório de uploads
    """
    upload_dir = "uploads/patients"
    files = []
    if os.path.exists(upload_dir):
        files = os.listdir(upload_dir)
    
    return {
        "upload_dir_exists": os.path.exists(upload_dir),
        "total_files": len(files),
        "files": files[:10]
    }