-- Disco lento ("archivo"): los chunks de tc_positions con más de 6 meses se mueven al tablespace
-- "archivo", que vive en /mnt/archivo/pg-archivo (block volume Lower Cost de 300 GB montado en el
-- contenedor traccar-postgres, ver compose.yml). Los chunks nuevos siguen en el disco rápido.
--
-- Aplicar una vez (ya aplicado el 2/11/2026):
--   docker exec -i traccar-postgres psql -U traccar -d traccar < timescale/archivo.sql
-- Ver estado:
--   select chunk_name, range_start::date, chunk_tablespace, is_compressed
--     from timescaledb_information.chunks where hypertable_name='tc_positions' order by range_start;
--   select * from timescaledb_information.jobs where proc_name='mover_chunks_archivo';
--   select * from timescaledb_information.job_stats where job_id = <id>;
-- Correr a mano:  call mover_chunks_archivo(0, null);

create or replace procedure mover_chunks_archivo(job_id int, config jsonb)
language plpgsql as $$
declare
  c record;
  meses interval := coalesce((config->>'meses')::int, 6) * interval '1 month';
begin
  for c in
    select format('%I.%I', chunk_schema, chunk_name) as ch, range_start::date as desde
      from timescaledb_information.chunks
     where hypertable_name = 'tc_positions'
       and range_end < now() - meses
       and coalesce(chunk_tablespace, '') <> 'archivo'
     order by range_start
  loop
    raise notice 'moviendo % (semana del %) a archivo', c.ch, c.desde;
    perform move_chunk(chunk => c.ch::regclass, destination_tablespace => 'archivo',
                       index_destination_tablespace => 'archivo');
    commit;
  end loop;
end $$;

-- Tarea mensual de TimescaleDB (corre dentro de PostgreSQL, no depende de cron ni de systemd).
select add_job('mover_chunks_archivo', schedule_interval => interval '1 month',
               initial_start => date_trunc('month', now()) + interval '1 month 4 hours 30 minutes',
               config => '{"meses": 6}')
 where not exists (select 1 from timescaledb_information.jobs where proc_name = 'mover_chunks_archivo');
