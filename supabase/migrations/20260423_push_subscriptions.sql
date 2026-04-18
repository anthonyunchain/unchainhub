create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy "users_own_subscriptions" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "service_role_all" on push_subscriptions for all using (true) with check (true);
