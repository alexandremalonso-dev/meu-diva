#!/usr/bin/env python3
"""
Descobre os planos de assinatura no Mercado Pago e vincula cada plano de paciente
(patient_plans) ao plano certo, comparando o valor.

Uso (na pasta /var/www/meudiva):
  .venv/bin/python link_patient_plans.py            -> só mostra (não grava nada)
  .venv/bin/python link_patient_plans.py --apply    -> grava onde houver exatamente 1 candidato
"""
import os
import sys

sys.path.insert(0, "/var/www/meudiva")
os.environ.setdefault("ENV", "prod")

from app.core.env_loader import load_environment
load_environment()

import requests
from sqlalchemy import create_engine, text

APPLY = "--apply" in sys.argv
token = os.getenv("MP_ACCESS_TOKEN", "")
if not token:
    print("MP_ACCESS_TOKEN não encontrado no ambiente.")
    sys.exit(1)

H = {"Authorization": f"Bearer {token}"}
r = requests.get("https://api.mercadopago.com/preapproval_plan/search", headers=H, timeout=20)
if not r.ok:
    print("Erro ao listar planos no Mercado Pago:", r.status_code, r.text[:200])
    sys.exit(1)

body = r.json()
planos_mp = body.get("results", [])
paging = body.get("paging") or {}
print(f"Planos no Mercado Pago: {len(planos_mp)} (total informado: {paging.get('total', 'n/d')})")
if paging.get("total") and paging["total"] > len(planos_mp):
    print("⚠️ Há mais planos do que a página trouxe. Se faltar algum, me avise.")

print("\n=== Planos no Mercado Pago ===")
for p in planos_mp:
    a = p.get("auto_recurring") or {}
    print(
        p.get("id"), "|", p.get("reason"), "|", p.get("status"),
        "| valor:", a.get("transaction_amount"),
        "| dia:", a.get("billing_day"),
        "| proporcional:", a.get("billing_day_proportional"),
        "| teste:", a.get("free_trial"),
        "| repeticoes:", a.get("repetitions"),
        "| back_url:", p.get("back_url"),
    )

engine = create_engine(os.getenv("DATABASE_URL"))
print("\n=== Vínculo com patient_plans ===")
with engine.begin() as conn:
    rows = conn.execute(text(
        "SELECT chave, nome, preco_mensal, mp_plan_id FROM patient_plans ORDER BY sessoes_mensais"
    )).all()
    for chave, nome, preco, atual in rows:
        candidatos = [
            p for p in planos_mp
            if p.get("status") == "active"
            and abs(float((p.get("auto_recurring") or {}).get("transaction_amount") or 0) - float(preco)) < 0.005
        ]
        if atual:
            print(f"{chave}: já vinculado a {atual}")
            continue
        if len(candidatos) == 1:
            cid = candidatos[0]["id"]
            if APPLY:
                conn.execute(text("UPDATE patient_plans SET mp_plan_id = :m, updated_at = now() WHERE chave = :c"), {"m": cid, "c": chave})
                print(f"{chave}: VINCULADO a {cid} ({candidatos[0].get('reason')})")
            else:
                print(f"{chave}: vincularia a {cid} ({candidatos[0].get('reason')}). Use --apply para gravar.")
        elif len(candidatos) == 0:
            print(f"{chave}: nenhum plano ativo de R$ {preco} encontrado no Mercado Pago")
        else:
            print(f"{chave}: {len(candidatos)} planos ativos de R$ {preco}. Não vinculei, escolha pelo admin:")
            for c in candidatos:
                print("    ", c["id"], "|", c.get("reason"))
