"use strict";

/**
 * ============================================================
 * PRECIFIO — SUPABASE SERVER CLIENT
 * ============================================================
 *
 * Backend-only Supabase client.
 *
 * Uses the Supabase service-role key.
 *
 * NEVER expose this file or these credentials to the browser.
 *
 * ============================================================
 */

const {
  createClient,
} = require("@supabase/supabase-js");


let supabaseClient = null;


function getSupabaseAdmin() {

  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }


  supabaseClient =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );


  return supabaseClient;
}


module.exports = {
  getSupabaseAdmin,
};