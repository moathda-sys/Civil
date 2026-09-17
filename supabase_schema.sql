-- ==========================================================
-- استلام التسليح — Supabase schema + Row Level Security
-- شغّل هذا الملف كاملاً مرة واحدة في: Supabase → SQL Editor
-- ==========================================================

create extension if not exists "pgcrypto";

-- ---------------- Tables ----------------

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  element_type text,
  element_subtype text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  element_type text not null,
  element_subtype text,
  template_id uuid, -- nullable: قد يكون من قالب افتراضي غير مخزّن في DB
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  text text not null,
  position integer not null default 0,
  status text not null default 'unchecked' check (status in ('unchecked','pass','issue','na')),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_user on public.templates(user_id);
create index if not exists idx_template_items_template on public.template_items(template_id);
create index if not exists idx_inspections_user on public.inspections(user_id);
create index if not exists idx_inspections_status on public.inspections(user_id, status);
create index if not exists idx_inspection_items_inspection on public.inspection_items(inspection_id);

-- ---------------- Row Level Security ----------------

alter table public.templates enable row level security;
alter table public.template_items enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;

-- templates: مباشرة عبر user_id
create policy "templates_select_own" on public.templates
  for select using (auth.uid() = user_id);
create policy "templates_insert_own" on public.templates
  for insert with check (auth.uid() = user_id);
create policy "templates_update_own" on public.templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "templates_delete_own" on public.templates
  for delete using (auth.uid() = user_id);

-- template_items: عبر ملكية القالب الأب
create policy "template_items_select_own" on public.template_items
  for select using (exists (
    select 1 from public.templates t where t.id = template_items.template_id and t.user_id = auth.uid()
  ));
create policy "template_items_insert_own" on public.template_items
  for insert with check (exists (
    select 1 from public.templates t where t.id = template_items.template_id and t.user_id = auth.uid()
  ));
create policy "template_items_update_own" on public.template_items
  for update using (exists (
    select 1 from public.templates t where t.id = template_items.template_id and t.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.templates t where t.id = template_items.template_id and t.user_id = auth.uid()
  ));
create policy "template_items_delete_own" on public.template_items
  for delete using (exists (
    select 1 from public.templates t where t.id = template_items.template_id and t.user_id = auth.uid()
  ));

-- inspections: مباشرة عبر user_id
create policy "inspections_select_own" on public.inspections
  for select using (auth.uid() = user_id);
create policy "inspections_insert_own" on public.inspections
  for insert with check (auth.uid() = user_id);
create policy "inspections_update_own" on public.inspections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inspections_delete_own" on public.inspections
  for delete using (auth.uid() = user_id);

-- inspection_items: عبر ملكية الاستلام الأب
create policy "inspection_items_select_own" on public.inspection_items
  for select using (exists (
    select 1 from public.inspections i where i.id = inspection_items.inspection_id and i.user_id = auth.uid()
  ));
create policy "inspection_items_insert_own" on public.inspection_items
  for insert with check (exists (
    select 1 from public.inspections i where i.id = inspection_items.inspection_id and i.user_id = auth.uid()
  ));
create policy "inspection_items_update_own" on public.inspection_items
  for update using (exists (
    select 1 from public.inspections i where i.id = inspection_items.inspection_id and i.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.inspections i where i.id = inspection_items.inspection_id and i.user_id = auth.uid()
  ));
create policy "inspection_items_delete_own" on public.inspection_items
  for delete using (exists (
    select 1 from public.inspections i where i.id = inspection_items.inspection_id and i.user_id = auth.uid()
  ));
