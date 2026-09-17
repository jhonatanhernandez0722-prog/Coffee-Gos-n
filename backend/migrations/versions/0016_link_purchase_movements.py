"""Link inventory purchases to their financial movement."""

from alembic import op
import sqlalchemy as sa


revision = "0016_link_purchase_movements"
down_revision = "0015_product_presentation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory_movements", sa.Column("financial_movement_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_inventory_movements_financial_movement_id", "inventory_movements", "financial_movements", ["financial_movement_id"], ["id"])
    op.create_index("ix_inventory_movements_financial_movement_id", "inventory_movements", ["financial_movement_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_financial_movement_id", table_name="inventory_movements")
    op.drop_constraint("fk_inventory_movements_financial_movement_id", "inventory_movements", type_="foreignkey")
    op.drop_column("inventory_movements", "financial_movement_id")