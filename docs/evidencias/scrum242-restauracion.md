# SCRUM-242 · Evidencia de la primera restauración real

**10-ago-2026, 12:15–12:50 CEST (UTC+0200).** Ejecutado contra la base **desechable**
`postgres-scratch`, nunca contra producción ni staging (ni en lectura). Esa base no tiene ni tendrá
jamás un dato real.

El host y la cadena de conexión **no aparecen aquí**: las salidas pegadas llevan `<host redactado>`
donde `scripts/_scratch-run.mjs` imprime el destino. Un informe también es un sitio.

Procedimiento: `docs/RUNBOOKS.md` §R14. Análisis y decisiones: `docs/master/SCRUM-242.md`.

---

## Lo que esta prueba encontró, que es el motivo de haberla hecho

**El backup lógico no era restaurable.** Los dos fallos siguientes solo podían salir ejecutándolo,
y llevaban ahí desde que existe el script:

1. **Los tipos.** El volcado va a JSON, y JSON no tiene fechas ni decimales. El primer intento de
   escribir de vuelta murió en la primera tabla:

   ```
   restauración FALLÓ: column "created_at" is of type timestamp without time zone
   but expression is of type text
   ```

   Corregido en `scripts/backup-restore.mjs` con casts **derivados del DMMF** (`DateTime`→`::timestamp`,
   `Decimal`→`::numeric`, `Json`→`::jsonb`, `BigInt`→`::bigint`). Derivados, no escritos a mano: un
   campo nuevo trae su cast solo.

2. **El orden.** El segundo intento murió en la segunda tabla:

   ```
   restauración FALLÓ: insert or update on table "customers" violates foreign key
   constraint "customers_merchant_id_fkey"
   ```

   El orden se sacaba de `ORDEN_BORRADO_MERCHANT` invertido —que es lo que decía el borrador de
   R14—, y esa lista enumera los **hijos** de un merchant: `merchants` no está en ella y caía al
   final. Corregido con un **orden topológico derivado del schema**: una tabla va después de todas
   aquellas a las que referencia.

Ninguno de los dos se ve leyendo el código. Es exactamente lo que este ticket vino a comprobar.

---

## 1 · Preparar el destino

`npx prisma db push` con preview previo (`prisma@6.18.0`, porque en Prisma 7 el diff sale vacío con
exit 0). El preview fue **aditivo**: 24 `CREATE TABLE`, 40 `CREATE INDEX`, 14 `CREATE UNIQUE INDEX`,
27 `ALTER TABLE`, **cero `DROP`**.

## 2 · Sembrar y censar el ANTES

Tres facturas **encadenadas** (`HASH001`←`HASH002`←`HASH003`), que es lo que un conteo no puede
comprobar:

```json
{ "conteos": { "merchants": 1, "customers": 1, "quotes": 0, "invoices": 3,
               "charges": 0, "jobs": 0, "albaranes": 0 },
  "idsFactura": [1, 2, 3],
  "sumaFacturas": "600.00",
  "cadena": [
    { "id": 1, "number": "2026-CF-0001", "vf_hash": "HASH001", "vf_prev_hash": null },
    { "id": 2, "number": "2026-CF-0002", "vf_hash": "HASH002", "vf_prev_hash": "HASH001" },
    { "id": 3, "number": "2026-CF-0003", "vf_hash": "HASH003", "vf_prev_hash": "HASH002" } ] }
```

## 3 · Volcar

`node scripts/backup-dump.mjs` tomó el camino **lógico** —imprimió `pg_dump NO disponible`—, que es
el mismo formato que produciría Railway. El fichero salió cifrado (`.logical.gz.enc`).

## 4 · Vaciar

Todas las tablas a 0. La base quedó como después de una pérdida.

## 5 · Restaurar

```
✓ merchants: 1 fila(s)
✓ customers: 1 fila(s)
✓ invoices: 3 fila(s)
✓ restauradas 5 filas en 24 tablas · 24 secuencias repuestas
```

## 6 · Comparar — el ANTES y el DESPUÉS son idénticos

Comparación byte a byte de los dos censos serializados: **385 caracteres cada uno, idénticos**.
Conteos, ids de factura, suma de importes (`600.00`) y la **cadena de huellas** completa, con su
`vf_prev_hash` apuntando a la huella de la factura anterior.

**Suelo del comparador:** mutando la suma del censo restaurado a `599.00`, el comparador **sí**
detecta la diferencia. Sin esta comprobación, «los dos censos coinciden» y «el comparador no compara
nada» serían el mismo verde.

## 7 · ¿Puede la base seguir emitiendo?

Un INSERT **sin id explícito** sobre la base restaurada:

```json
{"ok": true, "idNuevo": 4}
```

**Suelo del paso de secuencias:** la misma base, con la secuencia de `invoices` dejada en 1 —como la
dejaría una restauración que se saltara el `setval`— y el mismo INSERT:

```json
{"choca": true, "error": "Unique constraint failed on the fields: (`id`)"}
```

Es decir: **el paso 4 de R14 no es cosmético.** Sin él la base queda rota en diferido, y el que la
rompe es el primer usuario que emite. En facturas, un id repetido no se arregla borrando (regla 29).

---

## Lo que esta prueba NO demuestra

- **El volumen.** 5 filas en 24 tablas. Un volcado lógico de producción carga fila a fila y no se ha
  medido cuánto tarda ni si aguanta. Sigue siendo el argumento para el formato `pg_dump`.
- **Que exista un backup que restaurar.** Lo medido en `docs/master/SCRUM-242.md` es que
  `backup-dump.mjs` **no lo dispara nadie**: 0 invocaciones frente a 11/7/5 de otros scripts. Un
  procedimiento probado sobre un fichero que nadie genera sigue sin salvar la base.
- **La política de Railway.** Sigue `[VALIDAR]`: no es medible desde el repo.
