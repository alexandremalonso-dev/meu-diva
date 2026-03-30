from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "64ef71ee74d5"
down_revision = "367dabbc547d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) cria o TYPE no Postgres
    user_role = sa.Enum(
        "patient",
        "therapist",
        "company_admin",
        "admin",
        name="user_role",
    )
    user_role.create(op.get_bind(), checkfirst=True)

    # 2) adiciona a coluna usando o TYPE
    op.add_column(
        "users",
        sa.Column(
            "role",
            user_role,
            nullable=False,
            server_default="patient",
        ),
    )

    # 3) remove o default depois de preencher (boa prática)
    op.alter_column("users", "role", server_default=None)


def downgrade() -> None:
    # 1) remove a coluna
    op.drop_column("users", "role")

    # 2) remove o TYPE
    user_role = sa.Enum(
        "patient",
        "therapist",
        "company_admin",
        "admin",
        name="user_role",
    )
    user_role.drop(op.get_bind(), checkfirst=True)