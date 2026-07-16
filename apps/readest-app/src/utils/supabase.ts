import { createClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from '@/services/runtimeConfig';

/** Decode optional base64 env defaults; empty when unset (local-first builds). */
const decodeDefault = (value: string | undefined): string => {
  if (!value) return '';
  try {
    return atob(value);
  } catch {
    return '';
  }
};

// Local-first builds ship without official Supabase credentials. Use inert
// placeholders so createClient still constructs; all hosted auth/billing routes
// are already disabled and must not call a real project.
const supabaseUrl =
  getRuntimeConfig()?.supabaseUrl ||
  process.env['SUPABASE_URL'] ||
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
  decodeDefault(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_URL_BASE64']) ||
  'https://local-first.invalid';
const supabaseAnonKey =
  getRuntimeConfig()?.supabaseAnonKey ||
  process.env['SUPABASE_ANON_KEY'] ||
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
  decodeDefault(process.env['NEXT_PUBLIC_DEFAULT_SUPABASE_KEY_BASE64']) ||
  'local-first-disabled';

export const isSupabaseConfigured = () =>
  !supabaseUrl.includes('local-first.invalid') && supabaseAnonKey !== 'local-first-disabled';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseClient = (accessToken?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
};

export const createSupabaseAdminClient = () => {
  const supabaseAdminKey = process.env['SUPABASE_ADMIN_KEY'] || '';
  return createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
