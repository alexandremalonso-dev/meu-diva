from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

database_url = os.getenv("DATABASE_URL")
print("DATABASE_URL LIDA:", repr(database_url))  # <-- ADD

engine = create_engine(database_url)

with engine.connect() as connection:
    result = connection.execute(text("SELECT 1"))
    print("Conexão bem-sucedida! Resultado:", result.scalar())
