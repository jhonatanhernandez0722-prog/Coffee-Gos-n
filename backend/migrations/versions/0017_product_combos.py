"""Add combo products and component relations."""

from alembic import op
import sqlalchemy as sa


revision = "0017_product_combos"
down_revision = "0016_link_purchase_movements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("is_combo", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_products_is_combo", "products", ["is_combo"])
    op.create_table(
        "combo_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("combo_product_id", sa.Integer(), nullable=False),
        sa.Column("component_product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_combo_component_quantity_positive"),
        sa.ForeignKeyConstraint(["combo_product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["component_product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("combo_product_id", "component_product_id", name="uq_combo_component_product"),
    )
    op.create_index("ix_combo_components_combo_product_id", "combo_components", ["combo_product_id"])
    op.create_index("ix_combo_components_component_product_id", "combo_components", ["component_product_id"])
    op.add_column("inventory_movements", sa.Column("source_combo_product_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_inventory_movements_source_combo_product_id", "inventory_movements", "products", ["source_combo_product_id"], ["id"])
    op.create_index("ix_inventory_movements_source_combo_product_id", "inventory_movements", ["source_combo_product_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_source_combo_product_id", table_name="inventory_movements")
    op.drop_constraint("fk_inventory_movements_source_combo_product_id", "inventory_movements", type_="foreignkey")
    op.drop_column("inventory_movements", "source_combo_product_id")
    op.drop_index("ix_combo_components_component_product_id", table_name="combo_components")
    op.drop_index("ix_combo_components_combo_product_id", table_name="combo_components")
    op.drop_table("combo_components")
    op.drop_index("ix_products_is_combo", table_name="products")
    op.drop_column("products", "is_combo")
