"""Store seller assigned to internal inventory use."""

from alembic import op
import sqlalchemy as sa


revision = "0007_internal_use_seller"
down_revision = "0006_user_alert_reads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory_movements", sa.Column("assigned_seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_inventory_movements_assigned_seller_id", "inventory_movements", ["assigned_seller_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_assigned_seller_id", table_name="inventory_movements")
    op.drop_column("inventory_movements", "assigned_seller_id")