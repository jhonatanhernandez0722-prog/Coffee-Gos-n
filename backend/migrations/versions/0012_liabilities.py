"""Add balance sheet liabilities."""

from alembic import op
import sqlalchemy as sa


revision = "0012_liabilities"
down_revision = "0011_expense_settlement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "liabilities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_liabilities_kind", "liabilities", ["kind"])
    op.create_index("ix_liabilities_status", "liabilities", ["status"])


def downgrade() -> None:
    op.drop_index("ix_liabilities_status", table_name="liabilities")
    op.drop_index("ix_liabilities_kind", table_name="liabilities")
    op.drop_table("liabilities")