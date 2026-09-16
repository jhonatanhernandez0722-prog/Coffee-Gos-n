"""Track when pending expenses are deducted."""

from alembic import op
import sqlalchemy as sa


revision = "0011_expense_settlement"
down_revision = "0010_income_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_movements", sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_financial_movements_settled_at", "financial_movements", ["settled_at"])


def downgrade() -> None:
    op.drop_index("ix_financial_movements_settled_at", table_name="financial_movements")
    op.drop_column("financial_movements", "settled_at")