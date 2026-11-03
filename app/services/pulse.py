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


# asaas-pulso-admin: assinatura da PLATAFORMA INTEIRA (so o admin a pede). Muda quando muda qualquer coisa que o painel e a lista de sessoes do admin mostram:
# sessoes (estado completo), usuarios (quantos, ativos), pagamentos, disponibilidade e assinaturas/planos. Tabelas e colunas sao conferidas na hora: o que nao existe e ignorado.
_TABELAS_PLATAFORMA = ("users", "payments", "availability_slots", "subscriptions", "patient_subscriptions", "patient_plan_subscriptions", "empresa_planos", "patient_plans")
_COLUNAS_CACHE = {}


def _colunas(db, tabela):
    from sqlalchemy import text
    guardado = _COLUNAS_CACHE.get(tabela)
    if guardado:
        return guardado
    linhas = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :t"), {"t": tabela}).all()
    cols = {r[0] for r in linhas}
    if cols:  # so guarda tabela que EXISTE: uma tabela que passa a existir depois entra sozinha na assinatura
        _COLUNAS_CACHE[tabela] = cols
    return cols


def assinatura_plataforma(db):
    from sqlalchemy import text
    partes = []
    apt = db.execute(text(
        "SELECT count(*), md5(coalesce(string_agg(concat_ws('|', id, status::text, starts_at, ends_at, payment_status, session_price, video_call_url), ',' ORDER BY id), '')) FROM appointments"
    )).one()
    partes.append(f"apt:{apt[0]}:{apt[1]}")
    for t in _TABELAS_PLATAFORMA:
        cols = _colunas(db, t)
        if not cols:
            continue
        itens = ["count(*)"]
        if "id" in cols:
            itens.append("coalesce(max(id), 0)")
        if "updated_at" in cols:
            itens.append("coalesce(max(updated_at)::text, '')")
        if "is_active" in cols:
            itens.append("coalesce(sum(CASE WHEN is_active THEN 1 ELSE 0 END), 0)")
        if "status" in cols and "id" in cols:
            itens.append("md5(coalesce(string_agg(id::text || ':' || coalesce(status::text, ''), ',' ORDER BY id), ''))")
        linha = db.execute(text("SELECT " + ", ".join(itens) + " FROM " + t)).one()
        partes.append(t + ":" + ":".join(str(x) for x in linha))
    return {"signature": hashlib.md5("|".join(partes).encode("utf-8")).hexdigest()[:16], "count": apt[0]}
