import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// Just enough of Supabase's own schemas (roles, auth, storage) for the
// migrations to run in PGlite, an in-process Postgres. `auth.jwt()` reads the
// same `request.jwt.claims` setting PostgREST sets on every API request, so the
// policies see exactly what they would in production.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations");

export function migrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(migrationSql());
  return db;
}

export interface TestUser {
  id: string;
  email: string;
  admin?: boolean;
}

export async function createUser(db: PGlite, email: string, admin = false): Promise<TestUser> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_app_meta_data) values ($1, $2) returning id",
    [email, admin ? { role: "admin" } : {}],
  );
  return { id: rows[0].id, email, admin };
}

const ROLLBACK = Symbol("rollback");

/**
 * Run `fn` as a signed-in user, the way PostgREST does: role `authenticated`
 * plus their JWT claims. Rolled back afterwards unless `commit` is set, so
 * tests can't leak into each other.
 */
export async function asUser<T>(
  db: PGlite,
  user: TestUser,
  fn: (tx: Transaction) => Promise<T>,
  { commit = false } = {},
): Promise<T> {
  const claims = {
    sub: user.id,
    email: user.email,
    role: "authenticated",
    app_metadata: user.admin ? { role: "admin" } : {},
  };
  let result!: T;
  try {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec("set local role authenticated");
      result = await fn(tx);
      if (!commit) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return result;
}
