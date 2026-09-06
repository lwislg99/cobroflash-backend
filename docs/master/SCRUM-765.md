# SCRUM-765 · La puerta que nunca casaba, y los dos suelos que el instrumento no se exigía

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — el guard corre en `npm test`

**Medido contra:** `origin/main` = `00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T07:41:15+01:00

---

## PASO 0 — EL CONTROL QUE DECIDE, ANTES DE TOCAR NADA

`scripts/meta-guard-mutaciones.mjs` sostiene el requisito de entrega de toda la casa. Copiado a
otro nombre en el mismo directorio y ejecutado, **con el árbol de hoy y sin arreglar nada**:

| invocación | exit | reloj | mutaciones ejecutadas | líneas de salida |
|---|---|---|---|---|
| `node scripts/_copia-medicion-765.mjs` | **0** | **0,28 s** | **0** | **0** |
| `node scripts/meta-guard-mutaciones.mjs` | 0 | 76,0 s | **31** | 33 |

**Los dos salen con 0.** Un verde de tres décimas sobre un trabajo de 76 segundos, sin una sola
línea que lo delate.

---

## EL DEFECTO

El bloque de arranque preguntaba «¿me han ejecutado a mí?» así:

```js
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('meta-guard-mutaciones.mjs')) {
```

Medido con una sonda ejecutada en este árbol, en **las cuatro formas de invocación**:

```
argv[1]                : C:\Users\Javier Pereira\cobroflash-b5\scripts\_sonda-puerta-765.mjs
import.meta.url        : file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs
'file://'+argv1        : NO CASA
'file://'+argv1 (\->/) : NO CASA      ← la variante de scripts/backfill-job-assignees.mjs
pathToFileURL(argv1)   : CASA
```

**Tres diferencias a la vez**: la tercera barra, el sentido de las barras y el `%20` del espacio.
La primera mitad de la condición **no casa nunca en Windows**, así que el script arrancaba **sólo
por el respaldo** — y el respaldo compara por **nombre de fichero**.

🔴 **El respaldo no era una red: era lo que tapaba la avería.** Mientras estuvo puesto, la puerta
rota no se notaba, y por eso vivió desde el día que se escribió.

---

## LO QUE SE HIZO

### ① La puerta, comparando lo mismo con lo mismo

`pathToFileURL(argv[1]).href` construye la URL con las mismas reglas con las que Node compone
`import.meta.url`. **No se inventa nada:** seis scripts del árbol ya usaban esa forma
(`citar-*.mjs`, `diagnostico-dependencias.mjs`, `registro-de-lo-aprobado.mjs`). Esto unifica en la
forma que la casa ya había acertado, y vive en un sitio —
[scripts/_puerta-de-entrada.mjs](scripts/_puerta-de-entrada.mjs) — en vez de copiarse.

**El respaldo `endsWith()` se va con la avería.**

### ② SUELO ① — el censo no puede encoger en silencio

SCRUM-745 ya denunciaba la declaración **coja** (a la que le falta un campo). No cubría la
**borrada entera**: eso saca al guard del censo, el recuento baja de N a N-1 y el verde de al lado
se lee igual. Ahora hay trinquete: **20 guards · 54 declaraciones**, números que **sólo suben**.

Si alguien retira cobertura a propósito, baja el suelo **en el mismo commit** y el diff lo dice.

### ③ SUELO ② — cero mutaciones ejecutadas es CIEGO, no verde

Es lo que de verdad cierra el agujero, porque **arreglar la puerta no basta**: cualquier otro
camino que llegue al final sin mutar nada seguiría saliendo con 0.

**EJECUTADAS = VIVAS + MUDAS.** Las CIEGAS se descartaron *antes* de tocar el árbol: contarlas
convertiría «no supe medir» en «he medido».

### ④ `--solo-censo`

Abre la misma puerta y aplica los suelos **sin mutar nada**, en ~6 s. Existe para que se pueda
comprobar que la puerta abre sin pagar los minutos del trabajo entero — y es lo que ejercita el
test de punta a punta. **`npm run meta:mutaciones` no lo pasa:** el modo del CI sigue siendo el
trabajo completo, y el modo censo lo dice en voz alta en su última línea.

---

## LA VERIFICACIÓN QUE PIDE EL TICKET

| control | resultado |
|---|---|
| 🔴 **El que decide** — copia renombrada, ANTES | exit **0** en **0,28 s**, **0** mutaciones |
| ✅ **Positivo** — por su nombre real, ANTES | **31 vivas · 0 mudas · 0 ciegas**, 76,0 s |
| ✅ **Positivo** — por su nombre real, DESPUÉS | **31 vivas · 0 mudas · 0 ciegas**, 235,8 s |
| ✅ **Contraste** — importado como módulo, ANTES | **no arranca** (8 exports, ninguna mutación) |
| ✅ **Contraste** — importado como módulo, DESPUÉS | **no arranca** (13 exports, ninguna mutación) |

Y la MISMA copia renombrada que antes salía en 0,28 s con la boca cerrada, después del arreglo
**arranca**: 1,60 s y 9 líneas de censo (medido con `--solo-censo`, que abre exactamente la misma
puerta). La puerta ya no casa por el nombre, sino por el fichero — que es la prueba directa de que
el respaldo se ha ido.

---

## EL CENSO DE PUERTAS FRÁGILES (punto 3 del ticket)

Por **AST, no por `grep`**: la cabecera de `_puerta-de-entrada.mjs` escribe la forma prohibida
varias veces para poder explicarla, y un censo de texto se cazaría a sí mismo en su propia prosa
(el defecto de SCRUM-614/617).

**Población: 886 ficheros** `.mjs`/`.js` de `scripts/` y `tests/`. **Tres puertas frágiles**, una
de ellas la de este ticket:

| fichero | forma | respaldo | consecuencia medida |
|---|---|---|---|
| `scripts/meta-guard-mutaciones.mjs` | plantilla | `endsWith()` | **arreglada aquí** |
| `scripts/_prisma-sync.mjs` | plantilla | `endsWith()` | arranca sólo por el respaldo |
| `scripts/backfill-job-assignees.mjs` | plantilla + `.replace(\\→/)` | **ninguno** | su bloque de arranque **no se ejecuta nunca** en Windows |

**Control positivo del censo:** encuentra las tres formas fabricadas (plantilla, suma, y la
variante con `.replace()` dentro), **no** marca la forma buena, y **no** se caza en un comentario.
Y **seis** scripts del árbol ya usaban `pathToFileURL`, que es la prueba de que el censo distingue
lo frágil de lo sano en vez de marcar todo lo que se le parece.

### 🔴 Por qué las otras dos NO se han tocado (reglas 9 y 37)

`backfill-job-assignees.mjs` **escribe en una base de datos**. Arreglarle la puerta no es
cosmética: es **encender un backfill que hoy está apagado**. Eso lo decide el fundador con el diff
delante, no una sesión que venía a otra cosa. `_prisma-sync.mjs` es del mismo carril de BD.

Quedan **reportadas y bajo techo**: el guard exige que el árbol **no gane** puertas frágiles
(`TECHO_PUERTAS_FRAGILES = 2`, un número que **sólo baja**) y que el meta-guard no vuelva a ser una
de ellas. No es una lista blanca: nadie ha aprobado esas dos, están contadas.

---

## EL COSTE — Y POR QUÉ ESTE NÚMERO NO SE PUEDE DAR

Primera lectura: el trabajo completo pasaba de **76,0 s** a **235,8 s**, y eso parecía el precio del
cambio. **No lo es.** Repetido sobre el árbol final, con el mismo código y sin tocar nada entre
medias:

| pasada | mutaciones | reloj |
|---|---|---|
| antes del cambio | 31 | **76,0 s** |
| después, 1.ª medición | 36 | **235,8 s** |
| después, pasada 1 | 36 | **95,2 s** |
| después, pasada 2 | 36 | **239,0 s** |

**Dos pasadas del MISMO código sobre el MISMO árbol: 95,2 s y 239,0 s.** La dispersión de esta
máquina es más grande que la diferencia que se le quería atribuir al cambio, así que **con estos
números el coste del cambio no es medible**. El mismo censo de la frontera ha tardado hoy entre
**1,6 s y 12,7 s** sobre el árbol quieto: misma señal.

Lo que sí está medido es la cota superior del trabajo añadido: **sólo 5 mutaciones** tocan
TypeScript (5 de 36 cuando se midió; 8 de 54 en el árbol entregado), y emitir un fichero
cuesta **~6 ms** (1,7 s los 269). O sea **decenas de milisegundos**, no minutos. Pero eso es
aritmética sobre una parte, no la medición del total, y va dicho así.

---

## TESTS

- [tests/scrum765-la-puerta-y-el-suelo.test.mjs](tests/scrum765-la-puerta-y-el-suelo.test.mjs)

Los cuatro pares `argv[1]` / `import.meta.url` que usa son **los que imprimió la sonda real** en
este árbol, guardados como dato: así el guard no depende de que la máquina donde corra reproduzca
las cuatro formas. Y el último test **arranca el script de verdad** (`--solo-censo`), porque los
tests de función no habrían visto nunca una puerta que no abre.

## MUTACIONES DECLARADAS

| mutación | qué prueba |
|---|---|
| devolver la puerta a `` `file://${argv1}` `` | el defecto entero del ticket |
| aflojar `sueloDelCenso` a `>= 0` | que un guard menos no pasa en silencio |
| que `sueloDeEjecucion` acepte `>= 0` | que cero ejecutadas no sale verde |

---

## HUECOS DECLARADOS

- **El coste del cambio NO es medible con estos números.** Ver arriba: dos pasadas del mismo código
  sobre el mismo árbol dan 95,2 s y 239,0 s.
- La puerta se ha medido en **Windows**, en las cuatro formas de invocación de esta máquina. **No
  se ha medido en Linux ni en el CI**, donde `import.meta.url` y `argv[1]` no tienen las tres
  diferencias que causan el defecto — o sea que allí la forma vieja probablemente casaba, y por eso
  esto no se había visto nunca en un job.
- **No se ha medido** el caso de invocar el script a través de un enlace simbólico o de una ruta
  con distinta capitalización de unidad que la resuelta por Node: los dos valores salen de la misma
  cadena, así que deberían seguir casando, pero **eso es una predicción, no una medición**.
- Las dos puertas frágiles de `scripts/` **siguen rotas**: reportadas, contadas y bajo techo. La de
  `backfill-job-assignees.mjs` deja su script sin arrancar nunca en Windows.

---
---

# APÉNDICE · el rojo de CI de esta misma entrega (6-sep-2026)

**Medido contra:** `origin/main` = `00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T07:41:15+01:00

La entrega anterior declaraba este hueco: *«La puerta está medida en Windows. No en Linux ni en
CI. El caso de enlace simbólico o distinta capitalización de unidad no está medido: es
predicción.»* **CI midió la predicción y salió mal.** Dos rojos, y los dos dijeron algo.

## 🔴 ROJO 1 · el defecto estaba en MI SIMULACIÓN, no en la puerta

El guard llevaba pares `argv[1]`/`import.meta.url` **congelados** de una sonda de Windows y se los
daba a `ejecutadoDirectamente()`. En Linux una cadena `C:\Users\…` **no es una ruta absoluta**: es
un nombre de fichero relativo.

**Cuál de las dos causas era, medido — el espejo del rojo, en mi propia máquina:**

```
── PAR WINDOWS evaluado en win32 ──
   pathToFileURL(argv1) : file:///C:/Users/Javier%20Pereira/…/_sonda-puerta-765.mjs
   ejecutadoDirectamente: true
── PAR LINUX evaluado en win32 ──
   argv1                : /home/runner/work/cobroflash-backend/…/_sonda-puerta-765.mjs
   pathToFileURL(argv1) : file:///C:/home/runner/work/cobroflash-backend/…   ← le pega la unidad
   ejecutadoDirectamente: false
```

Mismo mecanismo, al revés. **Y CI aportó la mitad que decide**: en el mismo job rojo, el meta-guard
**ejecutó 42 mutaciones** en Linux. Un instrumento que ejecuta 42 mutaciones es un instrumento cuya
puerta ABRIÓ. Luego la puerta funcionaba en Linux y lo que fallaba era el test. **Era la segunda de
las dos causas.**

⛔ **Por eso el guard ya no simula nada.** Arranca `tests/_sonda-puerta.mjs` de verdad, en cada
forma de invocación, en la plataforma en la que corre. Nada congelado, nada que traducir.

## 🔴 Y AL MEDIRLO APARECIÓ UN DEFECTO REAL DE LA PUERTA — el hueco que yo había declarado

Node resuelve el módulo de **entrada** pasando por `realpath`. Con un enlace de por medio,
`import.meta.url` trae la ruta REAL y `argv[1]` la escrita. Medido en Windows con un junction al
repositorio, **el mismo fichero**:

```
argv[1]              C:\…\scratchpad\enlace-repo\scripts\_sonda-enlace-765.mjs
realpath(argv[1])    C:\Users\Javier Pereira\cobroflash-b5\scripts\_sonda-enlace-765.mjs
import.meta.url      file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/…
¿ABRE LA PUERTA?     false        ← el script no arranca y sale con 0 sin hacer nada
```

**El arreglo:** `realpath` a los dos lados y **una sola comparación**. Normaliza de golpe el
enlace, el sentido de las barras, el escapado, la mayúscula de la unidad y el nombre corto 8.3.
Con él, las **cinco** formas medidas (relativa · absoluta · barras invertidas · otro cwd · **a
través del enlace**) dan `true`, y los cinco controles negativos siguen dando `false`.

📌 **Se retiró la comparación de URL que había además.** Con `realpath` a los dos lados no puede
fallar sin que falle también la otra: ninguna mutación podría cazarla. Código al que ningún rojo
llega es decoración.

⛔ **Y no es el respaldo `endsWith()` por la puerta de atrás:** aquél comparaba por NOMBRE, y por
eso una copia renombrada colaba. Esto compara el MISMO FICHERO DE DISCO.

## 🔴 ROJO 2 · la ciega de `scrum738` era el JOB, no el guard

No era un defecto nuevo: era este instrumento negándose a certificar lo que no pudo medir. El job
`meta-mutaciones` llevaba un `checkout` **desnudo** mientras el de la tanda lleva `fetch-depth: 0`
desde SCRUM-388 — y el meta-guard corre esos mismos ficheros de guard.

Reproducido con clones locales, llamando a `censarTicket(684)`:

| forma del clon | veredicto | colisión | `scrum738` |
|---|---|---|---|
| repositorio entero | NO_MEDIBLE | 683 | **PASA** |
| superficial (checkout por defecto) | NO_MEDIBLE | AUSENTE | FALLA |
| superficial + `main` | NO_MEDIBLE | AUSENTE | FALLA |
| historia completa, UNA ref (`fetch-depth: 0`) | **NADA** | AUSENTE | FALLA |
| historia completa, UNA ref + `main` | NO_MEDIBLE | 683 | **PASA** |

**Hacen falta las dos cosas y ninguna basta sola.** Por eso el job lleva ahora `fetch-depth: 0`
**y** el `git fetch` de `main` — la misma línea que SCRUM-716b tuvo que añadirle al vigía, por el
mismo motivo medido. **No se ha tocado el guard de `scrum738`.**

## 📌 UNA MUDA QUE NO ERA UNA MUDA — hueco del contrato de SCRUM-745

Mi primera declaración `la comparación → return true` salió **MUDA**. Medida a mano, no lo era:

```
not ok 1 - tests\scrum765-la-puerta-y-el-suelo.test.mjs
  failureType: 'testCodeFailure'
  exitCode: 2
```

Con la puerta abierta de par en par, el `import` que ese fichero hace de
`meta-guard-mutaciones.mjs` **ejecuta su bloque principal dentro del proceso del test** — que es
justo para lo que la puerta existe— y el fichero **muere entero**. Ningún nombre de test llega a
reportarse, así que `cayo()` no encuentra el nombre declarado y dicta MUDO.

🔴 **El guard SÍ cae; lo que no cae es el test que la declaración nombraba.** Es un hueco del
contrato —*una mutación cuyo radio mata al fichero sale MUDA aunque el árbol se haya puesto
rojo*—, hermano del falso MUDO de SCRUM-748. **Va reportado, no arreglado aquí:** arreglarlo pide
un cuarto veredicto y eso no cabe en «cerrar el rojo». La declaración se cambió por una del mismo
valor y sin ese radio (el `catch` deja de fallar cerrado), verificada a mano: cae **sólo** el test
nombrado.

## Y un trinquete ajeno que había que subir, por su propio procedimiento

`tests/scrum702-suelo-misma-poblacion.test.mjs` topa cuántos ficheros leen una señal del entorno.
El guard nuevo lee `process.platform` para pedirle a `fs.symlinkSync` el tipo de enlace de
directorio de cada sistema (`junction` / `dir`). Tope **12 → 13**, declarado en su docstring como
pide su mensaje de fallo. **No condiciona ningún aserto**: el guard exige lo mismo en las dos
plataformas, y esa línea está justo para que el caso del enlace se pueda **probar** en las dos en
vez de saltarse en una.

## Tanda de cierre

| | |
|---|---|
| `npm test` | **5579 tests · 5491 pass · 0 fail · 88 skipped** |
| `frontera:dist` | 269 corresponden · 0 no · 0 sin dist · exit 0 |
| `meta:mutaciones` | **vivas 54 · mudas 0 · ciegas 0** · exit 0 · 198,6 s |

## Huecos que siguen abiertos

- **La puerta sigue medida sólo en Windows.** Las cinco formas y los cinco controles negativos son
  de esta máquina. Lo que Linux ha dicho hasta ahora es indirecto (42 mutaciones ejecutadas). **La
  confirmación es la próxima pasada de CI**, y así queda dicho en vez de darlo por hecho.
- **`--preserve-symlinks-main` no está medido.** Con esa bandera Node NO resuelve el `realpath` del
  módulo de entrada, y esta puerta compara rutas reales. CI no la usa; nadie del árbol la usa.
- **El YAML del workflow no lo valida nada local**: no hay parser en `node_modules` y no se añade
  una dependencia por esto (regla 36). Lo comprobado es que el bloque nuevo tiene la MISMA forma e
  indentación (columnas 6/10/6/8) que el del vigía, que lleva meses funcionando. **Su validez
  sintáctica la confirma CI.**
