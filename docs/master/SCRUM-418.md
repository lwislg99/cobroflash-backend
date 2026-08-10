# SCRUM-418 — censo de credenciales de producción por worktree, y el guard que las bendecía

**Medido contra:** `origin/main` = `1deed69a64e6677a2fb8bd72c17f617545f99993` · 2026-08-10T14:32:43+01:00

**Fecha:** 10-ago-2026 ·
**Tanda:** 2484 tests · 2410 pass · **0 fail** · 74 skipped · `npm test` **`$? = 0`**

## 🔴 LO PRIMERO: LA PREMISA DEL TICKET ERA MÍA Y ERA FALSA

Al cerrar SCRUM-415 avisé de que «el worktree `b1` **sí tiene `.env`** apuntando a prod». **La
primera mitad era medida; la segunda me la inventé.** Lo que ejecuté fue `ls -a | grep '^\.env'`,
que dice si el FICHERO EXISTE y nada más; el «apunta a prod» lo tomé de la frase de `CLAUDE.md`
(*«`.env` apunta a PROD; dev usa `.env.local`»*) sin abrirlo.

Es exactamente el error que este proyecto persigue —tomar una afirmación documental por una
medición— y encima me llevó a forzar `DATABASE_URL` en todos los comandos de Prisma de aquella
sesión para protegerme de un peligro que no existía.

**No hay regresión. La medición del 7-ago sigue siendo cierta hoy.**

## ① El censo — los cuatro árboles, medido

Sólo clave, host y base; ningún valor sale de `parseBDSegura` (regla R7 / SCRUM-226). Los cuatro
tienen un único `.env` (no hay `.env.local` en ninguno):

| worktree | claves de BD | destinos | `DATABASE_URL` | a `autorack` (producción) |
|---|---|---|---|---|
| `cobroflash-backend` | 3 | staging `acela/railway` · dev `acela/yaqu_dev_javier` · **tests → `yaqu_dev_javier`** | **ausente** | **0** |
| `cobroflash-b1` | 3 | staging · dev · **tests → `railway`** | **ausente** | **0** |
| `cobroflash-b2` | 3 | staging · dev · **tests → `railway`** | **ausente** | **0** |
| `cobroflash-b3` | 3 | staging · dev · **tests → `railway`** | **ausente** | **0** |

`DATABASE_URL_TESTS` difiere por carril **a propósito** (aislamiento, 23-jul-2026) y coincide con
el mapa de `DESTINOS_ESPERADOS`. Medido por dos caminos independientes: un censo propio que parsea
los `.env`, y el barredor `comprobar-claves-bd.mjs` — **fallos = 0 en los cuatro**.

## ② El guard de SCRUM-383: no es que no la conociera — **la bendecía**

La sospecha era que `DATABASE_URL` a secas no estaba en `DESTINOS_ESPERADOS` y el guard la dejaba
pasar por no conocerla. **Medido: sí está, desde el propio SCRUM-383** (`09c97115`, 6-ago). Y el
resultado real es peor que la sospecha:

```
comprobarClaveVsDestino('DATABASE_URL', <a producción>, 'cobroflash-b1')  →  cuadra ✅
comprobarClaveVsDestino('DATABASE_URL', <a staging>,    'cobroflash-b1')  →  no_cuadra 🔴
```

**El veredicto estaba invertido respecto del riesgo**: la credencial de producción PASABA y la
inofensiva FALLABA. Y no es un defecto de ese guard: contesta *«¿apunta a donde promete su
nombre?»*, y para esa pregunta la respuesta es correcta. **Lo que faltaba era la segunda pregunta
—¿debería existir esta credencial en este árbol?— que no hacía nadie.**

`comprobar-claves-bd.mjs` la declaraba en un comentario (*«`DATABASE_URL` (producción) NO vive en
un .env local»*) y en el código hacía lo contrario: si estaba y cuadraba, sumaba a `comprobadas`
y **no sumaba fallo**. Una regla declarada que nadie ejecuta es una promesa, no una barrera.

### Y el segundo agujero: **nadie ejecuta el barredor**

`comprobar-claves-bd.mjs` no aparece en `package.json`, ni en un test, ni en CI: sólo se
autorreferencia. Era un guard **manual**, que hay que acordarse de correr en los cuatro árboles.
Por eso, si la credencial hubiera aparecido, «nada lo habría detectado» — sería literalmente
cierto.

## ③ El preflight de SCRUM-395: confirmado, **no mira a qué base va**

Compara **rama declarada vs rama real** (`compararRama`) y clasifica **sentencias SQL**
(`_clasificador-sql.mjs`). Ni una referencia a host, base, `parseBDSegura` ni `DATABASE_URL`. Es
la puerta correcta para *«¿estoy en la rama que creo?»* y no pretende ser la de *«¿contra qué base
voy?»*. La sospecha era correcta.

## Lo construido — se vigila por **DESTINO**, no por nombre

Ésta es la decisión de diseño del ticket, y sale de la frase del encargo: *un guard que sólo
vigila las claves que le enseñaron deja pasar justo la que no conoce*. Una lista de nombres
prohibidos se esquiva renombrando la variable a `DATABASE_URL_PROD`, `URL_BUENA` o `TMP_1`. **El
host de producción es el mismo se llame como se llame la clave.**

* `comprobarCredencialDeProduccion(clave, url, worktree)` — PURA. `PRODUCCION_EN_ARBOL` si el host
  es el de producción; `NO_PUDE_RESOLVER` si la URL no se puede leer (**nunca `OK`**: no se puede
  afirmar que no sea producción algo cuyo destino no se llegó a leer). `HOST_PRODUCCION` sale de
  `DESTINOS_ESPERADOS.DATABASE_URL.host`, para no crear una segunda verdad que mantener.
* `clavesDeConexion(env)` — decide por el **valor** (prefijo `postgres://`), no por el nombre. De
  paso acota lo que el barrido toca: de un `.env` lleno de secretos —tokens de Meta, claves de
  Stripe— sólo se leen los valores que YA son URLs de base. Ninguno de los demás se parsea ni
  puede acabar en un mensaje.
* El barrido de `comprobarEsteArbol` recorre **todas** las cadenas de conexión y suma fallo por
  cada una que vaya a producción. La comprobación de coherencia de SCRUM-383 **se conserva
  entera**: son dos preguntas y ninguna sustituye a la otra.
* `raiz` inyectable, para poder ejercitar los cuatro worktrees sin tenerlos delante ni leer un
  solo `.env` real.
* **El suelo se amplía**: sin ninguna cadena de conexión leída, el barrido **falla declarándose
  ciego**. «No hay credencial de producción» y «no supe mirar» son el mismo verde y significan lo
  contrario.

## Verificado en rojo — las cuatro, por `$?`

**R1 — hoy NO cae, con el arreglo SÍ.** Con un `.env` **de prueba en el scratchpad** (credenciales
inventadas) que lleva las tres claves legítimas más una `DATABASE_URL` a `autorack`:

```
   claves: DATABASE_URL_STAGING, DATABASE_URL_DEV, DATABASE_URL_TESTS, DATABASE_URL
   guard de main    → fallos = 0   ⚠️  PASA EN VERDE
   guard SCRUM-418  → fallos = 1   ✅ CAE
```

Y el rojo **nombra worktree, clave y host**:

```
🔴 CREDENCIAL DE PRODUCCIÓN EN UN ÁRBOL DE TRABAJO.
  Worktree: cobroflash-b1
  Clave:    DATABASE_URL
  Apunta a: autorack.proxy.rlwy.net/railway  ← PRODUCCIÓN
```

**R2 — control positivo:** los tres destinos legítimos siguen pasando (`fallos = 0`,
`comprobadas = 3`, `conexiones = 3`), y el árbol principal también con su `DATABASE_URL_TESTS`
distinta. Comprobado además **clave a clave**, para que el verde no pueda venir de «no había nada
que mirar». `tests/scrum383-clave-vs-destino.test.mjs` sigue verde: no se tocó su semántica.

**R3 — no es un guard de ortografía:** `DATABASE_URL_STAGING` —nombre perfectamente legítimo—
apuntando a producción CAE, y apuntando a desarrollo sigue cayendo por SCRUM-383. Los dos guards
conviven y ninguno tapa al otro.

**R4 — suelo:** con el entorno vacío, `fallos > 0` y *«SUELO: no se leyó ni una sola cadena de
conexión»*. Y una URL ilegible da `no_pude_resolver`, no `OK`.

**Y el test mide algo:** neutralizado el barrido (`continue` antes de sumar el fallo), caen **3 de
10** —los tres que dependen de él— y los otros 7 siguen verdes porque miden otra cosa. La
inyección se verificó **en disco** antes de correr.

## Lo que NO se ha tocado

* **Ningún `.env`.** Son de la máquina del fundador: se leyeron para medir y no se escribió en
  ninguno. El `.env` de las pruebas es mío, vive en el scratchpad y lleva credenciales inventadas.
* **`comprobarClaveVsDestino` y `DESTINOS_ESPERADOS`**: intactos. Hay un test que fija que
  `DATABASE_URL` → producción sigue dando `cuadra`, para que nadie lo «arregle» ahí y rompa la
  coherencia declarada de la tabla.
* **`prisma/schema.prisma`**, el preflight de 395 y el clasificador de SQL: no se tocan.

## Lo que NO cubre — declarado

* **El barredor sigue sin tener quien lo ejecute sobre los `.env` REALES.** El test nuevo corre en
  `npm test` y vigila la LÓGICA con entornos sintéticos, que es lo que estaba sin vigilar; pero
  nada corre `comprobar-claves-bd.mjs` contra los cuatro `.env` de la máquina de forma automática.
  Hacerlo desde `npm test` rompería CI (donde no hay `.env`, el suelo salta con razón) y leer los
  otros tres árboles desde uno es tocar la máquina del fundador. **Queda como el hueco abierto de
  este ticket, y es el que de verdad convertiría esto en una barrera.** Propuesta: un hook de
  sesión, o un paso del arranque AA1.
* **Sólo se mira el host de producción.** Una credencial de staging en el árbol equivocado la caza
  SCRUM-383 por su nombre, pero una clave inventada apuntando a staging no la mira nadie.
* **Sólo `.env` y `process.env`.** Una URL escrita a mano dentro de un script no la ve este guard.

## Hallazgo de otro carril, reportado y NO tocado (regla 9)

**`CLAUDE.md` está desactualizado y contradice el código desde SCRUM-383.** Dice *«`.env` apunta a
PROD; dev usa `.env.local`»*: hoy ningún `.env` apunta a prod, ninguno tiene `DATABASE_URL`, y
`.env.local` no existe en ningún worktree. Esa frase es la que me hizo afirmar sin medir. Es
`CLAUDE.md` —derivado del máster, regla 35— y su cambio no es de este carril.

## Ficheros

* `scripts/_clave-vs-destino.mjs` — `comprobarCredencialDeProduccion`, `clavesDeConexion`,
  `HOST_PRODUCCION`, `PRODUCCION_EN_ARBOL` (añadidos; nada existente cambia de comportamiento).
* `scripts/comprobar-claves-bd.mjs` — barrido por destino, `raiz` inyectable, suelo ampliado.
* `tests/scrum418-credencial-de-produccion.test.mjs` (nuevo, 10 tests, **sin gate**).
* `docs/master/SCRUM-418.md` (nuevo) — esta entrada.
