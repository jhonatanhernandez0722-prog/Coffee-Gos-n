"""Add units to products."""

from alembic import op
import sqlalchemy as sa


revision = "0013_product_units"
down_revision = "0012_liabilities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("unit", sa.String(length=20), nullable=False, server_default="UNIT"))


def downgrade() -> None:
    op.drop_column("products", "unit")