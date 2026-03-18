import { createClient } from "npm:@supabase/supabase-js@2.99.1";

const DEFAULT_SCHEMA = "public";
const DEFAULT_ARTICLES_TABLE = "roblox_game_code_articles";
const DEFAULT_CODES_TABLE = "roblox_game_codes";
const DEFAULT_LETROSO_ANSWERS_TABLE = "letroso_answers";

export interface SupabaseConfig {
  url: string;
  key: string;
  keyType: "service_role" | "anon";
  schema: string;
  articlesTable: string;
  table: string;
  letrosoAnswersTable: string;
}

function getEnvValue(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  if (!value) return undefined;
  if (value.includes("your-project-ref.supabase.co")) return undefined;
  if (value === "your-service-role-key" || value === "your-anon-key") return undefined;
  return value;
}

function resolveSupabaseConfig(): SupabaseConfig {
  const url = getEnvValue("SUPABASE_URL");
  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = getEnvValue("SUPABASE_ANON_KEY");
  const schema = getEnvValue("SUPABASE_DB_SCHEMA") ?? DEFAULT_SCHEMA;
  const articlesTable = getEnvValue("SUPABASE_ARTICLES_TABLE") ?? DEFAULT_ARTICLES_TABLE;
  const table = getEnvValue("SUPABASE_CODES_TABLE") ?? DEFAULT_CODES_TABLE;
  const letrosoAnswersTable =
    getEnvValue("SUPABASE_LETROSO_ANSWERS_TABLE") ?? DEFAULT_LETROSO_ANSWERS_TABLE;

  if (!url) {
    throw new Error("Missing SUPABASE_URL.");
  }

  const key = serviceRoleKey ?? anonKey;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
  }

  return {
    url,
    key,
    keyType: serviceRoleKey ? "service_role" : "anon",
    schema,
    articlesTable,
    table,
    letrosoAnswersTable,
  };
}

export function createSupabaseClient() {
  const config = resolveSupabaseConfig();

  const client = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: config.schema,
    },
  });

  return { client, config };
}
