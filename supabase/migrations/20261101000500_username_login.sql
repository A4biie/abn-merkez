-- ABN Merkez · kullanıcı adı ve şifreyle giriş
--
-- Supabase Auth hesapları e-postayla tanır. Kullanıcı adı "<ad>@abnmerkez.local" biçiminde bir
-- e-postaya çevrilir (public.login_email). Bu adresler gerçek değildir; hiçbir e-posta gönderilmez.
--
-- Kayıt kapalıdır. Hesabı yönetici açar (admin_create_member), kullanıcı adını ve şifreyi yönetici
-- değiştirir (admin_set_login). İkisi de SQL Editor'den de çalışır.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.login_email(p_username text)
returns text language sql immutable set search_path = '' as $$
  select lower(p_username) || '@abnmerkez.local'
$$;

-- Verilen tabandan boşta bir kullanıcı adı üretir: "ece", doluysa "ece2", "ece3"...
create or replace function public.free_username(p_base text)
returns text language plpgsql stable set search_path = '' as $$
declare
  base text := left(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9._-]', '', 'g'), 28);
  cand text;
  n int := 1;
begin
  if length(base) < 3 then base := base || 'uye'; end if;
  cand := base;
  while exists (select 1 from public.profiles where username = cand) loop
    n := n + 1;
    cand := base || n;
  end loop;
  return cand;
end;
$$;

-- ───────────────────────── profiles.username ─────────────────────────

alter table public.profiles add column username text unique
  check (username ~ '^[a-z0-9._-]{3,32}$');

-- Var olan hesaplar (örnek kişiler, sihirli bağlantıyla açılmış hesaplar) e-postalarının baş
-- kısmından kullanıcı adı alır ve e-postaları yeni biçime geçer. Şifreleri yoksa yönetici belirler.
do $$
declare
  r record;
begin
  for r in
    select p.id, u.email from public.profiles p join auth.users u on u.id = p.id
     where p.username is null order by u.created_at
  loop
    update public.profiles set username = public.free_username(split_part(r.email, '@', 1)) where id = r.id;
  end loop;
end;
$$;

update auth.users u set email = public.login_email(p.username)
  from public.profiles p where p.id = u.id and u.email is distinct from public.login_email(p.username);
update auth.identities i
   set identity_data = i.identity_data || jsonb_build_object('email', public.login_email(p.username))
  from public.profiles p where p.id = i.user_id and i.provider = 'email';

alter table public.profiles alter column username set not null;

-- Yeni hesap açılınca profil kullanıcı adıyla birlikte oluşur.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local text := split_part(new.email, '@', 1);
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), local, ''),
    case
      when new.email = public.login_email(local) and local ~ '^[a-z0-9._-]{3,32}$'
        and not exists (select 1 from public.profiles where username = local)
      then local
      else public.free_username(local)
    end
  )
  on conflict (id) do nothing;
  insert into public.profit_shares (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- Kullanıcı adı değişince giriş e-postası da değişir.
create or replace function public.sync_login_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users set email = public.login_email(new.username), updated_at = now() where id = new.id;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', public.login_email(new.username))
   where user_id = new.id and provider = 'email';
  return new;
end;
$$;

create trigger profiles_username_sync after update of username on public.profiles
  for each row when (new.username is distinct from old.username)
  execute function public.sync_login_email();

-- Kişi kendi profilinde admin bayrağını, rol unvanını ve kullanıcı adını değiştiremez.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;   -- SQL editörü / servis anahtarı ya da admin
  end if;
  if new.is_admin is distinct from old.is_admin or new.role_title is distinct from old.role_title then
    raise exception 'Rolünü ve yönetici yetkisini sadece yöneticiler değiştirebilir.'
      using errcode = '42501';
  end if;
  if new.username is distinct from old.username then
    raise exception 'Kullanıcı adını sadece yöneticiler değiştirebilir.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ───────────────────────── Yönetici işlemleri ─────────────────────────

create or replace function public.check_login_input(p_username text, p_password text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_username is not null and p_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Kullanıcı adı 3-32 karakter olmalı; küçük harf, rakam, nokta, alt çizgi ve tire kullanılabilir.'
      using errcode = '22023';
  end if;
  if p_password is not null and (length(p_password) < 6 or length(p_password) > 72) then
    raise exception 'Şifre en az 6 karakter olmalı.' using errcode = '22023';
  end if;
end;
$$;

-- Yeni ekip üyesi açar. Dönüş: yeni kişinin id'si.
create or replace function public.admin_create_member(p_username text, p_full_name text, p_password text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_user text := lower(trim(p_username));
  v_email text;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Üye eklemeyi sadece yöneticiler yapabilir.' using errcode = '42501';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Kişinin adını yaz.' using errcode = '22023';
  end if;
  if p_password is null then
    raise exception 'Şifre en az 6 karakter olmalı.' using errcode = '22023';
  end if;
  perform public.check_login_input(v_user, p_password);
  if exists (select 1 from public.profiles where username = v_user) then
    raise exception 'Bu kullanıcı adı alınmış, başka bir tane dene.' using errcode = '23505';
  end if;

  v_email := public.login_email(v_user);
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', trim(p_full_name)),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now());
  return v_id;
end;
$$;

-- Kullanıcı adını ve/veya şifreyi değiştirir. Değişmeyecek olanı null bırak.
create or replace function public.admin_set_login(p_user uuid, p_username text default null, p_password text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user text := nullif(lower(trim(p_username)), '');
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Giriş bilgilerini sadece yöneticiler değiştirebilir.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Kişi bulunamadı.' using errcode = 'P0002';
  end if;
  perform public.check_login_input(v_user, nullif(p_password, ''));

  if v_user is not null and v_user is distinct from (select username from public.profiles where id = p_user) then
    if exists (select 1 from public.profiles where username = v_user) then
      raise exception 'Bu kullanıcı adı alınmış, başka bir tane dene.' using errcode = '23505';
    end if;
    update public.profiles set username = v_user where id = p_user;
  end if;

  if nullif(p_password, '') is not null then
    update auth.users
       set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = p_user;
  end if;
end;
$$;

revoke execute on function public.admin_create_member(text, text, text) from public, anon;
revoke execute on function public.admin_set_login(uuid, text, text) from public, anon;
grant execute on function public.admin_create_member(text, text, text) to authenticated;
grant execute on function public.admin_set_login(uuid, text, text) to authenticated;
