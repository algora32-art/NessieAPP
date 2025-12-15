-- Nessie 2026 schema + RLS
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'technician' check (role in ('admin','technician')),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(phone)
);

-- Source-of-truth for Work Order statuses (for dynamic Kanban columns)
create table if not exists public.work_order_statuses (
  key text primary key,
  label text not null,
  sort_order int not null default 0,
  color text not null default '#60a5fa',
  is_terminal boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed statuses (idempotent)
insert into public.work_order_statuses (key, label, sort_order, color, is_terminal)
values
  ('Nuevo','Nuevo',10,'#60a5fa',false),
  ('Visita técnica','Visita técnica',20,'#a78bfa',false),
  ('Espera cotización','Espera cotización',30,'#fbbf24',false),
  ('Cotizado','Cotizado',40,'#f59e0b',false),
  ('Aprobado','Aprobado',50,'#34d399',false),
  ('Servicio agendado','Servicio agendado',60,'#22c55e',false),
  ('En proceso','En proceso',70,'#fb7185',false),
  ('Pendiente por cerrar','Pendiente por cerrar',80,'#f97316',false),
  ('Finalizado','Finalizado',90,'#10b981',true),
  ('Seguimiento','Seguimiento',100,'#38bdf8',false)
on conflict (key) do update
  set label=excluded.label,
      sort_order=excluded.sort_order,
      color=excluded.color,
      is_terminal=excluded.is_terminal;

create table if not exists public.work_orders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete restrict,
  status text not null default 'Nuevo' check (
    status in (
      'Nuevo',
      'Visita técnica',
      'Espera cotización',
      'Cotizado',
      'Aprobado',
      'Servicio agendado',
      'En proceso',
      'Pendiente por cerrar',
      'Finalizado',
      'Seguimiento'
    )
  ),
  service text,
  description text,
  scheduled_start timestamptz,
  estimated_minutes int,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#34d399',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.work_order_tags (
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (work_order_id, tag_id)
);

create table if not exists public.routes (
  id uuid primary key default uuid_generate_v4(),
  route_date date not null,
  route_number int not null check (route_number in (1,2)),
  technician_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(route_date, route_number, technician_id)
);

create table if not exists public.route_items (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references public.routes(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  done boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique(route_id, work_order_id)
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  done boolean not null default false,
  created_by uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Ensure tasks.created_by is always populated for RLS checks
create or replace function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Populate created_by for tables that need it (tags, tasks, etc.)
drop trigger if exists trg_tags_created_by on public.tags;
create trigger trg_tags_created_by
before insert on public.tags
for each row execute function public.set_created_by();

drop trigger if exists trg_tasks_created_by on public.tasks;
create trigger trg_tasks_created_by
before insert on public.tasks
for each row execute function public.set_created_by();

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'generic',
  entity_id uuid,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ================= Finance =================
create table if not exists public.finance_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_date date not null,
  entry_type text not null check (entry_type in ('income','expense')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'General',
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.finance_series(p_from date, p_to date)
returns table (day date, income numeric, expense numeric, balance numeric)
language sql
stable
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  agg as (
    select
      entry_date as day,
      sum(case when entry_type='income' then amount else 0 end) as income,
      sum(case when entry_type='expense' then amount else 0 end) as expense
    from public.finance_entries
    where entry_date between p_from and p_to
      and (public.is_admin() or created_by = auth.uid())
    group by entry_date
  )
  select
    d.day,
    coalesce(a.income,0) as income,
    coalesce(a.expense,0) as expense,
    coalesce(a.income,0) - coalesce(a.expense,0) as balance
  from days d
  left join agg a using (day)
  order by d.day asc;
$$;

create or replace function public.finance_summary(p_from date, p_to date)
returns table (
  total_income numeric,
  total_expense numeric,
  balance numeric,
  income_by_category jsonb,
  expense_by_category jsonb
)
language sql
stable
as $$
  with base as (
    select *
    from public.finance_entries
    where entry_date between p_from and p_to
      and (public.is_admin() or created_by = auth.uid())
  ),
  sums as (
    select
      sum(case when entry_type='income' then amount else 0 end) as ti,
      sum(case when entry_type='expense' then amount else 0 end) as te
    from base
  ),
  inc_cat as (
    select category, sum(amount) as amount
    from base where entry_type='income'
    group by category
    order by sum(amount) desc
  ),
  exp_cat as (
    select category, sum(amount) as amount
    from base where entry_type='expense'
    group by category
    order by sum(amount) desc
  )
  select
    coalesce(s.ti,0) as total_income,
    coalesce(s.te,0) as total_expense,
    coalesce(s.ti,0) - coalesce(s.te,0) as balance,
    coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount)) from inc_cat), '[]'::jsonb) as income_by_category,
    coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount)) from exp_cat), '[]'::jsonb) as expense_by_category
  from sums s;
$$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists trg_work_orders_updated on public.work_orders;
create trigger trg_work_orders_updated before update on public.work_orders
for each row execute function public.set_updated_at();

create or replace view public.work_orders_view as
select
  wo.id, wo.status, wo.client_id,
  c.name as client_name, c.phone, c.address,
  wo.service, wo.description,
  wo.scheduled_start, wo.estimated_minutes,
  wo.assigned_to,
  p.name as assigned_to_name,
  (
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color) order by t.name), '[]'::jsonb)
    from public.work_order_tags wot
    join public.tags t on t.id=wot.tag_id
    where wot.work_order_id = wo.id
  ) as tags,
  wo.created_at, wo.updated_at
from public.work_orders wo
join public.clients c on c.id = wo.client_id
left join public.profiles p on p.id = wo.assigned_to;

create or replace function public.is_admin()
returns boolean as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role='admin' and p.active=true);
$$ language sql stable;

-- Centralized notifier (bypasses RLS via SECURITY DEFINER)
create or replace function public.notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text default 'generic',
  p_entity_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (user_id, type, entity_id, title, body)
  values (p_user_id, coalesce(p_type,'generic'), p_entity_id, p_title, p_body);
end;
$$;

create or replace function public.create_work_order_with_client(
  p_client_name text,
  p_phone text,
  p_address text,
  p_service text,
  p_description text,
  p_scheduled_start timestamptz default null,
  p_estimated_minutes int default null,
  p_assigned_to uuid default null
) returns uuid as $$
declare v_client_id uuid; v_work_order_id uuid;
declare v_phone text; v_name text; v_address text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Normalize inputs. This prevents the classic bug where " " or "( )" phones collide
  -- with the UNIQUE(phone) constraint, causing later OS creations to update the same client.
  v_phone := regexp_replace(coalesce(p_phone,''), '\\D', '', 'g');
  v_name := btrim(coalesce(p_client_name,''));
  v_address := btrim(coalesce(p_address,''));
  if v_phone = '' then raise exception 'Phone is required'; end if;
  if v_name = '' then raise exception 'Client name is required'; end if;
  if v_address = '' then raise exception 'Address is required'; end if;

  insert into public.clients (name, phone, address)
  values (v_name, v_phone, v_address)
  on conflict (phone) do update
    set name=excluded.name, address=excluded.address, updated_at=now()
  returning id into v_client_id;

  insert into public.work_orders (client_id, status, service, description, scheduled_start, estimated_minutes, assigned_to, created_by)
  values (v_client_id, 'Nuevo', p_service, p_description, p_scheduled_start, p_estimated_minutes, p_assigned_to, auth.uid())
  returning id into v_work_order_id;

  perform public.notify_user(
    auth.uid(),
    'OS creada · ' || v_name,
    coalesce(p_service,'(sin servicio)'),
    'work_order_created',
    v_work_order_id
  );

  -- If admin created and assigned to a technician, notify that technician too.
  if p_assigned_to is not null and p_assigned_to <> auth.uid() then
    perform public.notify_user(
      p_assigned_to,
      'Nueva OS asignada · ' || v_name,
      coalesce(p_service,'(sin servicio)'),
      'work_order_assigned',
      v_work_order_id
    );
  end if;

  return v_work_order_id;
end;
$$ language plpgsql security definer;


create or replace function public.update_work_order_and_client(
  p_work_order_id uuid,
  p_status text,
  p_client_name text,
  p_phone text,
  p_address text,
  p_service text,
  p_description text,
  p_scheduled_start timestamptz,
  p_estimated_minutes int,
  p_assigned_to uuid
) returns void as $$
declare v_client_id uuid;
declare v_phone text; v_name text; v_address text;
begin
  select client_id into v_client_id from public.work_orders where id=p_work_order_id;

  v_phone := regexp_replace(coalesce(p_phone,''), '\\D', '', 'g');
  v_name := btrim(coalesce(p_client_name,''));
  v_address := btrim(coalesce(p_address,''));
  if v_phone = '' then raise exception 'Phone is required'; end if;
  if v_name = '' then raise exception 'Client name is required'; end if;
  if v_address = '' then raise exception 'Address is required'; end if;

  update public.clients
    set name=v_name, phone=v_phone, address=v_address, updated_at=now()
  where id=v_client_id;

  update public.work_orders set
    status=p_status,
    service=p_service,
    description=p_description,
    scheduled_start=p_scheduled_start,
    estimated_minutes=p_estimated_minutes,
    assigned_to=p_assigned_to,
    updated_at=now()
  where id=p_work_order_id;

  perform public.notify_user(
    auth.uid(),
    'OS actualizada · ' || v_name,
    coalesce(p_service,'(sin servicio)') || ' · ' || p_status,
    'work_order_updated',
    p_work_order_id
  );

  -- Notify assignee if different from editor
  if p_assigned_to is not null and p_assigned_to <> auth.uid() then
    perform public.notify_user(
      p_assigned_to,
      'OS actualizada · ' || v_name,
      coalesce(p_service,'(sin servicio)') || ' · ' || p_status,
      'work_order_updated',
      p_work_order_id
    );
  end if;
end;
$$ language plpgsql security definer;


-- Task notifications
create or replace function public.notify_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    -- Notify assigned user (or creator if unassigned)
    perform public.notify_user(
      coalesce(new.assigned_to, new.created_by),
      'Tarea creada',
      new.title,
      'task_created',
      new.id
    );
  elsif (tg_op = 'UPDATE') then
    -- Only notify when the completion state changes
    if (new.done is distinct from old.done) then
      perform public.notify_user(
        coalesce(new.assigned_to, new.created_by),
        case when new.done then 'Tarea completada' else 'Tarea reabierta' end,
        new.title,
        case when new.done then 'task_done' else 'task_reopened' end,
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_notify_ins on public.tasks;
create trigger trg_tasks_notify_ins
after insert on public.tasks
for each row execute function public.notify_task_change();

drop trigger if exists trg_tasks_notify_upd on public.tasks;
create trigger trg_tasks_notify_upd
after update on public.tasks
for each row execute function public.notify_task_change();


create or replace function public.work_orders_for_date(p_date date)
returns table (
  id uuid,
  client_name text,
  phone text,
  address text,
  service text,
  description text,
  status text,
  scheduled_start timestamptz,
  estimated_minutes int,
  assigned_to uuid,
  assigned_to_name text,
  tags jsonb
) as $$
  select
    wo.id,
    c.name,
    c.phone,
    c.address,
    wo.service,
    wo.description,
    wo.status,
    wo.scheduled_start,
    wo.estimated_minutes,
    wo.assigned_to,
    p.name as assigned_to_name,
    (
      select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color) order by t.name), '[]'::jsonb)
      from public.work_order_tags wot
      join public.tags t on t.id=wot.tag_id
      where wot.work_order_id = wo.id
    ) as tags
  from public.work_orders wo
  join public.clients c on c.id=wo.client_id
  left join public.profiles p on p.id = wo.assigned_to
  where wo.scheduled_start is not null
    and (wo.scheduled_start at time zone 'America/Cancun')::date = p_date
    and wo.status <> 'Finalizado'
    -- If the OS is already in a route for this day, hide it from the left "Disponibles" list
    and not exists (
      select 1
      from public.route_items ri
      join public.routes r on r.id = ri.route_id
      where r.route_date = p_date
        and ri.work_order_id = wo.id
    )
    and (
      public.is_admin()
      or wo.assigned_to = auth.uid()
      or wo.created_by = auth.uid()
    )
  order by wo.scheduled_start asc;
$$ language sql stable;


create or replace function public.route_items_for_date(p_date date)
returns table (id uuid, route_number int, work_order_id uuid, done boolean, work_order jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    ri.id,
    r.route_number,
    ri.work_order_id,
    ri.done,
    jsonb_build_object(
      'id', wo.id,
      'client_name', c.name,
      'phone', c.phone,
      'address', c.address,
      'service', wo.service,
      'description', wo.description,
      'status', wo.status,
      'scheduled_start', wo.scheduled_start,
      'estimated_minutes', wo.estimated_minutes,
      'assigned_to', wo.assigned_to,
      'assigned_to_name', p.name,
      'tags', (
        select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color) order by t.name), '[]'::jsonb)
        from public.work_order_tags wot
        join public.tags t on t.id=wot.tag_id
        where wot.work_order_id = wo.id
      )
    )
  from public.route_items ri
  join public.routes r on r.id=ri.route_id
  join public.work_orders wo on wo.id=ri.work_order_id
  join public.clients c on c.id=wo.client_id
  left join public.profiles p on p.id = wo.assigned_to
  where r.route_date=p_date
    and (public.is_admin() or r.technician_id = auth.uid())
  order by r.route_number asc, ri.created_at asc;
$$;


create or replace function public.add_work_order_to_route(p_date date, p_route_number int, p_work_order_id uuid)
returns void as $$
declare
  v_route_id uuid;
  v_tech_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- ✅ Fix: when an admin adds an OS to a route, it should appear for the assigned technician.
  -- Strategy:
  -- - If the caller is admin AND the Work Order has assigned_to, route belongs to that technician.
  -- - Otherwise, route belongs to the caller (technician managing their own day).
  select
    case
      when public.is_admin() and wo.assigned_to is not null then wo.assigned_to
      else auth.uid()
    end
  into v_tech_id
  from public.work_orders wo
  where wo.id = p_work_order_id;

  if v_tech_id is null then
    v_tech_id := auth.uid();
  end if;

  insert into public.routes (route_date, route_number, technician_id)
  values (p_date, p_route_number, v_tech_id)
  on conflict (route_date, route_number, technician_id) do update set route_date=excluded.route_date
  returning id into v_route_id;

  insert into public.route_items (route_id, work_order_id)
  values (v_route_id, p_work_order_id)
  on conflict do nothing;

  perform public.notify_user(
    v_tech_id,
    'OS en ruta · Ruta ' || p_route_number,
    (
      select c.name || ' · ' || coalesce(wo.service,'(sin servicio)')
      from public.work_orders wo join public.clients c on c.id=wo.client_id
      where wo.id=p_work_order_id
    ),
    'route_added',
    p_work_order_id
  );
end;
$$ language plpgsql security definer;


create or replace function public.notify_route_item_done()
returns trigger as $$
declare v_name text; v_service text;
begin
  if new.done=true and (old.done is distinct from new.done) then
    select c.name, wo.service into v_name, v_service
    from public.route_items ri
    join public.work_orders wo on wo.id=ri.work_order_id
    join public.clients c on c.id=wo.client_id
    where ri.id=new.id;

    perform public.notify_user(
      auth.uid(),
      'Servicio finalizado en ruta',
      v_name || ' · ' || coalesce(v_service,'(sin servicio)'),
      'route_done',
      (select ri.work_order_id from public.route_items ri where ri.id=new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_route_item_done on public.route_items;
create trigger trg_route_item_done after update on public.route_items
for each row execute function public.notify_route_item_done();

-- RLS
-- Enable RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.work_orders enable row level security;
alter table public.tags enable row level security;
alter table public.work_order_tags enable row level security;
alter table public.routes enable row level security;
alter table public.route_items enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_entries enable row level security;
alter table public.notifications enable row level security;

-- Profiles
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select
using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- Clients (admin only)
drop policy if exists clients_admin_all on public.clients;
create policy clients_admin_all
on public.clients for all
using (public.is_admin())
with check (public.is_admin());

-- Allow technicians to SELECT clients only when related to their visible work orders/routes.
drop policy if exists clients_select_related on public.clients;
create policy clients_select_related
on public.clients for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.work_orders wo
    where wo.client_id = clients.id
      and (wo.assigned_to = auth.uid() or wo.created_by = auth.uid())
  )
  or exists (
    select 1
    from public.route_items ri
    join public.routes r on r.id = ri.route_id
    join public.work_orders wo on wo.id = ri.work_order_id
    where wo.client_id = clients.id
      and r.technician_id = auth.uid()
  )
);

-- Work orders
drop policy if exists wo_admin_all on public.work_orders;
create policy wo_admin_all
on public.work_orders for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists wo_tech_select_assigned on public.work_orders;
create policy wo_tech_select_assigned
on public.work_orders for select
using (assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists wo_tech_update_assigned on public.work_orders;
create policy wo_tech_update_assigned
on public.work_orders for update
using (assigned_to = auth.uid() or created_by = auth.uid())
with check (assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists wo_tech_insert on public.work_orders;
create policy wo_tech_insert
on public.work_orders for insert
with check (created_by = auth.uid());

-- Tags (custom labels)
drop policy if exists tags_select_all on public.tags;
create policy tags_select_all
on public.tags for select
using (auth.uid() is not null);

drop policy if exists tags_insert_own on public.tags;
create policy tags_insert_own
on public.tags for insert
with check (created_by = auth.uid());

drop policy if exists tags_update_own_or_admin on public.tags;
create policy tags_update_own_or_admin
on public.tags for update
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());

drop policy if exists tags_delete_own_or_admin on public.tags;
create policy tags_delete_own_or_admin
on public.tags for delete
using (public.is_admin() or created_by = auth.uid());

drop policy if exists wotags_admin_all on public.work_order_tags;
drop policy if exists wotags_select_visible_wo on public.work_order_tags;
drop policy if exists wotags_insert_visible_wo on public.work_order_tags;
drop policy if exists wotags_delete_visible_wo on public.work_order_tags;

-- Work order tags: allow manage when the underlying OS is visible to the user
create policy wotags_select_visible_wo
on public.work_order_tags for select
using (
  public.is_admin()
  or exists(select 1 from public.work_orders wo where wo.id = work_order_id and (wo.assigned_to=auth.uid() or wo.created_by=auth.uid()))
);

create policy wotags_insert_visible_wo
on public.work_order_tags for insert
with check (
  public.is_admin()
  or exists(select 1 from public.work_orders wo where wo.id = work_order_id and (wo.assigned_to=auth.uid() or wo.created_by=auth.uid()))
);

create policy wotags_delete_visible_wo
on public.work_order_tags for delete
using (
  public.is_admin()
  or exists(select 1 from public.work_orders wo where wo.id = work_order_id and (wo.assigned_to=auth.uid() or wo.created_by=auth.uid()))
);

-- Routes
drop policy if exists routes_admin_all on public.routes;
create policy routes_admin_all
on public.routes for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists routes_tech_own_select on public.routes;
create policy routes_tech_own_select
on public.routes for select
using (technician_id = auth.uid());

drop policy if exists routes_tech_own_insert on public.routes;
create policy routes_tech_own_insert
on public.routes for insert
with check (technician_id = auth.uid());

-- Route items
drop policy if exists route_items_admin_all on public.route_items;
create policy route_items_admin_all
on public.route_items for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists route_items_tech_select_via_route on public.route_items;
create policy route_items_tech_select_via_route
on public.route_items for select
using (exists(select 1 from public.routes r where r.id = route_id and r.technician_id = auth.uid()));

drop policy if exists route_items_tech_update_via_route on public.route_items;
create policy route_items_tech_update_via_route
on public.route_items for update
using (exists(select 1 from public.routes r where r.id = route_id and r.technician_id = auth.uid()))
with check (exists(select 1 from public.routes r where r.id = route_id and r.technician_id = auth.uid()));

drop policy if exists route_items_tech_insert_via_route on public.route_items;
create policy route_items_tech_insert_via_route
on public.route_items for insert
with check (exists(select 1 from public.routes r where r.id = route_id and r.technician_id = auth.uid()));

-- Tasks
drop policy if exists tasks_admin_all on public.tasks;
create policy tasks_admin_all
on public.tasks for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists tasks_tech_select on public.tasks;
create policy tasks_tech_select
on public.tasks for select
using (assigned_to = auth.uid() or created_by = auth.uid() or assigned_to is null);

drop policy if exists tasks_tech_insert on public.tasks;
create policy tasks_tech_insert
on public.tasks for insert
with check (created_by = auth.uid());

drop policy if exists tasks_tech_update on public.tasks;
create policy tasks_tech_update
on public.tasks for update
using (created_by = auth.uid() or assigned_to = auth.uid())
with check (created_by = auth.uid() or assigned_to = auth.uid());

-- Finance entries
drop policy if exists finance_select_own_or_admin on public.finance_entries;
create policy finance_select_own_or_admin
on public.finance_entries for select
using (public.is_admin() or created_by = auth.uid());

drop policy if exists finance_insert_own on public.finance_entries;
create policy finance_insert_own
on public.finance_entries for insert
with check (created_by = auth.uid());

drop policy if exists finance_update_own_or_admin on public.finance_entries;
create policy finance_update_own_or_admin
on public.finance_entries for update
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());

drop policy if exists finance_delete_own_or_admin on public.finance_entries;
create policy finance_delete_own_or_admin
on public.finance_entries for delete
using (public.is_admin() or created_by = auth.uid());

-- Notifications
drop policy if exists notifs_select_own_or_admin on public.notifications;
create policy notifs_select_own_or_admin
on public.notifications for select
using (public.is_admin() or user_id = auth.uid());

drop policy if exists notifs_insert_own_or_admin on public.notifications;
create policy notifs_insert_own_or_admin
on public.notifications for insert
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists notifs_update_own_or_admin on public.notifications;
create policy notifs_update_own_or_admin
on public.notifications for update
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

-- ============ Auth user -> profile auto-creation ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1), ''),
    coalesce(new.raw_user_meta_data->>'role', 'technician'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ Storage bucket for avatars ============
-- Bucket (public read) + policies for authenticated users to upload to their own folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects for select
using (bucket_id = 'avatars');

-- Users can upload/update/delete their own objects (owner = auth.uid()) in avatars bucket
drop policy if exists avatars_user_insert on storage.objects;
create policy avatars_user_insert
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists avatars_user_update on storage.objects;
create policy avatars_user_update
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid() = owner)
with check (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists avatars_user_delete on storage.objects;
create policy avatars_user_delete
on storage.objects for delete
using (bucket_id = 'avatars' and auth.uid() = owner);
