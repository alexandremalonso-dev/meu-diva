"""asaas-agenda: link "Adicionar ao Google Agenda" (nao exige conexao nem autorizacao do usuario).
Os horarios vao em UTC (formato que o Google espera) e o fuso de exibicao e Brasilia."""
from datetime import timezone
from urllib.parse import quote, urlencode


def _utc(dt):
    if dt.tzinfo is None:  # o banco guarda UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def link_google_agenda(inicio, fim, titulo, detalhes="", local=None):
    params = {
        "action": "TEMPLATE",
        "text": titulo,
        "dates": _utc(inicio).strftime("%Y%m%dT%H%M%S") + "Z/" + _utc(fim).strftime("%Y%m%dT%H%M%S") + "Z",
        "ctz": "America/Sao_Paulo",
    }
    if detalhes:
        params["details"] = detalhes
    if local:
        params["location"] = local
    return "https://calendar.google.com/calendar/render?" + urlencode(params, quote_via=quote)
