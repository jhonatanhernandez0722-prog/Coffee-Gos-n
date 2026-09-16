"""Add independent income metadata."""

from alembic import op
import sqlalchemy as sa


revision = "0009_manual_income_fields"
down_revision = "0008_expenses_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_movements", sa.Column("income_type", sa.String(length=30), nullable=True))
    op.add_column("financial_movements", sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_financial_movements_income_type", "financial_movements", ["income_type"])
    op.create_index("ix_financial_movements_occurred_at", "financial_movements", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_financial_movements_occurred_at", table_name="financial_movements")
    op.drop_index("ix_financial_movements_income_type", table_name="financial_movements")
    op.drop_column("financial_movements", "occurred_at")
    op.drop_column("financial_movements", "income_type")
