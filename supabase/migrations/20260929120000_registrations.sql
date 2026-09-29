-- Milky Way participants. Written only by the site's server (secret key); never readable with a
-- browser key. Organisers read it in the Supabase dashboard (Table Editor → registrations).
create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id          uuid primary key default gen_random_uuid(),
  pass_id     text not null,
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null unique check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  phone       text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13),
  institution text not null check (char_length(institution) between 2 and 160),
  year        text not null check (char_length(year) between 1 and 20),
  city        text not null default '' check (char_length(city) <= 80),
  interests   text[] not null default '{}' check (cardinality(interests) <= 12),
  updates     boolean not null default false,
  conduct     boolean not null check (conduct),
  source      text not null default 'web' check (char_length(source) <= 32),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.registrations is 'Milky Way festival registrations (one row per email; re-registering updates the row).';

create index if not exists registrations_created_at_idx on public.registrations (created_at desc);

-- keep created_at from the first registration when an upsert updates the row
create or replace function public.registrations_keep_created() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists registrations_keep_created on public.registrations;
create trigger registrations_keep_created before update on public.registrations
  for each row execute function public.registrations_keep_created();

-- locked down: RLS on, no policies, and no grants to the browser roles
alter table public.registrations enable row level security;
revoke all on table public.registrations from anon, authenticated;
