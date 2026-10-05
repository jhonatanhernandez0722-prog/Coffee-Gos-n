"""Move date-only financial records to Colombia time instead of UTC."""

from alembic import op


revision = "0021_income_dates_business_tz"
down_revision = "0020_damage_as_cost"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Medianoche UTC equivale a las 7 p. m. del día anterior en Colombia: el ingreso caía en otro día.
    op.execute(
        """
        UPDATE financial_movements
        SET occurred_at = occurred_at + INTERVAL '17 hours'
        WHERE movement_type = 'INCOME'
          AND sale_id IS NULL
          AND income_type IS DISTINCT FROM 'OPENING_BALANCE'
          AND occurred_at IS NOT NULL
          AND (occurred_at AT TIME ZONE 'UTC')::time = '00:00:00'
        """
    )
    # La fecha de pago de un crédito es la del último abono, en hora de Colombia.
    op.execute(
        """
        UPDATE credits AS credit
        SET paid_at = payments.last_paid_on
        FROM (
            SELECT sale_id, MAX(created_at AT TIME ZONE 'America/Bogota')::date AS last_paid_on
            FROM financial_movements
            WHERE movement_type = 'INCOME' AND sale_id IS NOT NULL
            GROUP BY sale_id
        ) AS payments
        WHERE credit.sale_id = payments.sale_id
          AND credit.status = 'PAID'
          AND credit.paid_at IS DISTINCT FROM payments.last_paid_on
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE financial_movements
        SET occurred_at = occurred_at - INTERVAL '17 hours'
        WHERE movement_type = 'INCOME'
          AND sale_id IS NULL
          AND income_type IS DISTINCT FROM 'OPENING_BALANCE'
          AND occurred_at IS NOT NULL
          AND (occurred_at AT TIME ZONE 'UTC')::time = '17:00:00'
        """
    )
