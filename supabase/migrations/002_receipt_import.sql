-- Zusätzlich zur bestehenden 001_initial.sql ausführen. Keine bestehenden Daten löschen.
begin;
create table if not exists public.receipt_imports (
 user_id uuid not null references auth.users(id) on delete cascade,
 receipt_hash text not null check(receipt_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 primary key(user_id,receipt_hash)
);
alter table public.receipt_imports enable row level security;
-- Nur die geprüfte Funktion schreibt die Importmarkierung; keine Bilder werden gespeichert.
revoke all on public.receipt_imports from anon,authenticated;

create or replace function public.import_receipt(receipt_hash text, items jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); entry jsonb; product_id_found uuid;
 product_name text; product_unit text; amount numeric; inserted integer; total integer := 0;
begin
 if owner_id is null then raise exception 'Bitte anmelden.'; end if;
 if receipt_hash is null or receipt_hash !~ '^[a-f0-9]{64}$' then raise exception 'Ungültiger Bon-Schlüssel.'; end if;
 if items is null or jsonb_typeof(items) <> 'array' then raise exception 'Ungültige Produktliste.'; end if;
 if jsonb_array_length(items) not between 1 and 60 then raise exception 'Bitte 1 bis 60 Produkte auswählen.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 insert into public.receipt_imports(user_id,receipt_hash) values(owner_id,receipt_hash) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted = 0 then return 0; end if;
 for entry in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'name') is distinct from 'string'
   or jsonb_typeof(entry->'unit') is distinct from 'string' or jsonb_typeof(entry->'quantity') is distinct from 'number'
   then raise exception 'Unvollständige Bonposition.'; end if;
  product_name := trim(entry->>'name'); product_unit := entry->>'unit'; amount := (entry->>'quantity')::numeric;
  if length(product_name) not between 1 and 100 or product_unit not in ('g','ml','Stück')
   or amount not between 0.001 and 10000000 then raise exception 'Produktname, Menge oder Einheit ist ungültig.'; end if;
  insert into public.products(user_id,name,unit) values(owner_id,product_name,product_unit)
   on conflict (user_id,lower(trim(name)),unit) do nothing;
  select id into product_id_found from public.products
   where user_id=owner_id and lower(trim(name))=lower(product_name) and unit=product_unit for update;
  insert into public.inventory(user_id,product_id,quantity,unit,expires_on)
   values(owner_id,product_id_found,amount,product_unit,null);
  total := total + 1;
 end loop;
 return total;
end;$$;
revoke all on function public.import_receipt(text,jsonb) from public,anon;
grant execute on function public.import_receipt(text,jsonb) to authenticated;
commit;
