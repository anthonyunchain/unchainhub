alter table tasks add column if not exists urls text[] default '{}';
