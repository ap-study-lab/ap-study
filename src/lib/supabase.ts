import { createClient, SupabaseClient } from "@supabase/supabase-js";

// anonキーはブラウザに配布される公開情報(データ保護はRLSで行う)なので、
// 環境変数が未設定の環境向けにフォールバックを埋め込んでいる
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://etrsjzjrhfllxzarhxox.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnNqempyaGZsbHh6YXJoeG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjk0NjAsImV4cCI6MjEwMTg0NTQ2MH0.z3Hf8LUb7rsGGgqn6TeW4gspcq0Zkn3nDXdVZVb4LM0";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
