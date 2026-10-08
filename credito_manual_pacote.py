#!/usr/bin/env python3
"""
Concede o crédito de um pacote que o paciente PAGOU mas que não virou crédito no sistema
(por exemplo, assinatura feita por um link mpago.la, ou webhook que falhou).

Sem --apply só SIMULA. É seguro rodar de novo: o mesmo ID não gera dois lotes.

Uso (em /var/www/meudiva):
  .venv/bin/python credito_manual_pacote.py --user 123 --plan no_diva_04 --charge 1234567890
  .venv/bin/python credito_manual_pacote.py --user 123 --plan no_diva_04 --charge 1234567890 --apply

--charge = o ID do pagamento (ou da cobrança) que aparece no painel do Mercado Pago.
--amount = só se o valor pago foi diferente do preço do plano.
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.environ.get("APP_DIR", "/var/www/meudiva"))
if not os.environ.get("SKIP_ENV"):
    os.environ.setdefault("ENV", "prod")
    from app.core.env_loader import load_environment
    load_environment()

from app.db.database import SessionLocal
from app.services.patient_packages import grant_lot_manually

ap = argparse.ArgumentParser(description="Crédito manual de pacote")
ap.add_argument("--user", type=int, required=True, help="id do usuário paciente")
ap.add_argument("--plan", required=True, help="chave do plano, por exemplo no_diva_04")
ap.add_argument("--charge", required=True, help="ID do pagamento/cobrança no Mercado Pago")
ap.add_argument("--amount", type=float, default=None, help="valor pago, se diferente do preço do plano")
ap.add_argument("--apply", action="store_true", help="grava de verdade (sem isso só simula)")
args = ap.parse_args()

db = SessionLocal()
try:
    r = grant_lot_manually(db, args.user, args.plan, args.charge, amount=args.amount, apply=args.apply)
finally:
    db.close()

print(("OK: " if r["ok"] else "NÃO FEITO: ") + r["message"])
if r["ok"] and args.apply:
    time.sleep(2)  # dá tempo de o alerta por e-mail (em segundo plano) sair
sys.exit(0 if r["ok"] else 1)
