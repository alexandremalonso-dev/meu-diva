# ==========================
# CARREGAR VARIÁVEIS DE AMBIENTE
# ==========================
from app.core.env_loader import load_environment
load_environment()

from fastapi import FastAPI, Request, WebSocket, Depends
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import traceback
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# 🔥 IMPORT DO SCHEDULER DE CRÉDITOS EMPRESA
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()

app = FastAPI(title="Meu Divã API", version="0.1.0")

# ==========================
# MIDDLEWARES (ORDEM IMPORTANTE)
# ==========================

# 🔥 Session middleware (necessário para OAuth) - DEVE SER O PRIMEIRO
app.add_middleware(SessionMiddleware, secret_key="meudiva_oauth_secret_key_2024")

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print("\n" + "="*70)
        print("ERRO NAO TRATADO NO SERVIDOR")
        print(f"URL: {request.method} {request.url.path}")
        print(f"Erro: {str(e)}")
        traceback.print_exc()
        print("="*70 + "\n")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Erro interno no servidor: {str(e)}"}
        )


# 🔥 CORS CONFIGURADO PARA PRODUÇÃO
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://app.meudivaonline.com",
        "https://homologacao.meudivaonline.com",
        "https://meudiva-frontend-prod-592671373665.southamerica-east1.run.app",
        "https://meudiva-frontend-non-prod-365415900882.southamerica-east1.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Criar diretórios de upload
os.makedirs("uploads/patients", exist_ok=True)
os.makedirs("uploads/fotos", exist_ok=True)
os.makedirs("uploads/admins", exist_ok=True)
os.makedirs("uploads/invoices", exist_ok=True)

# Servir arquivos estáticos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ==========================
# IMPORTS DAS ROTAS
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
from app.routes import personal_events
from app.routes.ai import router as ai_router
from app.routes import admin_availability
from app.routes import admin_reports
from app.routes import public_stats
from app.routes import plans
from app.routes import admin_permissions
from app.routes import therapist_documents
from app.routes import admin_therapists
from app.routes import ws_chat
from app.routes import ws_events
from app.db.database import get_db
from app.routes import admin_payments
from app.routes import therapist_availability
from app.routes import empresa_routes
from app.routes import empresa_analytics
from app.routes import empresa_import
from app.routes import empresa_colaboradores
from app.routes import empresa_profile
from app.routes import admin_empresa_planos
from app.routes import admin_empresas_assinaturas
from app.routes import empresa_reports
from app.routes import admin_empresas
from app.routes import empresa_sessions
from app.routes import empresa_colaboradores_plano
from app.routes import admin_empresas_cobranca
from app.routes import empresa_colaboradores_assinaturas
from app.routes import empresa_credits
from app.routes import jitsi
from app.routes import admin_reports_duracao
from app.routes import empresa_planos_public

# 🔥 NOVA ROTA PARA PLANO EMPRESA
from app.routes import appointments_plano

# 🔥 NOTAS FISCAIS (INVOICES) - USANDO SINGULAR
try:
    from app.routes import therapist_invoice
    from app.routes import admin_invoice
    print("✅ Invoices routers importados com sucesso")
except Exception as e:
    print(f"❌ Erro ao importar invoices routers: {e}")
    therapist_invoice = None
    admin_invoice = None

# 🔥 NOTIFICAÇÕES
try:
    from app.routes.notifications import router as notifications_router
    print("✅ Notifications router importado com sucesso")
except Exception as e:
    print(f"❌ Erro ao importar notifications router: {e}")
    notifications_router = None

# 🔥 CHAT
try:
    from app.routes.chat import router as chat_router
    print("✅ Chat router importado com sucesso")
except Exception as e:
    print(f"❌ Erro ao importar chat router: {e}")
    chat_router = None

# 🔥 GOOGLE CALENDAR
try:
    from app.routes.google_calendar import router as google_calendar_router
    print("✅ Google Calendar router importado com sucesso")
except Exception as e:
    print(f"❌ Erro ao importar google_calendar router: {e}")
    google_calendar_router = None

# 🔥 WEBSOCKET ONLINE
try:
    from app.routes.ws_online import websocket_online_endpoint
    print("✅ WebSocket Online importado com sucesso")
except Exception as e:
    print(f"❌ Erro ao importar ws_online: {e}")
    websocket_online_endpoint = None

from app.routes import admin_profile as admin_profile_router


# ==========================
# ROTAS DA API
# ==========================
app.include_router(users_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(therapists_router, prefix="/api")
app.include_router(appointments_router, prefix="/api")
app.include_router(availability_router, prefix="/api")
app.include_router(public_terapeutas_router)
app.include_router(patients_router, prefix="/api")
app.include_router(invites_router, prefix="/api")
app.include_router(patient.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(booking.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(meet.router, prefix="/api")
app.include_router(personal_events.router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(admin_availability.router, prefix="/api")
app.include_router(admin_reports.router, prefix="/api")
app.include_router(public_stats.router)
app.include_router(plans.router, prefix="/api")
app.include_router(admin_permissions.router, prefix="/api")
app.include_router(therapist_documents.router, prefix="/api")
app.include_router(admin_therapists.router, prefix="/api")
app.include_router(ws_chat.router)
app.include_router(ws_events.router)
app.include_router(admin_payments.router, prefix="/api", tags=["admin-payments"])
app.include_router(therapist_availability.router)
app.include_router(empresa_routes.router, prefix="/api")
app.include_router(empresa_analytics.router, prefix="/api")
app.include_router(empresa_import.router, prefix="/api")
app.include_router(empresa_colaboradores.router, prefix="/api")
app.include_router(empresa_profile.router, prefix="/api")
app.include_router(admin_empresa_planos.router, prefix="/api")
app.include_router(admin_empresas_assinaturas.router, prefix="/api")
app.include_router(empresa_reports.router, prefix="/api")
app.include_router(admin_empresas.router, prefix="/api")
app.include_router(empresa_sessions.router, prefix="/api")
app.include_router(empresa_colaboradores_plano.router, prefix="/api")
app.include_router(admin_empresas_cobranca.router, prefix="/api")
app.include_router(empresa_colaboradores_assinaturas.router, prefix="/api")
app.include_router(empresa_credits.router, prefix="/api")
app.include_router(jitsi.router, prefix="/api")
app.include_router(admin_reports_duracao.router, prefix="/api")
app.include_router(empresa_planos_public.router)

# 🔥 ROTA PARA PLANO EMPRESA
app.include_router(appointments_plano.router, prefix="/api")

# 🔥 NOTAS FISCAIS (INVOICES) - REGISTRAR ROTAS
if therapist_invoice:
    app.include_router(therapist_invoice.router, prefix="/api", tags=["therapist-invoices"])
    print("✅ Therapist Invoice router registrado em /api/therapist/invoices")
else:
    print("❌ Therapist Invoice router NÃO foi registrado")

if admin_invoice:
    app.include_router(admin_invoice.router, prefix="/api", tags=["admin-invoices"])
    print("✅ Admin Invoice router registrado em /api/admin/invoices")
else:
    print("❌ Admin Invoice router NÃO foi registrado")

# 🔥 NOTIFICAÇÕES
if notifications_router:
    app.include_router(notifications_router, prefix="/api")
    print("✅ Notifications router registrado em /api")
else:
    print("❌ Notifications router NÃO foi registrado")

# 🔥 CHAT
if chat_router:
    app.include_router(chat_router, prefix="/api")
    print("✅ Chat router registrado em /api/chat")
else:
    print("❌ Chat router NÃO foi registrado")

# 🔥 GOOGLE CALENDAR
if google_calendar_router:
    app.include_router(google_calendar_router, prefix="/api")
    print("✅ Google Calendar router registrado em /api/google-calendar")
else:
    print("❌ Google Calendar router NÃO foi registrado")

app.include_router(admin_profile_router.router, prefix="/api")


# ==========================
# WEBSOCKETS
# ==========================

@app.websocket("/ws/chat/{thread_id}")
async def websocket_chat_endpoint(websocket: WebSocket, thread_id: int):
    from app.routes.ws_chat import websocket_endpoint
    await websocket_endpoint(websocket, thread_id)

@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    from app.routes.ws_events import websocket_events_endpoint as ws_events_endpoint
    await ws_events_endpoint(websocket)

@app.websocket("/ws/online")
async def websocket_online_endpoint_route(websocket: WebSocket, db: Session = Depends(get_db)):
    if websocket_online_endpoint is None:
        print("❌ WebSocket Online não disponível - endpoint não importado")
        await websocket.close(code=1011, reason="Endpoint não disponível")
        return
    await websocket_online_endpoint(websocket, db)


# ==========================
# DOCUMENTAÇÃO SWAGGER
# ==========================
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
# ROTAS DE TESTE
# ==========================
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API do Meu Divã esta rodando!"}


@app.get("/test-upload")
async def test_upload():
    upload_dir = "uploads/patients"
    files = []
    if os.path.exists(upload_dir):
        files = os.listdir(upload_dir)
    return {
        "upload_dir_exists": os.path.exists(upload_dir),
        "total_files": len(files),
        "files": files[:10]
    }


@app.get("/api/chat/status")
async def chat_status():
    if chat_router:
        return {"status": "ok", "message": "Chat router está disponível"}
    return {"status": "error", "message": "Chat router NÃO está disponível"}


@app.get("/api/invoices/status")
async def invoices_status():
    """Verifica o status dos routers de notas fiscais"""
    return {
        "therapist_invoice_available": therapist_invoice is not None,
        "admin_invoice_available": admin_invoice is not None,
        "uploads_invoices_dir_exists": os.path.exists("uploads/invoices")
    }


# ==========================
# INICIAR SCHEDULER DE NOTIFICAÇÕES
# ==========================
try:
    from app.services.scheduler import start_scheduler
    start_scheduler()
    print("✅ Scheduler de notificações de assinaturas iniciado com sucesso")
except Exception as e:
    print(f"⚠️ Erro ao iniciar scheduler: {e}")


# ==========================
# 🔥 SCHEDULER - RENOVAÇÃO DE CRÉDITOS EMPRESA
# ==========================

def start_empresa_credit_scheduler():
    """Inicia o scheduler para renovação mensal de créditos de plano empresa"""
    try:
        from app.services.empresa_credit_scheduler import executar_rotina_mensal
        
        scheduler = BackgroundScheduler()
        
        # Executa no dia 1 de cada mês às 00:01
        scheduler.add_job(
            executar_rotina_mensal,
            'cron',
            day=1,
            hour=0,
            minute=1,
            id='empresa_credit_renewal',
            replace_existing=True
        )
        
        scheduler.start()
        print("✅ Scheduler de créditos empresa iniciado (executa dia 1 às 00:01)")
    except Exception as e:
        print(f"⚠️ Erro ao iniciar scheduler de créditos empresa: {e}")


# Iniciar scheduler de créditos empresa
start_empresa_credit_scheduler()