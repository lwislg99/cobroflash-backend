# SCRUM-395 · La puerta de antes: clasificador de sentencias y preflight de rama

**Medido contra:** `origin/main` = `cb6acb3f0b2679b1079a76ff32edac2777a2b7cf` · 2026-08-07T18:23:55+01:00

**7-ago-2026** · rama `scrum-395-preflight-migracion` · sin gate, corre en `npm test`

## De dónde sale

Durante la migración de C5, `prisma migrate diff` propuso **borrar las cuatro columnas recién
aplicadas**, porque otra sesión había movido el worktree a una rama cuyo `schema.prisma` no las
declara. `migrate diff` hizo lo correcto según lo que veía: **no mide el trabajo de la sesión,
mide lo que hay checkouteado AHORA.**

## 🔴 El dato que manda sobre el diseño

La regla de la casa dice «nunca `--accept-data-loss`». **Esa bandera protege a `db push`.** La
ruta real es `prisma db execute --file`, que **ejecuta el fichero tal cual**: un `DROP COLUMN`
explícito se habría ejecutado sin preguntar, con bandera o sin ella.

> Lo único que lo impidió fue que una persona clasificara las sentencias a mano. **Un paso manual
> no es una barrera: es una costumbre**, y el día que alguien tiene prisa no está. Eso es lo que
> este ticket mecaniza.

## Lo construido

### ① Clasificador de sentencias — `scripts/_clasificador-sql.mjs` (puro)

**PARSEA, no grepea.** Retira comentarios (`--` y `/* */`) y literales de cadena, parte por `;`
**fuera** de cadenas, y clasifica cada sentencia por su forma.

Que no sea un `grep DROP` no es un detalle de estilo: es **SCRUM-349**, y mordió el mismo día del
incidente — el auditor improvisado de una sesión se cazó a sí mismo porque la palabra «DROPs»
estaba en un comentario suyo. Un guard de texto acaba vigilando la explicación en vez del código.

Las dos direcciones están probadas: un `DROP` **en** un comentario no dispara nada, y un `DROP`
**detrás** de un comentario no se esconde.

**Lista BLANCA, no negra.** Se permiten `ADD COLUMN` (nullable o con `DEFAULT`), `CREATE
INDEX`/`TABLE`/`TYPE`, `ALTER TYPE … ADD VALUE` y `COMMENT ON`. Todo lo demás se rechaza —
incluida la forma que no se reconoce y el fichero que no se supo parsear. *«No encontré nada
peligroso» y «no supe mirar» dan el mismo verde y significan lo contrario; aquí el segundo borra
datos.*

**Autorización NOMINAL.** Para saltarse un rechazo hay que declarar **esa** sentencia por su
huella, con motivo y con quién autoriza. La huella normaliza espacios (para que no la invalide un
formato) pero no el contenido. **No existe interruptor global, a propósito**: un «sí a todo» se
pone una vez para salir del paso y se queda para siempre. Hay un test que comprueba que una
autorización **no** vale para otra sentencia.

### ② Preflight de rama — `scripts/_preflight-migracion.mjs` (puro) + lectura de git aparte

Quien lanza **declara** en qué rama cree estar; el mecanismo lee el `HEAD` real y, si no coinciden,
falla **nombrando las dos y el worktree**. No un error genérico: el 7-ago el problema era
exactamente no saber cuál de las dos era la buena.

Suelo: si falta cualquiera de las dos mitades —nadie declaró, o no se pudo leer el `HEAD`
(detached, sin git)— el veredicto es `no_pude_leer`, **nunca** `coincide`.

### El CLI

```
node scripts/preflight-migracion.mjs --rama <rama-esperada> --sql <fichero.sql>
```

Exit 0 = puedes aplicar · exit 1 = no apliques. **No ejecuta ninguna migración**: no abre
conexión, no lee `.env`, no toca ninguna base. Es la puerta, no el paso.

Se reconoce como CLI con `fileURLToPath`, no comparando `import.meta.url` con `argv[1]`: la ruta
de este repo lleva un espacio y esa comparación cruda lo convertiría en un **NO-OP con exit 0**
(SCRUM-235).

## ⛔ DESCOPADO: la propiedad del worktree (punto 3 del ticket)

**No se puede hacer medible hoy sin inventar una convención**, así que no se ha hecho. Lo medido:

* **Git no registra dueño de un worktree.** `.git/worktrees/<n>/` guarda `HEAD`, `index`, `refs`,
  `logs` — nada sobre quién lo ocupa legítimamente.
* **El mapa de `docs/MIGRATIONS_PENDING.md` es de BASES por worktree**, no de sesiones ni de ramas.
* **`_identidad-sesion.mjs` no sirve, y por una razón de diseño suya**: deriva la identidad **del
  árbol** (hash de la ruta) justamente para no depender de que nadie declare nada. Esa decisión,
  que es correcta para el turno de staging, la hace **incapaz de expresar propiedad**: quien está
  en el árbol *es* la sesión de ese árbol. No puede distinguir al ocupante legítimo del intruso,
  porque los dos calculan el mismo identificador.

**Qué haría falta**, y es decisión del fundador porque es una convención nueva:

1. Un **registro de reservas** (rama ↔ worktree ↔ sesión) escrito en algún sitio que ambas partes
   respeten, con su caducidad — sin caducidad, una reserva olvidada bloquea un árbol para siempre.
2. Un **enganche que lo lea antes de `git checkout`** en un worktree ajeno. Sin esto, el registro
   es documentación: exactamente lo que ya falló.
3. Y decidir qué pasa cuando la reserva y la realidad discrepan: ¿avisa o bloquea? Bloquear el
   `checkout` de otra sesión es una decisión de proceso, no de ingeniería.

**Mientras tanto, ② lo DELATA pero no lo impide.** Es menos de lo que pide el ticket y se dice
aquí para que nadie lea el preflight como una garantía de propiedad.

## 🔴 Un hallazgo de la prueba R4, y hay que saberlo

Al mover el worktree a una rama que no lleva este ticket, **el propio preflight desaparece del
árbol**: `Error: Cannot find module … scripts/preflight-migracion.mjs`.

Es el caso de METODO_YAQU «un guard que vive en otra rama no está en tu árbol». **No invalida el
mecanismo** —una vez en `main`, estará en todas las ramas—, pero sí dice una cosa incómoda:
**mientras 395 no esté mergeado, no protege en las ramas que no lo lleven**, que son todas menos
ésta. La prueba R4 se ejecutó con el script fuera del árbol y `cwd` apuntando al worktree movido,
que es la única forma de ejercitar ese caso hoy.

## Las seis pruebas de rojo, ejecutadas

| | Qué | Resultado |
| --- | --- | --- |
| **R1** | `DROP COLUMN` real (el SQL exacto del incidente) | 🔴 rechaza · línea 2 · huella `07c1f0d78aad` · **exit 1** |
| **R2** | control positivo: el `ALTER` aditivo de C5 + índice | ✅ pasa · 2 sentencias · **exit 0** |
| **R3** | «DROP» solo en comentarios y en un literal | ✅ pasa · 2 sentencias · **exit 0** |
| **R4** | árbol movido a otra rama | 🔴 cae nombrando `cobroflash-b1`, declarada y encontrada · **exit 1** |
| **R5** | control negativo: árbol en la rama correcta | ✅ no molesta · **exit 0** |
| **R6** | fichero con una comilla sin cerrar | 🔴 «NO SE PUDO PARSEAR» · **exit 1** |

**Suite:** `tests/scrum395-preflight-migracion.test.mjs` — 14 tests, 14 pass.

**Un defecto que cazó su propio test:** `ALTER TABLE "t" ALTER COLUMN "a" TYPE INTEGER` con el
identificador entrecomillado se rechazaba —lo atrapaba la lista blanca— pero **con el motivo
genérico** «forma no reconocida» en vez del específico. Rechazaba bien y explicaba mal. Corregido
el patrón; el rechazo por lista blanca fue la red que evitó que el fallo fuera peligroso.

## Lo que no toca

`prisma/schema.prisma` · las bases (esto no ejecuta ninguna migración) · el camino de emisión.
