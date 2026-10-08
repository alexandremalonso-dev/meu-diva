#!/usr/bin/env python3
"""Envia UM e-mail de teste do alerta de pacotes (para PAYMENT_ALERT_EMAIL ou contato@meudivaonline.com)."""
import os
import sys

sys.path.insert(0, "/var/www/meudiva")
os.environ.setdefault("ENV", "prod")
from app.core.env_loader import load_environment
load_environment()

from app.services.patient_packages import _send_alert

destino = os.getenv("PAYMENT_ALERT_EMAIL") or "contato@meudivaonline.com"
ok = _send_alert(
    "Teste de alerta de pacotes",
    "<p>Se você recebeu este e-mail, os alertas de venda de pacotes estão funcionando.</p>",
)
print(f"Destino: {destino}")
print("Envio confirmado pelo serviço de e-mail." if ok else "O serviço de e-mail NÃO confirmou o envio (veja a linha acima).")
sys.exit(0 if ok else 1)
