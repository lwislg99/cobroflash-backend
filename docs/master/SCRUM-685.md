# SCRUM-685 · Que `db-push-prod` no arranque desde un árbol atrasado, y aborte si el preview borra

**Medido contra:** `origin/main` = `2aeb71c041c855e35974f3a1c45937343e7f7e3e` · 2026-09-02T20:40:34+02:00
**Rama:** `scrum-685-push-no-arranca-atrasado`
**Commit previo a inyectar rojos:** `96e36cb8050fa4494681897f3abef54cab6858dd`

## El día que esto no existía

`scripts/db-push-prod`, **sin modificar y haciendo lo que promete**, se ejecutó desde el checkout
compartido —**1.933 commits detrás de `origin/main`**— y su preview propuso, contra PRODUCCIÓN:

```
DROP TABLE job_assignees · DROP TABLE email_messages · ~30 DROP COLUMN
```

El script no falló: comparó producción contra un esquema fósil y produjo el SQL correcto para esa
entrada. **Lo que estaba mal era el árbol.** Lo pararon dos cosas y **sólo una es diseño**: el GO
explícito —que protege si alguien LEE el diff— y que aquel shell no tenía stdin, así que `read`
recibió EOF y abortó solo. La segunda es **suerte**. Esto la convierte en mecanismo.

## Lo construido

`scripts/_guard-arbol-y-borrado.mjs`, con la lógica **fuera** del script: un guard que sólo se
puede ejercitar apuntando a producción no se ejercita nunca. `git` se inyecta, así que cada rama se
prueba sin montar repositorios de mentira.

**La puerta del ÁRBOL**, antes de enseñar una sola línea de SQL:

| Estado | Qué hace |
|---|---|
| `git fetch` FALLA | 🔴 **CIEGO** — aborta. «No pude comprobar» ≠ «estoy al día» |
| DETRÁS (aunque sea 1) | aborta diciendo **cuántos** commits y qué hacer |
| `schema.prisma` sin commitear | aborta: lo aplicado tiene que poder nombrarse por su SHA |
| DELANTE **y publicado** | ✅ **pasa** — una rama de esquema en revisión es lo normal |
| DELANTE **sin publicar** | aborta: ese esquema sólo existe en un disco |

Y **imprime la procedencia**: el SHA del commit *y* el del propio `schema.prisma`. Un diff sin
procedencia no se puede auditar después.

**La puerta del BORRADO**, después del preview y **antes del GO**: reutiliza
`scripts/_clasificador-sql.mjs` — desnuda comentarios y cadenas, trocea en sentencias y caza el
`DROP COLUMN` **dentro de un `ALTER TABLE`**, que es justo como Prisma escribe los borrados.

> 🔴 **No es un `grep DROP`**, y la diferencia ya costó un rojo en esta casa: un auditor
> improvisado se cazó a sí mismo porque la palabra estaba en su comentario.

**Sólo el borrado aborta.** `ALTER COLUMN … TYPE` se **señala** y no corta: la regla acordada fue
«cualquier `DROP TABLE` o `DROP COLUMN`», y una regla más ancha de la acordada se aplicaría a
espaldas de quien la acordó. Sale nombrado antes del GO para que el humano lo vea.

## El aviso del método, que sale de lo que midió Javier

En la **cabecera** y en la **salida**: `db push` **no es el método de esta casa contra producción**.
Producción va por delante de `main` en columnas aplicadas a mano para desbloquear PRs sin mergear,
y un push las propondría borrar todas. El orden es **① decisión → ② ALTER aditivo en las tres bases
→ ③ un solo PR**, y **nunca ③ sin ②**.

Un test exige que el aviso **se imprima** (`echo`), no que exista en un comentario: quien ejecuta el
script no lee sus comentarios, lee su salida.

## Los rojos, ejecutados con el script REAL

| Inyección | Resultado |
|---|---|
| árbol 215 commits detrás | aborta **antes del host-check y sin enseñar SQL**, nombrando los 215 |
| árbol al día, preview real de producción **con 5 `DROP COLUMN`** | aborta **antes del GO**, nombra el borrado y señala los 2 `ALTER COLUMN TYPE` |
| el test contra el script de hoy (con el módulo presente) | **2 de 16 fallan** — los dos que atan el script |

**El tercero es el que decide**: un test que también aprobaría el estado anterior no prueba que
hiciera falta. Y el suelo declara **ceguera** si `git fetch` falla.

📌 **Y una demostración que no busqué:** al ir a ejecutar el segundo rojo, **mi propia puerta me
paró** — la rama estaba por delante y sin publicar. Tuve que `git push` antes de poder seguir. La
rama `ADELANTADO_SIN_PUBLICAR` funciona sobre su autor.

## ⚠️ Lo que este guard NO puede hacer, dicho para que no se suponga

**Un checkout más viejo que este commit no tiene este guard.** El caso del 2-sep —1.933 commits de
retraso— tenía también el script de entonces. Esto protege **desde que entre, hacia delante**: a
quien esté algo atrasado pero por detrás del guard, no a quien esté en el pleistoceno. La
protección de ese caso es la otra: que `db push` deje de usarse contra producción, que es lo que
dice el aviso.

## Parte A · `docs/sql/scrum-674-aditivo.sql`

El **②** de SCRUM-674, cuyo ③ ya está en `main` — el error que Javier nombró: ③ sin ②.

Cinco columnas y `partes_trabajo`, idempotente (`IF NOT EXISTS`) porque se corre en tres bases. El
DDL de la tabla sale de `prisma migrate diff --from-empty`, no está escrito a mano.

**Clasificado, que es el criterio: 8 sentencias · 0 RECHAZADAS · 0 borrados · `ok=true` · exit 0.**

### 🔴 El hallazgo que no esquivo: el índice único no está en el esquema

Se pidió `CREATE UNIQUE INDEX (merchant_id, numero)`. **`prisma/schema.prisma` NO lo declara**:
medido, `model ParteTrabajo` sólo tiene `@@index([merchantId, fecha])` y
`@@index([merchantId, estado])`.

Crearlo en las bases sin declararlo haría que el próximo diff **propusiera borrarlo** — la misma
deriva contra la que existe ese fichero. Va en el bloque ④, **comentado**, con su `SELECT` de
duplicados delante, y con lo que hace falta para cerrarlo bien: que el ③ añada
`@@unique([merchantId, numero])`.

Hace falta de verdad: `parteNumero.ts` deriva el número del máximo ya emitido, y **sin índice único
la base no rechazaría un duplicado**.
