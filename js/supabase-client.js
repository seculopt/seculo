// Supabase client for seculopt.com frontend
// Publishable key is safe to include in browser code (RLS protects the DB)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://xoesazrzwbnrfkrtnhwc.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_SiNJZ5WYOL_MmOje_1KcKg_64GfO4IE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Returns the current session or null.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Returns the current user or null.
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}
