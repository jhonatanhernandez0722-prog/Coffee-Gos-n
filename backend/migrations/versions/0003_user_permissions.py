"""Add seller permissions."""

from alembic import op
import sqlalchemy as sa


revision = "0003_user_permissions"
down_revision = "0002_product_inventory_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section", sa.String(length=40), nullable=False),
        sa.UniqueConstraint("user_id", "section", name="uq_user_permissions_user_section"),
    )
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])
    op.create_index("ix_user_permissions_section", "user_permissions", ["section"])


def downgrade() -> None:
    op.drop_index("ix_user_permissions_section", table_name="user_permissions")
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_table("user_permissions")