-- Nome de exibição do usuário (coach ou atleta). auth.users não expõe nome ao client,
-- só e-mail via RPC; esta tabela guarda um display_name opcional editável pelo próprio
-- usuário, usado na lista de descoberta de grupos/treinadores (20260808150000).

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Provisiona a linha de perfil automaticamente para toda conta nova.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Backfill para contas já existentes antes desta migration.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;

create policy "users can read own profile"
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy "users can update own profile"
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Upsert do próprio nome de exibição; usado tanto pelo atleta quanto pelo coach.
create or replace function public.update_my_display_name(p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  trimmed_name text;
begin
  if auth.uid() is null then
    raise exception using message = 'Autenticação necessária.';
  end if;

  trimmed_name := btrim(p_display_name);

  if char_length(trimmed_name) < 2 then
    raise exception using message = 'Informe um nome com pelo menos 2 caracteres.';
  end if;

  insert into public.profiles (user_id, display_name)
  values (auth.uid(), trimmed_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  returning * into profile_row;

  return profile_row;
end;
$$;

comment on function public.update_my_display_name(text) is
  'Define o nome de exibição do usuário autenticado (coach ou atleta).';

revoke all on function public.update_my_display_name(text) from public;
grant execute on function public.update_my_display_name(text) to authenticated;
