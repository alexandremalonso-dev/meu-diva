from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.user_permissions import UserPermission
from app.models.plan_features_config import PlanFeaturesConfig

print("✅ Admin Permissions router importado com sucesso")

router = APIRouter(prefix="/admin/permissions", tags=["admin"])

class UserPermissionsRequest(BaseModel):
    user_id: int
    permissions: List[str]

class PlanFeaturesRequest(BaseModel):
    features: List[Dict[str, Any]]

# Lista de todas as permissoes disponiveis
AVAILABLE_PERMISSIONS = [
    {"id": "view_dashboard", "name": "Ver Dashboard", "category": "Dashboard"},
    {"id": "view_financial_report", "name": "Ver Relatorio Financeiro", "category": "Financeiro"},
    {"id": "view_sessions_report", "name": "Ver Relatorio de Sessoes", "category": "Financeiro"},
    {"id": "view_commission_report", "name": "Ver Relatorio de Comissoes", "category": "Financeiro"},
    {"id": "view_subscription_report", "name": "Ver Relatorio de Assinaturas", "category": "Financeiro"},
    {"id": "view_platform_report", "name": "Ver Relatorio da Plataforma", "category": "Financeiro"},
    {"id": "view_therapist_report", "name": "Ver Relatorio por Terapeuta", "category": "Financeiro"},
    {"id": "manage_users", "name": "Gerenciar Usuarios", "category": "Usuarios"},
    {"id": "manage_therapists", "name": "Gerenciar Terapeutas", "category": "Usuarios"},
    {"id": "manage_patients", "name": "Gerenciar Pacientes", "category": "Usuarios"},
    {"id": "manage_subscriptions", "name": "Gerenciar Assinaturas", "category": "Assinaturas"},
    {"id": "manage_pricing", "name": "Gerenciar Precos", "category": "Planos"},
    {"id": "view_audit_log", "name": "Ver Logs de Auditoria", "category": "Auditoria"},
    {"id": "manage_chat", "name": "Gerenciar Chat", "category": "Comunicacao"},
    {"id": "view_monitor", "name": "Ver Monitor", "category": "Monitoramento"},
]

# Permissoes padrao por role
DEFAULT_PERMISSIONS_BY_ROLE = {
    "admin": [p["id"] for p in AVAILABLE_PERMISSIONS],
    "therapist": [
        "view_dashboard", "view_financial_report", "view_sessions_report",
        "view_therapist_report", "manage_patients"
    ],
    "patient": []
}


@router.get("/user/{user_id}")
async def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Retorna as permissoes de um usuario especifico"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    
    saved_perms = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.granted == True
    ).all()
    
    if saved_perms:
        permissions = [p.permission_id for p in saved_perms]
    else:
        permissions = DEFAULT_PERMISSIONS_BY_ROLE.get(user.role, [])
    
    return {"user_id": user_id, "permissions": permissions}


@router.post("/user/save")
async def save_user_permissions(
    request: UserPermissionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Salva as permissoes de um usuario"""
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    
    db.query(UserPermission).filter(UserPermission.user_id == request.user_id).delete()
    
    for perm_id in request.permissions:
        user_perm = UserPermission(
            user_id=request.user_id,
            permission_id=perm_id,
            granted=True
        )
        db.add(user_perm)
    
    db.commit()
    
    return {"success": True, "message": "Permissoes salvas com sucesso"}


@router.get("/list")
async def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Lista todas as permissoes disponiveis"""
    return AVAILABLE_PERMISSIONS


@router.get("/plans/features")
async def get_plan_features(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Retorna as features configuradas para cada plano"""
    configs = db.query(PlanFeaturesConfig).all()
    
    if not configs:
        default_features = [
            {"id": "ai_microphone", "name": "Microfone com IA", "description": "Transcricao e rascunho de prontuario com IA", 
             "available_in": ["premium"], "is_active": True},
            {"id": "financial_reports", "name": "Relatorios Financeiros", "description": "Acesso a relatorios financeiros",
             "available_in": ["profissional", "premium"], "is_active": True},
            {"id": "advanced_stats", "name": "Estatisticas Avancadas", "description": "Metricas e analises detalhadas",
             "available_in": ["profissional", "premium"], "is_active": True},
            {"id": "priority_support", "name": "Suporte Prioritario", "description": "Atendimento prioritario",
             "available_in": ["premium"], "is_active": True},
            {"id": "calendar_sync", "name": "Sincronizacao com Google Calendar", "description": "Sync bidirecional",
             "available_in": ["profissional", "premium"], "is_active": False},
        ]
        return default_features
    
    result = []
    for config in configs:
        available_in = []
        if config.available_in_essencial:
            available_in.append("essencial")
        if config.available_in_profissional:
            available_in.append("profissional")
        if config.available_in_premium:
            available_in.append("premium")
        
        result.append({
            "id": config.feature_id,
            "name": config.feature_name,
            "description": config.description,
            "available_in": available_in,
            "is_active": config.is_active
        })
    
    return result


@router.post("/plans/features/save")
async def save_plan_features(
    request: PlanFeaturesRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Salva as configuracoes de features por plano"""
    
    for feature in request.features:
        existing = db.query(PlanFeaturesConfig).filter(
            PlanFeaturesConfig.feature_id == feature["id"]
        ).first()
        
        available_in = feature.get("available_in", [])
        
        if existing:
            existing.feature_name = feature["name"]
            existing.description = feature.get("description", "")
            existing.is_active = feature.get("is_active", True)
            existing.available_in_essencial = "essencial" in available_in
            existing.available_in_profissional = "profissional" in available_in
            existing.available_in_premium = "premium" in available_in
            existing.updated_at = datetime.now()
        else:
            new_config = PlanFeaturesConfig(
                feature_id=feature["id"],
                feature_name=feature["name"],
                description=feature.get("description", ""),
                is_active=feature.get("is_active", True),
                available_in_essencial="essencial" in available_in,
                available_in_profissional="profissional" in available_in,
                available_in_premium="premium" in available_in
            )
            db.add(new_config)
    
    db.commit()
    
    return {"success": True, "message": "Configuracoes salvas com sucesso"}