import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def reset_passwords():
    db = SessionLocal()
    try:
        # Definir as senhas que você quer usar
        users_data = [
            {"email": "admin@test.com", "password": "SenhaSegura123!"},
            {"email": "therapist@test.com", "password": "SenhaSegura123!"},
            {"email": "patient@test.com", "password": "SenhaSegura123!"},
        ]
        
        for data in users_data:
            user = db.query(User).filter(User.email == data["email"]).first()
            if user:
                user.password_hash = get_password_hash(data["password"])
                print(f"✅ Senha atualizada para: {data['email']}")
            else:
                print(f"❌ Usuário não encontrado: {data['email']}")
        
        db.commit()
        print("\n✅ Todas as senhas foram resetadas com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_passwords()