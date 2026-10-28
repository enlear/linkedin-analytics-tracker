-- LinkedIn Analytics Tracker — team version database.
--
-- Paste this whole file into Supabase → SQL Editor → Run (or `supabase db push`).
-- Re-running it is safe: every statement is idempotent and seeds never
-- overwrite rows an admin has edited.
--
-- Security model
--   * Every table has row-level security. The browser only ever holds the
--     publishable key, so these policies ARE the access control.
--   * "Admin" is `app_metadata.role = 'admin'` on the Supabase user. Only the
--     database owner can set app_metadata (see make_admin below), so nobody can
--     grant themselves admin from the app.
--   * Admins aren't posters: they get no `employees` row, so they never show on
--     leaderboards.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ---------------------------------------------------------------------------
-- Members and their posts
-- ---------------------------------------------------------------------------

create table if not exists public.employees (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  headline text,
  created_at timestamptz not null default now()
);
create index if not exists employees_email_idx on public.employees (email);

-- Admin-managed post types. `weight` feeds the Content part of the
-- Performance Score and is read at scoring time, so editing it re-scores every
-- month. Archive (active = false) instead of deleting so old posts keep it.
create table if not exists public.post_categories (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(trim(name)) > 0),
  description text,
  weight double precision not null check (weight >= 0.1 and weight <= 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.post_uploads (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  file_name text not null,
  source_sheet_name text,
  post_url text,
  post_date date not null,
  post_publish_time text,
  impressions integer not null check (impressions >= 0),
  reach integer not null check (reach >= 0),
  report_month date not null,
  tracking_period_start date not null,
  tracking_period_end date not null,
  validation_status text not null default 'accepted'
    check (validation_status in ('accepted', 'rejected')),
  rejection_reason text,
  source text not null default 'excel' check (source in ('excel', 'linkedin_api')),
  -- Null for API-synced posts or a since-deleted category; scoring treats null
  -- as the neutral weight 1.0.
  category_id text references public.post_categories (id) on delete set null,
  raw_extracted jsonb,
  created_at timestamptz not null default now()
);
-- One accepted upload per LinkedIn post, across the whole team. The app checks
-- first to explain who has it; this index closes the race between two uploads.
create unique index if not exists post_uploads_accepted_url_key
  on public.post_uploads (post_url)
  where validation_status = 'accepted' and post_url is not null;
create index if not exists post_uploads_employee_date_idx
  on public.post_uploads (employee_id, post_date desc);
create index if not exists post_uploads_report_month_idx
  on public.post_uploads (report_month);

create table if not exists public.upload_activity (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  action text not null check (action in ('upload_accepted', 'upload_rejected', 'upload_deleted')),
  file_name text,
  details jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists upload_activity_occurred_idx
  on public.upload_activity (occurred_at desc);
create index if not exists upload_activity_employee_idx
  on public.upload_activity (employee_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Company page analytics (admin only)
-- ---------------------------------------------------------------------------

-- One row per platform per report month; importing the same month again
-- replaces it (see replace_company_upload).
create table if not exists public.company_analytics_uploads (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'linkedin'
    check (platform in ('linkedin', 'tiktok', 'facebook', 'instagram')),
  report_month date not null,
  month_label text not null,
  file_name text not null,
  -- Original file in the `company-uploads` bucket; null for API fetches.
  storage_path text,
  uploaded_at timestamptz not null default now(),
  uploaded_by_email text,
  unique (platform, report_month)
);

create table if not exists public.company_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.company_analytics_uploads (id) on delete cascade,
  date date not null,
  impressions integer not null,
  impressions_organic integer,
  impressions_sponsored integer,
  unique_impressions integer not null,
  clicks integer not null,
  clicks_organic integer,
  clicks_sponsored integer,
  reactions integer not null,
  reactions_organic integer,
  reactions_sponsored integer,
  comments integer not null,
  comments_organic integer,
  comments_sponsored integer,
  reposts integer not null,
  reposts_organic integer,
  reposts_sponsored integer,
  -- Fraction, e.g. 0.039 for 3.9%.
  engagement_rate double precision not null,
  engagement_rate_organic double precision,
  engagement_rate_sponsored double precision
);
create index if not exists company_daily_metrics_upload_idx
  on public.company_daily_metrics (upload_id, date);

create table if not exists public.company_posts (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.company_analytics_uploads (id) on delete cascade,
  post_title text,
  post_link text,
  post_type text,
  posted_by text,
  created_date date,
  content_type text,
  impressions integer not null,
  views integer,
  offsite_views integer,
  clicks integer not null,
  click_through_rate double precision not null,
  likes integer not null,
  comments integer not null,
  reposts integer not null,
  follows integer,
  engagement_rate double precision not null
);
create index if not exists company_posts_upload_idx
  on public.company_posts (upload_id, impressions desc);

create table if not exists public.tiktok_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.company_analytics_uploads (id) on delete cascade,
  date date not null,
  video_views integer not null,
  profile_views integer not null,
  likes integer not null,
  comments integer not null,
  shares integer not null
);
create index if not exists tiktok_daily_metrics_upload_idx
  on public.tiktok_daily_metrics (upload_id, date);

create table if not exists public.facebook_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.company_analytics_uploads (id) on delete cascade,
  date date not null,
  impressions integer not null,
  reach integer not null,
  engaged_users integer not null,
  new_followers integer not null,
  post_impressions integer not null,
  post_engagements integer not null
);
create index if not exists facebook_daily_metrics_upload_idx
  on public.facebook_daily_metrics (upload_id, date);

create table if not exists public.instagram_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.company_analytics_uploads (id) on delete cascade,
  date date not null,
  reach integer not null,
  views integer not null,
  profile_views integer not null,
  accounts_engaged integer not null,
  total_interactions integer not null,
  -- Running total of followers on that day: take the latest, never sum.
  follower_count integer not null
);
create index if not exists instagram_daily_metrics_upload_idx
  on public.instagram_daily_metrics (upload_id, date);

-- Single row holding the Facebook Page token. Written only through
-- save_meta_connection and read only through meta_access_token, so the token
-- never travels back to a browser.
create table if not exists public.meta_connection (
  id text primary key default 'default' check (id = 'default'),
  page_id text not null,
  page_name text,
  page_access_token text not null,
  instagram_account_id text,
  instagram_username text,
  connected_at timestamptz not null default now(),
  connected_by_email text
);

-- ---------------------------------------------------------------------------
-- Experimental LinkedIn API sync (off unless LINKEDIN_API_ENABLED=true)
-- ---------------------------------------------------------------------------

-- Tokens are AES-256-GCM ciphertext made with a server-only key, so letting the
-- owner read their own row never exposes a usable credential.
create table if not exists public.linkedin_connections (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  status text check (status in ('pending', 'connected', 'error', 'disconnected')),
  linkedin_member_urn text,
  granted_scopes text,
  pending_state text,
  access_token_enc text,
  refresh_token_enc text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_at timestamptz,
  last_synced_at timestamptz,
  last_error text
);

-- ---------------------------------------------------------------------------
-- Privileges. Explicit, so the schema works whether or not the project
-- auto-exposes new tables to the Data API. RLS below narrows every grant.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on
  public.employees, public.post_categories, public.post_uploads, public.upload_activity,
  public.company_analytics_uploads, public.company_daily_metrics, public.company_posts,
  public.tiktok_daily_metrics, public.facebook_daily_metrics, public.instagram_daily_metrics,
  public.meta_connection, public.linkedin_connections
from anon, authenticated;

grant select, insert, update, delete on
  public.employees, public.post_categories, public.post_uploads, public.upload_activity,
  public.company_analytics_uploads, public.company_daily_metrics, public.company_posts,
  public.tiktok_daily_metrics, public.facebook_daily_metrics, public.instagram_daily_metrics,
  public.linkedin_connections
to authenticated;

-- Every column except the token; writes go through save_meta_connection.
grant select (id, page_id, page_name, instagram_account_id, instagram_username,
              connected_at, connected_by_email)
  on public.meta_connection to authenticated;
grant delete on public.meta_connection to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.employees enable row level security;
alter table public.post_categories enable row level security;
alter table public.post_uploads enable row level security;
alter table public.upload_activity enable row level security;
alter table public.company_analytics_uploads enable row level security;
alter table public.company_daily_metrics enable row level security;
alter table public.company_posts enable row level security;
alter table public.tiktok_daily_metrics enable row level security;
alter table public.facebook_daily_metrics enable row level security;
alter table public.instagram_daily_metrics enable row level security;
alter table public.meta_connection enable row level security;
alter table public.linkedin_connections enable row level security;

-- employees: everyone signed in sees the team; members create and edit only
-- their own profile, under the email they signed in with.
drop policy if exists "Signed-in users read employees" on public.employees;
create policy "Signed-in users read employees" on public.employees
  for select to authenticated using (true);

drop policy if exists "Members create their own profile" on public.employees;
create policy "Members create their own profile" on public.employees
  for insert to authenticated
  with check (id = (select auth.uid()) and email = (select auth.jwt() ->> 'email'));

drop policy if exists "Members update their own profile" on public.employees;
create policy "Members update their own profile" on public.employees
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and email = (select auth.jwt() ->> 'email'));

drop policy if exists "Admins manage employees" on public.employees;
create policy "Admins manage employees" on public.employees
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- post_categories: readable by all, managed by admins.
drop policy if exists "Signed-in users read categories" on public.post_categories;
create policy "Signed-in users read categories" on public.post_categories
  for select to authenticated using (true);

drop policy if exists "Admins manage categories" on public.post_categories;
create policy "Admins manage categories" on public.post_categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- post_uploads: the leaderboard is team-wide, so everyone reads every post.
-- Members add and remove only their own.
drop policy if exists "Signed-in users read posts" on public.post_uploads;
create policy "Signed-in users read posts" on public.post_uploads
  for select to authenticated using (true);

drop policy if exists "Members add their own posts" on public.post_uploads;
create policy "Members add their own posts" on public.post_uploads
  for insert to authenticated
  with check (employee_id = (select auth.uid()));

drop policy if exists "Members delete their own posts" on public.post_uploads;
create policy "Members delete their own posts" on public.post_uploads
  for delete to authenticated
  using (employee_id = (select auth.uid()));

drop policy if exists "Admins manage posts" on public.post_uploads;
create policy "Admins manage posts" on public.post_uploads
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- upload_activity: a member sees and records only their own history.
drop policy if exists "Members read their own activity" on public.upload_activity;
create policy "Members read their own activity" on public.upload_activity
  for select to authenticated
  using (employee_id = (select auth.uid()));

drop policy if exists "Members record their own activity" on public.upload_activity;
create policy "Members record their own activity" on public.upload_activity
  for insert to authenticated
  with check (employee_id = (select auth.uid()));

drop policy if exists "Admins manage activity" on public.upload_activity;
create policy "Admins manage activity" on public.upload_activity
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Company analytics: admins only.
drop policy if exists "Admins manage company uploads" on public.company_analytics_uploads;
create policy "Admins manage company uploads" on public.company_analytics_uploads
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage company daily metrics" on public.company_daily_metrics;
create policy "Admins manage company daily metrics" on public.company_daily_metrics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage company posts" on public.company_posts;
create policy "Admins manage company posts" on public.company_posts
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage TikTok metrics" on public.tiktok_daily_metrics;
create policy "Admins manage TikTok metrics" on public.tiktok_daily_metrics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage Facebook metrics" on public.facebook_daily_metrics;
create policy "Admins manage Facebook metrics" on public.facebook_daily_metrics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins manage Instagram metrics" on public.instagram_daily_metrics;
create policy "Admins manage Instagram metrics" on public.instagram_daily_metrics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins read the Meta connection" on public.meta_connection;
create policy "Admins read the Meta connection" on public.meta_connection
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Admins remove the Meta connection" on public.meta_connection;
create policy "Admins remove the Meta connection" on public.meta_connection
  for delete to authenticated using ((select public.is_admin()));

-- linkedin_connections: each member owns their row; admins can see status.
drop policy if exists "Members manage their LinkedIn connection" on public.linkedin_connections;
create policy "Members manage their LinkedIn connection" on public.linkedin_connections
  for all to authenticated
  using (employee_id = (select auth.uid()))
  with check (employee_id = (select auth.uid()));

drop policy if exists "Admins read LinkedIn connections" on public.linkedin_connections;
create policy "Admins read LinkedIn connections" on public.linkedin_connections
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Import one platform's month in a single transaction: drop the previous
-- import for that month (children cascade), then write the new rows. Rows are
-- JSON objects keyed by column name. Runs as the caller, so RLS still applies.
create or replace function public.replace_company_upload(
  p_platform text,
  p_report_month date,
  p_month_label text,
  p_file_name text,
  p_storage_path text,
  p_daily jsonb,
  p_posts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_upload_id uuid := gen_random_uuid();
  v_replaced_path text;
  v_ids jsonb := jsonb_build_object('upload_id', v_upload_id);
begin
  if not public.is_admin() then
    raise exception 'Only admins can import company analytics.' using errcode = '42501';
  end if;

  delete from public.company_analytics_uploads
   where platform = p_platform and report_month = p_report_month
  returning storage_path into v_replaced_path;

  insert into public.company_analytics_uploads
    (id, platform, report_month, month_label, file_name, storage_path, uploaded_by_email)
  values
    (v_upload_id, p_platform, p_report_month, p_month_label, p_file_name, p_storage_path,
     auth.jwt() ->> 'email');

  if p_platform = 'linkedin' then
    insert into public.company_daily_metrics
    select (jsonb_populate_record(null::public.company_daily_metrics,
              r || v_ids || jsonb_build_object('id', gen_random_uuid()))).*
      from jsonb_array_elements(p_daily) r;
    insert into public.company_posts
    select (jsonb_populate_record(null::public.company_posts,
              r || v_ids || jsonb_build_object('id', gen_random_uuid()))).*
      from jsonb_array_elements(p_posts) r;
  elsif p_platform = 'tiktok' then
    insert into public.tiktok_daily_metrics
    select (jsonb_populate_record(null::public.tiktok_daily_metrics,
              r || v_ids || jsonb_build_object('id', gen_random_uuid()))).*
      from jsonb_array_elements(p_daily) r;
  elsif p_platform = 'facebook' then
    insert into public.facebook_daily_metrics
    select (jsonb_populate_record(null::public.facebook_daily_metrics,
              r || v_ids || jsonb_build_object('id', gen_random_uuid()))).*
      from jsonb_array_elements(p_daily) r;
  elsif p_platform = 'instagram' then
    insert into public.instagram_daily_metrics
    select (jsonb_populate_record(null::public.instagram_daily_metrics,
              r || v_ids || jsonb_build_object('id', gen_random_uuid()))).*
      from jsonb_array_elements(p_daily) r;
  else
    raise exception 'Unknown platform "%".', p_platform using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_upload_id, 'replaced_storage_path', v_replaced_path);
end;
$$;

-- Save the Facebook Page connection. A blank token keeps the stored one, so an
-- admin can edit the page details without pasting the token again.
create or replace function public.save_meta_connection(
  p_page_id text,
  p_page_name text,
  p_page_access_token text,
  p_instagram_account_id text,
  p_instagram_username text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the Meta connection.' using errcode = '42501';
  end if;
  if nullif(trim(p_page_id), '') is null then
    raise exception 'Page ID is required.' using errcode = '22023';
  end if;
  if nullif(trim(p_page_access_token), '') is null
     and not exists (select 1 from public.meta_connection) then
    raise exception 'A Page access token is required for a new connection.' using errcode = '22023';
  end if;

  insert into public.meta_connection as m
    (id, page_id, page_name, page_access_token, instagram_account_id, instagram_username,
     connected_at, connected_by_email)
  values
    ('default', trim(p_page_id), nullif(trim(p_page_name), ''),
     coalesce(nullif(trim(p_page_access_token), ''), ''),
     nullif(trim(p_instagram_account_id), ''), nullif(trim(p_instagram_username), ''),
     now(), auth.jwt() ->> 'email')
  on conflict (id) do update set
    page_id = excluded.page_id,
    page_name = excluded.page_name,
    page_access_token = coalesce(nullif(trim(p_page_access_token), ''), m.page_access_token),
    instagram_account_id = excluded.instagram_account_id,
    instagram_username = excluded.instagram_username,
    connected_at = excluded.connected_at,
    connected_by_email = excluded.connected_by_email;
end;
$$;

-- The stored Page token, for the server's Graph API calls. Null for non-admins.
create or replace function public.meta_access_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select page_access_token from public.meta_connection
   where id = 'default' and public.is_admin()
$$;

-- Remove a member completely: their sign-in, profile, posts, activity and
-- LinkedIn connection (all cascade from auth.users).
create or replace function public.delete_employee_account(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete members.' using errcode = '42501';
  end if;
  if p_employee_id = auth.uid() then
    raise exception 'You can''t delete your own account.' using errcode = '22023';
  end if;

  select email into v_email from public.employees where id = p_employee_id;
  if v_email is null then
    raise exception 'Employee not found.' using errcode = 'P0002';
  end if;

  delete from auth.users where id = p_employee_id;
  -- Profile rows whose sign-in was already gone still need removing.
  delete from public.employees where id = p_employee_id;
  return v_email;
end;
$$;

-- Promote a user to admin. Run it yourself in the SQL editor:
--   select public.make_admin('you@example.com');
-- The app's roles can't call it. Signing out and in again picks up the role.
create or replace function public.make_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
   where lower(email) = lower(trim(p_email))
  returning id into v_user_id;

  if v_user_id is null then
    raise exception 'No user with email %. Sign up in the app first, then run this again.', p_email;
  end if;

  -- The profile created at first sign-in would list the admin as a member
  -- who never posts; drop it unless they already have posts.
  delete from public.employees e
   where e.id = v_user_id
     and not exists (select 1 from public.post_uploads p where p.employee_id = v_user_id);

  return p_email || ' is now an admin. Sign out and back in to pick up the role.';
end;
$$;

-- Cheap query for the optional keep-alive workflow: free projects pause after
-- a week without activity.
create or replace function public.ping()
returns boolean
language sql
stable
as $$
  select true
$$;

revoke execute on function public.replace_company_upload(text, date, text, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.save_meta_connection(text, text, text, text, text) from public, anon;
revoke execute on function public.meta_access_token() from public, anon;
revoke execute on function public.delete_employee_account(uuid) from public, anon;
revoke execute on function public.make_admin(text) from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.replace_company_upload(text, date, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_meta_connection(text, text, text, text, text) to authenticated;
grant execute on function public.meta_access_token() to authenticated;
grant execute on function public.delete_employee_account(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: original company export files, kept so admins can re-download.
-- Member uploads are parsed on the server and never stored.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('company-uploads', 'company-uploads', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "Admins manage company files" on storage.objects;
create policy "Admins manage company files" on storage.objects
  for all to authenticated
  using (bucket_id = 'company-uploads' and (select public.is_admin()))
  with check (bucket_id = 'company-uploads' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Default post categories, so members can upload straight after setup. Fixed
-- ids keep this idempotent and never overwrite an admin's edits.
-- ---------------------------------------------------------------------------

insert into public.post_categories (id, name, description, weight, active) values
  ('article', 'Article',
   'A long-form article (blog, newsletter or LinkedIn article) shared on LinkedIn.', 2, true),
  ('direct-post', 'Direct post',
   'A short, original post written directly on LinkedIn.', 1.5, true),
  ('event-update', 'Event update',
   'Coverage of an event — announcements, highlights, or recaps.', 1.25, true),
  ('other', 'Other',
   'Anything that doesn''t fit the categories above.', 1, true)
on conflict (id) do nothing;
