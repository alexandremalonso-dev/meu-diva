"""add_rescheduled_from_id_to_appointments

Revision ID: d5f6c5a23e92
Revises: 6a3a15206fc1
Create Date: 2026-03-05 00:20:53.307400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f6c5a23e92'
down_revision: Union[str, Sequence[str], None] = '6a3a15206fc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
