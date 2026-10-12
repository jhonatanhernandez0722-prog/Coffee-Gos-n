"""Allow the VIEWER role and track products that disappear from inventory."""

from alembic import op
import sqlalchemy as sa


revision = "0022_viewer_role_disappearances"
down_revision = "0021_income_dates_business_tz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # El rol de solo lectura existía en la aplicación pero la base lo rechazaba al crear el usuario.
    op.drop_constraint("users_role_check", "users", type_="check")
    op.create_check_constraint("users_role_check", "users", "role IN ('ADMIN', 'SELLER', 'VIEWER')")

    op.drop_constraint("inventory_movements_movement_type_check", "inventory_movements", type_="check")
    op.create_check_constraint(
        "inventory_movements_movement_type_check",
        "inventory_movements",
        "movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'INTERNAL_USE', 'DAMAGE', 'MISSING')",
    )

    op.create_table(
        "product_disappearances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("inventory_movement_id", sa.Integer(), sa.ForeignKey("inventory_movements.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING", index=True),
        sa.Column("resolution", sa.String(20), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.CheckConstraint("quantity > 0", name="product_disappearances_quantity_check"),
        sa.CheckConstraint("status IN ('PENDING', 'RESOLVED')", name="product_disappearances_status_check"),
        sa.CheckConstraint("resolution IS NULL OR resolution IN ('FOUND', 'SALE', 'INTERNAL_USE', 'DAMAGE')", name="product_disappearances_resolution_check"),
    )


def downgrade() -> None:
    op.drop_table("product_disappearances")
    op.execute("DELETE FROM inventory_movements WHERE movement_type = 'MISSING'")
    op.drop_constraint("inventory_movements_movement_type_check", "inventory_movements", type_="check")
    op.create_check_constraint(
        "inventory_movements_movement_type_check",
        "inventory_movements",
        "movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'INTERNAL_USE', 'DAMAGE')",
    )
    op.drop_constraint("users_role_check", "users", type_="check")
    op.create_check_constraint("users_role_check", "users", "role IN ('ADMIN', 'SELLER')")
