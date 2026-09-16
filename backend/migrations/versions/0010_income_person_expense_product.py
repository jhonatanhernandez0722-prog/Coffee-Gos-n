"""Add income person and optional expense product metadata."""

from alembic import op
import sqlalchemy as sa


revision = "0010_income_metadata"
down_revision = "0009_manual_income_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_movements", sa.Column("person_name", sa.String(length=120), nullable=True))
    op.add_column("financial_movements", sa.Column("product", sa.String(length=180), nullable=True))


def downgrade() -> None:
    op.drop_column("financial_movements", "product")
    op.drop_column("financial_movements", "person_name")