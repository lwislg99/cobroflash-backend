# SCRUM-429 · PASO 0: el cliente de Prisma compartido — y la causa no era la que dije

**Medido contra:** `origin/main` = `9060820d550d894c3461c341cc57d41ee54c9680` · 2026-08-10T19:49:52+02:00
**Rama:** `scrum-429-cliente-prisma`

**10-ago-2026, 19:49 CEST (UTC+0200)** · commit `797b6e868ad849e5c5bff1f28b418a247b2cec56`

## 🔴 Lo primero: mi propio diagnóstico de hace una hora era falso

Reporté que la caída de las 18:52 la había provocado **otra sesión** regenerando en el
`node_modules` compartido. **No.** Medido:

```
wt-226\node_modules          → DIRECTORIO REAL, no junction
wt-226\node_modules\.prisma  → real
```

**Mi `node_modules` es propio y nadie me lo tocó.** Lo que cambió fue **mi rama**:
`prisma/schema.prisma` ganó 2 líneas entre mi rama duplicada y la buena —
`feat(SCRUM-425): columna clave_idempotencia en Albaran`— y **el cliente generado no viaja con la
rama**. Lo deduje del síntoma en vez de mirarlo.

## (1) Cómo está montado hoy — medido

| | |
|---|---|
| worktrees con `node_modules` **junction** | **96** |
| worktrees con `node_modules` **real** | **45** |
| sin `node_modules` | 25 |

No todos apuntan al mismo sitio: la mayoría a `cobroflash-backend\node_modules`, pero **hay una
cadena** — `wt-215-probe`, `wt-216-consolidar` y `wt-248-fixtures` apuntan a
`wt-209-conflicto\node_modules`. Eso es lo que explica que un `git worktree remove` vaciara el
compartido una vez: siguió la cadena.

**Lo que se comparte es TODO `node_modules`**, no solo el cliente: no hay ninguna granularidad hoy.

## 🔴 Y por tanto: HAY DOS CAUSAS, no una

| | causa | a quién afecta | cómo se distingue |
|---|---|---|---|
| **(A)** | tu propio **cambio de rama**: el schema viaja con la rama, el cliente no | a ti solo | `git log -1 -- prisma/schema.prisma` |
| **(B)** | **otro worktree**, si tu `node_modules` es junction | a todos los que comparten | `(Get-Item node_modules).LinkType` |

**La mía fue la (A).** Y el mensaje del guard **solo nombraba la (B)** — con esa frase delante,
diagnosticar mal era lo normal. **Aislar el cliente no resuelve la (A)**, que es inherente: cualquier
worktree que cambie de rama necesita regenerar.

## (2) Las opciones, con su coste

| | |
|---|---|
| `node_modules` completo | **413 MB** · 17.131 ficheros |
| solo el cliente generado (`.prisma`) | **24,7 MB** · 18 ficheros |
| **libre en `D:`** | **2,1 GB** |

### ① `node_modules` propio por worktree — **IMPOSIBLE HOY**

96 × 413 MB = **~39,6 GB**. Hay **2,1 GB**. No caben ni cinco. **La descarta el disco, no una
opinión.**

### ② `output` por worktree en el `generator` — exige GO, y además arrastra

Pondría el cliente fuera de `node_modules`. Pero **cambia de dónde se importa**: hoy todo el código
hace `from '@prisma/client'`, que re-exporta desde `node_modules/.prisma/client`. Con `output`
propio habría que tocar **todos los imports** de `src/`, y eso es mucho más que un cambio de schema.
`prisma/schema.prisma` es territorio del fundador: **no lo he tocado y no traigo diff**, porque
antes de pedir GO hay que decidir si se acepta el arrastre de los imports.

### ③ Aislar **solo el cliente** (24,7 MB por worktree)

**Es lo único que cabe**: 4 worktrees activos = **99 MB**. Exige que `node_modules` deje de ser un
junction entero y pase a ser un directorio real con enlaces por paquete y `.prisma` propio — un
pnpm a mano. **No lo he construido**: toca el `node_modules` compartido, y la instrucción era parar
y decirlo antes. **Aquí paro.**

## (3) La que decide: ¿alguna resuelve sin paso manual?

**Ninguna de las tres, y por un motivo que el encargo no contemplaba:** las tres atacan la (B), y
**la (A) sigue viva con todas**. Un cambio de rama deja el cliente viejo aunque el `node_modules`
sea propio — **es exactamente lo que me pasó a mí hoy con un `node_modules` real**.

Lo único que resuelve **las dos sin paso manual** es que la regeneración **ocurra sola cuando el
schema y el cliente divergen**, en vez de fallar. Y eso **solo es seguro si el cliente no se
comparte** — con junction, regenerar automáticamente le rompería la medición a quien esté corriendo
tests en ese momento. O sea: **③ + regeneración automática**, en ese orden y no al revés.

**Es una propuesta, no una entrega.** Necesita GO porque toca el `node_modules` compartido.

## Verificación

**Control positivo, la mitad que SÍ pude ejecutar:** regeneré en `wt-226` (que ya está aislado) y el
cliente compartido **no se movió**:

```
compartido ANTES: 19:11:12     ·  DESPUÉS: 19:11:12   (intacto)
el mío     ANTES: 19:05:05     ·  DESPUÉS: 19:46:10   (regenerado)
```

> **NO PUDE PROBAR EL AISLAMIENTO EN LA OTRA DIRECCIÓN.** Exigiría regenerar desde un worktree
> junctionado, y eso **rompe el cliente de las sesiones vivas** — justo el daño que el ticket quiere
> evitar. Cómo se ejecutaría cuando haya ventana: anotar la marca de tiempo del cliente de dos
> worktrees aislados, regenerar en uno, y comprobar que el otro **no cambia de marca y sigue en
> verde** con `npm run guards:entrada` y `node scripts/_prisma-client-guard.mjs`.

**Lo entregado hoy** es el mensaje del guard, que nombraba una sola causa. Ahora nombra las dos, dice
cómo distinguirlas y avisa de que en el caso (B) **arreglar el tuyo rompe el de los demás**. Rojo por
`$?`: recortar una de las dos causas → cae nombrando cuál falta.

**El guard de divergencia no se toca en lo que hace.** Es lo único que ha hecho detectable esto seis
veces.

## Si se aprueba ③, lo que cada worktree tendría que hacer UNA vez

Todavía no hay comando que dar: depende de la forma que se apruebe. **Lo digo para que conste que no
lo hay**, en vez de dejarlo en el aire.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el `node_modules` compartido · el comportamiento del guard · el camino de
emisión.

Ficheros: `scripts/_prisma-client-guard.mjs` (solo el mensaje) ·
`tests/scrum235-cliente-por-columnas.test.mjs`.

---

# SCRUM-429 · segunda entrega: la regeneración automática, y por qué la ③ apenas hacía falta

**Medido contra:** `origin/main` = `c47d03655aacd7fe78044f89e7c55a7d467cbb5b` · 2026-08-10T20:13:06+02:00
**Rama:** `scrum-429-cliente-prisma`

**10-ago-2026, 20:13 CEST (UTC+0200)** · commit `2edefb9c0d5327cc1f5b5a8c45937610cf82468c`

## 🔴 Lo primero, porque cambia el trabajo: TRES DE LOS CUATRO YA ESTABAN AISLADOS

Antes de tocar nada, miré a qué apunta cada uno de los cuatro con actividad en la última hora —como
mandaba el encargo, sin suponerlo:

| worktree | último commit | `node_modules` |
|---|---|---|
| `wt-226` (el mío) | 19:52 | **REAL** |
| `wt-419` | 19:47 | **REAL** |
| `wt-440` | 19:37 | **JUNCTION** → `cobroflash-backend` |
| `wt-368` | 19:31 | **REAL** |

**Solo uno sigue compartido, y es de otra sesión que commiteó hace un rato.** Convertirlo mientras
esa sesión trabaja es exactamente el daño que este ticket quiere quitar: le dejaría sin
`node_modules` a mitad de una tanda. **No lo he tocado.**

## La segunda mitad, que es la que cierra las DOS causas

`scripts/_prisma-sync.mjs`, **delante** del guard en `pretest`. Regenera cuando el cliente no cuadra
con el schema de **esta** rama, y **solo si `node_modules` es propio**. La condición **se deriva**
con `lstat` —verificado: un junction sale `isSymbolicLink: true`, un directorio real no—, así que no
depende de que nadie recuerde en qué worktree está.

Con junction **no toca nada** y dice por qué. **El guard sigue detrás**, en su proceso, y el orden
tiene test: sincronizar después no serviría de nada, y quitar el guard dejaría el automatismo sin
vigilante.

## Causa (A), reproducida y arreglada sola — ejecutado, no razonado

```
main + cliente al día                       → guard 0
cambio a una rama sin claveIdempotencia     → guard 1   ← nadie más tocó nada
node scripts/_prisma-sync.mjs               → «el cliente estaba viejo … se ha regenerado solo»
guard después                               → 0
```

**Rojo por el mecanismo:** el mismo cambio de rama **sin** el automatismo deja el guard en 1.

## Dos bugs míos que cazó el propio escenario

- **La re-comprobación mentía.** `comprobarCliente` lee el cliente con `import()` dinámico y **Node
  cachea el módulo**: tras regenerar leía el viejo y el automatismo decía «sigue divergiendo» con el
  cliente ya arreglado. Ahora **juzga el guard**, en su proceso — que además es lo correcto: el
  veredicto lo sigue dando el mecanismo de siempre y no una copia dentro del automatismo.
- **`spawnSync` sobre el `.cmd`** devolvía `EINVAL` en Windows, y con `shell: true` arrastraba un
  aviso de deprecación. Se invoca el **JS del CLI local** con el `node` que ya corre: sin shell, sin
  `npx` (que se baja `prisma@latest`, SCRUM-385) y con la versión del proyecto.

## Y un hueco real en el SUELO, que salió al escribirlo

Con el cliente **ausente**, el guard **lanzaba un error de ESM crudo** en vez de declararse ciego.
**Un stack no es un diagnóstico:** quien lo ve no sabe si el guard encontró un problema o si el guard
**es** el problema. Ahora cae en el suelo que ya existía (`sinDatos`), que falla cerrado y explica que
no se pudo comparar.

## El comando de aislamiento, para pasárselo a las cuatro

Solo lo necesita quien tenga **junction**. Comprobar primero, y **el `rmdir` va SIN `/s`** — probado
aquí mismo con un junction de juguete: **borra el enlace y deja el destino intacto**, que es lo que
falló en los dos vaciados.

```powershell
# 1 · ¿es junction?  (vacío = ya es propio, no hagas nada)
(Get-Item .\node_modules -Force).LinkType

# 2 · quitar SOLO el enlace (NUNCA con /s: seguiría al destino)
cmd /c rmdir ".\node_modules"

# 3 · instalación propia (~413 MB)
npm ci
```

⚠️ **Hay CADENA**: `wt-215-probe`, `wt-216-consolidar` y `wt-248-fixtures` apuntan a
`wt-209-conflicto`, **no al principal**. Quien esté en uno de ésos tiene que mirar el paso 1 antes de
nada.

⚠️ **Espacio**: quedan **2,10 GB** libres y cada `node_modules` son **413 MB**. Caben **cuatro**
justas (1,61 GB) y dejarían 0,49 GB. **Con más de cuatro no cabe**, y por eso la ① —privado para los
96— sigue descartada.

## La verificación que falta, dicha con sus palabras

**No he podido probar el aislamiento en la dirección que falta.** Exigiría regenerar desde un
worktree junctionado —hoy solo `wt-440`, que es de otra sesión viva— y eso rompe su cliente. Cómo se
ejecutaría **cuando los cuatro estén aislados y ya no haya junction que romper**: anotar la marca de
tiempo del cliente de dos de ellos, regenerar en uno, y comprobar que el otro **no cambia de marca y
sigue en verde**.

La mitad que sí está hecha: regenerar en `wt-226` (aislado) **no movió** el cliente compartido —
`19:11:12` antes y después.

## 📌 Acumulación de worktrees — anotado para cuando se ataque

**96 con junction · 45 reales · 25 sin `node_modules`**, para **4 sesiones**. Y hay **cadenas**
(tres apuntan a `wt-209-conflicto`, no al principal), que es lo que convierte cualquier limpieza en
peligrosa: un `git worktree remove` siguió una de esas cadenas y vació el compartido. **No se limpia
hoy**; queda medido.

Ficheros: `scripts/_prisma-sync.mjs` (nuevo) · `scripts/_prisma-client-guard.mjs` ·
`package.json` (`pretest`) · `tests/scrum429-cliente-privado.test.mjs` (nuevo) ·
`tests/scrum235-cliente-por-columnas.test.mjs`.

---

# SCRUM-429 · tercera entrega: el aislamiento, probado en la dirección que faltaba

**Medido contra:** `origin/main` = `bf4ffb730a332f936e5bec6000fe665d4e6b0a9c` · 2026-08-10T20:26:40+02:00
**Rama:** `scrum-429-cliente-prisma`

## 🔴 `wt-440` sigue con junction: NO lo he aislado

Comprobado antes de nada:

| worktree | `node_modules` |
|---|---|
| `wt-226` | REAL (propio) |
| `wt-419` | REAL (propio) |
| `wt-368` | REAL (propio) |
| **`wt-440`** | **JUNCTION** → `cobroflash-backend` |

La instrucción era parar si aún no se había aislado, y **está sin aislar**. No se toca: esa sesión
está trabajando, y quitarle el `node_modules` a mitad de una tanda es el daño exacto que este ticket
vino a quitar. El comando está en la entrega anterior.

## Pero la verificación que faltaba SÍ se podía hacer ya

**Tres de los cuatro son propios**, y eso basta: se regenera en **uno mío** y se mira a los otros.
Ni se toca `wt-440` ni se modifica el worktree de nadie — leer su guard es de solo lectura.

| | antes | después | guard antes → después |
|---|---|---|---|
| **`wt-226`** (donde regenero) | 20:05:10 | **20:25:32** | — |
| `wt-419` | 18:42:46 | **18:42:46** | 0 → **0** |
| `wt-368` | 19:05:26 | **19:05:26** | 0 → **0** |
| compartido (`cobroflash-backend`) | 19:11:12 | **19:11:12** | — |

**Regenerar en un worktree propio no mueve el cliente de ningún otro, ni el compartido.** Es el
aislamiento en la dirección que faltaba, y con él el ticket queda cerrado por los dos lados: la (A)
por el automatismo, la (B) por el aislamiento.

## Rojo por el mecanismo — sin deshacer mi aislamiento

Deshacerlo habría exigido borrar 413 MB y reinstalar con **2,1 GB libres**: caro y arriesgado para
demostrar algo que se demuestra igual en pequeño. Con dos «worktrees» de juguete:

```
CON JUNCTION  · A regenera → B lee: REGENERADO POR A      ← la causa (B), reproducida
CON PROPIO    · C regenera → D lee: v1                    ← con aislamiento, no pasa
```

**Es la misma propiedad que la tabla de arriba, aislada del ruido**: lo que cambia el resultado es
el junction, no el proyecto.

## Estado final del ticket

| causa | cómo queda | quién avisa si se deshace |
|---|---|---|
| **(A)** el schema viaja con la rama y el cliente no | `_prisma-sync.mjs` regenera solo | el guard, detrás en `pretest` |
| **(B)** `node_modules` compartido | aislamiento (3 de 4 hechos) | el automatismo se niega a regenerar sobre un junction |

**El guard sigue vivo a propósito.** Si el automatismo se deshace, nos enteramos por él y no por una
medición corrompida — que es cómo se enteró este proyecto las seis veces anteriores.

## 📌 Lo que NO se toca hoy, y queda escrito

**96 worktrees con junction · 45 con `node_modules` real · 25 sin**, para **4 sesiones**. Es
acumulación, y limpiarla es **peligroso por las cadenas**: `wt-215-probe`, `wt-216-consolidar` y
`wt-248-fixtures` apuntan a **`wt-209-conflicto`, no al principal**. Un `git worktree remove` siguió
una de esas cadenas y vació el compartido — dos veces.

**No hay ninguna prisa y hoy no se limpia.** Queda medido para cuando se ataque, con el aviso de que
el primer paso de esa limpieza tiene que ser volver a mirar a qué apunta cada uno: los números de
arriba son de hoy.

## SCRUM-429b · el build NOMBRA el cliente viejo (14-oct-2026, Sesión 5)

Encargo del orquestador. Sin ticket nuevo: va aquí porque es el mismo defecto, y este ticket ya está cerrado.

**Medido, sobre `origin/main` = `bcd333823`:** el cliente compartido
(`cobroflash-backend/node_modules/.prisma/client`, generado el 1-oct) no tiene `Quote.seriesYear`,
`Quote.archivedAt` ni `WhatsAppMessage.toPhone`, y no le sobra nada. El encargo hablaba de dos campos;
son **tres**. El guard ya lo sabía (`node scripts/_prisma-client-guard.mjs` → exit 1, `Quote.seriesYear`),
pero no habló, por dos motivos:
- `npm run build` es `tsc` a secas. El guard sólo corría en `pretest`.
- El guard cantaba sólo la PRIMERA diferencia.

**Hecho:**
- `_prisma-client-guard.mjs`: `todasLasDiscrepancias()` saca la lista entera, que va en el mensaje. Con
  `--avisar` imprime un aviso que nombra cada campo y sale con 0.
- `package.json`: `prebuild` = el guard con `--avisar`. **No para el build**, a propósito: `tsc` emite `dist`
  aunque haya errores, un cliente compartido viejo pararía a todas las sesiones a la vez, y `prebuild` corre
  también en el deploy. El juez que bloquea sigue siendo `pretest` y el CI.
- De paso: el mensaje de «no se puede comparar» recomendaba `npx prisma generate`, en contra de SCRUM-385.
  Ahora dice `npm run prisma:generate` y remite al procedimiento.
- El procedimiento para regenerar está escrito en `docs/equipo/trampas-del-entorno.md` §10, **SIN EJECUTAR**.
  Medido para escribirlo: **no hace falta matar todos los `node`**, sólo los que tienen
  `query_engine-windows.dll.node` cargada. La sonda (`$_.Modules.FileName`) se vio cazar un `node` que la
  cargaba a propósito. De los 14 `node` vivos, ninguno la tenía.

**Control positivo:**
- Contra el cliente compartido de hoy, `--avisar` nombra los tres campos y sale con 0. Sin `--avisar`, la
  misma lista y sale con 1.
- Test `scrum429b`: (1) un cliente igual al schema no da ninguna diferencia, y quitando las tres columnas y
  añadiendo una salen las cuatro con su nombre; (2) contra el cliente REAL, dos columnas inventadas en `Quote`
  salen las dos, sea cual sea el estado del cliente local; (3) `--avisar` sale con 0 y sin él con 1;
  (4) `prebuild` avisa y `pretest` sigue bloqueando.
- **«Se calla con un cliente al día»** está probado con un cliente fabricado (la copia del schema), **no con
  un cliente regenerado**: hoy no se regenera. La primera regeneración tiene que ver el `✔`.

**Tanda local (13 ficheros): 87 de 93.** Los 6 rojos NO son de este diff:
- 4 (SCRUM-235/252, «el árbol sano da verde contra el cliente real») caen porque el cliente compartido es
  viejo. El guard ya salía con 1 sobre el árbol sin tocar.
- 2 (`scrum394`, `scrum729`) caen por `ERR_MODULE_NOT_FOUND` de `dist/…`: este árbol no tiene `dist`.

El juez es el CI, que genera su propio cliente.

## SCRUM-429c · la primera regeneración, apuntada (15-oct-2026, Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:34:16Z

A9: sin fallo que generalice — tramo de sólo medición. La línea A9 que le faltaba (el CI de #2476 cayó por eso) la añade el relevo de S5; el fallo, con su comprobación, va en el registro de SCRUM-1494.

El orquestador ejecutó el procedimiento de §10 por primera vez esta tanda, con el equipo parado. §10 decía
«la primera vez que se ejecute, se apunta aquí qué pasó», y eso es lo que se ha apuntado allí:
- Su primer control positivo falló por estar el script en `%TEMP%` (desde ahí no resuelve `@prisma/client` y
  el motor no se carga). Dentro del proyecto, la sonda vio el proceso. Ningún proceso con la DLL al regenerar.
  *(Medido por el orquestador; esta sesión no lo repitió.)*
- Repetido por esta sesión desde `s5-14octb` (junction al compartido, en `origin/main`): el guard da `✔`, EXIT 0.
  **Así queda probado lo que el 14-oct sólo estaba probado con un cliente fabricado: el guard se calla con un
  cliente regenerado de verdad.**
- Y los cuatro tests de SCRUM-235/252 que el 14-oct caían en local por el cliente viejo: con los de 429 y 429b,
  **47 de 47**, EXIT 0 (`scrum235`, `scrum252`, `scrum429`, `scrum429b`).
- Desde el árbol compartido (`scrum-1082…`, schema del 17-sep) el guard sigue en rojo con
  `Merchant.invoiceStartSeq` (cliente por delante del schema), EXIT 1. Es la causa (A): correcto. Se escribe en
  §10 para que nadie lo lea como «la regeneración falló», y que el arreglo que propone el guard, desde ese árbol,
  deshace la regeneración para todos.

**No se tocó** el texto del guard (que en el árbol compartido recomienda regenerar): queda dicho en §10.

## SCRUM-429d · con el `node_modules` compartido, el guard manda al orquestador y no a regenerar (Sesión 5)

**Medido contra:** `origin/main` = `f4910603f44de8d16eab3abc938d853d255d8295` · 2026-10-15T17:32:54Z

A9: comprobación → `tests/scrum429d-causa-b-no-regeneres.test.mjs`

Encargo del orquestador (15-oct, por mensaje), que lo trae de la S0: `_prisma-client-guard.mjs:332` decía «Arreglo, en
los dos casos: `npm run prisma:generate` (desde ESTE worktree)». En la causa (B) es justo lo que §10 prohíbe: un
consejo que, obedecido, rompe a los demás. Y el gemelo, encontrado de paso: `_prisma-sync.mjs:81`, ante un junction,
mandaba «avisar a las otras sesiones y regenerar a mano».

- **Carril:** el guard no tiene fila en `dos-equipos.md` (está entre los ayudantes compartidos sin clasificar), lo
  tocó la S5 el 14-oct (429b) y lo encarga el orquestador. Mismo caso el sync.
- **El guard:** el arreglo se parte por la topología. TUYO → `npm run prisma:generate`. COMPARTIDO (la B, o la A en
  un árbol que cuelga del compartido) → «NO regeneres», avisa al orquestador, §10. Sigue diciendo «ROMPE EL DE LOS
  DEMÁS» y nombra `LinkType` y `npm run topologia`, que es lo que exige `tests/scrum235-cliente-por-columnas`.
- **El sync:** la segunda salida pasa a ser «avisar al orquestador, que coordina la regeneración (§10)».
- **Rojo:** el test nuevo, 3 de 3 en rojo contra el texto de `main`; con el arreglo, 3 de 3 (`51e105707`).
  Los 9 ficheros de `tests/` que importan el guard o el sync: 81 de 81.
- **Mutación:** devolver «Arreglo, en los dos casos» (`git diff --numstat` 1/1) → cae SÓLO el caso 1. Restaurado
  con `git restore --source=HEAD`, porcelana vacía.
- Comprobado que nadie regeneró nada: `node_modules/.prisma/client/index.js` del compartido sigue con la hora de
  la regeneración del orquestador (15:33Z).
- Lleva dentro el merge de `scrum-429c-regenerado-apuntado` (#2476): las dos ramas anexaban a este mismo fichero y
  habrían chocado al final.

**Queda viejo, y no es mío:** `docs/equipo/trampas-del-entorno.md` §10 (líneas 180-181 con 429c) dice que el guard
propone regenerar «desde ESTE worktree» también desde el compartido. Al entrar esto deja de ser cierto. El fichero es
de S0.

## SCRUM-429e · trampas §10 al día con 429d: qué propone el guard depende de QUÉ COPIA corre (16-oct-2026, Sesión 0)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:05:37Z (`gh api -i zen`)

A9: sin fallo que generalice — tramo de documentación; la premisa del encargo era cierta para `main` y no para el compartido, y se dice abajo.

Encargo del orquestador (16-oct): #2501 entró, actualizar §10 (~180-181), que decía que el guard propone regenerar.

- **#2501 MERGED** 2026-10-15T17:54:44Z, merge `6a79dc1510f750806e2bf8cb6b87a39960f23397`.
- **Lo que dice cada copia, medido (texto del script, con el control en los dos sentidos):**
  `origin/main:scripts/_prisma-client-guard.mjs` → «NO regeneres» sí · «Arreglo, en los dos casos» no.
  `cobroflash-backend` `HEAD` (rama `scrum-1082-flujo-crear-factura-competencia`, 3185 commits por detrás) → «NO
  regeneres» no · «Arreglo, en los dos casos» sí. Ejecutado desde el compartido, su guard sale EXIT 1 y lo imprime.
- **La copia de `main` con el mismo directorio de trabajo da `✔` EXIT 0:** lee el `schema.prisma` de su propio árbol,
  no el del directorio desde el que se llama.
- **Así que la premisa «ya no lo propone» vale para todo árbol al día y NO para el compartido**, que es justo el sitio
  del ⛔. §10 lo dice ahora así, y conserva el ⛔. La §11 (S3) no se toca.