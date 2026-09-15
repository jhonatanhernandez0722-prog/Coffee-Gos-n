"""Add optional seller assignment and sale support images."""

from alembic import op
import sqlalchemy as sa


revision = "0005_sale_assignment_supports"
down_revision = "0004_product_restock_quantity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("assigned_seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_sales_assigned_seller_id", "sales", ["assigned_seller_id"])
    op.create_table(
        "sale_supports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sale_id", sa.Integer(), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sale_supports_sale_id", "sale_supports", ["sale_id"])


def downgrade() -> None:
    op.drop_index("ix_sale_supports_sale_id", table_name="sale_supports")
    op.drop_table("sale_supports")
    op.drop_index("ix_sales_assigned_seller_id", table_name="sales")
    op.drop_column("sales", "assigned_seller_id")