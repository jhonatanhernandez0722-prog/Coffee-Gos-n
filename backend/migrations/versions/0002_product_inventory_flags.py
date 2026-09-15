"""Add product image and saleability flags."""

from alembic import op
import sqlalchemy as sa


revision = "0002_product_inventory_flags"
down_revision = "0001_initial_domain"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("image_url", sa.String(length=500), nullable=True))
    op.add_column("products", sa.Column("is_saleable", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("products", "is_saleable")
    op.drop_column("products", "image_url")
