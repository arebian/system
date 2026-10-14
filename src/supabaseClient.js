import { createClient } from "@supabase/supabase-js";
import { createAuthRecoveryFetch } from "./systemAuthRecovery.js";

// THE SYSTEM 2.0 uses the publishable Supabase credentials below as a
// runtime fallback. These are intentionally public client credentials;
// privileged service-role credentials are never shipped to the browser.
const DEFAULT_SUPABASE_URL =
  "https://ojiwavxndprqsdhbnlqy.supabase.co";

const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IdRQEHgY2EYP1-jTXWP5lQ_p7y7_ne9";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    global: {
      fetch: createAuthRecoveryFetch({
        origin: new URL(supabaseUrl).origin,
        getClient: () => supabase,
      }),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
