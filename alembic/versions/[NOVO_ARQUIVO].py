"""create_invites_table_only

Revision ID: create_invites_table_only
Revises: ee0357f66880
Create Date: 2026-03-24 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'create_invites_table_only'
down_revision = 'ee0357f66880'
branch_labels = None
depends_on = None


def upgrade():
    # Verificar se a tabela já existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'invites' not in inspector.get_table_names():
        # Criar tabela invites
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
            sa.PrimaryKeyConstraint('id', name='pk_invites'),
            sa.ForeignKeyConstraint(['therapist_user_id'], ['users.id'], name='fk_invites_therapist_user_id'),
            sa.ForeignKeyConstraint(['patient_user_id'], ['users.id'], name='fk_invites_patient_user_id')
        )
        
        # Criar índices
        op.create_index('ix_invites_id', 'invites', ['id'])
        op.create_index('ix_invites_therapist_user_id', 'invites', ['therapist_user_id'])
        op.create_index('ix_invites_patient_user_id', 'invites', ['patient_user_id'])
        op.create_index('ix_invites_status', 'invites', ['status'])


def downgrade():
    # Apenas remover a tabela invites
    op.drop_index('ix_invites_status', table_name='invites')
    op.drop_index('ix_invites_patient_user_id', table_name='invites')
    op.drop_index('ix_invites_therapist_user_id', table_name='invites')
    op.drop_index('ix_invites_id', table_name='invites')
    op.drop_table('invites')