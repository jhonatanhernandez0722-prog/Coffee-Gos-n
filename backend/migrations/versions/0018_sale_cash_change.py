"""Add cash received and change amounts to sales."""

from alembic import op
import sqlalchemy as sa


revision = "0018_sale_cash_change"
down_revision = "0017_product_combos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("amount_received", sa.Numeric(12, 2), nullable=True))
    op.add_column("sales", sa.Column("change_amount", sa.Numeric(12, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("sales", "change_amount")
    op.drop_column("sales", "amount_received")
