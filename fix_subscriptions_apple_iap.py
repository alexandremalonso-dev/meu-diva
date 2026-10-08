from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    result = db.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'subscriptions'
        AND column_name IN ('payment_provider', 'apple_original_transaction_id')
    """)).fetchall()

    existing_cols = {r[0] for r in result}

    if "payment_provider" not in existing_cols:
        db.execute(text("""
            ALTER TABLE subscriptions
            ADD COLUMN payment_provider VARCHAR(20) NOT NULL DEFAULT 'mercadopago'
        """))
        print("Coluna payment_provider adicionada")
    else:
        print("Coluna payment_provider ja existe")

    if "apple_original_transaction_id" not in existing_cols:
        db.execute(text("""
            ALTER TABLE subscriptions
            ADD COLUMN apple_original_transaction_id VARCHAR(255)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_subscriptions_apple_original_transaction_id
            ON subscriptions (apple_original_transaction_id)
        """))
        print("Coluna apple_original_transaction_id adicionada com indice")
    else:
        print("Coluna apple_original_transaction_id ja existe")

    db.commit()
    print("Migration concluida com sucesso")

except Exception as e:
    db.rollback()
    print(f"Erro: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
