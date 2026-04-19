create table if not exists google_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
alter table google_calendar_tokens enable row level security;
create policy "Users manage own tokens" on google_calendar_tokens
  for all using (auth.uid() = user_id);
