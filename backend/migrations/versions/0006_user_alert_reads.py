"""Track dashboard alert reads per user."""

from alembic import op
import sqlalchemy as sa


revision = "0006_user_alert_reads"
down_revision = "0005_sale_assignment_supports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_reads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_id", sa.String(length=120), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "alert_id", name="uq_alert_reads_user_alert"),
    )
    op.create_index("ix_alert_reads_user_id", "alert_reads", ["user_id"])
    op.create_index("ix_alert_reads_alert_id", "alert_reads", ["alert_id"])


def downgrade() -> None:
    op.drop_index("ix_alert_reads_alert_id", table_name="alert_reads")
    op.drop_index("ix_alert_reads_user_id", table_name="alert_reads")
    op.drop_table("alert_reads")