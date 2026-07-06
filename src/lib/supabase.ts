import { createClient, SupabaseClient } from "@supabase/supabase-js";

// anonキーはブラウザに配布される公開情報(データ保護はRLSで行う)なので、
// 環境変数が未設定の環境向けにフォールバックを埋め込んでいる
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://nofhkuacbkgqbvwscvos.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vZmhrdWFjYmtncWJ2d3Njdm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTcxMDQsImV4cCI6MjA5ODUzMzEwNH0.SNQj4qnYKywNrW6KVsnYJulMlSxu6Bark4rzJYEcwZM";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
