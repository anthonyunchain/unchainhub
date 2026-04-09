-- Ideas table for brainstorming content ideas
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  client_name text,
  likes uuid[] default '{}',
  created_by_name text,
  created_by_id uuid,
  created_at timestamptz default now()
);

-- RLS
alter table ideas enable row level security;

-- Admins can do everything
create policy "Admins full access on ideas"
  on ideas for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Freelancers with ideas_access can read and insert
create policy "Freelancers can read ideas if access granted"
  on ideas for select
  using (
    exists (
      select 1 from freelancers
      where email = (select email from auth.users where id = auth.uid())
      and ideas_access = true
    )
  );

create policy "Freelancers can insert ideas if access granted"
  on ideas for insert
  with check (
    exists (
      select 1 from freelancers
      where email = (select email from auth.users where id = auth.uid())
      and ideas_access = true
    )
  );

-- Freelancers can update (for likes) and delete their own ideas
create policy "Freelancers can update ideas if access granted"
  on ideas for update
  using (
    exists (
      select 1 from freelancers
      where email = (select email from auth.users where id = auth.uid())
      and ideas_access = true
    )
  );

create policy "Freelancers can delete their own ideas"
  on ideas for delete
  using (
    created_by_id = auth.uid()
  );

-- Add ideas_access to freelancers table
alter table freelancers add column if not exists ideas_access boolean default false;
