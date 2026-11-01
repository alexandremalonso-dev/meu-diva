"""Carteira do paciente: obtem a carteira e, se o paciente ainda nao tiver uma (cadastro recente), cria a carteira VAZIA (saldo 0, BRL) em vez de falhar com 404."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.wallet import Wallet


def obter_ou_criar_carteira(db, patient_id: int) -> Wallet:
    w = db.execute(select(Wallet).where(Wallet.patient_id == patient_id)).scalar_one_or_none()
    if w:
        return w
    try:
        w = Wallet(patient_id=patient_id, balance=0, currency="BRL")
        db.add(w)
        db.commit()
        db.refresh(w)
        print(f"[carteira] carteira vazia criada para o paciente {patient_id}")
        return w
    except IntegrityError:  # duas requisicoes ao mesmo tempo: a outra criou primeiro
        db.rollback()
        return db.execute(select(Wallet).where(Wallet.patient_id == patient_id)).scalar_one()
