-- Freelancer service catalog
create table if not exists freelancer_services (
  id          uuid primary key default gen_random_uuid(),
  freelancer_id uuid references freelancers(id) on delete set null,
  name        text not null,
  description text,
  category    text,
  price       numeric(10,2) not null default 0,
  is_active   boolean not null default true,
  "order"     int not null default 0,
  created_at  timestamptz not null default now()
);

-- Monthly purchases: which services were ordered each month
create table if not exists monthly_service_orders (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid references freelancer_services(id) on delete cascade,
  month       text not null,          -- YYYY-MM
  custom_price numeric(10,2),         -- override catalog price if needed
  notes       text,
  status      text not null default 'active',  -- active | paused | cancelled
  created_at  timestamptz not null default now(),
  unique(service_id, month)
);

alter table freelancer_services enable row level security;
alter table monthly_service_orders enable row level security;

create policy "admin_all_freelancer_services" on freelancer_services for all using (true) with check (true);
create policy "admin_all_monthly_service_orders" on monthly_service_orders for all using (true) with check (true);
