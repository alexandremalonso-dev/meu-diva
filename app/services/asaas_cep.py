"""
Consulta de CEP para o formulario de cartao (preenche rua/bairro/cidade ao digitar o CEP). Fonte principal: ViaCEP; reserva: BrasilAPI.
Resposta normalizada: {cep, logradouro, bairro, cidade, uf}. Cache em memoria por 24 h. Nao e dado sensivel: so devolve o endereco publico do CEP.
404 = CEP nao existe nas duas fontes; 502 = nenhuma fonte respondeu (a tela continua funcionando, so sem o autopreenchimento).
"""
import os
import re
import time

import requests
from fastapi import HTTPException

_CACHE = {}
_TTL, _MAX = 86400, 2000
ESPERA = (3, 4)


def _viacep(cep):
    r = requests.get(os.getenv("ASAAS_CEP_VIACEP_URL", "https://viacep.com.br/ws").rstrip("/") + f"/{cep}/json/", timeout=ESPERA)
    if r.status_code in (400, 404):
        return None
    r.raise_for_status()
    d = r.json()
    if not isinstance(d, dict) or d.get("erro"):
        return None
    return {"logradouro": d.get("logradouro") or "", "bairro": d.get("bairro") or "", "cidade": d.get("localidade") or "", "uf": d.get("uf") or ""}


def _brasilapi(cep):
    r = requests.get(os.getenv("ASAAS_CEP_BRASILAPI_URL", "https://brasilapi.com.br/api/cep/v1").rstrip("/") + f"/{cep}", timeout=ESPERA)
    if r.status_code in (400, 404):
        return None
    r.raise_for_status()
    d = r.json()
    if not isinstance(d, dict) or not (d.get("city") or d.get("street")):
        return None
    return {"logradouro": d.get("street") or "", "bairro": d.get("neighborhood") or "", "cidade": d.get("city") or "", "uf": d.get("state") or ""}


def consultar(cep_bruto) -> dict:
    cep = re.sub(r"\D", "", str(cep_bruto or ""))
    if len(cep) != 8:
        raise HTTPException(status_code=400, detail="CEP inválido.")
    hit = _CACHE.get(cep)
    if hit and hit[0] > time.time():
        return hit[1]
    falhou = False
    for fonte in (_viacep, _brasilapi):
        try:
            d = fonte(cep)
        except (requests.RequestException, ValueError):
            falhou = True
            continue
        if d:
            out = {"cep": f"{cep[:5]}-{cep[5:]}", **d}
            if len(_CACHE) >= _MAX:
                _CACHE.clear()
            _CACHE[cep] = (time.time() + _TTL, out)
            return out
    if falhou:
        raise HTTPException(status_code=502, detail="Não foi possível consultar o CEP agora.")
    raise HTTPException(status_code=404, detail="CEP não encontrado.")
