"""create_invites_table_only

Revision ID: [ID_DO_ARQUIVO]
Revises: ee0357f66880
Create Date: 2026-03-24 14:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '[ID_DO_ARQUIVO]'
down_revision = 'ee0357f66880'
branch_labels = None
depends_on = None


def upgrade():
    # 🔥 CRIAR APENAS A TABELA INVITES
    op.create_table(
        'invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('therapist_user_id', sa.Integer(), nullable=False),
        sa.Column('patient_user_id', sa.Integer(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('session_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['therapist_user_id'], ['users.id'], name='fk_invites_therapist_user_id'),
        sa.ForeignKeyConstraint(['patient_user_id'], ['users.id'], name='fk_invites_patient_user_id')
    )
    
    # 🔥 CRIAR ÍNDICES
    op.create_index('ix_invites_id', 'invites', ['id'])
    op.create_index('ix_invites_therapist_user_id', 'invites', ['therapist_user_id'])
    op.create_index('ix_invites_patient_user_id', 'invites', ['patient_user_id'])
    op.create_index('ix_invites_status', 'invites', ['status'])


def downgrade():
    # 🔥 REMOVER APENAS A TABELA INVITES
    op.drop_table('invites')