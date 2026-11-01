"""
Cliente minimo da API do Asaas (v3). Ambiente por ASAAS_MODE: "sandbox" (PADRAO, sem dinheiro de verdade) ou "production".
Chaves: ASAAS_API_KEY_SANDBOX e ASAAS_API_KEY (producao), lidas do .env.prod. A chave NUNCA e registrada em log nem devolvida em mensagem de erro.
Regras da documentacao do Asaas: cabecalho access_token + User-Agent obrigatorio; tempo de espera >= 60 s; nao repetir criacao as cegas.
"""
import os
import re

import requests

BASES = {"sandbox": "https://api-sandbox.asaas.com/v3", "production": "https://api.asaas.com/v3"}
USER_AGENT = "MeuDiva/1.0 (+https://meudivaonline.com)"


class AsaasErro(Exception):
    def __init__(self, mensagem, status=0, detalhe=""):
        super().__init__(mensagem)
        self.status = status
        self.detalhe = detalhe


def modo() -> str:
    return "production" if os.getenv("ASAAS_MODE", "sandbox").strip().lower() == "production" else "sandbox"


def _chave() -> str:
    return os.getenv("ASAAS_API_KEY" if modo() == "production" else "ASAAS_API_KEY_SANDBOX", "").strip()


def configurado() -> bool:
    return bool(_chave())


def base_url() -> str:
    return (os.getenv("ASAAS_API_BASE_URL") or BASES[modo()]).rstrip("/")


def _limpar(texto: str) -> str:
    t = re.sub(r"\$?aact_[A-Za-z0-9_=+/.-]+", "<chave>", str(texto or ""))
    return re.sub(r"[A-Za-z0-9_+/=$.-]{40,}", "<oculto>", t)[:300]


def chamar(metodo: str, caminho: str, corpo=None, espera: int = 60):
    chave = _chave()
    if not chave:
        raise AsaasErro("chave do Asaas nao configurada", 0)
    try:
        r = requests.request(metodo, base_url() + caminho, json=corpo, timeout=(10, espera),
                             headers={"access_token": chave, "Content-Type": "application/json", "User-Agent": USER_AGENT})
    except requests.RequestException as e:
        raise AsaasErro("falha de comunicacao com o Asaas", 0, type(e).__name__)
    try:
        dados = r.json() if r.content else {}
    except ValueError:
        dados = {}
    print(f"[asaas] {metodo} {caminho.split('?')[0]} -> {r.status_code}")
    if r.status_code >= 400:
        erros = dados.get("errors") if isinstance(dados, dict) else None
        desc = "; ".join(str(e.get("description", "")) for e in erros if isinstance(e, dict)) if isinstance(erros, list) else ""
        raise AsaasErro(f"Asaas respondeu {r.status_code}", r.status_code, _limpar(desc))
    return dados


def criar_checkout(corpo: dict) -> dict:
    return chamar("POST", "/checkouts", corpo)


def cancelar_checkout(checkout_id: str) -> dict:
    return chamar("POST", f"/checkouts/{checkout_id}/cancel")
