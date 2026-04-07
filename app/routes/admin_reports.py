from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, desc
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.subscription import Subscription
from app.models.commission import Commission
from app.models.appointment import Appointment
from app.core.appointment_status import AppointmentStatus

router = APIRouter(prefix="/admin/reports", tags=["admin"])


@router.get("/financial")
def get_financial_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    therapist_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Gerando relatório financeiro")
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
    end = end.replace(hour=23, minute=59, second=59)
    commissions_query = select(Commission).where(
        Commission.created_at >= start,
        Commission.created_at <= end,
        Commission.is_refund == False
    )
    if therapist_id:
        commissions_query = commissions_query.where(Commission.therapist_id == therapist_id)
    commissions = db.execute(commissions_query).scalars().all()
    total_commission = sum(float(c.commission_amount) for c in commissions)
    total_net = sum(float(c.net_amount) for c in commissions)
    total_gross = total_commission + total_net
    plan_revenue = {}
    for c in commissions:
        therapist = db.get(TherapistProfile, c.therapist_id)
        if therapist:
            sub = db.execute(select(Subscription).where(Subscription.therapist_id == therapist.id)).scalar_one_or_none()
            plan = sub.plan if sub else "essencial"
            plan_revenue[plan] = plan_revenue.get(plan, 0) + float(c.commission_amount)
    therapist_revenue = {}
    for c in commissions:
        therapist = db.get(TherapistProfile, c.therapist_id)
        if therapist:
            therapist_revenue[therapist.id] = therapist_revenue.get(therapist.id, 0) + float(c.commission_amount)
    active_subscriptions = db.execute(select(Subscription).where(Subscription.status == "active")).scalars().all()
    mrr = 0
    subscription_breakdown = {"essencial": 0, "profissional": 0, "premium": 0}
    for sub in active_subscriptions:
        if sub.plan == "profissional":
            mrr += 79
            subscription_breakdown["profissional"] += 79
        elif sub.plan == "premium":
            mrr += 149
            subscription_breakdown["premium"] += 149
    return {
        "period": {"start_date": start.isoformat(), "end_date": end.isoformat()},
        "summary": {"total_gross": total_gross, "total_commission": total_commission, "total_net": total_net, "total_sessions": len(commissions), "mrr": mrr},
        "by_plan": plan_revenue,
        "by_therapist": therapist_revenue,
        "subscription_breakdown": subscription_breakdown,
        "active_subscriptions_count": len(active_subscriptions)
    }


@router.get("/therapists-by-plan")
def get_therapists_by_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Listando terapeutas por plano")
    therapists = db.execute(select(TherapistProfile)).scalars().all()
    result = []
    for therapist in therapists:
        user = db.get(User, therapist.user_id)
        subscription = db.execute(select(Subscription).where(Subscription.therapist_id == therapist.id)).scalar_one_or_none()
        total_commission = db.execute(select(func.sum(Commission.commission_amount)).where(Commission.therapist_id == therapist.id, Commission.is_refund == False)).scalar() or 0
        total_sessions = db.execute(select(func.count(Commission.id)).where(Commission.therapist_id == therapist.id, Commission.is_refund == False)).scalar() or 0
        result.append({
            "therapist_id": therapist.id,
            "user_id": therapist.user_id,
            "name": therapist.full_name or user.full_name or user.email,
            "email": user.email,
            "plan": subscription.plan if subscription else "essencial",
            "subscription_status": subscription.status if subscription else "active",
            "total_commission_paid": float(total_commission),
            "total_sessions": total_sessions,
            "current_period_end": subscription.current_period_end.isoformat() if subscription and subscription.current_period_end else None
        })
    return result


@router.get("/commissions")
def get_commissions_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    therapist_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Listando comissões")
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=30)
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
    end = end.replace(hour=23, minute=59, second=59)
    query = select(Commission).where(Commission.created_at >= start, Commission.created_at <= end)
    if therapist_id:
        query = query.where(Commission.therapist_id == therapist_id)
    query = query.order_by(desc(Commission.created_at))
    total = db.execute(query).all()
    commissions = db.execute(query.offset(offset).limit(limit)).scalars().all()
    result = []
    for c in commissions:
        therapist = db.get(TherapistProfile, c.therapist_id)
        user = db.get(User, therapist.user_id) if therapist else None
        appointment = db.get(Appointment, c.appointment_id)
        result.append({
            "id": c.id,
            "appointment_id": c.appointment_id,
            "appointment_date": appointment.starts_at.isoformat() if appointment else None,
            "therapist_name": therapist.full_name if therapist else None,
            "therapist_email": user.email if user else None,
            "session_price": float(c.session_price),
            "commission_rate": float(c.commission_rate),
            "commission_amount": float(c.commission_amount),
            "net_amount": float(c.net_amount),
            "is_refund": c.is_refund,
            "created_at": c.created_at.isoformat()
        })
    return {"total": len(total), "limit": limit, "offset": offset, "commissions": result}


@router.get("/subscriptions")
def get_subscriptions_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Relatório de assinaturas")
    subscriptions = db.execute(select(Subscription).where(Subscription.status == "active")).scalars().all()
    total_mrr = 0
    by_plan = {"essencial": {"count": 0, "mrr": 0}, "profissional": {"count": 0, "mrr": 0}, "premium": {"count": 0, "mrr": 0}}
    for sub in subscriptions:
        if sub.plan == "profissional":
            by_plan["profissional"]["count"] += 1
            by_plan["profissional"]["mrr"] += 79
            total_mrr += 79
        elif sub.plan == "premium":
            by_plan["premium"]["count"] += 1
            by_plan["premium"]["mrr"] += 149
            total_mrr += 149
        else:
            by_plan["essencial"]["count"] += 1
    return {"total_active_subscriptions": len(subscriptions), "total_mrr": total_mrr, "by_plan": by_plan, "projected_yearly": total_mrr * 12}


@router.get("/platform-revenue")
def get_platform_revenue(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Receita da plataforma")
    query = select(
        func.date_trunc('month', Commission.created_at).label('month'),
        func.sum(Commission.commission_amount).label('total_commission'),
        func.count(Commission.id).label('total_sessions')
    ).where(Commission.is_refund == False)
    if year:
        query = query.where(Commission.created_at >= datetime(year, 1, 1), Commission.created_at <= datetime(year, 12, 31, 23, 59, 59))
    query = query.group_by(func.date_trunc('month', Commission.created_at)).order_by('month')
    results = db.execute(query).all()
    monthly_data = [{"month": row.month.strftime("%Y-%m"), "total_commission": float(row.total_commission) if row.total_commission else 0, "total_sessions": row.total_sessions} for row in results]
    total_all_time = db.execute(select(func.sum(Commission.commission_amount)).where(Commission.is_refund == False)).scalar() or 0
    return {"total_all_time": float(total_all_time), "monthly": monthly_data}


@router.get("/daily-revenue")
def get_daily_revenue(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    therapist_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] daily-revenue chamado")
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() - timedelta(days=90)
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime.now()
    end = end.replace(hour=23, minute=59, second=59)
    appointments = db.query(Appointment).filter(Appointment.starts_at >= start, Appointment.starts_at <= end, Appointment.status == "completed")
    if therapist_id:
        appointments = appointments.filter(Appointment.therapist_user_id == therapist_id)
    appointments = appointments.all()
    daily = {}
    for apt in appointments:
        date_key = apt.starts_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"revenue": 0, "sessions": 0}
        daily[date_key]["revenue"] += float(apt.session_price or 0)
        daily[date_key]["sessions"] += 1
    chart_data = []
    cumulative = 0
    for date_str in sorted(daily.keys()):
        revenue = daily[date_str]["revenue"]
        cumulative += revenue
        chart_data.append({"date": date_str, "day": int(date_str.split('-')[2]), "revenue": revenue, "sessions": daily[date_str]["sessions"], "cancelled": 0, "cumulative": cumulative})
    return {"data": chart_data, "summary": {"total_revenue": cumulative, "total_sessions": sum(d["sessions"] for d in chart_data), "total_cancelled": 0}}


# ==========================
# 🔥 DASHBOARD COMPLETO DO ADMIN (RELATÓRIO GERAL)
# ==========================
@router.get("/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    from sqlalchemy.orm import joinedload
    print(f"\n📊 [ADMIN] Dashboard - Carregando todos os dados")

    start = datetime.now() - timedelta(days=90)
    end = datetime.now()
    completed_appointments = db.query(Appointment).filter(
        Appointment.starts_at >= start,
        Appointment.starts_at <= end,
        Appointment.status == "completed"
    ).all()
    daily = {}
    for apt in completed_appointments:
        date_key = apt.starts_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"revenue": 0, "sessions": 0}
        daily[date_key]["revenue"] += float(apt.session_price or 0)
        daily[date_key]["sessions"] += 1
    chart_data = []
    cumulative = 0
    for date_str in sorted(daily.keys()):
        revenue = daily[date_str]["revenue"]
        cumulative += revenue
        chart_data.append({"date": date_str, "day": int(date_str.split('-')[2]), "revenue": revenue, "sessions": daily[date_str]["sessions"], "cumulative": cumulative})

    all_sessions = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.therapist)
    ).order_by(Appointment.starts_at.desc()).limit(500).all()
    sessions_list = []
    for apt in all_sessions:
        patient_name = None
        patient_email = None
        patient_foto_url = None
        therapist_foto_url = None

        if apt.patient:
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient.id).first()
            if patient_profile and patient_profile.full_name:
                patient_name = patient_profile.full_name
            elif apt.patient.full_name:
                patient_name = apt.patient.full_name
            else:
                patient_name = f"Paciente #{apt.patient_user_id}"
            patient_email = apt.patient.email or ""
            patient_foto_url = patient_profile.foto_url if patient_profile else None

        if apt.therapist:
            therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == apt.therapist.id).first()
            therapist_foto_url = therapist_profile.foto_url if therapist_profile else None

        sessions_list.append({
            "id": apt.id,
            "starts_at": apt.starts_at.isoformat() if apt.starts_at else None,
            "status": apt.status,
            "session_price": float(apt.session_price) if apt.session_price else 0,
            "patient_name": patient_name,
            "patient_email": patient_email,
            "patient_foto_url": patient_foto_url,
            "therapist_name": apt.therapist.full_name if apt.therapist else "Desconhecido",
            "therapist_foto_url": therapist_foto_url,
            "therapist_id": apt.therapist_user_id,
            "patient_user_id": apt.patient_user_id
        })

    therapists = db.query(TherapistProfile).all()
    therapists_list = []
    for t in therapists:
        user = db.get(User, t.user_id)
        therapists_list.append({
            "id": t.user_id,
            "name": t.full_name or (user.full_name if user else None) or (user.email if user else "Terapeuta")
        })

    total_revenue = sum(float(apt.session_price or 0) for apt in completed_appointments)
    print(f"   Gráfico: {len(chart_data)} dias | Sessões: {len(sessions_list)} | Terapeutas: {len(therapists_list)} | Receita: R$ {total_revenue}")

    return {
        "chart_data": chart_data,
        "sessions": sessions_list,
        "therapists": therapists_list,
        "summary": {
            "total_revenue": total_revenue,
            "total_sessions": len(completed_appointments),
            "total_therapists": len(therapists_list)
        }
    }


# ==========================
# 🔥 RELATÓRIO POR TERAPEUTA - VALORES LÍQUIDOS
# ==========================
@router.get("/terapeutas")
def get_relatorio_terapeutas(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    from sqlalchemy.orm import joinedload
    print(f"\n📊 [ADMIN] Relatório por Terapeuta (valores líquidos)")
    
    commissions = db.query(Commission).filter(Commission.is_refund == False).all()
    net_amount_map = {}
    for c in commissions:
        net_amount_map[c.appointment_id] = float(c.net_amount)
    
    start = datetime.now() - timedelta(days=90)
    end = datetime.now()
    
    completed_appointments = db.query(Appointment).filter(
        Appointment.starts_at >= start,
        Appointment.starts_at <= end,
        Appointment.status == "completed"
    ).all()
    
    daily = {}
    for apt in completed_appointments:
        date_key = apt.starts_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"revenue": 0, "sessions": 0}
        net_val = net_amount_map.get(apt.id, float(apt.session_price or 0))
        daily[date_key]["revenue"] += net_val
        daily[date_key]["sessions"] += 1
    
    chart_data = []
    cumulative = 0
    for date_str in sorted(daily.keys()):
        revenue = daily[date_str]["revenue"]
        cumulative += revenue
        chart_data.append({"date": date_str, "day": int(date_str.split('-')[2]), "revenue": revenue, "sessions": daily[date_str]["sessions"], "cumulative": cumulative})
    
    all_sessions = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.therapist)
    ).order_by(Appointment.starts_at.desc()).limit(500).all()
    
    sessions_list = []
    for apt in all_sessions:
        patient_name = None
        patient_email = None
        patient_foto_url = None
        therapist_foto_url = None
        
        session_price = net_amount_map.get(apt.id, float(apt.session_price or 0))
        
        if apt.patient:
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient.id).first()
            if patient_profile and patient_profile.full_name:
                patient_name = patient_profile.full_name
            elif apt.patient.full_name:
                patient_name = apt.patient.full_name
            else:
                patient_name = f"Paciente #{apt.patient_user_id}"
            patient_email = apt.patient.email or ""
            patient_foto_url = patient_profile.foto_url if patient_profile else None
        
        if apt.therapist:
            therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == apt.therapist.id).first()
            therapist_foto_url = therapist_profile.foto_url if therapist_profile else None
        
        sessions_list.append({
            "id": apt.id,
            "starts_at": apt.starts_at.isoformat() if apt.starts_at else None,
            "status": apt.status,
            "session_price": session_price,
            "patient_name": patient_name,
            "patient_email": patient_email,
            "patient_foto_url": patient_foto_url,
            "therapist_name": apt.therapist.full_name if apt.therapist else "Desconhecido",
            "therapist_foto_url": therapist_foto_url,
            "therapist_id": apt.therapist_user_id,
            "patient_user_id": apt.patient_user_id
        })
    
    therapists = db.query(TherapistProfile).all()
    therapists_list = []
    for t in therapists:
        user = db.get(User, t.user_id)
        therapists_list.append({
            "id": t.user_id,
            "name": t.full_name or (user.full_name if user else None) or (user.email if user else "Terapeuta")
        })
    
    total_revenue = 0
    total_sessions = 0
    for apt in completed_appointments:
        net_val = net_amount_map.get(apt.id, float(apt.session_price or 0))
        total_revenue += net_val
        total_sessions += 1
    
    return {
        "chart_data": chart_data,
        "sessions": sessions_list,
        "therapists": therapists_list,
        "summary": {
            "total_revenue": total_revenue,
            "total_sessions": total_sessions,
            "total_therapists": len(therapists_list)
        }
    }


# ==========================
# 🔥 RELATÓRIO DA PLATAFORMA - VERSÃO CORRIGIDA (BUSCA TODAS AS SESSÕES)
# ==========================
@router.get("/plataforma")
def get_relatorio_plataforma(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """
    Retorna relatório de comissões da plataforma
    Busca TODAS as sessões (como o dashboard) e calcula a comissão em tempo real
    """
    from sqlalchemy.orm import joinedload
    print(f"\n📊 [ADMIN] Relatório da Plataforma (comissões - todas as sessões)")
    
    # Configurar datas
    if not start_date:
        start = datetime.now() - timedelta(days=90)
    else:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    
    if not end_date:
        end = datetime.now()
    else:
        end = datetime.strptime(end_date, "%Y-%m-%d")
    end = end.replace(hour=23, minute=59, second=59)
    
    # 🔥 BUSCAR TODAS AS SESSÕES (como no dashboard)
    all_sessions = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.therapist)
    ).order_by(Appointment.starts_at.desc()).limit(500).all()
    
    # 🔥 MAPA DE COMISSÕES (para sessões que já têm)
    commissions_map = {}
    commissions = db.query(Commission).filter(Commission.is_refund == False).all()
    for c in commissions:
        commissions_map[c.appointment_id] = {
            "commission_amount": float(c.commission_amount),
            "commission_rate": float(c.commission_rate)
        }
    
    # Função para calcular comissão baseada no plano do terapeuta
    def get_commission_amount(therapist_user_id: int, session_price: float, db: Session) -> float:
        # Buscar perfil do terapeuta
        therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == therapist_user_id).first()
        if not therapist_profile:
            return session_price * 0.20  # padrão 20%
        
        # Buscar assinatura ativa
        subscription = db.query(Subscription).filter(
            Subscription.therapist_id == therapist_profile.id,
            Subscription.status == "active"
        ).first()
        
        if not subscription or subscription.plan == "essencial":
            return session_price * 0.20
        elif subscription.plan == "profissional":
            return session_price * 0.10
        elif subscription.plan == "premium":
            return session_price * 0.03
        return session_price * 0.20
    
    # 1. GRÁFICO (comissão por dia)
    daily = {}
    for apt in all_sessions:
        # Verificar se a sessão está no período
        if start_date and apt.starts_at < start:
            continue
        if end_date and apt.starts_at > end:
            continue
        
        date_key = apt.starts_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"comissao": 0, "sessoes": 0}
        
        # Calcular comissão
        if apt.id in commissions_map:
            comissao = commissions_map[apt.id]["commission_amount"]
        else:
            # Calcular comissão baseada no plano (apenas para sessões que geram receita)
            if apt.status in ["completed", "confirmed", "scheduled"]:
                comissao = get_commission_amount(apt.therapist_user_id, float(apt.session_price or 0), db)
            else:
                comissao = 0
        
        daily[date_key]["comissao"] += comissao
        if comissao > 0:
            daily[date_key]["sessoes"] += 1
    
    chart_data = []
    cumulative = 0
    for date_str in sorted(daily.keys()):
        comissao = daily[date_str]["comissao"]
        cumulative += comissao
        chart_data.append({
            "date": date_str,
            "day": int(date_str.split('-')[2]),
            "comissao": comissao,
            "sessoes": daily[date_str]["sessoes"],
            "cumulative": cumulative
        })
    
    # 2. LISTA DE SESSÕES
    sessions_list = []
    for apt in all_sessions:
        # Verificar se a sessão está no período
        if start_date and apt.starts_at < start:
            continue
        if end_date and apt.starts_at > end:
            continue
        
        patient_name = None
        patient_email = None
        patient_foto_url = None
        therapist_foto_url = None
        
        # Calcular comissão
        if apt.id in commissions_map:
            comissao = commissions_map[apt.id]["commission_amount"]
        else:
            # Calcular comissão baseada no plano (apenas para sessões que geram receita)
            if apt.status in ["completed", "confirmed", "scheduled"]:
                comissao = get_commission_amount(apt.therapist_user_id, float(apt.session_price or 0), db)
            else:
                comissao = 0
        
        if apt.patient:
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient.id).first()
            if patient_profile and patient_profile.full_name:
                patient_name = patient_profile.full_name
            elif apt.patient.full_name:
                patient_name = apt.patient.full_name
            else:
                patient_name = f"Paciente #{apt.patient_user_id}"
            patient_email = apt.patient.email or ""
            patient_foto_url = patient_profile.foto_url if patient_profile else None
        
        if apt.therapist:
            therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == apt.therapist.id).first()
            therapist_foto_url = therapist_profile.foto_url if therapist_profile else None
        
        sessions_list.append({
            "id": apt.id,
            "starts_at": apt.starts_at.isoformat() if apt.starts_at else None,
            "status": apt.status,
            "session_price": comissao,  # 🔥 VALOR DA COMISSÃO (calculado)
            "patient_name": patient_name,
            "patient_email": patient_email,
            "patient_foto_url": patient_foto_url,
            "therapist_name": apt.therapist.full_name if apt.therapist else "Desconhecido",
            "therapist_foto_url": therapist_foto_url,
            "therapist_id": apt.therapist_user_id,
            "patient_user_id": apt.patient_user_id
        })
    
    # 3. TERAPEUTAS
    therapists = db.query(TherapistProfile).all()
    therapists_list = []
    for t in therapists:
        user = db.get(User, t.user_id)
        therapists_list.append({
            "id": t.user_id,
            "name": t.full_name or (user.full_name if user else None) or (user.email if user else "Terapeuta")
        })
    
    # 4. RESUMO
    total_comissao = sum(s["session_price"] for s in sessions_list)
    total_sessoes = len([s for s in sessions_list if s["session_price"] > 0])
    total_terapeutas = len(set(s["therapist_id"] for s in sessions_list))
    comissao_media = total_comissao / total_sessoes if total_sessoes > 0 else 0
    
    # Agrupar por plano
    por_plano = {
        "essencial": {"quantidade": 0, "comissao": 0, "sessoes": 0},
        "profissional": {"quantidade": 0, "comissao": 0, "sessoes": 0},
        "premium": {"quantidade": 0, "comissao": 0, "sessoes": 0},
        "sem_plano": {"quantidade": 0, "comissao": 0, "sessoes": 0}
    }
    
    for s in sessions_list:
        if s["session_price"] > 0:
            therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == s["therapist_id"]).first()
            plano = "sem_plano"
            if therapist_profile:
                sub = db.query(Subscription).filter(
                    Subscription.therapist_id == therapist_profile.id,
                    Subscription.status == "active"
                ).first()
                plano = sub.plan if sub else "sem_plano"
            
            if plano in por_plano:
                por_plano[plano]["quantidade"] += 1
                por_plano[plano]["comissao"] += s["session_price"]
                por_plano[plano]["sessoes"] += 1
            else:
                por_plano["sem_plano"]["quantidade"] += 1
                por_plano["sem_plano"]["comissao"] += s["session_price"]
                por_plano["sem_plano"]["sessoes"] += 1
    
    return {
        "periodo": {
            "start_date": start.isoformat() if start_date else None,
            "end_date": end.isoformat() if end_date else None
        },
        "chart_data": chart_data,
        "sessions": sessions_list,
        "therapists": therapists_list,
        "por_plano": por_plano,
        "resumo": {
            "total_comissao": total_comissao,
            "total_sessoes": total_sessoes,
            "total_terapeutas": total_terapeutas,
            "comissao_media": comissao_media
        }
    }

# ==========================
# 🔥 TODAS AS SESSÕES (TABELA)
# ==========================
@router.get("/sessions/all")
def get_all_sessions_for_admin(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    therapist_id: Optional[int] = Query(None),
    patient_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    print(f"\n📊 [ADMIN] Buscando todas as sessões")
    query = select(Appointment)
    if start_date:
        query = query.where(Appointment.starts_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        query = query.where(Appointment.starts_at <= end)
    if therapist_id:
        query = query.where(Appointment.therapist_user_id == therapist_id)
    if patient_id:
        query = query.where(Appointment.patient_user_id == patient_id)
    if status:
        query = query.where(Appointment.status == status)
    query = query.order_by(desc(Appointment.starts_at))
    total = db.execute(query).all()
    appointments = db.execute(query.offset(offset).limit(limit)).scalars().all()
    result = []
    for apt in appointments:
        patient_name = None
        patient_email = None
        patient_foto_url = None
        if apt.patient:
            if apt.patient.patient_profile and apt.patient.patient_profile.full_name:
                patient_name = apt.patient.patient_profile.full_name
            elif apt.patient.full_name:
                patient_name = apt.patient.full_name
            else:
                patient_name = f"Paciente #{apt.patient_user_id}"
            patient_email = apt.patient.email or ""
            patient_foto_url = apt.patient.foto_url
        result.append({
            "id": apt.id,
            "starts_at": apt.starts_at.isoformat(),
            "ends_at": apt.ends_at.isoformat() if apt.ends_at else None,
            "status": apt.status,
            "session_price": float(apt.session_price) if apt.session_price else 0,
            "payment_method": apt.payment_method,
            "video_call_url": apt.video_call_url,
            "patient": {"id": apt.patient.id if apt.patient else None, "full_name": patient_name, "email": patient_email, "foto_url": patient_foto_url} if apt.patient else None,
            "therapist": {"id": apt.therapist.id if apt.therapist else None, "full_name": apt.therapist.full_name if apt.therapist else "Desconhecido", "email": apt.therapist.email if apt.therapist else ""} if apt.therapist else None,
            "therapist_user_id": apt.therapist_user_id,
            "patient_user_id": apt.patient_user_id
        })
    return {"total": len(total), "limit": limit, "offset": offset, "sessions": result}