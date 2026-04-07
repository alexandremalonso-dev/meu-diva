"""
Adiciona campos de Google Calendar integração.

Como rodar:
  cd C:\\meu-diva
  .venv\\Scripts\\activate
  python fix_google_calendar_migration.py
"""
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # 1. therapist_profiles — token OAuth e flag de ativação
    cols = db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'therapist_profiles'
        AND column_name IN ('google_calendar_token', 'google_calendar_enabled')
    """)).fetchall()
    existing = {r[0] for r in cols}

    if 'google_calendar_token' not in existing:
        db.execute(text("ALTER TABLE therapist_profiles ADD COLUMN google_calendar_token JSONB"))
        print("✅ Coluna google_calendar_token adicionada")
    else:
        print("✅ google_calendar_token já existe")

    if 'google_calendar_enabled' not in existing:
        db.execute(text("ALTER TABLE therapist_profiles ADD COLUMN google_calendar_enabled BOOLEAN DEFAULT FALSE"))
        print("✅ Coluna google_calendar_enabled adicionada")
    else:
        print("✅ google_calendar_enabled já existe")

    # 2. appointments — id do evento criado no Google Calendar
    apt_cols = db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'google_calendar_event_id'
    """)).fetchall()

    if not apt_cols:
        db.execute(text("ALTER TABLE appointments ADD COLUMN google_calendar_event_id VARCHAR(255)"))
        print("✅ Coluna google_calendar_event_id adicionada em appointments")
    else:
        print("✅ google_calendar_event_id já existe")

    db.commit()
    print("\n✅ Migration concluída com sucesso!")

except Exception as e:
    db.rollback()
    print(f"❌ Erro: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()