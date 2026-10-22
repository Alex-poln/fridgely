-- Fridgely: einmal in einem NEUEN Supabase-Projekt ausführen. Keine Beispieldaten.
begin;
create table public.products (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), unit text not null check(unit in ('g','ml','Stück')),
 category text not null default 'Sonstiges', kcal numeric check(kcal between 0 and 10000),
 protein numeric check(protein between 0 and 1000), carbs numeric check(carbs between 0 and 1000), fat numeric check(fat between 0 and 1000),
 nutrition_source text not null default 'manual' check(nutrition_source in ('manual','ai')), image_path text,
 created_at timestamptz not null default now(), unique(id,user_id)
);
create unique index product_name_unit_unique on public.products(user_id,lower(trim(name)),unit);
create table public.inventory (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null,quantity numeric not null check(quantity>0 and quantity<=10000000),
 unit text not null check(unit in ('g','ml','Stück')),expires_on date,date_type text not null default 'best_before' check(date_type in ('best_before','use_by')),
 created_at timestamptz not null default now(),foreign key(product_id,user_id) references public.products(id,user_id) on delete restrict
);
create table public.goals (
 id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id) on delete cascade,
 goal text not null check(goal in ('balanced','lose','gain','muscle')),diet text not null default 'Keine Einschränkung',
 allergies text not null default '' check(length(allergies)<=500),preferences text not null default '' check(length(preferences)<=500),created_at timestamptz not null default now()
);
create table public.recipes (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 content jsonb not null check(jsonb_typeof(content)='object'),cooked_at timestamptz,created_at timestamptz not null default now()
);
create table public.user_roles (user_id uuid primary key references auth.users(id) on delete cascade,role text not null default 'member' check(role in ('member','admin')));
-- Rollen nur durch Projektverantwortliche im SQL-Editor vergeben, niemals vom Frontend.
create function public.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.user_roles(user_id) values(new.id);return new;end;$$;
create trigger create_user_role after insert on auth.users for each row execute function public.on_signup();
insert into public.user_roles(user_id) select id from auth.users on conflict do nothing;
create table public.ai_usage(user_id uuid not null references auth.users(id) on delete cascade,day date not null default current_date,calls integer not null default 0,primary key(user_id,day));
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.goals enable row level security;
alter table public.recipes enable row level security;
alter table public.user_roles enable row level security;
alter table public.ai_usage enable row level security;
create policy own_products on public.products for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_inventory on public.inventory for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_goals on public.goals for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy read_recipes on public.recipes for select to authenticated using(user_id=(select auth.uid()));
create policy delete_recipes on public.recipes for delete to authenticated using(user_id=(select auth.uid()));
create policy read_role on public.user_roles for select to authenticated using(user_id=(select auth.uid()));
create policy read_usage on public.ai_usage for select to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.products, public.inventory, public.goals to authenticated;
grant select,delete on public.recipes to authenticated;
grant select on public.user_roles,public.ai_usage to authenticated;
revoke insert,update,delete on public.user_roles,public.ai_usage from anon,authenticated;
revoke insert,update on public.recipes from anon,authenticated;
grant all on public.products, public.inventory, public.goals, public.recipes, public.user_roles, public.ai_usage to service_role;
-- Serverseitiger Einheitenabgleich; Stammdaten dürfen bei vorhandenen Chargen nicht ihre Einheit wechseln.
create function public.check_inventory_unit() returns trigger language plpgsql set search_path='' as $$
declare product_unit text;
begin select unit into product_unit from public.products where id=new.product_id and user_id=new.user_id for update;
 if product_unit is distinct from new.unit then raise exception 'Einheit passt nicht zum Produkt.';end if;return new;end;$$;
create trigger inventory_unit before insert or update on public.inventory for each row execute function public.check_inventory_unit();
create function public.guard_product_unit() returns trigger language plpgsql set search_path='' as $$
begin if old.unit<>new.unit and exists(select 1 from public.inventory where product_id=old.id) then raise exception 'Einheit kann bei vorhandenem Vorrat nicht geändert werden.';end if;return new;end;$$;
create trigger product_unit before update on public.products for each row execute function public.guard_product_unit();
-- Mengenänderungen sind atomar: parallele +/- Aufrufe überschreiben sich nicht.
create function public.adjust_inventory(lot_id uuid,delta numeric) returns void language plpgsql security definer set search_path='' as $$
declare lot public.inventory; new_quantity numeric;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
 if delta is null or delta=0 or abs(delta)>10000000 or delta::text in ('NaN','Infinity','-Infinity') then raise exception 'Ungültige Menge';end if;
 -- Einheitliche Sperre pro Nutzer: verhindert Konflikte mit cook_recipe.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into lot from public.inventory where id=lot_id and user_id=auth.uid() for update;
 if not found then raise exception 'Charge nicht mehr vorhanden';end if;
 new_quantity:=lot.quantity+delta;
 if new_quantity<0 then raise exception 'Nicht genug Vorrat';end if;
 if new_quantity=0 then delete from public.inventory where id=lot.id;else update public.inventory set quantity=new_quantity where id=lot.id;end if;
end;$$;
-- Ganze Kochbuchung in EINER Transaktion. Fehler rollen sämtliche Abzüge zurück.
-- Rezeptzeile + Nutzersperre schützen vor Doppelbuchung und parallelem Kochen.
create function public.cook_recipe(recipe_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare recipe public.recipes; ingredient jsonb; lot public.inventory; remaining numeric; take numeric; matched_product uuid;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into recipe from public.recipes where id=recipe_id and user_id=auth.uid() for update;
 if not found then raise exception 'Rezept nicht gefunden';end if;
 if recipe.cooked_at is not null then raise exception 'Dieses Rezept wurde bereits abgezogen';end if;
 if jsonb_array_length(recipe.content->'ingredients')=0 then raise exception 'Rezept enthält keine Zutaten';end if;
 for ingredient in select value from jsonb_array_elements(recipe.content->'ingredients') loop
  remaining:=(ingredient->>'quantity')::numeric;
  if remaining is null or remaining<=0 then raise exception 'Ungültige Rezeptmenge';end if;
  matched_product:=null;
  if ingredient->>'product_id' is not null then matched_product:=(ingredient->>'product_id')::uuid;
  else select id into matched_product from public.products where user_id=auth.uid() and lower(trim(name))=lower(trim(ingredient->>'name')) and unit=ingredient->>'unit';end if;
  for lot in select * from public.inventory where user_id=auth.uid() and product_id=matched_product and unit=ingredient->>'unit' and (expires_on is null or expires_on>=current_date) order by expires_on asc nulls last,created_at,id for update loop
   take:=least(remaining,lot.quantity);
   if take=lot.quantity then delete from public.inventory where id=lot.id;else update public.inventory set quantity=quantity-take where id=lot.id;end if;
   remaining:=remaining-take;exit when remaining<=0;
  end loop;
  if remaining>0 then raise exception 'Nicht genug Vorrat für %',ingredient->>'name';end if;
 end loop;
 update public.recipes set cooked_at=now() where id=recipe.id;
end;$$;
-- Serverseitiges Limit, zählt auch Fehlversuche. Nur die Edge Function darf es aufrufen.
create function public.reserve_ai_call(target_user uuid) returns integer language plpgsql security definer set search_path='' as $$
declare count_now integer;allowed integer;
begin
 select case when role='admin' then 40 else 20 end into allowed from public.user_roles where user_id=target_user;
 allowed:=coalesce(allowed,20);
 insert into public.ai_usage(user_id,day,calls) values(target_user,current_date,1)
 on conflict(user_id,day) do update set calls=public.ai_usage.calls+1 where public.ai_usage.calls<allowed returning calls into count_now;
 if count_now is null then raise exception 'Dein Tageslimit für KI-Anfragen ist erreicht.';end if;
 return count_now;
end;$$;
revoke all on function public.reserve_ai_call(uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_call(uuid) to service_role;
revoke all on function public.adjust_inventory(uuid,numeric),public.cook_recipe(uuid) from public,anon;
grant execute on function public.adjust_inventory(uuid,numeric),public.cook_recipe(uuid) to authenticated;
create index inventory_owner_expiry on public.inventory(user_id,expires_on);
create index products_owner on public.products(user_id);
create index recipes_owner on public.recipes(user_id,created_at desc);
-- Private Bilder: Zugriff nur auf den eigenen Ordner <user-id>/...
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy own_images_read on storage.objects for select to authenticated using(bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_images_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_images_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
