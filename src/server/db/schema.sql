-- ============================================================================
-- ADRTech PrintQR - Production Database Schema (PostgreSQL / Supabase Compatible)
-- Recreates complete relational model with constraints, indexes, and triggers
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Shop owners, staff, platform administrators)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    whatsapp_verified BOOLEAN DEFAULT FALSE,
    whatsapp_otp VARCHAR(10),
    whatsapp_otp_expires_at TIMESTAMP WITH TIME ZONE,
    role VARCHAR(30) DEFAULT 'shop_owner' CHECK (role IN ('admin', 'shop_owner', 'shop_staff')),
    reset_token VARCHAR(255),
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);

-- 2. Shops Table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'active', 'suspended', 'rejected')),
    rejection_reason TEXT,
    activated_at TIMESTAMP WITH TIME ZONE,
    activated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);

-- 3. Shop Pricing Configuration
CREATE TABLE IF NOT EXISTS shop_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID UNIQUE NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    bw_single_price NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
    bw_duplex_price NUMERIC(10, 2) NOT NULL DEFAULT 3.00,
    color_single_price NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    color_duplex_price NUMERIC(10, 2) NOT NULL DEFAULT 18.00,
    legal_extra NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    photo_4x6_price NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
    id_card_single_price NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    currency VARCHAR(10) DEFAULT 'INR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Shop Approval Rules
CREATE TABLE IF NOT EXISTS shop_approval_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID UNIQUE NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    mode VARCHAR(20) DEFAULT 'smart' CHECK (mode IN ('manual', 'auto', 'smart')),
    max_auto_pages INTEGER DEFAULT 10,
    max_auto_amount NUMERIC(10, 2) DEFAULT 50.00,
    require_payment_before_print BOOLEAN DEFAULT TRUE,
    notify_whatsapp BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Windows Agents (Paired shop computer printers)
CREATE TABLE IF NOT EXISTS windows_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    device_name VARCHAR(150) NOT NULL,
    pairing_code VARCHAR(20),
    pairing_code_expires_at TIMESTAMP WITH TIME ZONE,
    auth_token_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'revoked')),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    default_printer VARCHAR(200),
    bw_printer VARCHAR(200),
    color_printer VARCHAR(200),
    installed_printers JSONB DEFAULT '[]'::jsonb,
    ip_address VARCHAR(50),
    app_version VARCHAR(30) DEFAULT '1.0.0',
    dry_run_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_shop ON windows_agents(shop_id);

-- 6. Orders and Uploaded Documents
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(30) UNIQUE NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    copies INTEGER NOT NULL DEFAULT 1,
    color_mode VARCHAR(20) NOT NULL DEFAULT 'bw' CHECK (color_mode IN ('bw', 'color')),
    duplex_mode VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (duplex_mode IN ('single', 'duplex')),
    paper_size VARCHAR(20) NOT NULL DEFAULT 'A4' CHECK (paper_size IN ('A4', 'Legal', 'Photo4x6')),
    order_type VARCHAR(30) NOT NULL DEFAULT 'document' CHECK (order_type IN ('document', 'id_card', 'photo')),
    page_range VARCHAR(100) DEFAULT 'all',
    custom_notes TEXT,
    -- Price snapshot at time of order creation (NEVER trust client calculations)
    unit_price NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending_approval' CHECK (status IN (
        'pending_approval', 'approved', 'payment_pending', 'queued', 'printing', 'completed', 'rejected', 'archived'
    )),
    rejection_reason TEXT,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'collected', 'refunded')),
    payment_collected_at TIMESTAMP WITH TIME ZONE,
    payment_collector_name VARCHAR(100),
    payment_method VARCHAR(30) CHECK (payment_method IN ('counter_cash', 'counter_upi', 'other')),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    printed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    document_retention_until TIMESTAMP WITH TIME ZONE,
    is_document_purged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- 7. Order Status History (Audit trail for workflow changes)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by_name VARCHAR(100) NOT NULL,
    changed_by_id UUID REFERENCES users(id),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_history ON order_status_history(order_id);

-- 8. Payments (Counter payment collection records)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(30) NOT NULL CHECK (method IN ('counter_cash', 'counter_upi')),
    status VARCHAR(20) DEFAULT 'collected' CHECK (status IN ('collected', 'refunded')),
    collected_by VARCHAR(100) NOT NULL,
    notes TEXT,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id);

-- 9. Print Jobs (Atomic claim queue for Windows Agent)
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES windows_agents(id),
    printer_name VARCHAR(200) NOT NULL,
    claim_token VARCHAR(255),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'spooling', 'printed', 'failed')),
    claimed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(shop_id, status);

-- 10. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_shop ON activity_logs(shop_id, created_at DESC);
