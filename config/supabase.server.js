// config/supabase.server.js
// Supabase admin client for server-side operations.
// Not used in the extraction pipeline yet — reserved for future auth/credits/storage features.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not set. Auth/credits/storage features will be unavailable.');
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);