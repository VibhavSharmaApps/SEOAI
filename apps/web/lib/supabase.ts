import { createClient } from '@supabase/supabase-js';
import { env, serverEnv } from './env';

/**
 * Create a Supabase client for server-side use with service role key
 * This bypasses Row Level Security (RLS) - use with caution!
 */
export function createAdminClient() {
  return createClient(
    env.supabase.url,
    serverEnv.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Create a Supabase client for server-side use with anon key
 * This respects Row Level Security (RLS)
 */
export function createServerClient() {
  return createClient(
    env.supabase.url,
    env.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Create a Supabase client for client-side use
 * This respects Row Level Security (RLS) and handles auth
 */
export function createBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserClient can only be used in the browser');
  }

  return createClient(
    env.supabase.url,
    env.supabase.anonKey
  );
}
