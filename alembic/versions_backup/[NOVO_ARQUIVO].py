"""add_rescheduled_from_id_to_appointments

Revision ID: (gerado automaticamente)
Revises: 819586b99488
Create Date: 2026-03-05 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'xxxxx'  # Substitua pelo gerado
down_revision = '819586b99488'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('appointments', sa.Column('rescheduled_from_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_appointments_rescheduled_from', 'appointments', 'appointments', ['rescheduled_from_id'], ['id'])

def downgrade():
    op.drop_constraint('fk_appointments_rescheduled_from', 'appointments', type_='foreignkey')
    op.drop_column('appointments', 'rescheduled_from_id')