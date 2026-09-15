"""Add per-product restock quantity."""

from alembic import op
import sqlalchemy as sa


revision = "0004_product_restock_quantity"
down_revision = "0003_user_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("restock_quantity", sa.Numeric(12, 3), nullable=False, server_default="10"))


def downgrade() -> None:
    op.drop_column("products", "restock_quantity")