"""
Gestao (cancelar, pausar, retomar) das assinaturas do ASAAS, chamada pelas MESMAS rotas de "Meu plano" (terapeuta) e "Meus pacotes" (paciente).
Cada operacao usa o ambiente em que a assinatura foi criada (uma assinatura de teste no Sandbox e gerida com a chave do Sandbox).
Se o Asaas nao confirmar, devolve erro ao usuario e NADA muda no nosso banco.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text

from app.services import asaas_client as ac

BR = timezone(timedelta(hours=-3))
MSG = "Não foi possível {acao} agora no Asaas. Tente de novo em instantes ou fale com a gente."


def _ambiente(db, sub_id):
    r = db.execute(text("SELECT ambiente FROM asaas_assinaturas WHERE asaas_subscription_id = :s"), {"s": sub_id}).first()
    return r[0] if r else ac.modo()


def _marcar(db, sub_id, status):
    db.execute(text("UPDATE asaas_assinaturas SET status = :st, atualizada_em = now() WHERE asaas_subscription_id = :s"), {"st": status, "s": sub_id})


def cancelar_assinatura_asaas(db, sub_id):
    try:
        ac.remover_assinatura(sub_id, ambiente=_ambiente(db, sub_id))
    except ac.AsaasErro as e:
        if e.status != 404:  # 404 = ja removida la: tudo certo
            print(f"❌ [ASAAS] cancelar {sub_id}: {e} {e.detalhe}")
            raise HTTPException(status_code=502, detail=MSG.format(acao="cancelar"))
    _marcar(db, sub_id, "DELETED")


def pausar_assinatura_asaas(db, sub_id):
    try:
        ac.atualizar_assinatura(sub_id, {"status": "INACTIVE"}, ambiente=_ambiente(db, sub_id))
    except ac.AsaasErro as e:
        print(f"❌ [ASAAS] pausar {sub_id}: {e} {e.detalhe}")
        raise HTTPException(status_code=502, detail=MSG.format(acao="pausar"))
    _marcar(db, sub_id, "INACTIVE")


def retomar_assinatura_asaas(db, sub_id, fim_do_periodo=None):
    """Reativar exige novo nextDueDate (documentacao do Asaas): a data de fim do periodo ja pago, se ainda no futuro; senao, hoje."""
    hoje = datetime.now(BR).date()
    prox = hoje
    if isinstance(fim_do_periodo, datetime):
        prox = max(hoje, fim_do_periodo.date())
    elif isinstance(fim_do_periodo, date):
        prox = max(hoje, fim_do_periodo)
    try:
        ac.atualizar_assinatura(sub_id, {"status": "ACTIVE", "nextDueDate": prox.isoformat()}, ambiente=_ambiente(db, sub_id))
    except ac.AsaasErro as e:
        print(f"❌ [ASAAS] retomar {sub_id}: {e} {e.detalhe}")
        raise HTTPException(status_code=502, detail=MSG.format(acao="reativar"))
    _marcar(db, sub_id, "ACTIVE")


def cancelar_pacote_asaas(db, user, sub):
    """Cancela o pacote do paciente (mesmas mensagens do fluxo do Mercado Pago)."""
    cancelar_assinatura_asaas(db, sub.mp_subscription_id)
    db.execute(text("UPDATE patient_plan_subscriptions SET status = 'cancelled', updated_at = now() WHERE id = :i"), {"i": sub.id})
    db.commit()
    ate = db.execute(text("SELECT max(valid_until) FROM patient_session_lots WHERE patient_user_id = :u AND valid_until > now()"), {"u": user.id}).scalar()
    print(f"🗓️ [PACOTE] assinatura Asaas {sub.mp_subscription_id} cancelada (paciente {user.id})")
    msg = "Pacote cancelado. Não haverá novas cobranças."
    if ate:
        msg += f" As sessões já pagas continuam valendo até {ate.strftime('%d/%m/%Y')}."
    return {"message": msg, "valid_until": ate.isoformat() if ate else None}
