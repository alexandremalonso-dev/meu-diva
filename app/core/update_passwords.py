import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def update_passwords():
    db = SessionLocal()
    try:
        # Definir as novas senhas para cada usuário
        users_to_update = [
            {"email": "admin@test.com", "new_password": "SenhaSegura123!"},
            {"email": "therapist@test.com", "new_password": "SenhaSegura123!"},
            {"email": "patient@test.com", "new_password": "SenhaSegura123!"},
        ]
        
        for user_data in users_to_update:
            user = db.query(User).filter(User.email == user_data["email"]).first()
            if user:
                # Gerar novo hash da senha
                user.hashed_password = get_password_hash(user_data["new_password"])
                print(f"Senha alterada para: {user_data['email']}")
            else:
                print(f"Usuário não encontrado: {user_data['email']}")
        
        db.commit()
        print("\nTodas as senhas foram atualizadas com sucesso!")
        
    except Exception as e:
        print(f"Erro ao atualizar senhas: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_passwords()