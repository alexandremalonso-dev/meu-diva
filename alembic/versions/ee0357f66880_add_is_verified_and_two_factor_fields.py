"""add_is_verified_and_two_factor_fields

Revision ID: ee0357f66880
Revises: 98af45db5ce1
Create Date: 2026-03-24 11:23:53.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ee0357f66880'
down_revision = '98af45db5ce1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 🔥 Apenas adicionar as colunas na tabela users
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # 🔥 Remover as colunas
    op.drop_column('users', 'two_factor_enabled')
    op.drop_column('users', 'is_verified')