"""asaas-carteira-evento: todo perfil de paciente novo ganha a carteira vazia (saldo 0, BRL) no mesmo instante, por qualquer caminho de cadastro."""
from sqlalchemy import event, text

from app.models.patient_profile import PatientProfile


@event.listens_for(PatientProfile, "after_insert")
def _criar_carteira_do_paciente(mapper, connection, target):
    connection.execute(
        text("INSERT INTO wallets (patient_id, balance, currency) SELECT :p, 0, 'BRL' WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE patient_id = :p)"),
        {"p": target.id},
    )
