"""Add expense categories and payment method tracking."""

from alembic import op
import sqlalchemy as sa


revision = "0008_expenses_metrics"
down_revision = "0007_internal_use_seller"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expense_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_expense_categories_name", "expense_categories", ["name"])
    op.add_column("financial_movements", sa.Column("payment_method", sa.String(length=20), nullable=True))
    op.add_column("financial_movements", sa.Column("expense_category_id", sa.Integer(), sa.ForeignKey("expense_categories.id"), nullable=True))
    op.create_index("ix_financial_movements_expense_category_id", "financial_movements", ["expense_category_id"])


def downgrade() -> None:
    op.drop_index("ix_financial_movements_expense_category_id", table_name="financial_movements")
    op.drop_column("financial_movements", "expense_category_id")
    op.drop_column("financial_movements", "payment_method")
    op.drop_index("ix_expense_categories_name", table_name="expense_categories")
    op.drop_table("expense_categories")