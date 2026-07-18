// config/supabase.server.js

"use strict";

const {
  createClient
} = require("@supabase/supabase-js");


const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!supabaseUrl || !supabaseServiceKey) {

  console.warn(
    "Supabase environment variables not set."
  );

}


const supabaseAdmin =
  createClient(

    supabaseUrl || "",

    supabaseServiceKey || ""

  );


module.exports = {

  supabaseAdmin

};