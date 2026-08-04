# SCRUM-258 · TURNO-5: la nota del turno es de la SESIÓN, y soltar comprueba de quién es

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `57f6380a467f53340ea36f25c38cfb2e579de20b` · 2026-08-04T13:02:26+02:00
**Tanda:** 1225 tests, 1158 pass, 0 fail, 67 skipped

## Cuánto de esto lo resolvía SCRUM-253: **nada, y a la vez lo hace corto**

253 construyó la identidad de sesión (`host` + token del árbol de trabajo). Eso es el eje, sí —
pero 253 protege **tomar** el turno, y aquí no había identidad en ninguna de las dos piezas que
fallan: ni en la ruta de la nota, ni en el camino de **soltar**. Lo que 253 aporta es la
herramienta: con `tokenDeSesion()` ya hecho, la ruta se arregla en una línea.

**Y midiendo salió que 258 es mayor que su enunciado.** Tres cosas, no una.

## ① El enunciado: la nota es de la máquina

`%TEMP%\yaqu-turno-staging.json`, ruta fija. Un fichero por EQUIPO. Dos sesiones se lo pisan y la
primera se queda soltando a mano.

## ② La mitad que el enunciado no dice, y es peor

**No necesita que caduque nada:**

1. B lanza su tanda (turno libre) → `guardarNota` escribe la marca de B encima de la de A.
2. A ejecuta `turno:soltar`, por costumbre o desde un script de limpieza.
3. `leerNota` le devuelve **la marca de B**; el marcador de la BD *es* el de B, así que coincide.
4. **A suelta el turno VIVO de B.** En silencio, con la tanda de B escribiendo. El turno queda
   libre para un tercero: dos sesiones sobre la misma base — el desastre exacto que SCRUM-188
   existe para impedir, entrando por el fichero que era «una comodidad».

El paso 3→4 solo era posible porque `soltarLock` comparaba **la cadena del marcador y nada más**:

```js
if (marca !== marcaPropia) return { soltado: false }   // …y si coincide, suelta. De quien sea.
```

Quien llegara con la marca correcta soltaba, fuera suyo el turno o no. Y el `--marca` que la propia
ayuda documenta hace lo mismo con un copia-y-pega.

**La cabecera de `turno-staging.mjs` YA prometía «NO rompe locks ajenos».** Esto no es política
nueva: es esa promesa, comprobada. Quien sí puede romper un lock ajeno sigue siendo
`marcar-staging.mjs`, el único con esa responsabilidad.

## ③ Dos defectos vivos encontrados al observar, y uno era mío

* **`turno-staging.mjs` llamaba a `dueñoActual()` SIN IMPORTARLO.** Lo introduje yo en SCRUM-253:
  cambié el `const dueño = …` en cuatro ficheros y puse el import en tres. Llegó a `main` así, y
  `turno:tomar` reventaba con `ReferenceError` **con la suite en 1196 verdes**. No fue mala
  suerte: ningún test importa ni ejecuta ese CLI —hacerlo lanzaría acciones contra staging—, así
  que no había nada que pudiera verlo. Lo descubrí al ir a observar el hueco nº1 de 253, tecleando
  el comando.
* **El runner importaba `borrarNota` y no lo llamaba nunca.** Cada tanda dejaba una nota huérfana
  apuntando a un turno ya soltado.

## La decisión

**La ruta se deriva de la sesión:** `yaqu-turno-staging-<token>.json`, con el token del árbol de
trabajo (SCRUM-253). No sale de una variable de entorno ni de nada que el humano exporte — una
ruta que depende de que alguien se acuerde de algo es la misma clase de fallo que 253 le quitó al
dueño, con otro disfraz, y hoy mismo se descartó una rama entera por eso.

**Y la nota se describe a sí misma:** guarda de quién es, y `leerNota` **no devuelve una marca
ajena** aunque se la encuentre en su ruta. Una nota sin dueño (escrita por código anterior)
tampoco: no saber de quién es una marca es razón suficiente para no soltar con ella. La ruta
derivada hace el choque improbable; comprobar el dueño hace que un choque no sirva de nada. Dos
barreras, porque al otro lado está soltarle el turno a otra sesión mientras escribe.

**No se migra ni se borra el fichero viejo.** Mientras haya sesiones corriendo código anterior,
ese fichero sigue siendo suyo; tocarlo desde aquí sería pisar a quien todavía lo usa, que es
literalmente el defecto que este ticket cierra.

## Los dos huecos de SCRUM-253, cerrados

### ① La secuencia `turno:tomar` → tanda adoptando, observada contra staging real

El turno estaba libre. Desde `wt-258`, con el código de `main`:

```
✅ Turno TOMADO sobre la base "railway" para «scrum-258-observacion» (~20 min).
   MARCA=YAQU_STAGING lock:DESKTOP-T5MONF5.d92a7932bd@2026-08-04T10:47:18.322Z

🔒 turno de staging ADOPTADO en "railway" por «DESKTOP-T5MONF5.d92a7932bd» (caduca solo en 55 min).
   (ya era de esta sesión: lo tomaste con `turno:tomar` desde este mismo árbol. No se le ha quitado a nadie.)
```

La adopción funciona contra staging real. Los cuatro hijos salieron `exit=9` porque ese árbol no
tiene `dist/` construido — irrelevante para lo observado, que es el camino del turno. Y el «55 min»
confirma en vivo el TTL derivado de SCRUM-265 (45 + 10), que allí se dejó escrito como predicción.

**Observación aparte, sin arreglar:** la tanda **soltó** al terminar un turno que no había tomado
ella. Adoptar y soltar no son simétricos. No lo toco —el runner soltó algo que legítimamente
tenía— pero queda dicho: si alguien toma el turno a mano para 20 minutos y lanza una tanda por el
medio, se queda sin turno al acabar la tanda.

### ② ¿Queda algún turno con id del formato viejo (`host.PID`)?

**No.** Medido: el turno de staging está **LIBRE**, así que no hay ninguno vivo, ni viejo ni nuevo.
El último formato viejo que se vio fue `DESKTOP-T5MONF5.23680`, de las **09:05:54Z del 4-ago**
(tanda de `scrum-255-anidado-wa`); dejó de estar vivo al tomarse el turno a las 10:47. La
afirmación de 253 —«el conjunto se vacía solo»— queda confirmada.

Lo que **sí** sobrevivió al cambio de formato no fue un turno sino **una nota huérfana**, que es
exactamente lo que este ticket arregla.

## El guard nuevo, y por qué es de este ticket

Un script que ningún test ejecuta no tiene red, y eso acaba de costar un `ReferenceError` en
`main`. El guard hace análisis estático de **identificadores sin declarar** sobre los 261 `.mjs` de
`scripts/` y `tests/`: todo nombre referenciado tiene que estar importado, declarado en el fichero,
o ser un global. **Los globales se derivan de `globalThis`, no de una lista escrita a mano** — una
lista se queda vieja y entonces acusa a código correcto, que es el camino más corto a que un guard
se desactive.

**No distingue ámbitos a propósito.** Un nombre declarado en una función y usado en otra no se
detecta. A cambio no puede dar falsos positivos por ámbito: si el nombre no está declarado en
ninguna parte, no existe. Prefiero un guard que detecta menos y nunca miente a uno que grita por
casos legítimos. El caso del ticket cae de lleno en lo que sí detecta.

**Dos falsos positivos míos, cazados midiendo antes de entregar:** `import.meta` (el AST ve un
identificador `meta`; salían 122) y los `get merchant() {…}` de los dobles de test. Los dos
corregidos estructuralmente. Residuo final: **2 sobre 261 ficheros**, ambos en `e2e-critico.mjs`,
callbacks que corren **dentro del navegador** y llegan a `page.evaluate` a través de un `waitFor`
local — reconocerlos pediría análisis entre funciones. Se congela como censo, con las dos
condiciones de SCRUM-267: **no puede crecer, y si baja también falla.**

El segundo guard es el del ticket: **ningún script guarda estado en una ruta fija del temporal**.
`mkdtempSync` queda fuera **por su forma** —crea un directorio único en cada llamada, así que no
puede ser estado compartido—, no por estar en una lista.

## Verificado en rojo

* **La ruta vuelve a ser fija** → caen «la ruta es distinta por árbol» y el guard de estado por
  máquina.
* **`soltar` vuelve a comparar solo la cadena** → cae «EL CASO GRAVE» con su mensaje: se soltó el
  turno de otra sesión.
* **Se quita otra vez el import de `dueñoActual`** (el bug real que llegó a `main`) → cae el guard
  nuevo señalando `scripts/turno-staging.mjs:135`. **Y `node --check` pasa**, que es exactamente
  por qué nadie lo veía.

Las tres inyecciones verificadas como aplicadas y compilando; revertidas, árbol limpio.

## Lo que NO cubre

* **La nota huérfana anterior no se limpia.** `yaqu-turno-staging.json` (sin token) queda inerte en
  el temporal. Es deliberado: sigue siendo de quien corra código anterior.
* **El guard de identificadores no ve ámbitos** (arriba), y **no cubre `src/`**: TypeScript ya lo
  comprueba al compilar. Es para `.mjs`, que no pasan por `tsc`.
* **`soltarLock` admite que no le pasen dueño** para no romper a un llamador externo; lo que impide
  que los de esta casa se lo dejen es un guard derivado sobre las llamadas de `scripts/`.
* **La secuencia de la nota no se probó contra dos sesiones reales a la vez.** Se prueba con
  árboles de mentira y con la ruta real; montar dos sesiones concurrentes de verdad contra staging
  habría exigido el turno dos veces.

## Ficheros

* `scripts/_turno-nota.mjs` — `ficheroNota()` derivada de la sesión; la nota guarda su dueño;
  `leerNota` rechaza lo ajeno y lo sin dueño.
* `scripts/_staging-lock.mjs` — `soltarLock` acepta `dueño` y rechaza soltar lo ajeno (`motivo:
  'ajeno'`).
* `scripts/turno-staging.mjs` — **el import que faltaba**; pasa el dueño al soltar; mensaje propio
  para el turno ajeno.
* `scripts/test-staging-gated.mjs` — pasa el dueño al soltar y **llama a `borrarNota`**.
* `tests/_identificadores-sueltos.mjs` (nuevo) — el analizador, con los globales del runtime.
* `tests/scrum258-nota-por-sesion.test.mjs` (10, sin gate).
