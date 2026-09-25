"""Add audit records for opening balance corrections."""

from alembic import op
import sqlalchemy as sa


revision = "0019_opening_balance_corrections"
down_revision = "0018_sale_cash_change"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "opening_balance_corrections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("cash_before", sa.Numeric(12, 2), nullable=False),
        sa.Column("cash_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("nequi_before", sa.Numeric(12, 2), nullable=False),
        sa.Column("nequi_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_opening_balance_corrections_user_id", "opening_balance_corrections", ["user_id"])
    op.create_index("ix_opening_balance_corrections_created_at", "opening_balance_corrections", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_opening_balance_corrections_created_at", table_name="opening_balance_corrections")
    op.drop_index("ix_opening_balance_corrections_user_id", table_name="opening_balance_corrections")
    op.drop_table("opening_balance_corrections")