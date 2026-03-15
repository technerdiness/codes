import { createClient } from "@supabase/supabase-js";

const DEFAULT_SCHEMA = "public";
const DEFAULT_ARTICLES_TABLE = "roblox_game_code_articles";
const DEFAULT_CODES_TABLE = "roblox_game_codes";
const DEFAULT_LETROSO_ANSWERS_TABLE = "letroso_answers";
const DEFAULT_WORDLE_ANSWERS_TABLE = "wordle_answers";
const DEFAULT_CONNECTIONS_ANSWERS_TABLE = "connections_answers";
const DEFAULT_STRANDS_ANSWERS_TABLE = "strands_answers";

export interface SupabaseConfig {
  url: string;
  key: string;
  keyType: "service_role" | "anon";
  schema: string;
  articlesTable: string;
  table: string;
  letrosoAnswersTable: string;
  wordleAnswersTable: string;
  connectionsAnswersTable: string;
  strandsAnswersTable: string;
}

function getEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
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
  const wordleAnswersTable =
    getEnvValue("SUPABASE_WORDLE_ANSWERS_TABLE") ?? DEFAULT_WORDLE_ANSWERS_TABLE;
  const connectionsAnswersTable =
    getEnvValue("SUPABASE_CONNECTIONS_ANSWERS_TABLE") ?? DEFAULT_CONNECTIONS_ANSWERS_TABLE;
  const strandsAnswersTable =
    getEnvValue("SUPABASE_STRANDS_ANSWERS_TABLE") ?? DEFAULT_STRANDS_ANSWERS_TABLE;

  if (!url) {
    throw new Error("Missing SUPABASE_URL. Copy .env.example to .env and fill in your Supabase project URL.");
  }

  const key = serviceRoleKey ?? anonKey;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY. The service role key is recommended for this server-side scraper."
    );
  }

  return {
    url,
    key,
    keyType: serviceRoleKey ? "service_role" : "anon",
    schema,
    articlesTable,
    table,
    letrosoAnswersTable,
    wordleAnswersTable,
    connectionsAnswersTable,
    strandsAnswersTable,
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  return resolveSupabaseConfig();
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
