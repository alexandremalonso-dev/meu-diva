#!/usr/bin/env python3
"""
Testa o crédito dos pacotes SEM o Mercado Pago: monta eventos de mentira e confere o que o
serviço grava. Tudo o que cria usa o prefixo TEST e é apagado no fim.
Os alertas por e-mail são SUBSTITUÍDOS por um contador: este teste não envia e-mail nenhum.

Uso (em /var/www/meudiva):  .venv/bin/python test_patient_packages.py
"""
import os
import sys

sys.path.insert(0, os.environ.get("APP_DIR", "/var/www/meudiva"))
if not os.environ.get("SKIP_ENV"):
    os.environ.setdefault("ENV", "prod")
    from app.core.env_loader import load_environment
    load_environment()

from sqlalchemy import text
from app.db.database import SessionLocal
import app.services.patient_packages as svc
from app.services.patient_packages import handle_patient_package_event, grant_lot_manually

alertas = []
svc._notify_admin = lambda subject, lines: alertas.append(subject)

db = SessionLocal()
SUB = "TESTSUB" + "0" * 25
falhas = 0


def check(nome, ok, detalhe=""):
    global falhas
    print(("PASS " if ok else "FAIL ") + nome + (f" | {detalhe}" if detalhe else ""))
    if not ok:
        falhas += 1


def lotes():
    return db.execute(text("SELECT count(*) FROM patient_session_lots WHERE mp_charge_id LIKE 'TEST%'")).scalar()


def assinaturas():
    return db.execute(text("SELECT count(*) FROM patient_plan_subscriptions WHERE mp_subscription_id = :s"), {"s": SUB}).scalar()


def n_alertas(trecho):
    return sum(1 for a in alertas if trecho in a)


def limpar():
    db.rollback()
    db.execute(text("DELETE FROM patient_session_lots WHERE mp_charge_id LIKE 'TEST%' OR mp_payment_id LIKE 'TEST%'"))
    db.execute(text("DELETE FROM patient_plan_subscriptions WHERE mp_subscription_id = :s"), {"s": SUB})
    db.commit()


try:
    limpar()
    plan = db.execute(text(
        "SELECT id, chave, mp_plan_id, preco_mensal, sessoes_mensais FROM patient_plans "
        "WHERE mp_plan_id IS NOT NULL ORDER BY sessoes_mensais LIMIT 1"
    )).first()
    patient = db.execute(text("SELECT id FROM users WHERE role::text = 'patient' ORDER BY id LIMIT 1")).first()
    therapist = db.execute(text("SELECT id FROM users WHERE role::text = 'therapist' ORDER BY id LIMIT 1")).first()
    if not plan or not patient:
        print("Faltam dados para o teste (plano vinculado ao Mercado Pago ou um paciente).")
        sys.exit(2)
    print(f"Usando o plano {plan.chave} (R$ {plan.preco_mensal}, {plan.sessoes_mensais} sessão(ões)) e o paciente {patient.id}\n")

    ref = f"patient_{patient.id}_plan_{plan.chave}"
    pre = {
        "preapproval_plan_id": plan.mp_plan_id,
        "external_reference": ref,
        "status": "authorized",
        "next_payment_date": "2026-11-06T12:00:00.000-03:00",
        "payer_email": "teste@example.com",
    }
    aprovada = {"id": "TESTCHARGE1", "transaction_amount": float(plan.preco_mensal), "payment": {"id": "TESTPAY1", "status": "approved"}}

    check("plano que não é de paciente devolve False", handle_patient_package_event(db, {"preapproval_plan_id": "0" * 32}, None, SUB) is False)
    check("sem external_reference: True, nada gravado, ALERTA",
          handle_patient_package_event(db, {**pre, "external_reference": ""}, aprovada, SUB) is True
          and assinaturas() == 0 and lotes() == 0 and n_alertas("SEM identificação") == 1)
    check("referência de outro plano: nada gravado, ALERTA",
          handle_patient_package_event(db, {**pre, "external_reference": f"patient_{patient.id}_plan_outro"}, aprovada, SUB) is True
          and assinaturas() == 0 and lotes() == 0 and n_alertas("não confere") == 1)
    if therapist:
        check("usuário que não é paciente: nada gravado, ALERTA",
              handle_patient_package_event(db, {**pre, "external_reference": f"patient_{therapist.id}_plan_{plan.chave}"}, aprovada, SUB) is True
              and assinaturas() == 0 and lotes() == 0 and n_alertas("não é paciente") == 1)
    antes = len(alertas)
    check("sem referência mas SEM cobrança aprovada: não alerta",
          handle_patient_package_event(db, {**pre, "external_reference": ""}, None, SUB) is True and len(alertas) == antes)
    check("assinatura sem cobrança: grava a assinatura, nenhum lote, sem alerta",
          handle_patient_package_event(db, pre, None, SUB) is True and assinaturas() == 1 and lotes() == 0 and len(alertas) == antes)
    check("cobrança recusada: nenhum lote, sem alerta",
          handle_patient_package_event(db, pre, {**aprovada, "payment": {"id": "TESTPAYR", "status": "rejected"}}, SUB) is True
          and lotes() == 0 and len(alertas) == antes)
    check("cobrança de valor menor que o plano: nenhum lote, ALERTA",
          handle_patient_package_event(db, pre, {**aprovada, "transaction_amount": float(plan.preco_mensal) / 2}, SUB) is True
          and lotes() == 0 and n_alertas("valor menor") == 1)
    check("cobrança aprovada: cria 1 lote e avisa a venda",
          handle_patient_package_event(db, pre, aprovada, SUB) is True and lotes() == 1 and n_alertas("Nova venda") == 1)
    lote = db.execute(text(
        "SELECT sessions_total, payout_per_session, valid_until - valid_from AS dur FROM patient_session_lots WHERE mp_charge_id = 'TESTCHARGE1'"
    )).first()
    check("o lote tem as sessões do plano", lote is not None and lote.sessions_total == plan.sessoes_mensais, str(lote))
    check("o lote vale entre 28 e 31 dias", lote is not None and 28 <= lote.dur.days <= 31, str(lote.dur if lote else None))
    check("evento repetido não duplica e não avisa de novo",
          handle_patient_package_event(db, pre, aprovada, SUB) is True and lotes() == 1 and n_alertas("Nova venda") == 1)
    check("mesmo pagamento com OUTRO id de cobrança não duplica",
          handle_patient_package_event(db, pre, {**aprovada, "id": "TESTCHARGEX"}, SUB) is True and lotes() == 1)
    check("segunda cobrança (outra, outro pagamento) cria outro lote",
          handle_patient_package_event(db, pre, {**aprovada, "id": "TESTCHARGE2", "payment": {"id": "TESTPAY2", "status": "approved"}}, SUB) is True
          and lotes() == 2 and n_alertas("Nova venda") == 2)

    # ---- crédito manual ----
    r = grant_lot_manually(db, patient.id, plan.chave, "TESTMAN1")
    check("manual: simulação não grava", r["ok"] and "SIMULAÇÃO" in r["message"] and lotes() == 2, r["message"][:70])
    r = grant_lot_manually(db, patient.id, plan.chave, "TESTMAN1", apply=True)
    check("manual: apply cria o lote", r["ok"] and r["lot_id"] and lotes() == 3 and n_alertas("Crédito manual") == 1, r["message"][:70])
    r = grant_lot_manually(db, patient.id, plan.chave, "TESTMAN1", apply=True)
    check("manual: repetir não duplica", (not r["ok"]) and lotes() == 3, r["message"][:70])
    check("manual: depois o webhook com esse pagamento não duplica",
          handle_patient_package_event(db, pre, {**aprovada, "id": "TESTOUTRO", "payment": {"id": "TESTMAN1", "status": "approved"}}, SUB) is True and lotes() == 3)
    check("manual: plano inexistente", not grant_lot_manually(db, patient.id, "nao_existe", "TESTMAN2", apply=True)["ok"] and lotes() == 3)
    if therapist:
        check("manual: usuário que não é paciente", not grant_lot_manually(db, therapist.id, plan.chave, "TESTMAN3", apply=True)["ok"] and lotes() == 3)
    check("manual: sem ID", not grant_lot_manually(db, patient.id, plan.chave, "", apply=True)["ok"])
finally:
    limpar()
    print(f"\nLimpeza feita. Sobras: lotes={lotes()} assinaturas={assinaturas()}")
    db.close()

print("RESULTADO:", "TUDO OK" if falhas == 0 else f"{falhas} FALHA(S)")
sys.exit(1 if falhas else 0)
