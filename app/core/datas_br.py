"""asaas-fuso: datas e horas para o USUARIO: sempre em horario de BRASILIA (America/Sao_Paulo) e com nomes em PORTUGUES.
O banco guarda UTC; formatar direto mostrava 3 horas a mais (sessao das 07:15 aparecia como 10:15 no e-mail). Datas puras (date) nao tem hora e passam sem conversao."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

BR = ZoneInfo("America/Sao_Paulo")
MESES = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro")


def para_local(dt, tz=BR):
    if isinstance(dt, datetime):
        if dt.tzinfo is None:  # o banco guarda UTC: sem fuso = UTC
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(tz)
    return dt


def hora_local(dt, tz=BR):
    return para_local(dt, tz).strftime("%H:%M")


def data_local(dt, tz=BR):
    return para_local(dt, tz).strftime("%d/%m/%Y")


def data_hora_local(dt, tz=BR):
    return para_local(dt, tz).strftime("%d/%m/%Y às %H:%M")


def data_hora_curta_local(dt, tz=BR):
    return para_local(dt, tz).strftime("%d/%m às %H:%M")


def data_extenso(dt, tz=BR):
    d = para_local(dt, tz)
    return f"{d.day:02d} de {MESES[d.month - 1]} de {d.year}"
