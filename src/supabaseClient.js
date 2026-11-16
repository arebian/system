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

const configuredPublishableKey =
  String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

// A copied .env.example can leave the literal instructional placeholder
// in the local environment. Vite treats it as configured and would otherwise
// send "replace-with-your-development-publishable-key" to Supabase, causing
// every Auth request to fail with UNAUTHORIZED_INVALID_API_KEY.
// Ignore that placeholder for this hosted project and use its active,
// public publishable key instead.
const isPlaceholderPublishableKey =
  !configuredPublishableKey ||
  /^(replace-with|your[-_ ]|placeholder)/i.test(
    configuredPublishableKey
  );

const supabasePublishableKey =
  isPlaceholderPublishableKey
    ? DEFAULT_SUPABASE_PUBLISHABLE_KEY
    : configuredPublishableKey;

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
