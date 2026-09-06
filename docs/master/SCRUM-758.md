# SCRUM-758 · Las «nueve migraciones» — medidas, y el enunciado no se sostiene

**Fecha:** 6-sep-2026 · **Carril:** datos · despliegue · **Gate:** sin gate (todo lee ficheros)

**Medido contra:** `origin/main` = `50312d327c0f7ddcf8a0670ab54c46407a7bba9d` · 2026-09-06T22:36:05+01:00

> 🛑 **Ticket de MEDIR.** Cero escrituras, cero conexiones a ninguna base — ni a dev compartida.
> Todo lo de aquí sale de leer ficheros del árbol.

---

## 🔴 EL ENUNCIADO, CORREGIDO POR EL ÁRBOL

El ticket dice: *«NUEVE migraciones que MUTAN datos no constan en el log de `db push`»*. **Las tres
mitades de esa frase fallan**, y el propio log lo dice.

**Las «nueve» existen, y están en el log**, con su nombre:

```
docs/MIGRATIONS_PENDING.md:575
## LOTE ÚNICO · 9 columnas en 4 tablas (SCRUM-403 · A5 · E4 · SCRUM-195 · SCRUM-16/142)
```

**① No mutan datos: son NUEVE `ADD COLUMN`.** El recuento está en el propio log, contado del SQL:

| `ADD COLUMN` | `DROP` | `ALTER COLUMN` | `NOT NULL` | `DEFAULT` | `DELETE`/`TRUNCATE` |
|---|---|---|---|---|---|
| **9** | 0 | 0 | 0 | 0 | 0 |

*«100 % aditivo: nueve columnas nullable, sin default, sin unique, sin índice.»* Y una línea más
abajo: **«Ninguna fila se toca. Las nueve columnas quedan a `NULL`.»**

**② Sí constan en el log**: son una entrada con su cabecera, su preview y su verificación.

**③ Y están APLICADAS EN PRODUCCIÓN**, con verificación independiente:

```
- [x] producción · autorack — aplicado 10-ago-2026 con GO EXPLÍCITO del fundador
      Verificación independiente por `information_schema`: 9/9 columnas, is_nullable = YES
      CERO BACKFILL: expenses 10 filas · 0 con base_amount · quotes 125 · 0 con es_adicional
                     invoices 55 · 0 con deducts_refs
```

⚠️ **Y hay un defecto de documentación que casi me engaña a mí:** la CABECERA de esa entrada
sigue diciendo **«🔴 SIN APLICAR en ninguna de las tres»**, mientras su propio cuerpo tiene las
tres casillas marcadas. **El título contradice al cuerpo.** Si el ticket nació de leer ese título,
nació de una línea que envejeció.

---

## EL CENSO · qué cambia ESTRUCTURA y qué cambia DATOS

`scripts/censo-migraciones.mjs`, sin lista cableada. **Sobre 173 ficheros: 25 tocan datos, 32 sólo
estructura.**

### 🔴 Y las migraciones de este árbol viven en TRES IDIOMAS

Lo aprendí midiéndome a mí misma, y las tres pasadas están escritas en la cabecera del script:

| pasada | qué miraba | DML encontrado |
|---|---|---|
| 1ª | sólo ficheros `.sql` | **3** |
| 2ª | + llamadas de Prisma | subió |
| 3ª | + `cliente.query(sql)` con `pg` en crudo | apareció `backfill-job-assignees.mjs` |

`backfill-job-assignees.mjs` **escribe** (su cabecera lo dice: `--aplicar` → escribe) y las dos
primeras pasadas lo daban por limpio. **Un censo que mire un solo idioma subestima**, y ése es el
motivo por el que una lista de «migraciones de datos» hecha a ojo sale corta.

⚠️ **Y la primera pasada dio 0 de 43** — todas «desconocida». No era el árbol: `partirSentencias`
devuelve `{ sql, linea }` y yo le pasaba el objeto, así que clasificaba `[object Object]`. **Un
cero sobre 43 no es un dato**; por eso el script lleva ahora control positivo dentro y sale con
código 2 si no ve los cinco idiomas conocidos.

### El parseo se DERIVA, no se reescribe

`desnudar` + `partirSentencias` salen del clasificador oficial (SCRUM-395), que ya dejó escrito por
qué un `grep` no vale: *«un guard de texto acaba vigilando la EXPLICACIÓN en vez del código»*.

---

## 🔴 EL MECANISMO QUE EXPLICA EL ENUNCIADO — y es más interesante que el enunciado

**El aplicador oficial NO PUEDE aplicar una migración de datos.** Medido ejecutándolo:

```
docs/sql/scrum-650-paso-c-backfill.sql   (INSERT … SELECT)
   ok: false · rechazada DESCONOCIDA — «se rechaza POR DEFECTO»
prisma/backfill/scrum609-item-kind.sql   (ADD COLUMN + UPDATE)
   permitida  ADD COLUMN ×1
   rechazada  DESCONOCIDA          ← el UPDATE
docs/sql/scrum-425-clave-idempotencia.sql (DDL puro)
   ok: true · permitida ADD COLUMN ×1 · permitida CREATE INDEX
```

`scripts/aplicar-sql-dev.mjs` sólo ejecuta la **lista blanca** de formas aditivas. El DML no está
en ella y **nunca lo va a estar**: la lista blanca existe para que un `DROP` no pase.

**Consecuencia estructural, y es el hallazgo del ticket:** toda migración de DATOS tiene que
aplicarse **por otra vía** —un `.mjs` con su propio cliente, o a mano en la consola— y esa otra vía
**no pasa por el aplicador que escribe en el log**. No es que a alguien se le olvidara apuntarlas:
es que el camino que las aplica no tiene por dónde apuntarlas.

Las que hoy tocan datos y **no constan por nombre** en el log:

| fichero | vía |
|---|---|
| `docs/sql/scrum-650-paso-c-backfill.sql` | `.sql` (`INSERT … SELECT`) |
| `scripts/backfill-job-assignees.mjs` | `pg` en crudo |
| `scripts/backfill-quote-jobid.mjs` | `$executeRawUnsafe` |
| `scripts/renumerar-documentos.mjs` | Prisma |
| `scripts/conciliar-auditoria-fiscal.mjs` | `$executeRawUnsafe` |

(`scrum205-vf-estado.sql`, `scrum609-item-kind.sql` y `backfill-quote-numbers.mjs` **sí** constan.)

---

## 🔴 LA CAÍDA DE PRODUCCIÓN · lo que sí apunta a algo, y NO son las nueve

La hipótesis del encargo era `schemaDrift` sobre las nueve columnas. **No se sostiene: producción
las tiene.** Pero el mismo mecanismo apunta a **otra entrada del log**, y ésa sí encaja:

```
docs/MIGRATIONS_PENDING.md:462
## SCRUM-475 (fase 2) · tabla nueva `email_messages` — ✅ APLICADO solo en DEV (11-ago-2026)
   «Staging y producción están PENDIENTES»
```

Y la cadena, cerrada sin tocar producción:

1. `prisma/schema.prisma:1282` declara **`model EmailMessage`**.
2. `schemaDrift.tablasEsperadas()` deriva de **`Prisma.dmmf.datamodel`** — todos los modelos, así
   que `email_messages` entra.
3. Su contrato: *«SÍ: que exista cada TABLA y cada COLUMNA que el cliente Prisma va a nombrar.»*
4. En producción: *«HAY DERIVA → no arranca»* — `schemaDrift.ts:276` hace `throw`.

→ **Si producción no tiene `email_messages`, la app de hoy no arranca ahí.** Encaja con el
síntoma: **el vigía dispara idéntico en tres ramas porque el fallo no es de rama, es de la base.**

⚠️ **ESTO ES UNA HIPÓTESIS CON MECANISMO, NO UNA MEDIDA DE PRODUCCIÓN.** No he consultado
producción y no voy a hacerlo. Y acabo de ver en este mismo fichero que **un título del log puede
mentir sobre su propio cuerpo**, así que un log que dice «pendiente» tampoco prueba que lo esté.

### Lo que lo cierra en un solo paso, y ya existe

`docs/sql/deriva-prod.sql` — **468 líneas, SOLO LECTURA, sin credenciales**, generado del mismo
schema que usa la app. Se pega entero en la consola de Postgres de producción. **0 filas = en
sync**; cualquier fila nombra lo que falta. Comprobado que cubre los candidatos: `email_messages`
aparece 12 veces, y las nueve columnas del lote una vez cada una.

**No lo ejecuto yo** (obligación 5): es producción.

---

## OBLIGACIÓN 4 · NO SE HA PODIDO EJECUTAR, y por qué

Reconstruir desde el log en una base desechable y arrancar la app. **No hay base desechable en
esta máquina**, medido:

```
puertos 5432/55432 a la escucha ... ninguno
LIBRO_PG_URL .................... NO definida
docker .......................... no disponible
```

Y las alternativas están prohibidas: dev es **compartida** (otra sesión vio filas desaparecer entre
dos censos suyos), y staging/producción no se tocan. **No hay control que dé.**

🔴 **Así que el control que decide de este ticket queda SIN EJECUTAR, y no se sustituye por un
razonamiento.** Lo que sí puedo afirmar sin base es lo de arriba: qué tabla espera el código y qué
dice el log sobre ella.

**Y hay un límite anterior, que importa más:** el log es un **Markdown**, no un guion. «Reconstruir
una base desde el log» no es una operación que exista hoy — habría que traducir a mano prosa a SQL,
y esa traducción sería mía, no del log. La pregunta de la obligación 4 **no tiene mecanismo**
todavía; eso es un hallazgo, no una excusa.

---

## OBLIGACIÓN 5 · lo que apunta a un ALTER en producción

Si `deriva-prod.sql` devolviera filas para `email_messages`, el arreglo sería **crear esa tabla en
producción** — un `CREATE TABLE`, aditivo. **Queda escrito y PARO**: ni lo aplico, ni lo propongo
como acción. El SQL ya existe en `docs/sql/scrum-475-email-messages.sql` (censado: 4 sentencias,
todas de estructura).

---

## HUECOS DECLARADOS

- ⛔ **Cero conexiones a cualquier base.** Ni producción, ni staging, ni la dev compartida.
- 🔴 **La obligación 4 no se ejecutó** (arriba, con la medición de por qué).
- 🔴 **El censo declara su propia ceguera** en `prisma/backfill/scrum205-vf-estado.sql`: 3
  sentencias que no clasifica. Son fragmentos de un bloque `DO $guard$ … $$` —
  `IF faltan IS NOT NULL THEN RAISE EXCEPTION`, `END IF`, `END $guard$`— porque
  `partirSentencias` corta por `;` **también dentro** de un bloque con comillas de dólar. Es una
  limitación del partidor oficial (SCRUM-395), no de este censo, y **no se ha tocado**.
- **El censo NO separa «migración» de «sembrador» ni de «herramienta»**, y no debe: `seed-demo.mjs`
  escribe datos y no es una migración. Da el hecho; la lectura la hace quien la tenga que hacer.
- **«Consta en el log» se determina por dos mecanismos** —el nombre del fichero, y el número de
  ticket— y se reportan por separado a propósito: que el log mencione SCRUM-650 no prueba que
  mencione su fichero de backfill.
- **No he medido si producción arranca hoy.** Sólo qué espera el código y qué dice el log.
- **Ninguna cifra de este documento sale de una base**, así que ninguna es una foto que caduque —
  salvo las que cito del log, que son fotos de agosto y llevan su fecha.

---

## TANDA

**5.714 tests · 5.612 pass · 0 fail · 102 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (`50312d32`, que trajo SCRUM-793 mergeada).

Los 102 saltados declaran su motivo y **suman**: 90 `QA_DB_TEST` + 9 `LIBRO_PG_URL` +
1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un enlace a fichero en Windows sin
elevación. **Este ticket no añade tests**: su entrega es la medición y el censo.

`node scripts/censo-migraciones.mjs` → estado **0**, con su control positivo en verde.

---

## LO QUE ME CAZÓ A MÍ

**SCRUM-763** (*el árbol ejecutable NO es el fuente*). Ramifiqué desde `main` y **no recompilé**:
`dist/` seguía llevando el `customerAdmin.ts` de SCRUM-793, que en `main` todavía no estaba. El
guard lo dijo con el fichero delante —*«cualquier medición sobre este árbol mide un código que no
es el que hay escrito»*— y tenía razón. Recompilado y vuelto a medir.

Y **mi propio censo dio 0 de 43 en la primera pasada**, que es el otro modo de estar ciego. Las
dos veces el aviso vino de la misma regla de la casa: **un cero hay que saber de cuál de los dos
es.**
