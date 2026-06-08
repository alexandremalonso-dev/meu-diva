# Adicionar este modelo ao banco para salvar oauth state
# back/app/models/oauth_state.py

from sqlalchemy import Column, String, DateTime
from datetime import datetime, timedelta
from app.db.database import Base

class OAuthState(Base):
    __tablename__ = "oauth_states"

    state = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def is_expired(self):
        return datetime.utcnow() > self.created_at + timedelta(minutes=10)