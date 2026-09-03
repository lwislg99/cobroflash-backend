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

---

> ⚠️ **DOS TICKETS EN UN FICHERO, y es temporal.** Lo de abajo **NO es de SCRUM-685**: es el
> registro de la vista de oficina del parte, escrito aquí por otra sesión cuando ese trabajo
> aún no tenía número. Ya tiene el suyo — **SCRUM-703** — y su autora lo moverá a
> `docs/master/SCRUM-703.md` en su próxima tanda.
>
> Se conserva **entero y sin tocar** hasta entonces: perder el registro de un trabajo hecho
> para dejar un fichero limpio sería cambiar una molestia por una pérdida. Lo único que se
> añade es esta nota, que es de quien resuelve el conflicto y no de su autora.

# SCRUM-685 · La vista de oficina: donde el jefe valora un parte firmado

**Medido contra:** `origin/main` = `e96ca273cabd4cbbea7f7151ca36d7afca16b4fb` · 2026-09-03T20:10:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

## 1 · Su PROPIO serializador, y la separación es de RUTA

`serializeParteParaLaOficina` se escribe **campo a campo**, igual que el del técnico y por el mismo
motivo: extendiendo la fila, la columna de dinero que se añada mañana saldría sin que nadie lo
decidiera. `serializeParteParaElTecnico` **no se ha tocado**.

Y la separación no es un `if` dentro de un serializador: son **rutas distintas**.

| puerta | quién | qué devuelve |
|---|---|---|
| `GET /admin/partes/:id` | cualquiera | vista del técnico (sin un solo importe) |
| `GET /admin/partes/:id/oficina` | **`requireRole('admin')`** | vista de oficina (con importes) |
| `GET /admin/partes/oficina/pendientes` | **`requireRole('admin')`** | lo que falta por valorar |
| `PATCH /admin/partes/:id` | según **rol** | oficina si ve todo; si no, técnico |

⚠️ **La condición del PATCH es el ROL y no «si la petición traía precios»**, y la diferencia
importa: lo segundo lo decide quien llama, así que un técnico que mandara `precios` en un borrador
recibiría importes en el móvil. El rol no lo elige él.

⚠️ Y `/oficina/pendientes` va declarada **antes** de `/:id`: Express casa por orden, y declarada
después, «oficina» entraría como `:id` y esa ruta no existiría nunca.

## 2 · 🔴 CÓMO SE ENCUENTRA EL TRABAJO — tu punto 4

**La pantalla abre por la lista de pendientes, no por un buscador.** Si el jefe no puede saber
cuáles le faltan, la pantalla no sirve.

`GET /oficina/pendientes` devuelve los partes **firmados** con alguna línea **sin precio**. Dos
decisiones que merecen leerse:

* **«Sin valorar» es POR LÍNEA, no por parte.** Un parte de tres líneas con dos precios está sin
  valorar; contando «tiene algún precio» desaparecería de la lista a medias.
* **El suelo viaja con el dato:** la respuesta lleva `firmadosLeidos`. Así **«0 de 12» y «0 de 0»
  dejan de ser el mismo número**, y la pantalla distingue *no te queda ninguno* (✅) de *no he
  podido leerlos* (⚠️). Un cero de un lector roto no se pinta como una buena noticia.

## 3 · La pantalla

Dos bloques —**mano de obra ‖ materiales**—, una casilla de precio por línea, el importe de cada
una y el **total**, que se repinta al teclear. Al guardar, **se repinta con lo que devuelve el
servidor**, no con lo que había en pantalla: es la única forma de que el jefe vea *lo que se
guardó*. Si el parte está facturado, no se ofrece tocar nada: el candado viaja resuelto desde el
servidor y la pantalla **no vuelve a decidir la regla**.

## 4 · ⛔ MICROCOPY — los rótulos exactos, para que los apruebes

Todos salen de **una sola constante** (`MARCA_OFICINA`), así que aprobarlos es tocar un sitio.
Esta pantalla la usa tu padre todos los días:

| dónde | texto propuesto |
|---|---|
| título de la sección | **Partes por valorar** |
| subtítulo | **Los partes que tu equipo ya ha firmado y todavía no tienen precios.** |
| vacío · no queda ninguno | **No te queda ningún parte por valorar.** |
| vacío · no se pudieron leer | **No hemos podido leer tus partes firmados. Vuelve a intentarlo.** |
| bloque 1 | **Mano de obra** |
| bloque 2 | **Materiales** |
| casilla de precio (aria) | **Precio por unidad** |
| botón | **Guardar precios** |
| parte ya facturado | **Este parte ya está facturado: sus precios no se tocan.** |
| error al cargar | **No hemos podido cargar los partes.** |
| error al guardar | **No se han podido guardar los precios.** |
| botón en Trabajos | **Partes por valorar** |

## 5 · 🔴 LA BARRA LATERAL SE QUEDA LIMPIA, y lo decidió un guard

Puse la entrada en la barra y **cayó SCRUM-420 ④**: *«queda microcopy sin aprobar en la barra; es
lo primero que ve el profesional cada día»*. Tiene razón, así que **la entrada NO va a la barra
todavía**: se entra desde **Trabajos**, y la vista queda declarada en `VISTAS_SIN_ENTRADA` con su
motivo y con la instrucción de borrar esa línea el día que apruebes el rótulo.

**Y el guard me enseñó el tercer sitio:** una sección son TRES —el `case`, la entrada y
`HASH_VIEWS`— y el tercero es el que se olvida. Sin él, quien recargue estando ahí pierde la vista.
(Al añadirlo rompí `app.js` con una coma y **el banco que EJECUTA los scripts lo cazó**: un script
clásico que lanza se pierde entero, y con él todas las pantallas que publicaba.)

## 6 · El control que no puede caer, REAPUNTADO

Antes el PATCH contestaba siempre con la vista del técnico y bastaba con exigir eso. Ahora contesta
a cada público con la suya, así que ese aserto dejaría de describir el hecho.

> **El hecho que vigila ahora:** la vista de OFICINA sólo se alcanza detrás de un gate de rol —
> ninguna salida la devuelve sin comprobar antes que quien pregunta lo ve todo.

Se comprueba en dos mitades: dentro del bloque del PATCH, y **toda aparición** del serializador de
oficina en el fichero tiene `requireRole('admin')` o `seesAllJobs` en su contexto.

## Censos tocados, con su motivo

`scrum402` (marcadores pintables: `parteOficinaView.js` 1, `app.js` 1 por el título) ·
`_barra-lateral` (`VISTAS_SIN_ENTRADA`) · `_banco-vistas` (la lista de scripts) · `sw.js` (el
shell) · `scrum627`/`627b` (la aritmética: veredicto **DOCUMENTO** — da la BASE de una línea,
`precio × unds`, y **no deriva IVA**: `tipoIva` se copia sin entrar en ninguna multiplicación).


---

# SCRUM-685b · El número del parte es único dentro de su merchant, y lo dice la BASE

**Medido contra:** `origin/main` = `948e63980491950d313356977e61493f14f9888e` · 2026-09-03T09:20:00+02:00

## 🔴 La prueba que importó: contra un PostgreSQL REAL, no afirmada

No se pudo hacer desde la suite —corre sin base— así que se levantó un **PostgreSQL 16.4 portátil
en el scratchpad** (puerto 55432, creado vacío y tirado al terminar; **ninguna base del proyecto**).
Salida literal:

```
② SIN EL INDICE: dos INSERT con el mismo (merchant_id, numero)
   INSERT 0 1
   INSERT 0 1
   filas_con_pt_2026_001 = 2          ← LA BASE ACEPTO EL DUPLICADO

③ el SELECT de comprobacion lo detecta
   merchant_id | numero      | veces | ids
             1 | PT-2026-001 |     2 | {1,2}

④ CON duplicados dentro, CREATE UNIQUE INDEX falla
   ERROR:  could not create unique index "partes_trabajo_merchant_id_numero_key"
   DETAIL:  Key (merchant_id, numero)=(1, PT-2026-001) is duplicated.

⑥ limpiado y creado el indice, el MISMO INSERT que antes pasaba
   ERROR:  duplicate key value violates unique constraint "partes_trabajo_merchant_id_numero_key"
   DETAIL:  Key (merchant_id, numero)=(1, PT-2026-001) already exists.

⑦ CONTROL POSITIVO: otro merchant con el mismo numero
   INSERT 0 1                          ← el indice es POR merchant, no global
```

**Las cuatro cosas quedan demostradas, no supuestas:** sin índice la base **acepta** el duplicado,
con él lo **rechaza**, con duplicados dentro el `CREATE UNIQUE INDEX` **falla** —por eso el
`SELECT` de comprobación va primero— y otro merchant **sí** puede reutilizar el número.

## Por qué hace falta, y no es redundancia del código

`siguienteNumeroParte` deriva el número del **máximo ya emitido** dentro de la transacción del
create, porque `Merchant` no tiene contadores propios para el parte —el albarán sí
(`nextAlbaranNumber` + `albaranSeriesYear`)—. Derivar del máximo **no impide el duplicado**: dos
creaciones simultáneas leen el mismo máximo. Sin el índice quedan dos partes distintos diciendo ser
el mismo documento: **el cliente firma uno y la oficina valora el otro**, y nada falla hasta que
alguien los compara.

## Lo entregado (② y ③ juntos, como pidió Javier)

| Pieza | Qué |
|---|---|
| `prisma/schema.prisma` | `@@unique([merchantId, numero])` en `ParteTrabajo` — el **③** |
| `docs/sql/scrum-685b-comprobar-duplicados.sql` | el `SELECT`, con control positivo. **Se ejecuta primero, en cada base** |
| `docs/sql/scrum-685b-parte-numero-unico.sql` | el `CREATE UNIQUE INDEX` — el **②**, y dice en su cabecera que va ANTES del PR |
| `tests/scrum685b-parte-numero-unico.test.mjs` | 5 tests que atan la declaración y el SQL al hecho medido |

**Clasificador** sobre el fichero del índice: **1 sentencia · 0 RECHAZADAS · 0 borrados · `ok=true`**.

⚠️ **El nombre del índice no es libre:** `partes_trabajo_merchant_id_numero_key`, el que genera
Prisma para ese `@@unique` (comprobado con `migrate diff --from-empty`). Con otro nombre, esquema y
base tendrían el mismo índice llamado de dos formas y el diff propondría crear uno y borrar el otro.

## 📌 El fichero del `SELECT` sale RECHAZADO por el clasificador, y es correcto

`scrum-685b-comprobar-duplicados.sql` → **2 RECHAZADAS**, forma `DESCONOCIDA`. No es un defecto:
el clasificador es una **lista blanca de formas aditivas** y rechaza `SELECT` por diseño. Lo dice
`docs/sql/verificacion-deriva-produccion.sql:10-12` — *«meter la verificación en el mismo fichero
que el `ALTER` deja el fichero inaplicable. Ya pasó una vez; por eso se separan»*.

Por eso van **dos ficheros**, y hay un test que fija la separación para que nadie los junte.

## 🔴 Un rojo que me cazó a mí: SCRUM-694

Mi test se fabricaba su propio filtro de comentarios (`replace(/^\s*\/\/.*$/gm, '')`) y el
trinquete de SCRUM-694 subió de 56 a **57**. **Existe `tests/_solo-codigo.mjs`** — el escáner de
TypeScript, que distingue un `//` dentro de una cadena de uno que abre comentario.

Comprobado antes de migrar a ciegas: sobre el bloque de Prisma **conserva** `@@unique` y los dos
`@@index` y **borra** las quince líneas que lo explican. Migrado; el trinquete vuelve a 56.

> Construir lo que ya estaba construido, otra vez. Esta vez lo cazó un guard de la casa.

## El conflicto de `SCRUM-685.md`

Se conservan **los dos bloques**. El segundo no es de este ticket: es el registro de la vista de
oficina, escrito aquí por otra sesión cuando ese trabajo no tenía número. Ya tiene el suyo
(**SCRUM-703**) y su autora lo moverá. Se ha añadido únicamente una nota que lo explica: perder el
registro de un trabajo hecho para dejar un fichero limpio sería cambiar una molestia por una
pérdida.

## ⛔ No aplicado a ninguna base

Ni a dev. El ② lo ejecuta el fundador con Javier, base por base, con el `SELECT` de duplicados
delante en cada una.
