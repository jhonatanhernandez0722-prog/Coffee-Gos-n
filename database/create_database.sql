-- SQL estándar para crear las tablas de Coffee Gosen.
-- Ejecutar seleccionando previamente la base de datos: coffee_gosen.
-- La base de datos debe crearse desde el panel de administración del editor.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'SELLER'
                    CHECK (role IN ('ADMIN', 'SELLER')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section         VARCHAR(40) NOT NULL,
    UNIQUE (user_id, section)
);

CREATE TABLE IF NOT EXISTS categories (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id                  BIGSERIAL PRIMARY KEY,
    category_id         BIGINT NOT NULL REFERENCES categories(id),
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    image_url           VARCHAR(500),
    is_saleable         BOOLEAN NOT NULL DEFAULT TRUE,
    sale_price          NUMERIC(12, 2) NOT NULL CHECK (sale_price >= 0),
    acquisition_cost    NUMERIC(12, 2) NOT NULL CHECK (acquisition_cost >= 0),
    stock               NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold NUMERIC(12, 3) NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    restock_quantity    NUMERIC(12, 3) NOT NULL DEFAULT 10 CHECK (restock_quantity > 0),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    identifier      VARCHAR(80) UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id              BIGSERIAL PRIMARY KEY,
    sale_number     VARCHAR(30) NOT NULL UNIQUE,
    customer_id     BIGINT REFERENCES customers(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    assigned_seller_id BIGINT REFERENCES users(id),
    payment_method  VARCHAR(20) NOT NULL
                    CHECK (payment_method IN ('CASH', 'NEQUI', 'CREDIT')),
    subtotal        NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    total           NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_supports (
    id              BIGSERIAL PRIMARY KEY,
    sale_id         BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
    id                  BIGSERIAL PRIMARY KEY,
    sale_id             BIGINT NOT NULL REFERENCES sales(id),
    product_id          BIGINT NOT NULL REFERENCES products(id),
    quantity            NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost_snapshot  NUMERIC(12, 2) NOT NULL CHECK (unit_cost_snapshot >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    movement_type   VARCHAR(20) NOT NULL
                    CHECK (movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT', 'INTERNAL_USE')),
    quantity        NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    stock_after     NUMERIC(12, 3) NOT NULL CHECK (stock_after >= 0),
    sale_id         BIGINT REFERENCES sales(id),
    observation     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_movements (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    movement_type   VARCHAR(20) NOT NULL
                    CHECK (movement_type IN ('INCOME', 'EXPENSE')),
    amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    concept         VARCHAR(180) NOT NULL,
    sale_id         BIGINT REFERENCES sales(id),
    observation     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credits (
    id              BIGSERIAL PRIMARY KEY,
    sale_id         BIGINT NOT NULL UNIQUE REFERENCES sales(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount > 0),
    pending_amount  NUMERIC(12, 2) NOT NULL CHECK (pending_amount >= 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PAID')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at         DATE,
    CHECK (pending_amount <= original_amount),
    CHECK ((status = 'PENDING' AND paid_at IS NULL)
        OR (status = 'PAID' AND pending_amount = 0 AND paid_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_financial_created_at ON financial_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_customer_id ON credits(customer_id);

COMMIT;

-- Regla de negocio: INTERNAL_USE solo aparece en inventory_movements.
-- Nunca debe insertarse como INCOME o EXPENSE en financial_movements.