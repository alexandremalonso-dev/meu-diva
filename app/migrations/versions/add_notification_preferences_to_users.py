@"
\"\"\"
Migration: Adicionar campos de preferências de notificação na tabela users
Criado em: 10/04/2026
\"\"\"

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = 'add_notification_preferences'
down_revision = None  # Ajuste conforme sua última migração
branch_labels = None
depends_on = None

def upgrade():
    # Adicionar coluna email_notifications_enabled
    op.add_column('users', sa.Column(
        'email_notifications_enabled',
        sa.Boolean(),
        server_default='true',
        nullable=False
    ))
    
    # Adicionar coluna email_preferences (JSON)
    op.add_column('users', sa.Column(
        'email_preferences',
        JSON,
        nullable=True
    ))


def downgrade():
    # Remover colunas
    op.drop_column('users', 'email_notifications_enabled')
    op.drop_column('users', 'email_preferences')
"@ | Out-File -FilePath "app\migrations\versions\add_notification_preferences_to_users.py" -Encoding utf8