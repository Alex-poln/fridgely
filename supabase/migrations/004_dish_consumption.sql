-- Run once in the Supabase SQL editor after the nutrition/tracker schema.
begin;
create table if not exists public.dish_stock_ledger (
 user_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null check(source_type in ('recipe','custom_meal')),
 source_id uuid not null,
 prepared numeric not null default 0 check(prepared>=0),
 eaten numeric not null default 0 check(eaten>=0),
 primary key(user_id,source_type,source_id)
);
alter table public.dish_stock_ledger enable row level security;
revoke all on public.dish_stock_ledger from public,anon,authenticated;
insert into public.dish_stock_ledger(user_id,source_type,source_id,prepared)
select user_id,'recipe',id,(content->>'servings')::numeric from public.recipes where cooked_at is not null
on conflict do nothing;

-- Private helper: called only by the authenticated, owner-checked RPCs below.
create or replace function public.deduct_available_dish(p_items jsonb,p_factor numeric)
returns void language plpgsql security definer set search_path='' as $$
declare ingredient jsonb; lot public.inventory; remaining numeric; take numeric; matched uuid;
begin
 if auth.uid() is null or p_factor<0 then raise exception 'Ungültige Buchung';end if;
 if p_factor=0 then return;end if;
 for ingredient in select value from jsonb_array_elements(p_items) loop
  remaining:=(ingredient->>'quantity')::numeric*p_factor;
  if remaining is null or remaining<=0 or remaining::text='NaN' then raise exception 'Ungültige Zutatenmenge';end if;
  matched:=null;
  if nullif(ingredient->>'product_id','') is not null then
   select id into matched from public.products where id=(ingredient->>'product_id')::uuid and user_id=auth.uid() and unit=ingredient->>'unit';
  else
   select id into matched from public.products where user_id=auth.uid() and lower(trim(name))=lower(trim(ingredient->>'name')) and unit=ingredient->>'unit' order by created_at,id limit 1;
  end if;
  for lot in select * from public.inventory where user_id=auth.uid() and product_id=matched and unit=ingredient->>'unit' order by expires_on asc nulls last,created_at,id for update loop
   take:=least(remaining,lot.quantity);
   if take=lot.quantity then delete from public.inventory where id=lot.id;
   else update public.inventory set quantity=quantity-take where id=lot.id;end if;
   remaining:=remaining-take;
   exit when remaining<=0;
  end loop;
  -- Missing ingredients and shortages deliberately do not roll back available stock.
 end loop;
end;$$;
revoke all on function public.deduct_available_dish(jsonb,numeric) from public,anon,authenticated;

create or replace function public.cook_recipe_available(recipe_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.recipes; ledger public.dish_stock_ledger; servings numeric;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into r from public.recipes where id=recipe_id and user_id=auth.uid() for update;
 if not found then raise exception 'Rezept nicht gefunden';end if;
 servings:=(r.content->>'servings')::numeric;
 if servings is null or servings<=0 then raise exception 'Ungültige Portionen';end if;
 insert into public.dish_stock_ledger(user_id,source_type,source_id) values(auth.uid(),'recipe',r.id) on conflict do nothing;
 select * into ledger from public.dish_stock_ledger where user_id=auth.uid() and source_type='recipe' and source_id=r.id for update;
 perform public.deduct_available_dish(r.content->'ingredients',greatest(servings-ledger.prepared,0)/servings);
 update public.dish_stock_ledger set prepared=greatest(prepared,servings) where user_id=auth.uid() and source_type='recipe' and source_id=r.id;
 update public.recipes set cooked_at=coalesce(cooked_at,now()) where id=r.id;
end;$$;

create or replace function public.log_dish_consumption(p_request_id uuid,p_source_type text,p_source_id uuid,p_quantity numeric,p_entry_date date,p_meal_type text,p_nutrition jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare items jsonb; title text; servings numeric; ledger public.dish_stock_ledger; extra numeric; k text; v numeric;
begin
 if auth.uid() is null then raise exception 'Nicht angemeldet';end if;
 if p_request_id is null or p_entry_date is null or p_quantity is null or p_quantity<=0 or p_quantity>10000 or p_quantity::text='NaN'
 or p_meal_type is null or p_meal_type not in ('breakfast','lunch','dinner','snack') then raise exception 'Ungültiger Tagebucheintrag';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.food_entries where user_id=auth.uid() and request_id=p_request_id) then return;end if;
 if p_source_type='recipe' then
  select content->'ingredients',content->>'title',(content->>'servings')::numeric into items,title,servings from public.recipes where id=p_source_id and user_id=auth.uid() for update;
 elsif p_source_type='custom_meal' then
  select ingredients,name,custom_meals.servings into items,title,servings from public.custom_meals where id=p_source_id and user_id=auth.uid() for update;
 else raise exception 'Ungültige Quelle';end if;
 if title is null or servings is null or servings<=0 then raise exception 'Gericht nicht gefunden';end if;
 foreach k in array array['kcal','protein','carbs','fat'] loop
  v:=(p_nutrition->>k)::numeric;
  if v<0 or v>1000000 or v::text='NaN' then raise exception 'Ungültige Nährwerte';end if;
 end loop;
 insert into public.dish_stock_ledger(user_id,source_type,source_id) values(auth.uid(),p_source_type,p_source_id) on conflict do nothing;
 select * into ledger from public.dish_stock_ledger where user_id=auth.uid() and source_type=p_source_type and source_id=p_source_id for update;
 extra:=greatest(ledger.eaten+p_quantity-ledger.prepared,0);
 perform public.deduct_available_dish(coalesce(items,'[]'::jsonb),extra/servings);
 update public.dish_stock_ledger set prepared=prepared+extra,eaten=eaten+p_quantity where user_id=auth.uid() and source_type=p_source_type and source_id=p_source_id;
 insert into public.food_entries(user_id,request_id,entry_date,meal_type,name,source_type,source_id,quantity,unit,kcal,protein,carbs,fat,nutrition_source)
 values(auth.uid(),p_request_id,p_entry_date,p_meal_type,title,p_source_type,p_source_id,p_quantity,'Portion',(p_nutrition->>'kcal')::numeric,(p_nutrition->>'protein')::numeric,(p_nutrition->>'carbs')::numeric,(p_nutrition->>'fat')::numeric,'calculated');
end;$$;
revoke all on function public.cook_recipe_available(uuid),public.log_dish_consumption(uuid,text,uuid,numeric,date,text,jsonb) from public,anon;
grant execute on function public.cook_recipe_available(uuid),public.log_dish_consumption(uuid,text,uuid,numeric,date,text,jsonb) to authenticated;
-- Old clients must use the same safe cooking implementation.
create or replace function public.cook_recipe(recipe_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform public.cook_recipe_available(recipe_id);end;$$;
commit;
