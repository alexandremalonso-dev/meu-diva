"""add slug to therapist_profiles + merge heads

Revision ID: a1b2c3d4e5f6
Revises: 27dd99433fae, create_invites_table_only
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = ('27dd99433fae', 'create_invites_table_only')
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'therapist_profiles',
        sa.Column('slug', sa.String(length=120), nullable=True)
    )
    op.create_index(
        'ix_therapist_profiles_slug',
        'therapist_profiles',
        ['slug'],
        unique=True
    )


def downgrade():
    op.drop_index('ix_therapist_profiles_slug', table_name='therapist_profiles')
    op.drop_column('therapist_profiles', 'slug')
