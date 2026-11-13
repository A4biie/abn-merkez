-- Kanban (Merkez 0.11 bölüm 2): sütun içi sıra ve canlı görev güncellemesi.
-- position küçükten büyüğe sıralanır. Yeni görev en üste düşsün diye varsayılan değer -(oluşturma anı, saniye);
-- kart iki kartın arasına bırakılınca ikisinin ortalaması yazılır, diğer satırlara dokunulmaz.

alter table public.tasks
  add column if not exists position double precision not null default (-extract(epoch from now()));

update public.tasks set position = -extract(epoch from created_at);

create index if not exists tasks_status_position_idx on public.tasks (status, position);

-- Sürükle bırak herkeste anında görünsün. RLS geçerli ("görevler: ekip okur").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
