from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Security

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User

router = APIRouter(prefix="/admin/pacientes/assinaturas", tags=["Admin - Assinaturas de Pacientes"])

LIVE = ("authorized", "pending", "paused")

# Uma sessão marcada com crédito só deixa de consumir o lote se a consulta foi cancelada ou recusada
# (mesma ideia do plano empresa: o saldo é calculado pelo status das consultas).
NAO_CONSUMIDOS = "('cancelled_by_patient','cancelled_by_therapist','cancelled_by_admin','declined')"

# Sessões restantes de um paciente = soma, nos lotes ainda válidos, de (total - consumidas)
RESTANTES_DO_PACIENTE = f"""
  (SELECT coalesce(sum(greatest(l.sessions_total - coalesce(x.used, 0), 0)), 0)
     FROM patient_session_lots l
     LEFT JOIN LATERAL (
        SELECT count(*) AS used
          FROM patient_session_uses su
          JOIN appointments a ON a.id = su.appointment_id
         WHERE su.lot_id = l.id AND a.status::text NOT IN {NAO_CONSUMIDOS}
     ) x ON TRUE
    WHERE l.patient_user_id = s.patient_user_id AND l.valid_until > now())
"""


def _iso(v):
    return v.isoformat() if v else None


@router.get("")
def relatorio_assinaturas(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    rows = db.execute(text(
        f"""
        SELECT s.id, s.status, s.current_period_end, s.created_at, s.mp_subscription_id,
               u.id AS user_id, u.email, u.full_name,
               p.chave, p.nome, p.preco_mensal, p.sessoes_mensais,
               (SELECT coalesce(sum(l.amount_paid), 0) FROM patient_session_lots l WHERE l.subscription_id = s.id) AS total_pago,
               (SELECT count(*) FROM patient_session_lots l WHERE l.subscription_id = s.id) AS cobrancas,
               (SELECT max(l.created_at) FROM patient_session_lots l WHERE l.subscription_id = s.id) AS ultima_cobranca,
               {RESTANTES_DO_PACIENTE} AS sessoes_restantes
          FROM patient_plan_subscriptions s
          JOIN users u ON u.id = s.patient_user_id
          JOIN patient_plans p ON p.id = s.plan_id
         ORDER BY s.created_at DESC
        """
    )).all()

    assinaturas = [
        {
            "id": r.id,
            "status": r.status,
            "user_id": r.user_id,
            "paciente_nome": r.full_name,
            "paciente_email": r.email,
            "plano_chave": r.chave,
            "plano_nome": r.nome,
            "preco_mensal": float(r.preco_mensal),
            "sessoes_mensais": int(r.sessoes_mensais),
            "total_pago": float(r.total_pago),
            "cobrancas": int(r.cobrancas),
            "ultima_cobranca": _iso(r.ultima_cobranca),
            "proxima_cobranca": _iso(r.current_period_end),
            "sessoes_restantes": int(r.sessoes_restantes),
            "mp_subscription_id": r.mp_subscription_id,
            "created_at": _iso(r.created_at),
        }
        for r in rows
    ]

    vivas = [a for a in assinaturas if a["status"] in LIVE]
    ativas = [a for a in assinaturas if a["status"] == "authorized"]

    disponiveis = db.execute(text(
        f"""
        SELECT coalesce(sum(greatest(l.sessions_total - coalesce(x.used, 0), 0)), 0)
          FROM patient_session_lots l
          LEFT JOIN LATERAL (
             SELECT count(*) AS used
               FROM patient_session_uses su
               JOIN appointments a ON a.id = su.appointment_id
              WHERE su.lot_id = l.id AND a.status::text NOT IN {NAO_CONSUMIDOS}
          ) x ON TRUE
         WHERE l.valid_until > now()
        """
    )).scalar()

    usadas_mes = db.execute(text(
        f"""
        SELECT count(*)
          FROM patient_session_uses su
          JOIN appointments a ON a.id = su.appointment_id
         WHERE a.status::text NOT IN {NAO_CONSUMIDOS}
           AND a.starts_at >= date_trunc('month', now())
           AND a.starts_at < date_trunc('month', now()) + interval '1 month'
        """
    )).scalar()

    vendidas = db.execute(text(
        "SELECT coalesce(sum(sessions_total), 0), coalesce(sum(amount_paid), 0) FROM patient_session_lots "
        "WHERE created_at >= date_trunc('month', now())"
    )).first()

    # Série REAL dos últimos 12 meses (mês corrente incluído), calculada das cobranças e das sessões.
    serie_rows = db.execute(text(
        f"""
        WITH meses AS (
          SELECT generate_series(date_trunc('month', now()) - interval '11 months',
                                 date_trunc('month', now()), interval '1 month') AS m
        )
        SELECT to_char(m, 'YYYY-MM') AS mes,
               (SELECT count(DISTINCT l.patient_user_id) FROM patient_session_lots l
                 WHERE l.created_at >= m AND l.created_at < m + interval '1 month') AS assinantes_pagantes,
               (SELECT coalesce(sum(l.amount_paid), 0) FROM patient_session_lots l
                 WHERE l.created_at >= m AND l.created_at < m + interval '1 month') AS receita,
               (SELECT coalesce(sum(l.sessions_total), 0) FROM patient_session_lots l
                 WHERE l.created_at >= m AND l.created_at < m + interval '1 month') AS sessoes_vendidas,
               (SELECT count(*) FROM patient_session_uses su JOIN appointments a ON a.id = su.appointment_id
                 WHERE a.status::text NOT IN {NAO_CONSUMIDOS}
                   AND a.starts_at >= m AND a.starts_at < m + interval '1 month') AS sessoes_usadas,
               (SELECT count(*) FROM patient_plan_subscriptions s
                 WHERE s.created_at >= m AND s.created_at < m + interval '1 month') AS novas_assinaturas
          FROM meses ORDER BY m
        """
    )).all()
    serie_mensal = [
        {
            "mes": r.mes,
            "assinantes_pagantes": int(r.assinantes_pagantes),
            "receita": float(r.receita),
            "sessoes_vendidas": int(r.sessoes_vendidas),
            "sessoes_usadas": int(r.sessoes_usadas),
            "novas_assinaturas": int(r.novas_assinaturas),
        }
        for r in serie_rows
    ]

    por_plano = []
    for pl in db.execute(text("SELECT chave, nome, preco_mensal, sessoes_mensais, ativo FROM patient_plans ORDER BY sessoes_mensais, preco_mensal")).all():
        do_plano = [a for a in ativas if a["plano_chave"] == pl.chave]
        por_plano.append({
            "chave": pl.chave,
            "nome": pl.nome,
            "ativo": bool(pl.ativo),
            "assinantes_ativos": len(do_plano),
            "receita_mensal": float(sum(a["preco_mensal"] for a in do_plano)),
        })

    return {
        "summary": {
            "assinantes": len({a["user_id"] for a in vivas}),
            "ativas": len(ativas),
            "em_analise": len([a for a in assinaturas if a["status"] == "pending"]),
            "pausadas": len([a for a in assinaturas if a["status"] == "paused"]),
            "canceladas": len([a for a in assinaturas if a["status"] == "cancelled"]),
            "receita_mensal_estimada": float(sum(a["preco_mensal"] for a in ativas)),
            "cobrado_no_mes": float(vendidas[1]),
            "sessoes_vendidas_no_mes": int(vendidas[0]),
            "sessoes_disponiveis": int(disponiveis or 0),
            "sessoes_usadas_no_mes": int(usadas_mes or 0),
        },
        "por_plano": por_plano,
        "serie_mensal": serie_mensal,
        "assinaturas": assinaturas,
    }
