-- ABN Merkez 0.7.0 · ilk giriş akışı
-- onboarded: hoş geldin turu bitti ya da atlandı. skills: "Ne yaparsın?" seçimleri (kişinin kendisi
-- değiştirir; role_title'dan farklı olarak yöneticiye bağlı değil).

alter table public.profiles
  add column onboarded boolean not null default false,
  add column skills text[] not null default '{}' check (cardinality(skills) <= 12);
