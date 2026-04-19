create table if not exists client_workflow_steps (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null,
  month        text not null, -- yyyy-MM
  step_key     text not null, -- meeting_prev | stats_share | calendar_pdf | shooting_org | meeting_review
  completed    boolean not null default false,
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (client_name, month, step_key)
);

alter table client_workflow_steps enable row level security;

create policy "Admins full access"
  on client_workflow_steps for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
