-- El poso EXACTO de las 33 tablas (count(*), no estadisticas). Uso: psql -tA -f poso-todo.sql -d <url>
select 'tablas=' || count(*) || ' · con filas: ' || coalesce(string_agg(t || '=' || n, ' ') filter (where n > 0), '(ninguna)')
from (
  select table_name as t,
         (xpath('/row/c/text()', query_to_xml('select count(*) as c from ' || quote_ident(table_name), false, true, '')))[1]::text::int as n
  from information_schema.tables
  where table_schema = 'public'
) x;
