# asaas-pulso: "assinatura" barata do estado das sessoes que o usuario enxerga. O painel pergunta isto a cada 30 s e so recarrega tudo quando a assinatura MUDA.
import hashlib
import json


def _texto(valor):
    if valor is None:
        return ""
    if hasattr(valor, "value"):
        valor = valor.value
    if hasattr(valor, "isoformat"):
        return valor.isoformat()
    return str(valor)


def assinatura_sessoes(rows):
    """Recebe as sessoes (as MESMAS que a tela mostraria) e devolve {"signature": ..., "count": ...}.
    Muda quando muda qualquer coisa que a tela mostra: o que entra ou sai, o status, o horario, o pagamento, o preco ou o link da sala."""
    itens = sorted(
        [
            _texto(getattr(a, "id", None)),
            _texto(getattr(a, "status", None)),
            _texto(getattr(a, "starts_at", None)),
            _texto(getattr(a, "ends_at", None)),
            _texto(getattr(a, "payment_status", None)),
            _texto(getattr(a, "session_price", None)),
            _texto(getattr(a, "video_call_url", None)),
        ]
        for a in rows
    )
    bruto = json.dumps(itens, ensure_ascii=False, separators=(",", ":"))
    return {"signature": hashlib.md5(bruto.encode("utf-8")).hexdigest()[:16], "count": len(itens)}
