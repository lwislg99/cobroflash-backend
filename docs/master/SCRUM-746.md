# SCRUM-746 · La barrera está en el comando, y las dos rutas que tocan producción no son un comando

**Fecha:** 4-sep-2026 · **Carril:** barrera de producción (AA2) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `291b86739079a8b069992deb45fb876f944b8050` · 2026-09-04T23:12:30+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-746-la-barrera-y-la-indireccion`

**Tanda:** **PENDIENTE** — se rellena con la pasada de después del último cambio.

> ⛔ **ESTE TICKET MIDE Y PROPONE. NO ELIGE.** El encargo lo dice y estoy de acuerdo: esto toca la
> barrera de producción y la decisión no es mía. Lo que va aquí es el rojo medido, el censo, las dos
> salidas con sus consecuencias y **mi criterio escrito**. Lo único que se ha construido es un
> trinquete para que la exposición **no crezca mientras se decide**.
>
> ⛔ **No se ha ejecutado ninguna de las dos rutas.** Ni contra producción ni contra nada: al hook se
> le da la misma entrada que recibiría —el JSON del tool call— y se mira su veredicto. Es una función
> pura sobre esa entrada.

---

## 🔴 EL ROJO, PRIMERO

| lo que se teclea | ¿lo ve el hook? |
|---|---|
| `bash scripts/db-push-prod` | **🔴 PASA** |
| `npm run db:push` | **🔴 PASA** |
| `npm run db:seed` | **🔴 PASA** |
| `npx prisma db push` (contraste) | BLOQUEA |
| `prisma db seed` (contraste, desde SCRUM-744) | BLOQUEA |

**La causa es de una línea:** el hook es un `PreToolUse` y recibe **lo que Claude teclea**. Lo que
ese comando desencadena por dentro —otro `bash`, un `npm run`, un `ts-node`— **no vuelve a pasar
por él**. No es un fallo del patrón: el patrón funciona. Es que **la barrera está en el sitio
equivocado para estas dos rutas**.

## 🔴 Y LO PRIMERO ES CORREGIRME: MI HALLAZGO DE SCRUM-744 EXAGERABA

Escribí que `bash scripts/db-push-prod` *«no cruza la barrera»* y lo dejé ahí. Es cierto **y es
engañoso**, porque ese script **tiene su propia barrera, y es más fuerte que la del hook**:

1. **Puerta del árbol** (SCRUM-685): se niega a arrancar desde un checkout atrasado.
2. **Host-check**: dice a qué base apunta, sin imprimir la URL.
3. **Preview obligatorio** con suelo anti-silencio: si no produce salida, aborta.
4. **Guard de borrado**: si el diff borra algo, **aborta sin llegar a pedir el GO**.
5. **GO explícito tecleado por una persona**, y sin TTY se aborta.
6. Se **auto-crea el sentinel** justo antes del push y lo borra después.

**Lo que de verdad falta ahí no es la barrera: es que el hook no puede confirmarla.** Y el punto 6
merece decirse tal cual: **el script se concede a sí mismo la autorización de un solo uso.** Es
razonable —ya ha pasado por cinco puertas— pero significa que **el sentinel no es una autorización
del fundador cuando se llega por esta ruta**, y quien lea el hook creerá que sí.

**La ruta de verdad desprotegida es la otra.** `npm run db:seed` → `prisma db seed` →
`ts-node prisma/seed.ts` → **`new PrismaClient()` a secas**: sin puerta del árbol, sin host-check,
sin preview, sin GO. Hace `upsert` sobre el merchant 1 —nombre, NIF, dirección, plan,
`planExpiresAt`— contra **lo que apunte `DATABASE_URL`**.

## PASO 0

**ENTRADA.** Cualquiera de las sesiones —hoy trece árboles— teclea un comando. El hook lo intercepta
(`.claude/settings.json`, matcheado a Bash y PowerShell). La víctima es la base del fundador.

**MECANISMO — hay DOS, y ésa es la pregunta del ticket.**
* **En el comando:** `guard-dangerous.mjs`. Ve lo que se teclea. Ciego a la indirección.
* **En la conexión:** `scripts/_clave-vs-destino.mjs` — `exigirDestinoCorrecto(clave, url, worktree)`
  y `exigirNoProduccion`. Vigilan **por destino, no por nombre**, y su propio comentario ya explica
  por qué: *«un guard que sólo vigila las claves que le enseñaron deja pasar justo la que no
  conoce»*. Hoy lo llaman **dos** scripts.

## El censo del punto de conexión

Población: **384** ficheros `.ts/.mjs/.js` en `src/`, `scripts/` y `prisma/`. **20 construyen un
`PrismaClient`.**

| | |
|---|---|
| **ACOTADOS por su clave** (leen `_STAGING`/`_DEV`/`_TESTS`: no pueden llegar a producción) | **8** |
| **Pueden alcanzar producción** (usan la `DATABASE_URL` del entorno) | **12** |
| … de ésos, **comprueban el destino** | **7** |
| … **sin comprobación** | **5** |

🔴 **Y de esos 5, TRES no son un problema — decirlo es la mitad del trabajo:**

| fichero | por qué NO es un hallazgo |
|---|---|
| `src/core/db/prisma.ts` | es el cliente de **la app**: su destino correcto **es** producción |
| `scripts/censo-vias-de-cobro.mjs` | **sólo lee**, y ya lleva su suelo de «ciego» |
| `scripts/backfill-quote-numbers.mjs` | escribe, pero exige `--apply` explícito (mitigación, no guarda) |

**Quedan DOS que escriben contra lo que apunte `DATABASE_URL` sin nada:**

* **`prisma/seed.ts`** — el del encargo.
* **`scripts/backup-restore.mjs`** — **y éste no estaba en el encargo**. Restaura un backup: es el
  más destructivo de los veinte, y tampoco comprueba a dónde apunta.

## LAS DOS SALIDAS, con sus consecuencias

### (A) Resolver la indirección: que el hook siga `bash x.sh` y `npm run y`

**Qué haría.** Leer el fichero o el `package.json`, sacar el comando real y volver a evaluarlo.

**Lo que gana.** Cubre las dos rutas nombradas **sin tocar código de producto**.

**Lo que cuesta, y por qué no me convence:**
* **Es una carrera que el hook no puede ganar.** Hoy son `bash` y `npm run`. Mañana un script que
  llame a otro, un `Makefile`, un `npm run` que expanda a `npm run` — y siempre queda la última
  puerta: **un comando construido en tiempo de ejecución**, que ningún lector de ficheros ve. El
  propio hook lleva la ofuscación declarada como hueco desde SCRUM-176 por este mismo motivo.
* **El hook pasaría a LEER FICHEROS del disco.** Hoy es una función pura sobre su entrada, y eso es
  lo que permite probarlo entero sin tocar nada. En cuanto lee ficheros, su veredicto depende del
  estado del árbol y se vuelve mucho más difícil de verificar — y **es el guard que más falta hace
  que sea verificable**.
* **Multiplica el falso positivo.** SCRUM-176 y SCRUM-454 son la historia de este hook aflojándose
  para no bloquear lo legítimo. Seguir indirecciones mete texto ajeno —el contenido de un script—
  en el ámbito de los patrones. `db-push-prod` **contiene la cadena `npx prisma db push`**: al
  seguirlo, el hook bloquearía **la ruta guiada, que es la buena**, y la sesión con prisa acabaría
  tecleando el `npx prisma db push` a pelo. **La barrera empujaría hacia el camino peor.**
* **Y no arregla lo que de verdad duele:** `seed.ts` seguiría sin saber a dónde apunta si alguien
  lo lanza con `ts-node prisma/seed.ts`, que no es ni `bash` ni `npm run`.

### (B) Vigilar en el punto de CONEXIÓN, como ya hace `exigirDestinoCorrecto`

**Qué haría.** Que quien construye un cliente que puede alcanzar producción **declare a dónde va**.
El mecanismo existe, está probado y lo usan siete scripts.

**Lo que gana.**
* **Protege sea cual sea la ruta**: `npm run`, `ts-node`, un script nuevo que nadie revisó, o un
  compañero ejecutándolo a mano sin Claude por medio — que hoy **no pasa por ninguna barrera**.
* Es **la pregunta correcta**: no «cómo se escribió esto» sino «¿a qué base voy a escribir?».
* **Cierra `seed.ts` y `backup-restore.mjs`**, que es donde está el daño medido.

**Lo que cuesta, y hay que decirlo:**
* **No cubre `db push`.** Ese abre su conexión **dentro del binario de Prisma**, no en nuestro
  código: por (B) no pasa. Lo que protege ahí es la barrera propia del script, que ya existe.
* Toca ficheros de producto (`prisma/seed.ts`), aunque sea para añadir dos líneas.
* Un `PrismaClient` nuevo puede nacer sin la guarda. **Por eso este ticket deja el trinquete**: si
  aparece uno que puede alcanzar producción y no comprueba el destino, la tanda cae y lo nombra.

## 🔴 MI CRITERIO, que es lo que se me pidió

**(B), y (A) no.** Y la razón de fondo no es de coste: es que **(A) vigila la ortografía y (B) vigila
el hecho** — la misma distinción que cerró SCRUM-744 hace dos horas. Seguir indirecciones es
perseguir formas de escribir un comando; comprobar el destino es preguntar a qué base se va a
escribir, que es lo único que importa.

**Y hay un argumento que decide, por encima de todos:** la barrera del comando **sólo existe cuando
Claude teclea**. Un compañero que abra una terminal y ejecute `npm run db:seed` no pasa por el hook
—ni pasará nunca, con (A) o sin ella—. **(B) es la única de las dos que protege también a las
personas.**

**Lo que propongo, en el orden en que yo lo haría:**

1. **`prisma/seed.ts`** — `exigirNoProduccion` antes del primer `upsert`. Dos líneas, cero riesgo,
   cierra la ruta que el encargo señala. *Y si el fundador quiere sembrar producción alguna vez, que
   sea con una variable explícita, no por olvido.*
2. **`scripts/backup-restore.mjs`** — igual. Es el más destructivo de los veinte.
3. **El sentinel de `db-push-prod`**: hoy el script se lo concede a sí mismo. **Propongo que no lo
   cree**, y que si hace falta lo ponga una persona — o que al menos lo diga en su salida, porque
   ahora mismo un lector del hook creerá que hubo un OK del fundador que no hubo.
4. **(A) no.** Y si se decidiera hacerla, **que no sea a costa de (B)**: (A) sin (B) deja la casa
   protegida sólo cuando escribe Claude.

**Lo que NO propongo:** tocar `db-push-prod`, más allá del punto 3. Sus cinco puertas son mejores
que lo que el hook podría añadir, y meterse ahí sin necesidad es tocar la ruta de producción por
gusto.

## El residuo del sentinel, medido

Medido con el hook: al **dejar pasar** un `db push` con el sentinel puesto, **el sentinel se borra**.
El hook no puede saber qué pasa después —el usuario aún puede denegar el permiso en el prompt de
Claude Code—, así que **una autorización del fundador se puede gastar sin que se ejecute nada**.

Ya estaba declarado en el propio hook como residuo conocido. Se deja **medido en un test**, no
arreglado: cerrarlo exige saber qué ocurre después de la decisión del hook, y desde el hook no hay
forma. **Es un hueco de diseño del punto de enganche, no un descuido.**

## Lo único que se construye aquí: un trinquete

`tests/scrum746-barrera-y-punto-de-conexion.test.mjs` (5 tests). No cierra nada — **impide que
crezca**:

* fija el rojo (las tres rutas por indirección no llegan al hook) **con el mensaje al revés**: el día
  que alguien lo cierre, el test cae diciendo *«enhorabuena, actualiza este documento»*;
* **cae si aparece un punto de conexión NUEVO** que pueda alcanzar producción sin comprobar el
  destino, y lo nombra;
* comprueba que los dos expuestos **siguen existiendo y siguen escribiendo** — un trinquete sobre
  una lista que ya no describe nada es peor que ninguno;
* y fija el residuo del sentinel.

La lista de los dos expuestos y de los tres que no son un problema **va a mano y con motivo**, no
derivada: derivarla haría que el número subiera solo cada vez que alguien añade un script que sólo
lee, y el ruido acaba desactivando el guard.

## La decisión de SCRUM-744 que llegó tarde, y dónde ha acabado

El asesor decidió meter **`db seed`** en la lista de subcomandos bloqueados. Lo commiteé en la rama
de SCRUM-744, **pero ese PR se mergeó antes de que yo lo empujara**, así que el cambio venía aquí de
todos modos. Está en esta rama, con su motivo, y el censo de SCRUM-744 pasa de 7 a 8 bloqueados.

⚠️ **`prisma db seed` ya cae; `npm run db:seed` sigue pasando.** Eso no es un fallo de la decisión:
es exactamente el hueco que este ticket mide, y ninguna línea del hook lo cierra.

## Ficheros

`tests/scrum746-barrera-y-punto-de-conexion.test.mjs` (**nuevo**, 5 tests) ·
`.claude/hooks/guard-dangerous.mjs` (+`db seed`, la decisión del asesor) ·
`tests/scrum744-el-guard-mira-la-accion.test.mjs` (su censo: `db seed` pasa a bloqueado, 7→8) ·
esta entrada.

**No se ha tocado:** `prisma/seed.ts` · `scripts/backup-restore.mjs` · `scripts/db-push-prod` ·
`package.json` · `prisma/schema.prisma` · sin dependencias nuevas (regla 36). **Nada de lo que la
propuesta recomienda se ha hecho**: es una propuesta.

## 🔴 Los huecos que declaro

1. **No he ejecutado ninguna de las dos rutas**, ni contra un destino inofensivo. El veredicto del
   hook se mide dándole su entrada; **lo que los scripts hacen por dentro lo sé por LECTURA**, no
   por haberlo visto correr.
2. **El censo de puntos de conexión es por TEXTO** (`new PrismaClient(`) sobre el fuente completo,
   sin filtrar comentarios. Los 20 se revisaron a mano, pero el barrido puede contar de más si
   alguien escribe la construcción en un comentario.
3. **«Acotado por su clave» se decide porque el fichero NOMBRA `_STAGING`/`_DEV`/`_TESTS`.** Un
   fichero que la nombre en un mensaje y lea `DATABASE_URL` saldría acotado sin serlo. Ninguno de
   los ocho lo hace hoy —los miré—, pero el criterio es más flojo de lo que parece.
4. **No he medido qué pasa si `DATABASE_URL` no está definida** en un árbol de trabajo, que es el
   caso normal aquí (los `.env` llevan `_STAGING`/`_DEV`/`_TESTS`). Es probable que `seed.ts`
   simplemente falle al conectar — **probable no es medido**, y cambia bastante la urgencia.
5. **La propuesta no está probada.** No he escrito la guarda de `seed.ts` ni medido su coste; si al
   implementarla apareciera un falso positivo, el orden que propongo podría cambiar.
6. **`.claude/settings.json` no se ha revisado**: doy por hecho que el hook sigue enganchado a Bash
   y PowerShell y a nada más. Es lo que dice el propio hook, no lo que he medido hoy.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `scripts/backup-restore.mjs` restaura un backup contra lo que apunte `DATABASE_URL` **sin comprobar el destino**: no estaba en el encargo y es el más destructivo de los veinte constructores.
* `scripts/db-push-prod` **se auto-crea el sentinel** (`touch .claude/allow-db-push`) antes del push: quien lea el hook creerá que hubo una autorización del fundador que por esa ruta no existe.
* Ninguna barrera de esta casa protege a **una persona en una terminal**: el hook sólo existe cuando escribe Claude, y siete de los doce constructores que pueden alcanzar producción dependen de que quien los lance sepa lo que hace.
* Mi propio hallazgo de SCRUM-744 sobre `db-push-prod` **exageraba**: decir «no cruza la barrera» sin decir «tiene cinco puertas propias» habría mandado a la siguiente sesión a blindar lo que ya estaba blindado.
