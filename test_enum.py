from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
print(f"Conectando a: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    result = conn.execute(text("SELECT id, status FROM appointments LIMIT 5"))
    for row in result:
        print(f"ID: {row[0]}, Status: {row[1]}")
