"""
Privacidade entre terapeuta e paciente e "sessão paga" — regras decididas NO SERVIDOR (o navegador não decide nada).

SESSÃO PAGA OU COBERTA (qualquer um destes):
  - existe lançamento de débito da sessão na carteira do paciente (ledger, transaction_type 'session...')
  - existe comissão registrada para ela (só nasce depois do pagamento)
  - o crédito de um pacote foi usado nela (patient_session_uses)
  - é benefício de plano da empresa (is_empresa_benefit)
  - payment_status = 'paid'
  - ou a sessão foi REAGENDADA de uma sessão que cumpre algum item acima (a cadeia rescheduled_from_id herda o pagamento)

PACIENTE DO TERAPEUTA: tem pelo menos 1 sessão com ele que foi
  AGENDADA PELO PRÓPRIO PACIENTE (o evento de criação da primeira sessão da cadeia é do paciente; convite ou
  agendamento feito pelo terapeuta não conta), PAGA (ou coberta) e REALIZADA (status completed).

PACIENTE FREQUENTE: paciente do terapeuta com pelo menos 2 dessas sessões e a última nos últimos 60 dias (JANELA_DIAS;
passar dias=None desliga o prazo).
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

MIN_SESSOES_RELACAO = 1
MIN_SESSOES_FREQUENTE = 2
JANELA_DIAS = 60  # dias; None = sem limite de tempo
PROFUNDIDADE = 10  # limite de reagendamentos encadeados

_SQL_COBERTAS = """
SELECT a.id FROM appointments a
 WHERE a.id = ANY(:ids) AND (
        a.payment_status::text = 'paid'
     OR COALESCE(a.is_empresa_benefit, FALSE) IS TRUE
     OR EXISTS (SELECT 1 FROM ledger l WHERE l.appointment_id = a.id AND left(l.transaction_type::text, 7) = 'session')
     OR EXISTS (SELECT 1 FROM commissions c WHERE c.appointment_id = a.id AND COALESCE(c.is_refund, FALSE) = FALSE)
     OR EXISTS (SELECT 1 FROM patient_session_uses u WHERE u.appointment_id = a.id)
 )
"""


def _cobertas(db, ids) -> set:
    ids = [int(i) for i in ids]
    if not ids:
        return set()
    return {r[0] for r in db.execute(text(_SQL_COBERTAS), {"ids": ids}).all()}


def _pais(db, ids) -> dict:
    ids = [int(i) for i in ids]
    if not ids:
        return {}
    return {r[0]: r[1] for r in db.execute(text("SELECT id, rescheduled_from_id FROM appointments WHERE id = ANY(:ids)"), {"ids": ids}).all()}


def ids_pagas(db, ids) -> set:
    """Entre os ids, os que são pagos/cobertos, seguindo a cadeia de reagendamentos."""
    ids = {int(i) for i in ids}
    atual = {i: i for i in ids}  # id original -> ancestral ainda em avaliação
    resolvidos = set()
    for _ in range(PROFUNDIDADE):
        if not atual:
            break
        cobertas = _cobertas(db, set(atual.values()))
        for orig, anc in list(atual.items()):
            if anc in cobertas:
                resolvidos.add(orig)
                del atual[orig]
        if not atual:
            break
        pais = _pais(db, set(atual.values()))
        for orig, anc in list(atual.items()):
            pai = pais.get(anc)
            if pai is None:
                del atual[orig]  # chegou à raiz sem cobertura
            else:
                atual[orig] = pai
    return resolvidos


def _raizes(db, ids) -> dict:
    """id -> id da primeira sessão da cadeia de reagendamentos."""
    atual = {int(i): int(i) for i in ids}
    for _ in range(PROFUNDIDADE):
        pais = _pais(db, set(atual.values()))
        mudou = False
        for orig, anc in atual.items():
            pai = pais.get(anc)
            if pai:
                atual[orig] = int(pai)
                mudou = True
        if not mudou:
            break
    return atual


def _criadores(db, raizes) -> dict:
    raizes = [int(r) for r in raizes]
    if not raizes:
        return {}
    rows = db.execute(text(
        "SELECT DISTINCT ON (appointment_id) appointment_id, actor_user_id FROM appointment_events "
        "WHERE appointment_id = ANY(:r) AND event_type::text = 'created' ORDER BY appointment_id, id"), {"r": raizes}).all()
    return {r[0]: r[1] for r in rows}


def _sessoes_qualificadas(db, terapeuta_id: int, paciente_id: int = None) -> list:
    """[(paciente_id, starts_at)] das sessões realizadas, pagas/cobertas e agendadas pelo próprio paciente."""
    sql = ("SELECT id, patient_user_id, starts_at, COALESCE(is_empresa_benefit, FALSE) AS emp FROM appointments "
           "WHERE therapist_user_id = :t AND status::text = 'completed'")
    params = {"t": int(terapeuta_id)}
    if paciente_id is not None:
        sql += " AND patient_user_id = :p"
        params["p"] = int(paciente_id)
    rows = db.execute(text(sql), params).all()
    if not rows:
        return []
    ids = [r[0] for r in rows]
    pagas = ids_pagas(db, ids)
    raizes = _raizes(db, ids)
    criadores = _criadores(db, set(raizes.values()))
    out = []
    for r in rows:
        sid, pid, ini, emp = r[0], r[1], r[2], r[3]
        if sid not in pagas:
            continue
        if not emp and criadores.get(raizes[sid]) != pid:  # plano da empresa: o próprio colaborador agenda
            continue
        out.append((pid, ini))
    return out


def eh_paciente_do_terapeuta(db, terapeuta_id: int, paciente_id: int) -> bool:
    return len(_sessoes_qualificadas(db, terapeuta_id, paciente_id)) >= MIN_SESSOES_RELACAO


def _agrupar(db, terapeuta_id: int) -> dict:
    por = defaultdict(list)
    for pid, ini in _sessoes_qualificadas(db, terapeuta_id):
        por[pid].append(ini)
    return por


def _montar(db, achados) -> list:
    """
    achados: [(paciente_id, n_sessoes, ultima_sessao)]. Devolve só o que o terapeuta pode ver: identificação e foto.
    NUNCA telefone nem e-mail (contato por fora da plataforma). 'email' e 'phone' vão vazios só para as telas antigas não quebrarem.
    """
    try:
        from app.routes import appointments as _ap  # usa os modelos que o sistema já carrega
        User, PatientProfile = _ap.User, _ap.PatientProfile
    except Exception:
        User = PatientProfile = None
    out = []
    for pid, n, ultima in achados:
        nome = foto = None
        if User is not None:
            try:
                u = db.get(User, pid)
                pp = db.query(PatientProfile).filter(PatientProfile.user_id == pid).first()
                nome = getattr(pp, "full_name", None) or getattr(u, "full_name", None)
                foto = getattr(pp, "foto_url", None)
            except Exception:
                pass
        out.append({"id": pid, "user_id": pid, "full_name": nome or f"Paciente #{pid}", "email": "", "phone": "",
                    "foto_url": foto, "session_count": n, "last_session": ultima.isoformat() if ultima else None,
                    "is_frequent": n >= MIN_SESSOES_FREQUENTE, "is_blocked": False})
    return out


def pacientes_do_terapeuta(db, terapeuta_id: int) -> list:
    """Todos os pacientes DESTE terapeuta (>= 1 sessão agendada por eles, paga e realizada), mais recentes primeiro."""
    achados = [(pid, len(d), max(d)) for pid, d in _agrupar(db, terapeuta_id).items() if len(d) >= MIN_SESSOES_RELACAO]
    achados.sort(key=lambda x: x[2], reverse=True)
    return _montar(db, achados)


def pacientes_frequentes(db, terapeuta_id: int, min_sessoes: int = MIN_SESSOES_FREQUENTE, dias=JANELA_DIAS, agora=None) -> list:
    agora = agora or datetime.now(timezone.utc)
    limite = (agora - timedelta(days=dias)) if dias is not None else None
    achados = [(pid, len(d), max(d)) for pid, d in _agrupar(db, terapeuta_id).items()
               if len(d) >= min_sessoes and (limite is None or max(d) >= limite)]
    achados.sort(key=lambda x: (x[1], x[2]), reverse=True)  # mais sessões primeiro; empate: a mais recente
    return _montar(db, achados)


def visiveis_para_terapeuta(db, rows, terapeuta_id: int) -> list:
    """
    Agenda do terapeuta: só entram as sessões PAGAS ou cobertas (e nunca convites ou tentativas não pagas, qualquer
    que seja o status). As sessões em que o próprio terapeuta é o paciente continuam como estão.
    """
    do_terapeuta = [a for a in rows if a.therapist_user_id == terapeuta_id and a.patient_user_id != terapeuta_id]
    pagas = ids_pagas(db, [a.id for a in do_terapeuta])
    return [a for a in rows if not (a.therapist_user_id == terapeuta_id and a.patient_user_id != terapeuta_id) or a.id in pagas]
