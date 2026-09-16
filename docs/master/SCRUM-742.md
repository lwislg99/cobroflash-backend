# SCRUM-742 · El censo de internos de Prisma: «media docena» eran quince

**Fecha:** 4-sep-2026 · **Carril:** dependencias / herramienta · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `cc786ab34df118e6a44ae25ae523709f3cb4e11c` · 2026-09-04T22:21:52+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-742-censo-de-internos-de-prisma`

**Tanda:** **5.340 pruebas · 5.252 en verde · 0 fallos · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

🟢 **Y es la primera tanda de esta máquina sin un solo rojo en toda la sesión.** La base sobre
`main` limpio, medida al empezar sobre un worktree recién nacido de
`0cc1376eb2a1f5fb12001bf9d596eab85786d981`, daba **5.312 · 5.223 · 1 fallo · 88 saltadas** — el
rojo del `%20` en `tests/scrum176b`. Ese fallo lo cerró **SCRUM-730**, que entró en `main` durante
esta sesión y se mezcló dentro de esta rama. No es mérito de este ticket y por eso se dice de quién
es.

**Los +28 tests, dicho con precisión:** **7** son de este ticket (medidos corriendo el fichero
solo). Los otros **21** vienen del `main` nuevo que se mergeó dentro — SCRUM-728, 730, 733 y 641.
**No se ha hecho comparación de fan-out nombre a nombre**, así que ese reparto es aritmética, no
medición.

---

## ⛔ LO PRIMERO: ESTE TICKET NO SUBE NINGUNA VERSIÓN

Las dependencias las decide el fundador (regla 36). Aquí se **mide el alcance** para que esa
decisión se tome con la lista delante. El censo sólo lee: no ejecuta `prisma`, no escribe un byte
y no propone un plan de migración. Misma forma que `scripts/diagnostico-dependencias.mjs`.

## PASO 0

**ENTRADA.** No hay pantalla. Se llega por dos sitios: (a) `prisma generate` imprime **en cada
ejecución** que `package.json#prisma` está deprecado y desaparece en Prisma 7 —lo ve cualquiera que
regenere el cliente—, y (b) el día que alguien se plantee subir de versión. Hoy esa segunda entrada
**no tenía nada que leer**: la respuesta a «¿cuánto nos afecta?» era *«media docena de guards»*, una
impresión que nadie había contado.

**MECANISMO.** El censo no existía. Lo que sí existía y se reutiliza en vez de duplicarlo:
`soloEjecutable` (`tests/_guard-texto.mjs`, SCRUM-700/719) como filtro ÚNICO de comentarios, y el
precedente de `diagnostico-dependencias.mjs` —un script de solo lectura que mide y calla— incluido
el de importar desde `tests/` a `scripts/`, que ya se hacía.

## El número: 15 ficheros, no seis

Población: **1.120** ficheros `.ts/.mjs/.js` en `src/`, `scripts/` y `tests/` (sin `.d.ts`, sin
`node_modules`, sin los dos ficheros del propio instrumento).

| superficie | ficheros | |
|---|---|---|
| `Prisma.dmmf` | **9** | el modelo de datos compilado dentro del cliente generado |
| un fichero de dentro del cliente generado | **1** | `.prisma/client/schema.prisma` |
| un paquete interno (`@prisma/internals`, `engines`, `runtime/`) | **0** | nadie los importa |
| la RUTA del CLI en `node_modules` | **6** | de ésos, **4 lo LANZAN** |
| el bloque `prisma` de `package.json` | **1** | no es un fichero de código |
| | **15 ficheros distintos** | |
| ·· *control negativo:* API pública | 71 | `PrismaClient`, errores tipados, `Decimal`, `$transaction` |
| ·· *prosa:* un comando de Prisma en un mensaje | 19 | no cuenta: no es acoplamiento |

La lista nominal, fichero a fichero y con para qué usa cada uno lo suyo, está en
**`docs/CENSO_INTERNOS_PRISMA.md`**. Se rehace con `npm run censo:internos-prisma`.

**Los 71 de API pública se cuentan A PROPÓSITO y son la mitad del valor:** si el barrido dejara de
ver el uso normal de Prisma, su «cero internos» sería un cero de ceguera — y se leería como la
mejor noticia posible.

## 🔴 Lo que cambia en Prisma 7, con el NIVEL DE EVIDENCIA de cada fila

Esto es lo que el encargo pedía separar, y se separa: *«el DMMF no es lo mismo que una ruta dentro
de `runtime/`»*.

| superficie | qué pasa | evidencia |
|---|---|---|
| bloque `prisma` de `package.json` | **desaparece**; se migra a `prisma.config.ts` | 🟢 **MEDIDO AQUÍ**: la cadena vive dentro de `@prisma/config` **instalado**, y hay un test que la lee de ahí en cada tanda en vez de copiarla |
| el cliente en `node_modules/.prisma/client` | **deja de generarse ahí por defecto**: `output` pasa a ser obligatorio | 🟡 fuente externa (guía oficial de subida) |
| generador `prisma-client-js` | *«will be removed in future releases»* | 🟡 fuente externa (misma guía) |
| **`Prisma.dmmf`** | **no se expone** en la salida del generador nuevo `prisma-client` | 🟠 fuente externa, issue **cerrada** del repo de Prisma (26-sep-2025) |
| `node_modules/prisma/build/index.js` | **NO CONSTA** en la guía | ⚪ no se afirma nada |

**El golpe no es el bloque de `package.json`** —una clave `seed` que se muda de fichero—. **El
golpe es el DMMF**, y por dónde pasa: de los nueve que lo leen, **tres son camino de producción** —
el chequeo de deriva del ARRANQUE (`src/core/db/schemaDrift.ts`), la portabilidad RGPD
(`portabilidadCompleta.ts`, que decide qué se le entrega a un merchant que pide sus datos) y la
restauración de backup—. Y **cinco de los nueve son tests**: parte de la red que vigila a los otros
cuatro se apoya en lo mismo que ellos.

El sustituto que se propone en esa issue es `getDMMF` de `@prisma/internals`, que **no está
instalado** y sería dependencia nueva. `scripts/_pares-del-schema.mjs` ya lo había escrito en su
cabecera hace tiempo: *«El día que `@prisma/internals` esté instalado, `getDMMF` hace esto mejor y
este fichero sobra.»*

## Por qué no es un `grep`, medido y no razonado

`Prisma.dmmf` aparece en **11** ficheros por texto y en **9** de verdad. Los dos que sobran
—`scripts/_pares-del-schema.mjs` y `tests/scrum461-censo-no-encoge.test.mjs`— lo nombran **en un
comentario**, que es el sitio natural donde se escribe el nombre de un interno: el comentario que
explica por qué se usa. Un `grep` habría abierto un ticket sobre un fichero que no lo toca.

### El detector de «lanza el CLI» se apretó CUATRO veces, y las dos últimas eran falsos NEGATIVOS

| versión | dio | por qué era falso |
|---|---|---|
| ① la palabra `prisma` cerca de un `spawn` | **22** | metía en el mismo saco a quien EJECUTA el CLI y a quien lo escribe en un mensaje al fundador |
| ② ventana de 220 hacia delante | **5** | **cuatro falsos positivos** al mirarlos a mano: un `regex.exec()`, dos ficheros cuyas *cadenas de ejemplo* dicen `spawn('prisma', …)`, y un `spawnSync` de un script propio |
| ③ ventana a dos lados, 300 | **3** | perdió `_prisma-sync.mjs`: la ruta se arma en la línea de ANTES |
| ④ ventana a dos lados | **3** | perdió `preview-migracion.mjs`: allí la ruta la devuelve **otra función** |
| ⑤ condición de FICHERO | **4** | los seis candidatos revisados **a mano**, uno a uno |

🔴 **Las dos últimas eran falsos negativos, que son los que no se notan.** Una ventana no puede
seguir un valor que cruza funciones, y ensancharla hasta que quepa es elegir el número que uno
quiere. La condición de fichero es tosca, pero **no se equivoca en silencio**: son seis nombres y
el censo los imprime para que cualquiera repita la revisión en dos minutos.

### Y el censo se contaba a sí mismo. Dos veces

La primera versión aparecía en **cuatro** superficies sin tocar ninguna: sus patrones son literales
de regex en código ejecutable. Se excluyó el script… y al mezclar `main` **entró su fichero de
tests por lo mismo**. El mismo defecto, a un fichero de distancia. Por eso la exclusión es ahora una
LISTA (`LOS_MIOS`) y no un nombre, y hay un test que exige que el instrumento siga casando con sus
propios patrones — si dejara de hacerlo, la exclusión habría dejado de tener sentido y hay que
volver a mirarla.

## El hallazgo del encargo, escrito donde el próximo lo busque: RUNBOOKS **R20**

`node_modules/.bin/prisma` **no es un ejecutable**: son tres lanzadores de shell (`prisma`,
`prisma.cmd`, `prisma.ps1`) que npm crea, y `execFileSync` no los interpreta. Falla siempre en
Windows con un error que no habla de Prisma, y se lee como «Prisma no puede generar».

La forma correcta —`spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), …])`—
**ya la usa la casa en cuatro sitios** (`_prisma-sync`, `aplicar-sql-dev`, `preflight-schema-drift`,
`preview-migracion`) y no estaba escrita en ningún sitio. Ahora está en `docs/RUNBOOKS.md` §R20,
con la trampa hermana: **Prisma infiere la raíz del proyecto desde la ruta del `--schema`**, así que
un schema de usar y tirar tiene que quedarse dentro de `prisma/`.

## Verificado en rojo — cinco mutaciones y un caso real

Cada mutación guarda los BYTES, comprueba que cambió **ese** fichero, corre la tanda del ticket,
restaura y verifica con `Buffer.compare`. El árbol queda limpio y se comprueba con `git status`.

| se rompe a propósito | cae por |
|---|---|
| ① el filtro deja de quitar comentarios | «el censo distingue USAR de NOMBRAR EN UN COMENTARIO» |
| ② se quita la exclusión del instrumento | «SUELO: el censo NO se cuenta a sí mismo» |
| ③ la API pública deja de contarse | «SUELO: el barrido ve la población y ve el uso NORMAL» |
| ④ se borra del RUNBOOK la ruta del CLI | «el censo se puede ejecutar y su documento existe» |
| ⑤ **CONTROL NEGATIVO**: se reescribe prosa del documento | **no cae** — y no debe |
| ⑥ **CASO REAL**: se añaden tres ficheros que usan `Prisma.dmmf` | cae por el trinquete, **y los nombra** |

La ③ es la que impide el verde hueco, y la ⑤ la que impide que esto sea un guard que vigila que
nadie toque un documento.

## Ficheros

`scripts/censo-internos-de-prisma.mjs` (**nuevo**) · `docs/CENSO_INTERNOS_PRISMA.md` (**nuevo**) ·
`tests/scrum742-internos-de-prisma.test.mjs` (**nuevo**, 7 tests) · `docs/RUNBOOKS.md` (+R20) ·
`package.json` (+`censo:internos-prisma`, con su `//comentario` pegado) · esta entrada.

**No se ha tocado:** ninguna versión de ninguna dependencia · `prisma/schema.prisma` · ninguno de
los 15 ficheros censados · ningún test existente · sin dependencias nuevas (regla 36) · el suelo de
la tanda, que sigue siendo un mínimo.

⚠️ **El conflicto de `package.json` aquí es esperado** y se resuelve como dice su propia nota
(SCRUM-548): se conservan LOS DOS lados, cada script con su `//comentario` pegado.

## Estado del árbol

* Rama nacida de `origin/main` = `0cc1376eb2a1f5fb12001bf9d596eab85786d981`. Durante la sesión
  `origin/main` avanzó a `cc786ab3` (SCRUM-728, 730, 733 y 641): se **mergeó `main` DENTRO**, sin
  reescribir historia, y **el censo entero se re-midió sobre el árbol mezclado** — de ahí salió el
  defecto del fichero de tests contándose a sí mismo, que sin el merge no se habría visto hoy.
* Cero CR en disco en los cinco ficheros tocados, medido por **BYTES**.
* `npm run guards:entrada` en verde.

## 🔴 Los huecos que declaro

1. **No se ha probado a subir a Prisma 7.** Se sabe qué *dice Prisma* que cambia; no se sabe qué
   rompe de verdad. Medirlo exige instalar la versión nueva, que es justo lo que este ticket tiene
   prohibido.
2. **Cuatro de las cinco filas de riesgo son FUENTE EXTERNA**, consultada el 4-sep-2026. Sólo la
   primera la puede afirmar esta máquina por sí sola. Las URLs están en el documento para que se
   puedan volver a comprobar; si Prisma cambia de opinión, este documento envejece y nadie lo avisa.
3. **Es un censo por TEXTO sobre la parte ejecutable**, no por AST: `src/` es TypeScript. Distingue
   código de comentario —el error caro— pero **no** distingue código vivo de código muerto.
4. **`cli-invocado` es una condición de fichero**, no de sentencia: un fichero que resolviera la
   ruta para un mensaje y aparte lanzara otra cosa saldría como invocador. Los seis se revisaron a
   mano hoy; el próximo que lo lea tendrá que repetirlo.
5. **No se han censado `.sql`, `.yml`, `.json` ni la documentación**, que también nombran comandos
   de Prisma — el CI, por ejemplo.
6. **No se ha evaluado `getDMMF` de `@prisma/internals` como sustituto**: no está instalado, y
   traerlo es decisión del fundador.
7. **`Prisma.dmmf` es a la vez un export público del cliente generado y una API que Prisma describe
   como interna.** Esa ambigüedad es del proveedor; se deja escrita tal cual en vez de resolverla a
   mi favor.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* La tanda de `main` limpio ha vuelto a **CERO fallos** (5.340 · 5.252 verde · 0 · 88 saltadas): el rojo del `%20` que arrastraban los nueve árboles desde ayer lo cerró SCRUM-730, y esta es la primera medición limpia de esta máquina en toda la sesión.
* `scripts/_pares-del-schema.mjs` existe como **segundo testigo** del schema precisamente porque el primero lee el DMMF: si el DMMF desaparece en Prisma 7, ese fichero deja de ser el testigo redundante y pasa a ser **el único**, que es un cambio de papel que nadie ha decidido.
* `tests/scrum176b-force-por-identidad.test.mjs` lleva en su lista de comandos peligrosos la forma `./node_modules/.bin/prisma db push --force-reset`: si el punto de entrada del CLI cambia, esa lista deja de cubrir el comando real sin que nada lo diga.
* `@prisma/config` —el paquete que emite el aviso de deprecación— **no está declarado en `package.json`**: llega como dependencia transitiva, así que el aviso que hoy se cita como evidencia podría desaparecer del árbol sin tocar nada nuestro.
