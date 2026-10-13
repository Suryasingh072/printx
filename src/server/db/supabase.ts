import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://skbwakxzlrsjkubmbzte.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_QP1HmIg1sarCAM26rm_h9g_dnSeVjqg';

export interface SupabaseSyncStatus {
  connected: boolean;
  url: string;
  lastSyncedAt?: string;
  mode: 'tables' | 'snapshot' | 'connecting';
  error?: string;
}

class SupabaseService {
  private client: SupabaseClient;
  private sessionToken: string | null = null;
  private status: SupabaseSyncStatus = {
    connected: false,
    url: SUPABASE_URL,
    mode: 'connecting',
  };

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
    });
    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      // Authenticate with dedicated cloud state service account on this Supabase project
      const { data, error } = await this.client.auth.signInWithPassword({
        email: 'printx.cloud.db@gmail.com',
        password: 'PrintxCloudSecure2026!',
      });

      if (!error && data?.session?.access_token) {
        this.sessionToken = data.session.access_token;
        this.status.connected = true;
        this.status.mode = 'snapshot';
        console.log('[Supabase Cloud] Authenticated successfully with Supabase Cloud project.');
      } else {
        // If user doesn't exist yet, sign up
        const signup = await this.client.auth.signUp({
          email: 'printx.cloud.db@gmail.com',
          password: 'PrintxCloudSecure2026!',
        });
        if (signup.data?.session?.access_token) {
          this.sessionToken = signup.data.session.access_token;
          this.status.connected = true;
          this.status.mode = 'snapshot';
        } else {
          this.status.connected = true;
        }
      }
    } catch (err: any) {
      console.warn('[Supabase Cloud] Auth initialization warning:', err.message);
      this.status.connected = true; // Still connected for table queries
    }
  }

  public getStatus(): SupabaseSyncStatus {
    return { ...this.status };
  }

  /**
   * Load remote database state from Supabase Cloud
   */
  public async loadRemoteState(): Promise<any | null> {
    try {
      // 1. Try to read from 'printx_state' table if the user executed the SQL script
      const { data: tableData, error: tableError } = await this.client
        .from('printx_app_state')
        .select('data')
        .eq('id', 'main_database')
        .single();

      if (!tableError && tableData?.data) {
        console.log('[Supabase Cloud] Loaded state from printx_app_state table.');
        this.status.lastSyncedAt = new Date().toISOString();
        this.status.mode = 'tables';
        return tableData.data;
      }

      // 2. Fallback: Read from authenticated user metadata snapshot
      const { data: userRes, error: userErr } = await this.client.auth.getUser(this.sessionToken || undefined);
      if (!userErr && userRes?.user?.user_metadata?.db_snapshot) {
        console.log('[Supabase Cloud] Loaded state from Supabase Cloud snapshot.');
        this.status.lastSyncedAt = new Date().toISOString();
        this.status.mode = 'snapshot';
        return userRes.user.user_metadata.db_snapshot;
      }
    } catch (e: any) {
      console.warn('[Supabase Cloud] Error loading remote state:', e.message);
    }
    return null;
  }

  /**
   * Persist database state to Supabase Cloud
   */
  public async saveRemoteState(databaseData: any): Promise<boolean> {
    try {
      let saved = false;

      // 1. Try to save to printx_app_state table if table exists
      try {
        const { error: upsertErr } = await this.client
          .from('printx_app_state')
          .upsert({
            id: 'main_database',
            data: databaseData,
            updated_at: new Date().toISOString(),
          });

        if (!upsertErr) {
          saved = true;
          this.status.mode = 'tables';
        }
      } catch (err) {
        // Table might not exist yet
      }

      // 2. Always persist state snapshot into user metadata for guaranteed durability
      try {
        const { error: updateErr } = await this.client.auth.updateUser({
          data: {
            db_snapshot: databaseData,
            last_saved_at: new Date().toISOString(),
          },
        });
        if (!updateErr) {
          saved = true;
        }
      } catch (err) {
        // Continue
      }

      if (saved) {
        this.status.connected = true;
        this.status.lastSyncedAt = new Date().toISOString();
        delete this.status.error;
        return true;
      }
    } catch (err: any) {
      this.status.error = err.message;
      console.warn('[Supabase Cloud] Save remote state warning:', err.message);
    }
    return false;
  }
}

export const supabaseService = new SupabaseService();
