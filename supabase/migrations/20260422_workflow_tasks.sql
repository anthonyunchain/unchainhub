-- =============================================================================
-- WORKFLOW MESSAGE TEMPLATES — 17 message templates for monthly client comms
-- =============================================================================

create table if not exists public.workflow_message_templates (
  id                   uuid primary key default gen_random_uuid(),
  msg_id               text not null unique,
  week_label           text,
  trigger_event        text,
  is_reminder          boolean not null default false,
  reminder_delay_days  int not null default 0,
  default_channel      text check (default_channel in ('email','whatsapp','push')),
  subject_en           text,
  message_en           text not null,
  subject_fi           text,
  message_fi           text not null default '',
  variables            text,
  notes                text,
  default_day_of_month int,
  default_assigned_to  text not null default 'anthony',
  created_at           timestamptz not null default now()
);

alter table public.workflow_message_templates enable row level security;

create policy "wmt_admin_all" on public.workflow_message_templates
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Seed real content from unchain_client_messages_v2.csv
insert into public.workflow_message_templates
  (msg_id, week_label, trigger_event, is_reminder, reminder_delay_days,
   default_channel, subject_en, message_en, variables, notes,
   default_day_of_month, default_assigned_to)
values
  ('MSG_01','Week 1','Month start',false,0,'whatsapp',null,
   'Hi {client_name} 👋 A new month is starting! Let''s schedule our monthly sync for the last week of {month} — here are my availabilities: {availabilities}. Let me know what works best for you!',
   '{client_name}, {month}, {availabilities}','Meeting invitation — sent mid-month for last week sync',1,'anthony'),

  ('MSG_02','Week 1','Month start',false,0,'email',
   'Monthly sync — {month}',
   'Hi {client_name}! I''d like to schedule our monthly sync for the last week of {month}. Here are my proposed time slots: {availabilities}. Looking forward to connecting!',
   '{client_name}, {month}, {availabilities}','Email version of meeting invitation',1,'anthony'),

  ('MSG_03','Week 1','Month start',false,0,'email',
   'Brief for {next_month} + shooting dates',
   'Hi {client_name}, it''s time to prepare {next_month}! Please fill in your content brief here: {brief_link}. Deadline: {deadline_brief}. I''m also proposing the following shooting dates for {next_month}: {shooting_dates} — please confirm your availability alongside the brief. Thank you!',
   '{client_name}, {next_month}, {brief_link}, {deadline_brief}, {shooting_dates}','Brief + shooting dates sent together on day 1 of the cycle',1,'anthony'),

  ('MSG_04','Week 1','Brief not received',true,5,'whatsapp',null,
   'Hey {client_name}! Just a quick reminder to fill in the brief for {next_month} 😊 It only takes 5 minutes → {brief_link}. Deadline: {deadline_brief}.',
   '{client_name}, {next_month}, {brief_link}, {deadline_brief}','Only reminder — sent once at day 5. No further reminder after deadline.',5,'anthony'),

  ('MSG_05','Week 2','Brief received',false,0,'whatsapp',null,
   'Got it — thank you {client_name}! 🎉 I''ve received your brief for {next_month}. I''ll get back to you with the editorial calendar by {deadline_calendar}.',
   '{client_name}, {next_month}, {deadline_calendar}','Acknowledgement sent as soon as brief is received',null,'anthony'),

  ('MSG_06','Week 2','Calendar PDF added',false,0,'email',
   'Your editorial calendar for {next_month} is ready',
   'Hi {client_name}! Your editorial calendar for {next_month} is now available in your UnchainHub space. Please review it and send me your feedback before {deadline_calendar}. Looking forward to your thoughts!',
   '{client_name}, {next_month}, {deadline_calendar}','Sent when PDF is uploaded to UnchainHub',14,'anthony'),

  ('MSG_07','Week 2','Calendar PDF added',false,0,'push',
   '📅 Your editorial calendar is ready!',
   'Your editorial calendar for {next_month} has just been added to your space. Tap to review it.',
   '{next_month}','Push notification triggered automatically on PDF upload',14,'anthony'),

  ('MSG_08','Week 2','Calendar not validated',true,3,'whatsapp',null,
   'Hey {client_name}! Have you had a chance to look at the editorial calendar for {next_month}? Feel free to share any feedback — I''m here if you have questions 🙌',
   '{client_name}, {next_month}','Single reminder at day 3 after calendar sent',17,'anthony'),

  ('MSG_09','Week 3','Calendar not validated',true,6,'email',
   'Action required — Calendar validation for {next_month}',
   'Hi {client_name}, I haven''t received your feedback on the {next_month} editorial calendar yet. If I don''t hear back by {deadline_calendar}, I will consider it approved and move into production. Thank you!',
   '{client_name}, {next_month}, {deadline_calendar}','Auto-validation notice if still no response at day 6',22,'anthony'),

  ('MSG_10','Week 3','Revisions received',false,0,'whatsapp',null,
   'Revisions noted ✅ Thanks {client_name}! I''ve updated the calendar — we''re now moving into production for {next_month}. I''ll keep you posted!',
   '{client_name}, {next_month}','Sent after client feedback is processed',null,'anthony'),

  ('MSG_11','Week 3','Calendar validated',false,0,'whatsapp',null,
   'The calendar for {next_month} is validated 🎉 We''re now in production mode. Stay tuned!',
   '{next_month}','Sent when calendar is marked as validated',null,'anthony'),

  ('MSG_12','Week 3','Shooting not confirmed',true,4,'whatsapp',null,
   'Hey {client_name}! Still waiting on your confirmation for the {next_month} shootings 📸 Proposed dates: {shooting_dates} — let me know ASAP so I can lock it in!',
   '{client_name}, {next_month}, {shooting_dates}','Only reminder for shooting confirmation — sent once at day 4',null,'anthony'),

  ('MSG_13','Week 4','Performance report added',false,0,'email',
   'Your performance report — {month}',
   'Hi {client_name}! Your performance report for {month} is ready. You''ll find key metrics, highlights and recommendations for {next_month}. Check it in your UnchainHub space or download it here: {report_link}',
   '{client_name}, {month}, {next_month}, {report_link}','Sent at start of next cycle (day 1 of following month)',1,'anthony'),

  ('MSG_14','Week 4','Performance report added',false,0,'push',
   '📊 Your {month} report is here!',
   'Your performance report for {month} has just been added. Tap to review your results.',
   '{month}','Push notification triggered automatically on report upload',null,'anthony'),

  ('MSG_15','Week 4','End of month',false,0,'whatsapp',null,
   'Everything is scheduled for {next_month} 🚀 Great work {client_name}! See you next week for our monthly sync. Have a great end of month!',
   '{client_name}, {next_month}','Closing message — sent last working day of the month',28,'anthony'),

  ('MSG_16','Week 4','Report not opened',true,2,'email',
   'Did you see your performance report for {month}?',
   'Hi {client_name}, just checking in — have you had a chance to review your {month} performance report? It includes key insights for {next_month}. You can access it here: {report_link}',
   '{client_name}, {month}, {next_month}, {report_link}','Reminder only if report not opened after 2 days',null,'anthony'),

  ('MSG_17','Anytime','New brief form available',false,0,'push',
   '📝 Your brief form for {next_month} is open!',
   'It''s time to share your ideas for {next_month}. Fill in your brief now to help us craft the best content strategy for you.',
   '{next_month}','Push triggered when brief form is made available in UnchainHub',null,'anthony')

on conflict (msg_id) do nothing;

-- =============================================================================
-- WORKFLOW TASKS
-- =============================================================================

create table if not exists public.workflow_tasks (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete cascade,
  month            text not null,
  msg_id           text not null references public.workflow_message_templates(msg_id),
  scheduled_date   date not null,
  channel          text check (channel in ('email','whatsapp','push')),
  status           text not null default 'pending'
                     check (status in ('pending','sent','skipped')),
  assigned_to      text not null default 'anthony',
  assigned_user_id uuid references auth.users(id) on delete set null,
  sent_at          timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_workflow_tasks_month    on public.workflow_tasks(month);
create index if not exists idx_workflow_tasks_client   on public.workflow_tasks(client_id);
create index if not exists idx_workflow_tasks_assigned on public.workflow_tasks(assigned_user_id);
create index if not exists idx_workflow_tasks_date     on public.workflow_tasks(scheduled_date);

alter table public.workflow_tasks enable row level security;

create policy "wt_admin_all" on public.workflow_tasks
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "wt_freelancer_select" on public.workflow_tasks
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'freelancer')
    and assigned_user_id = auth.uid()
  );

create policy "wt_freelancer_update" on public.workflow_tasks
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'freelancer')
    and assigned_user_id = auth.uid()
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'freelancer')
    and assigned_user_id = auth.uid()
  );
