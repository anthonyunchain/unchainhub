alter table public.editorial_content
  add column if not exists shoot_timing text
    not null default 'in-month'
    check (shoot_timing in ('advance','in-month','no-shoot'));
