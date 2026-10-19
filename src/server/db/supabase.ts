import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_FILE = path.resolve(process.cwd(), './data/supabase.config.json');

export interface SupabaseSyncStatus {
  connected: boolean;
  url: string;
  hasServiceRoleKey: boolean;
  lastSyncedAt?: string;
  mode: 'service_role' | 'tables' | 'snapshot' | 'rls_blocked' | 'connecting' | 'error';
  error?: string;
  sqlFix?: string;
  shopsCount?: number;
}

interface StoredSupabaseConfig {
  url?: string;
  serviceRoleKey?: string;
  anonKey?: string;
}

function loadConfig(): StoredSupabaseConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('Could not read supabase.config.json:', e);
  }
  return {};
}

function saveConfigFile(cfg: StoredSupabaseConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write supabase.config.json:', e);
  }
}

class SupabaseService {
  private client!: SupabaseClient;
  private url: string = '';
  private key: string = '';
  private serviceRoleKey: string = '';
  private sessionToken: string | null = null;
  private status: SupabaseSyncStatus = {
    connected: false,
    url: '',
    hasServiceRoleKey: false,
    mode: 'connecting',
  };

  constructor() {
    this.reconfigure();
  }

  public reconfigure(): void {
    const stored = loadConfig();

    this.url =
      stored.url ||
      process.env.SUPABASE_URL ||
      'https://skbwakxzlrsjkubmbzte.supabase.co';

    this.serviceRoleKey =
      stored.serviceRoleKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      '';

    const defaultAnonKey = 'sb_publishable_QP1HmIg1sarCAM26rm_h9g_dnSeVjqg';
    const anonKey =
      stored.anonKey ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      defaultAnonKey;

    // If service_role key is present, use it for root database access (bypasses RLS)
    this.key = this.serviceRoleKey || anonKey;

    this.status = {
      connected: false,
      url: this.url,
      hasServiceRoleKey: Boolean(this.serviceRoleKey),
      mode: 'connecting',
    };

    try {
      this.client = createClient(this.url, this.key, {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
        },
      });
      this.testConnection();
    } catch (e: any) {
      this.status.connected = false;
      this.status.mode = 'error';
      this.status.error = e.message;
    }
  }

  public async updateConfig(newConfig: { url?: string; serviceRoleKey?: string; anonKey?: string }): Promise<SupabaseSyncStatus> {
    const current = loadConfig();
    const updated: StoredSupabaseConfig = {
      url: newConfig.url?.trim() || current.url,
      serviceRoleKey: newConfig.serviceRoleKey !== undefined ? newConfig.serviceRoleKey.trim() : current.serviceRoleKey,
      anonKey: newConfig.anonKey?.trim() || current.anonKey,
    };
    saveConfigFile(updated);
    this.reconfigure();
    await this.testConnection();
    return this.getStatus();
  }

  private async testConnection(): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('printx_app_state')
        .select('id, updated_at')
        .limit(1);

      if (!error) {
        this.status.connected = true;
        this.status.mode = this.serviceRoleKey ? 'service_role' : 'tables';
        delete this.status.error;
        delete this.status.sqlFix;
      } else if (error.code === '42501') {
        this.status.connected = true;
        this.status.mode = 'rls_blocked';
        this.status.error = 'Supabase Row Level Security (RLS) is blocking database operations.';
        this.status.sqlFix = this.getSqlFixScript();
      } else {
        this.status.connected = false;
        this.status.mode = 'error';
        this.status.error = error.message;
        this.status.sqlFix = this.getSqlFixScript();
      }
    } catch (e: any) {
      this.status.connected = false;
      this.status.mode = 'error';
      this.status.error = e.message;
    }
  }

  public getSqlFixScript(): string {
    return `-- ==============================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO PERMANENTLY ENABLE PERSISTENCE
-- ==============================================================

-- 1. Create the persistent app state table if not exists
CREATE TABLE IF NOT EXISTS public.printx_app_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Disable Row Level Security so server can save/load without errors
ALTER TABLE public.printx_app_state DISABLE ROW LEVEL SECURITY;

-- 3. If shops/orders tables exist, also grant unrestricted access
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shops') THEN
    ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
`;
  }

  public getStatus(): SupabaseSyncStatus {
    return { ...this.status };
  }

  /**
   * Load remote database state from Supabase Cloud
   */
  public async loadRemoteState(): Promise<any | null> {
    try {
      const { data: tableData, error: tableError } = await this.client
        .from('printx_app_state')
        .select('data, updated_at')
        .eq('id', 'main_database')
        .single();

      if (!tableError && tableData?.data) {
        console.log('[Supabase Cloud] State successfully loaded from printx_app_state table.');
        this.status.connected = true;
        this.status.lastSyncedAt = tableData.updated_at || new Date().toISOString();
        this.status.mode = this.serviceRoleKey ? 'service_role' : 'tables';
        if (tableData.data?.shops?.length) {
          this.status.shopsCount = tableData.data.shops.length;
        }
        delete this.status.error;
        return tableData.data;
      }

      if (tableError) {
        if (tableError.code === '42501') {
          this.status.mode = 'rls_blocked';
          this.status.error = 'Supabase RLS is blocking access to printx_app_state.';
          this.status.sqlFix = this.getSqlFixScript();
        } else if (tableError.code !== 'PGRST116') {
          // PGRST116 is just "no rows returned" (empty database)
          console.warn('[Supabase Cloud] Load state error:', tableError.message);
          this.status.error = tableError.message;
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Cloud] Exception loading remote state:', e.message);
      this.status.error = e.message;
    }
    return null;
  }

  /**
   * Persist complete database state to Supabase Cloud
   */
  public async saveRemoteState(databaseData: any): Promise<boolean> {
    try {
      if (!databaseData || typeof databaseData !== 'object') return false;

      const payload = {
        id: 'main_database',
        data: databaseData,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await this.client
        .from('printx_app_state')
        .upsert(payload, { onConflict: 'id' });

      if (!upsertErr) {
        this.status.connected = true;
        this.status.mode = this.serviceRoleKey ? 'service_role' : 'tables';
        this.status.lastSyncedAt = new Date().toISOString();
        if (databaseData?.shops?.length) {
          this.status.shopsCount = databaseData.shops.length;
        }
        delete this.status.error;
        delete this.status.sqlFix;
        console.log(`[Supabase Cloud] Successfully synced ${databaseData?.shops?.length || 0} shops to cloud.`);
        return true;
      }

      console.warn('[Supabase Cloud] Save remote state warning:', upsertErr.message, upsertErr.code);
      if (upsertErr.code === '42501') {
        this.status.mode = 'rls_blocked';
        this.status.error = 'Supabase Row Level Security (RLS) is blocking saves. Provide service_role key or run SQL fix.';
        this.status.sqlFix = this.getSqlFixScript();
      } else {
        this.status.error = upsertErr.message;
      }
      return false;
    } catch (err: any) {
      this.status.error = err.message;
      console.error('[Supabase Cloud] Save exception:', err.message);
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
