"""Add product presentation content fields."""

from alembic import op
import sqlalchemy as sa


revision = "0015_product_presentation"
down_revision = "0014_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("content_quantity", sa.Numeric(12, 3), nullable=True))
    op.add_column("products", sa.Column("content_unit", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "content_unit")
    op.drop_column("products", "content_quantity")