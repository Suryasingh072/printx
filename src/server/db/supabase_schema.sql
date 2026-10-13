-- ============================================================================
-- printx - Complete Supabase Database Schema
-- Run this in Supabase: Project Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Shop owners, staff, platform administrators)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    whatsapp_verified BOOLEAN DEFAULT FALSE,
    whatsapp_otp TEXT,
    whatsapp_otp_expires_at TIMESTAMPTZ,
    role TEXT DEFAULT 'shop_owner',
    reset_token TEXT,
    reset_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shops Table
CREATE TABLE IF NOT EXISTS public.shops (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    upi_id TEXT,
    rejection_reason TEXT,
    activated_at TIMESTAMPTZ,
    activated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shop Pricing
CREATE TABLE IF NOT EXISTS public.shop_pricing (
    id TEXT PRIMARY KEY,
    shop_id TEXT UNIQUE NOT NULL,
    bw_single_price NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
    bw_duplex_price NUMERIC(10, 2) NOT NULL DEFAULT 3.00,
    color_single_price NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    color_duplex_price NUMERIC(10, 2) NOT NULL DEFAULT 18.00,
    legal_extra NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    photo_4x6_price NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
    id_card_single_price NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    currency TEXT DEFAULT 'INR',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shop Approval Rules
CREATE TABLE IF NOT EXISTS public.shop_approval_rules (
    id TEXT PRIMARY KEY,
    shop_id TEXT UNIQUE NOT NULL,
    mode TEXT DEFAULT 'smart',
    max_auto_pages INTEGER DEFAULT 10,
    max_auto_amount NUMERIC(10, 2) DEFAULT 50.00,
    require_payment_before_print BOOLEAN DEFAULT TRUE,
    notify_whatsapp BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Windows Agents
CREATE TABLE IF NOT EXISTS public.windows_agents (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    pairing_code TEXT,
    pairing_code_expires_at TIMESTAMPTZ,
    auth_token_hash TEXT,
    status TEXT DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ,
    default_printer TEXT,
    bw_printer TEXT,
    color_printer TEXT,
    installed_printers JSONB DEFAULT '[]'::jsonb,
    ip_address TEXT,
    app_version TEXT DEFAULT '2.4.0',
    dry_run_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    shop_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    document_name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    copies INTEGER NOT NULL DEFAULT 1,
    color_mode TEXT NOT NULL DEFAULT 'bw',
    duplex_mode TEXT NOT NULL DEFAULT 'single',
    paper_size TEXT NOT NULL DEFAULT 'A4',
    order_type TEXT NOT NULL DEFAULT 'document',
    page_range TEXT DEFAULT 'all',
    custom_notes TEXT,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending_approval',
    rejection_reason TEXT,
    payment_status TEXT DEFAULT 'unpaid',
    payment_collected_at TIMESTAMPTZ,
    payment_collector_name TEXT,
    payment_method TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    printed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    document_retention_until TIMESTAMPTZ,
    is_document_purged BOOLEAN DEFAULT FALSE,
    purged_at TIMESTAMPTZ,
    purge_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_name TEXT NOT NULL,
    changed_by_id TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'collected',
    collected_by TEXT NOT NULL,
    notes TEXT,
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Print Jobs
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    agent_id TEXT,
    printer_name TEXT NOT NULL,
    claim_token TEXT,
    status TEXT DEFAULT 'pending',
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    shop_id TEXT,
    user_id TEXT,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop ON public.print_jobs(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_shop ON public.windows_agents(shop_id);

-- Disable Row Level Security (RLS) so Anon API Key can read & write smoothly
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_approval_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.windows_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;

-- Grant Full Permissions to anon and authenticated roles
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shops TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shop_pricing TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shop_approval_rules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.windows_agents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.order_status_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.print_jobs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.activity_logs TO anon, authenticated, service_role;
