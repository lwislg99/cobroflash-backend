# SCRUM-450 · el control negativo que le faltaba al guard del SHELL

**Medido contra:** `origin/main` = `022f9f982a29b58343f91e7a32fed74444b752ef` · 2026-08-10T20:14:31+01:00

**10-ago-2026** · sesión 1 · sin gate, corre en `npm test`

El día que el precache incorpore una ruta que sirve el servidor y no existe como fichero —y **H1 va
a añadir rutas, es literalmente su trabajo**— el guard del SHELL acusaría en falso. Y **un guard que
acusa en falso no se corrige: se desactiva.** Entonces nadie vigila el precache y volvemos al
escenario del fontanero en el sótano sin offline.

## PASO 0

* **`docs/master/SCRUM-450.md` no existía en `main`** (censo de SCRUM-388: `NADA`).
* **La premisa se sostiene**: `scrum274-shell-alineado.test.mjs` no tenía ninguna excepción para
  rutas servidas. Las dos apariciones de «servidor» en el fichero eran prosa, no mecanismo.
* **ENTRADA: no hay pantalla.** Es un guard.
* **MECANISMO: existe y es bueno.** El cuarto test de `scrum274` ya lee del fichero real, tiene dos
  suelos, separa directorio de fichero suelto y cae nombrando las rutas. **No había que
  construirlo: había que cerrarle un hueco.**

> ⚠️ La primera versión de este ticket decía que **no existía ningún control del precache**. Era
> falso, y se paró en PASO 0 sin escribir una línea. Este ticket es la reescritura con lo único que
> faltaba.

## Lo construido — DENTRO de `scrum274-shell-alineado.test.mjs`

**No se creó un fichero nuevo.** Un segundo censo del mismo `const SHELL` sería exactamente el
defecto que cerraron SCRUM-436 y SCRUM-447 esta semana.

### ① Cómo se declara una ruta servida — y por qué así

`SERVIDAS_POR_EL_SERVIDOR`: **lista explícita, con motivo por entrada**. Descartado el prefijo o el
patrón: un `startsWith('/api')` exceptuaría de golpe cualquier ruta futura que empiece así,
**incluida una escrita por error** — justo lo que el guard existe para cazar. Mismo criterio que el
`CENSO` de SCRUM-402 y las `ENMIENDAS` de SCRUM-427.

**Hoy está vacía**, porque hoy no hay ninguna ruta servida: 54 entradas en el SHELL, **0 que no
resuelvan a fichero de disco**.

### ② 🔴 El suelo del propio control negativo

Aquí estaba la dificultad real. **Una lista vacía hace verdad cualquier afirmación sobre sus
elementos**: un control negativo apoyado en el SHELL real diría «ninguna servida cae» sobre un
conjunto vacío — cierto, hueco y verde para siempre.

Por eso `rutasMuertas(rutas, excepciones)` se extrajo **pura sobre sus argumentos**, y el control se
ejercita contra un **corpus sintético** que siempre tiene una servida y una de disco. **Se prueba el
mecanismo, y el mecanismo funciona hoy aunque no tenga clientes.**

Con su propio suelo dentro: el corpus tiene que tener las dos clases **y la de disco tiene que
existir de verdad**; si el fichero real desapareciera, el control pasaría por el motivo equivocado.

### ③ `MINIMO_SCRIPTS` · 31 → 45

**Estaba descalibrado.** Se escribió cuando había 31 scripts y **hoy hay 51**, así que llevaba 20 de
margen. Seguía cumpliendo su trabajo —cazar al extractor ciego— pero ya no tocaba el suelo de nada.
Se recalibra a 45, dejando holgura para retirar alguna pantalla sin volver aquí, que es el criterio
que su comentario ya declaraba.

**Contado con:** leer los `<script src>` locales de `dashboard/index.html` y las entradas de
`const SHELL` en `public/sw.js` (que está en la **línea 19**; H0 lo situó en la ~23 y se movió en
tres días).

## Verificado en rojo — cuatro, cada uno con post-condición en disco

| mutación | lo que dijo |
|---|---|
| **se renombra un fichero precacheado** (`paidViaEtiquetas.js`) | *«EL SHELL PRECACHEA RUTAS QUE NO EXISTEN: `/dashboard/js/paidViaEtiquetas.js`»* — **la ruta exacta**, no «el precache falla» |
| **`const SHELL` cambia de nombre** (el suelo) | *«ESCÁNER CIEGO: no encuentro `const SHELL = [ … ];`… su verde no significaría nada»* |
| **la excepción deja de aplicarse** | *«una entrada declarada como SERVIDA está haciendo caer el guard. Es exactamente el falso positivo que lo condena»* |
| **la excepción se vuelve puerta trasera** (excluye por prefijo) | cae *«la excepción NO es una puerta trasera: lo NO declarado sigue cayendo»* |

**Control negativo:** un comentario añadido a `sw.js` **no** lo tira — 7/7 verde. Un guard que salta
con cualquier roce se desactiva igual que uno que acusa en falso.

## 🔴 El hueco que se declara, no se tapa

**Este censo comprueba que la ruta RESUELVE EN EL REPO. NO comprueba que el servidor la sirva con
200 en producción** — eso sólo se ve contra un despliegue real, y esta sesión no tiene producción.
Una ruta declarada en `SERVIDAS_POR_EL_SERVIDOR` queda, por definición, **fuera de toda
verificación**: se cree su motivo escrito. Es el precio de no acusar en falso, y se dice en vez de
vender vigilancia que no existe.

## Lo que NO se ha tocado

La política de qué se precarga (SCRUM-357) · **ninguna ruta del precache: ni una añadida ni una
quitada** · la forma en que `sw.js` declara la lista —el censo se adapta al producto, no al revés—
· IndexedDB y la cola (H3) · almacenamiento (H5) · `prisma/schema.prisma` · la estrategia de runtime
del service worker.

**El precache está sano hoy.** Esta tarea no arregla nada roto: prepara el guard para lo que viene.

## Ficheros

* `tests/scrum274-shell-alineado.test.mjs` — `SERVIDAS_POR_EL_SERVIDOR`, `rutasMuertas` pura,
  `aFichero` extraída, `MINIMO_SCRIPTS` recalibrado y tres tests nuevos.
