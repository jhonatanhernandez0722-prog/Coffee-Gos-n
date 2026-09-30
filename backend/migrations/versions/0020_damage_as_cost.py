"""Record inventory damage as a cost instead of a cash expense."""

from alembic import op


revision = "0020_damage_as_cost"
down_revision = "0019_opening_balance_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("financial_movements_movement_type_check", "financial_movements", type_="check")
    op.create_check_constraint(
        "financial_movements_movement_type_check",
        "financial_movements",
        "movement_type IN ('INCOME', 'EXPENSE', 'COST')",
    )
    # Los daños no mueven dinero: dejan de restar caja y de sumar a gastos.
    op.execute(
        """
        UPDATE financial_movements
        SET movement_type = 'COST', payment_method = NULL, settled_at = NULL
        WHERE movement_type = 'EXPENSE'
          AND expense_category_id IN (SELECT id FROM expense_categories WHERE name ILIKE 'Daño de inventario')
        """
    )
    op.execute(
        """
        UPDATE inventory_movements AS inventory
        SET financial_movement_id = financial.id
        FROM financial_movements AS financial
        WHERE inventory.movement_type = 'DAMAGE'
          AND inventory.financial_movement_id IS NULL
          AND financial.movement_type = 'COST'
          AND financial.created_at = inventory.created_at
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE financial_movements
        SET movement_type = 'EXPENSE', payment_method = 'CASH', settled_at = created_at
        WHERE movement_type = 'COST'
        """
    )
    op.drop_constraint("financial_movements_movement_type_check", "financial_movements", type_="check")
    op.create_check_constraint(
        "financial_movements_movement_type_check",
        "financial_movements",
        "movement_type IN ('INCOME', 'EXPENSE')",
    )
