-- RLS-safe delivery completion and customer confirmation helpers.

create schema if not exists transacties;

create or replace function transacties.complete_delivery_for_current_user(
  p_delivery_id uuid,
  p_foto_bewijs text[],
  p_confirm_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = transacties, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_delivery transacties.deliveries%rowtype;
  v_token text := nullif(trim(coalesce(p_confirm_token, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_delivery_id is null then
    raise exception 'delivery_id is required' using errcode = '22023';
  end if;

  if p_foto_bewijs is null or coalesce(array_length(p_foto_bewijs, 1), 0) = 0 then
    raise exception 'at least one proof photo is required' using errcode = '22023';
  end if;

  select *
    into v_delivery
    from transacties.deliveries
   where id = p_delivery_id
   for update;

  if not found then
    raise exception 'delivery not found' using errcode = 'P0002';
  end if;

  if v_delivery.chauffeur_id is not null and v_delivery.chauffeur_id <> v_user_id then
    raise exception 'delivery assigned to another chauffeur' using errcode = '42501';
  end if;

  if v_token is null then
    v_token := coalesce(v_delivery.confirm_token, encode(gen_random_bytes(24), 'hex'));
  end if;

  update transacties.deliveries
     set geleverd_op = now(),
         foto_bewijs = p_foto_bewijs,
         chauffeur_id = v_user_id,
         confirm_token = v_token
   where id = p_delivery_id
   returning *
    into v_delivery;

  return jsonb_build_object(
    'id', v_delivery.id,
    'order_id', v_delivery.order_id,
    'geleverd_op', v_delivery.geleverd_op,
    'foto_bewijs', v_delivery.foto_bewijs,
    'chauffeur_id', v_delivery.chauffeur_id,
    'klant_bevestigd', v_delivery.klant_bevestigd,
    'klant_bevestigd_op', v_delivery.klant_bevestigd_op,
    'confirm_token', v_delivery.confirm_token
  );
end;
$$;

create or replace function transacties.confirm_delivery_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = transacties, public, pg_temp
as $$
declare
  v_token text := nullif(trim(coalesce(p_token, '')), '');
  v_delivery transacties.deliveries%rowtype;
begin
  if v_token is null then
    raise exception 'confirmation token is required' using errcode = '22023';
  end if;

  select *
    into v_delivery
    from transacties.deliveries
   where confirm_token = v_token
   for update;

  if not found then
    raise exception 'delivery token not found' using errcode = 'P0002';
  end if;

  update transacties.deliveries
     set klant_bevestigd = true,
         klant_bevestigd_op = coalesce(klant_bevestigd_op, now())
   where id = v_delivery.id
   returning *
    into v_delivery;

  return jsonb_build_object(
    'id', v_delivery.id,
    'order_id', v_delivery.order_id,
    'geleverd_op', v_delivery.geleverd_op,
    'klant_bevestigd', v_delivery.klant_bevestigd,
    'klant_bevestigd_op', v_delivery.klant_bevestigd_op
  );
end;
$$;

revoke all on function transacties.complete_delivery_for_current_user(uuid, text[], text) from public;
revoke all on function transacties.confirm_delivery_by_token(text) from public;

grant execute on function transacties.complete_delivery_for_current_user(uuid, text[], text) to authenticated, service_role;
grant execute on function transacties.confirm_delivery_by_token(text) to anon, authenticated, service_role;
