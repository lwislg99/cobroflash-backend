# Censo de internos de Prisma — cuánto de esta casa depende de lo que Prisma no promete

> **SCRUM-742 · 4-sep-2026.** Lo produce `npm run censo:internos-prisma`, que sólo LEE.
> **⛔ Este documento no decide nada.** Las dependencias las decide el fundador (regla 36). Aquí
> está la lista para que la decisión se tome con ella delante y no con una impresión.

**Medido contra lo instalado:** `prisma` 6.18.0 · `@prisma/client` 6.18.0 · `@prisma/engines`
6.18.0 · `@prisma/config` 6.18.0 · `@prisma/internals` **no instalado**.
**Población:** 1.120 ficheros `.ts/.mjs/.js` en `src/`, `scripts/` y `tests/` (sin `.d.ts`, sin
`node_modules`, y sin los dos ficheros del propio instrumento — el script y su trinquete).

**«Media docena» era una impresión. Son 15 ficheros** más el bloque `prisma` de `package.json`.

---

## 1 · Qué toca cada quién

Las superficies **se solapan a propósito** (quien lanza el CLI nombra también su ruta), así que el
número que manda es el de **ficheros distintos**, no la suma de las columnas.

### 🟠 `Prisma.dmmf` — el modelo de datos compilado dentro del cliente generado · **9 ficheros**

| fichero | para qué |
|---|---|
| `scripts/backup-restore.mjs` | recorre los modelos para restaurar tabla por tabla |
| `scripts/constancia-del-alter.mjs` | columnas esperadas por el código desplegado |
| `scripts/generar-sql-deriva.mjs` | genera `docs/sql/deriva-prod.sql` |
| `src/core/db/schemaDrift.ts` | el chequeo de deriva del ARRANQUE |
| `src/modules/exports/domain/portabilidadCompleta.ts` | qué modelos son del merchant (RGPD) |
| `tests/scrum222-deriva-arranque.test.mjs` | vigila el censo de deriva |
| `tests/scrum235-cliente-por-columnas.test.mjs` | cliente vs schema por nombre de columna |
| `tests/scrum242-restauracion-cubre-todos-los-tipos.test.mjs` | cobertura de la restauración |
| `tests/scrum244-cobertura-portabilidad.test.mjs` | cobertura de la portabilidad |

**No cuentan, y es el dato que justifica el método:** `scripts/_pares-del-schema.mjs` y
`tests/scrum461-censo-no-encoge.test.mjs` **sólo lo nombran en un comentario**. Por texto son 11;
de verdad son 9.

### 🟠 Un FICHERO de dentro del cliente generado · **1 fichero**

`scripts/_prisma-procedencia-guard.mjs` lee `node_modules/.prisma/client/schema.prisma` —la copia
del schema que Prisma guarda al generar— para comprobar que el cliente salió de ESTE schema. El
propio fichero ya lo declara como *«detalle interno de Prisma, no API documentada»* y por eso se
pone **rojo y jamás verde** si desaparece. Es el único de los quince que ya llevaba su propio suelo
para este riesgo.

### 🟠 La RUTA del CLI dentro de `node_modules` · **6 ficheros**

`scripts/_prisma-sync.mjs` · `scripts/aplicar-sql-dev.mjs` · `scripts/generar-sql-deriva.mjs` ·
`scripts/preflight-schema-drift.mjs` · `scripts/preview-migracion.mjs` ·
`tests/scrum176b-force-por-identidad.test.mjs`.

De ésos, **4 LANZAN el CLI** (`spawnSync(process.execPath, [prisma/build/index.js, …])`). Los otros
dos sólo la NOMBRAN: `scrum176b` en una cadena de ejemplo de su lista de comandos peligrosos, y
`generar-sql-deriva.mjs` en el mensaje que le dice al operador cómo regenerar el cliente. No son
acoplamiento, pero dependen de la FORMA del comando, que es justo lo que cambiaría.

### 🟠 El bloque `prisma` de `package.json` · **1**, y es el único con fecha

Existe, con la clave `seed`. El CLI **instalado** dice de él, literalmente:
*«is deprecated and will be removed in Prisma 7»*.

### 🟠 Paquetes internos (`@prisma/internals`, `@prisma/engines`, `runtime/…`) · **0**

Nadie los importa. `scripts/_pares-del-schema.mjs` menciona `@prisma/internals` en un comentario,
prediciendo justamente el escenario de la sección 2: *«El día que `@prisma/internals` esté
instalado, `getDMMF` hace esto mejor y este fichero sobra.»*

### ·· Control negativo — API pública · **71 ficheros**

`PrismaClient`, errores tipados, `Decimal`, `$transaction`. Se cuentan a propósito: **si el barrido
no viera el uso normal, su cero de internos no significaría nada.**

### ·· Prosa — un comando de Prisma escrito en un mensaje · 19 ficheros, **no cuentan**

Instrucciones al fundador («regenera con `npx prisma generate`») y mensajes de guards. No son
acoplamiento, pero envejecen igual si cambian los comandos.

---

## 2 · Qué se va en Prisma 7, y con qué evidencia

🔴 **Cada fila dice DE DÓNDE sale.** Lo que esta máquina puede afirmar por sí sola es sólo la
primera. Lo demás es fuente externa consultada el 4-sep-2026, y se cita para que se pueda volver a
comprobar; y lo que no consta, se dice que no consta en vez de suponerlo estable.

| superficie | qué pasa | evidencia |
|---|---|---|
| bloque `prisma` de `package.json` | **desaparece**; se migra a `prisma.config.ts` | 🟢 **MEDIDO AQUÍ** — la cadena está dentro de `@prisma/config` instalado, y el CLI la imprime en cada `generate` |
| el cliente en `node_modules/.prisma/client` | **deja de generarse ahí por defecto**: `output` pasa a ser **obligatorio** en el bloque `generator` | 🟡 **FUENTE EXTERNA** — guía oficial de subida a Prisma 7 |
| generador `prisma-client-js` | *«will be removed in future releases»*; el nuevo es `prisma-client` | 🟡 **FUENTE EXTERNA** — misma guía |
| `Prisma.dmmf` | **no se expone** en la salida del generador nuevo `prisma-client` | 🟠 **FUENTE EXTERNA, issue cerrada** (26-sep-2025). El sustituto que se propone allí es `getDMMF` de `@prisma/internals`, que **no está instalado** y sería dependencia nueva |
| `Prisma.dmmf` como API | Prisma lo trata como **interno y no documentado**, sujeto a romper en versiones menores | 🟠 **FUENTE EXTERNA** — hilos del repo de Prisma |
| `node_modules/prisma/build/index.js` (punto de entrada del CLI) | **NO CONSTA** en la guía de subida | ⚪ **no se afirma nada** |

**Fuentes externas:**
[guía de subida a Prisma 7](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) ·
[issue #28166 — falta el DMMF en la salida del generador `prisma-client`](https://github.com/prisma/prisma/issues/28166) ·
[issue #19392 — sustituir `Prisma.dmmf` por una API pública de reflexión](https://github.com/prisma/prisma/issues/19392) ·
[issue #28348 — el DMMF se simplifica sin motores Rust](https://github.com/prisma/prisma/issues/28348)

---

## 3 · Lo que esto significa, dicho sin adornos

**El golpe no es el bloque de `package.json`** —una clave `seed` que se muda a un fichero de
configuración—. **El golpe es el DMMF.** Nueve ficheros lo leen, y entre ellos están:

* el **chequeo de deriva del ARRANQUE** (`src/core/db/schemaDrift.ts`),
* la **portabilidad RGPD** (`portabilidadCompleta.ts`), que decide qué se le entrega a un merchant
  que pide sus datos,
* la **restauración de backup** (`backup-restore.mjs`),
* y el generador del censo que el fundador pega en producción.

Si el DMMF deja de estar, esos cuatro no fallan por igual: los tres primeros son **camino de
producción**; el cuarto es herramienta. Y hay un quinto efecto, más callado: **cinco de los nueve
son tests**, o sea que parte de la red que vigila los otros cuatro también se apoya en el DMMF.

**El segundo golpe es `output` obligatorio**: si el cliente deja de vivir en
`node_modules/.prisma/client`, el guard de procedencia (SCRUM-252) pierde el fichero que compara —
aunque ése, al menos, está construido para ponerse rojo y no verde.

**Lo que NO está en riesgo:** los 71 ficheros de API pública. El uso normal de Prisma en esta casa
no depende de nada de esto.

---

## 4 · Los huecos de este censo

1. **Es un censo por TEXTO sobre la parte ejecutable** (`soloEjecutable`, SCRUM-700/719), no por
   AST: `src/` es TypeScript y acorn no lo parsea. Distingue código de comentario, que es el error
   caro; **no** distingue código vivo de código muerto.
2. **`cli-invocado` es una condición de FICHERO** —nombra la ruta Y llama a `spawn`—, no de
   sentencia. Se llegó a ella después de que dos versiones con ventana dieran **falsos negativos**
   (`_prisma-sync.mjs` y `preview-migracion.mjs`, donde la ruta cruza líneas o funciones). Los
   cinco ficheros se revisaron **a mano**.
3. **No se ha probado a subir a Prisma 7.** No se sabe qué rompe DE VERDAD: se sabe qué dice Prisma
   que cambia. Medirlo exigiría instalar la versión nueva, que es exactamente lo que este ticket
   tiene prohibido.
4. **`getDMMF` de `@prisma/internals` no se ha evaluado** como sustituto: no está instalado y
   traerlo es decisión del fundador.
5. **No se han censado los ficheros `.sql`, `.yml` ni la documentación**, que también nombran
   comandos de Prisma.
6. **La clasificación público/interno es de Prisma, no mía**, y no siempre es explícita:
   `Prisma.dmmf` es un export **público** del cliente generado y a la vez una API que Prisma
   describe como interna. Esa ambigüedad es del proveedor y se deja escrita tal cual.
