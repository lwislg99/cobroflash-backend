# SCRUM-1393 · Quién vigila `main`, cuánto tarda en verse un rojo y qué se sirvió en producción sin verificar — medido, sin construir nada

**Medido contra:** `origin/main` = `6536e63e038ef36be9d61fc8057a649ff2af3149` · 2026-10-07T17:16:32Z

A9: aviso → cicatriz J3 «Puse en la misma fila una hora con el desfase de la máquina y otra en Z: el rojo salía legible una hora antes de entrar su commit.» — no se pudo comprobar: es un guion de evidencias que corre a mano fuera de la tanda; lo que queda es que `analiza.mjs` pasa toda hora por una sola función (`utc`) antes de imprimirla

J3 (jv-j3), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). **Es LECTURA:** el árbol
en el ancla, la API de GitHub (corridas, jobs, despliegues, reglas de `main`) y el rastro local del latido. No se
ha construido ningún vigía ni se ha tocado ningún workflow, test o guard, y no se ha transicionado el ticket. Los
datos se recogieron el 7-oct-2026 entre las 17:20Z y las 17:28Z. La ficha del encargo recorta el ticket: **su
«fase 1» (escribir un script) NO se hace aquí**; se mide y se traen las salidas, sin elegir.

## Tres premisas que no se sostienen, con su cita

1. **«Un rojo del CI estuvo 45 min sin que nadie lo viera» (título; run `36886780786`, `cadf00bc`).** Esa corrida
   está en `failure` y su job obligatorio está en VERDE (`salida-1`, control F). No es un caso raro: de las **243**
   corridas `failure` de `main` en 30 días, **220 tienen el obligatorio verde** (90,5 %), 22 lo tienen rojo y 1 no
   tiene jobs. El color de la corrida no dice nada del commit. El control ③ del ticket («`cadf00bc` tiene el CI en
   `failure` → el vigía tiene que nombrarlo») nombraría 220 corridas al mes que no son un rojo de `main`.
2. **«El tercer estado es el que hoy no existe» y «la primera tarea es comprobar si ya existe».** Existe, en dos
   sitios, y los dos son posteriores o del mismo día que el ticket: la sección MAIN del latido
   (`scripts/equipo/latido.mjs`, SCRUM-1356 y SCRUM-1385) dice «último con el obligatorio VERDE · N más nuevos sin
   veredicto (K con su corrida CANCELADA)», y `scripts/vigia-silencio-de-main.mjs` (`npm run vigia:silencio`,
   SCRUM-1324) cuenta por job lo que no llegó a ejecutarse. Ninguno de los dos está en la lista del ticket. Lo que
   falta no es el instrumento: es quién lo corre y a quién le llega (apartado ①).
3. **«El sistema tarda media hora en decirlo» (ficha del encargo).** Media hora tarda la corrida ENTERA. El
   veredicto del obligatorio se puede leer antes: en los 24 rojos, **9,6 min de mediana** desde el push (p90 27,
   máximo 47). Y «seis commits debajo»: en 30 días el máximo es **5**, la mediana 1, y 13 de 24 llevan alguno.

## ① Qué vigila hoy `main`, y cada cuánto

Población: los 8 workflows del ancla (`salida-2`, control a cero: 0) y los guiones de `scripts/` y `.claude/hooks/`
cuyo nombre habla de vigía, latido, despliegue o CI. Leídos enteros los que miran el CI de `main`; de los demás, la
cabecera.

| instrumento | quién lo dispara | cada cuánto, medido | qué ve del CI de `main` | qué NO ve |
|---|---|---|---|---|
| latido, sección MAIN (`latido.mjs`, hook `latido-arranque.mjs`) | el arranque de una sesión, o alguien a mano | 63 pasadas en 6 días en esta máquina; mediana 1,1 min entre dos (arrancan en tandas), **2 huecos de más de 8 h, el mayor de 103 h** | recorre las corridas por push desde la más nueva hasta el primer veredicto del obligatorio; avisa si ese primero es ROJO | un rojo que ya tiene un verde encima; el rojo de un job no obligatorio (a propósito); más de 20 corridas atrás. Llega al contexto de la sesión que arranca, no a una persona |
| `vigia-silencio-de-main.mjs` (`npm run vigia:silencio`) | nadie: ningún workflow lo invoca (`salida-2`; lo dice también `docs/master/SCRUM-1480.md`) | no deja rastro: no se puede saber cuándo corrió | por job: 5 rojos seguidos, o 22 corridas seguidas sin ejecutarse | **el rojo del obligatorio lo excluye de sus avisos** (línea 306: «ya para la cola»); un rojo suelto; el commit, porque mide rachas |
| `avisador-rojo.yml` | `workflow_run` del CI, al acabar en `failure` | con cada corrida roja | comenta en el PR ABIERTO de esa corrida | un push a `main` no tiene PR abierto: por lectura de `puerta-avisador-rojo.mjs` no avisa. No medido por efecto |
| `vigia-atascados.yml` | cron `0 */3 * * *` | — | PR atascados; `main` PARADO (48 h sin un merge) | el color del CI de `main` |
| `vigia-despliegue.yml` y el job «vigía del despliegue» de `ci.yml` | cron `0 */2 * * *`, y cada corrida | — | si producción sirve lo que hay en `main` | el CI: compara commits, no veredictos |
| `ci-de-la-rama.mjs` (`npm run ci:rama`) | alguien a mano | — | el CI de la rama que se le pida | nada por sí solo |
| hook `latido-cierre.mjs` | el cierre de una sesión | — | las ramas que ESA sesión empujó | `main` |

**Nadie recibe un aviso cuando el obligatorio cae sobre un commit de `main`.** Los dos instrumentos que lo leen
funcionan cuando alguien los corre; los tres que corren solos miran otra cosa. Y la frase «ya para la cola» no se
cumple: entre cada rojo y el verde siguiente hubo de 2 a 10 despliegues (107 en total), y commits nuevos encima en
6 de 24. En `main` el obligatorio no frena nada: los PR entran por el check de SU PR.

No leídos (por el nombre no miran el CI de `main`): `vigia-sesiones-jv.mjs`, `vigia-pasada.mjs` más allá de su
llamada, `_suelo-contra-main.mjs`, `abierto-con-trabajo-en-main.mjs` y `scripts/verificacion-s5/*`.

## ② Cuánto tarda en verse un rojo

Población: 1.135 corridas del CI por push a `main` del 7-sep al 7-oct, una por cada uno de los 1.133 commits de
primer padre (0 sin corrida; 2 commits con dos). Clasificadas por el JOB obligatorio, no por la corrida:

| lo que dijo el obligatorio de ese commit | commits |
|---|---|
| VERDE | 468 (41,3 %) |
| ROJO | 24 |
| corrida cancelada sin jobs (pendiente sustituido) | 406 |
| corrida con jobs, obligatorio cancelado a medias | 233 |
| corrida `failure` sin jobs | 1 |
| corriendo al tomar los datos | 1 |

De los **24 rojos** (`salida-1`, apartado D, uno por línea):

| medida | mínimo · p50 · p90 · máximo |
|---|---|
| push → rojo que se PUEDE leer | 3,9 · 9,6 · 27 · 47 min |
| commits sin veredicto propio justo debajo (el rojo es su primera prueba) | 0 · 1 · 3 · 5 |
| rojo legible → siguiente VERDE de `main` | 13,5 · 40,2 · 107,7 · 606,8 min |
| despliegues a producción entre que entra el commit y ese verde | 2 · 4 · 9 · 10 |

**Cuándo lo VIO alguien no se puede medir:** ni GitHub ni el repositorio guardan quién abrió una corrida. Lo único
con rastro es el latido de arranque, y sólo desde el 1-oct y en esta máquina: de los 4 rojos posteriores, **1 tuvo
alguna pasada mientras era el último veredicto (3 pasadas) y 3 no tuvieron ninguna**. Que una pasada corriera no
dice que la sesión leyera esa línea. La otra cota es la vida del rojo: 22 de 24 duraron menos de dos horas.

## ③ Qué pasa si nadie mira: lo que se sirvió en producción

Railway despliega cada commit de `main` sin esperar al CI. Medido: 1.125 despliegues en la ventana, 1.084 llegaron
a `SUCCESS`, todos commits de primer padre. De los 695 cuyo commit tuvo veredicto, **313 se sirvieron antes de
tenerlo**; del merge a servido pasan 4,6 min de mediana, y el veredicto tarda 8,3.

| lo que el CI de `main` dijo de ESE commit servido | despliegues | horas sirviendo |
|---|---|---|
| VERDE | 443 (214 de ellos, servidos después de saberse) | 501,6 (68,1 %) |
| nada: su corrida se canceló sin jobs o a medias | 618 | 229,1 (31,1 %) |
| **ROJO** | **21** | 5,4 (0,7 %) |
| `failure` sin jobs · corriendo | 1 · 1 | 0,2 |

**Sí ha pasado, 21 veces en 30 días:** un commit con el obligatorio en rojo sobre `main` estuvo sirviendo, entre
0,1 y 80 min cada vez. En 12 de las 21 el rojo ya se podía leer cuando empezó a servirse; en 9, todavía no.

La lectura más generosa (un verde de ese commit **o de uno posterior** cubre el árbol): 217 de 1.084 ya estaban
cubiertos al empezar a servirse (20 %), 263 se cubrieron mientras servían (5 min de mediana, 252,8 de máximo) y
**604 (55,7 %) fueron sustituidos por el despliegue siguiente sin haber estado cubiertos ni un minuto**. En horas:
86,9 de 736,2 (11,8 %) sirviendo algo que ningún verde de `main` cubría.

Lo que esto NO dice: cada uno de esos commits pasó el obligatorio en su PR. Pero las reglas de `main` tienen
`strict_required_status_checks_policy: false`: el PR se probó fusionado con la base que había entonces, no con el
`main` en el que entró. Y **no he clasificado los 24 rojos**: no sé cuántos son un defecto y cuántos un
intermitente o un cuelgue como el de #2272 de hoy.

## ④ La corrida `failure` sin jobs (pedido por el orquestador a mitad del encargo)

**Una en 30 días de `main`:** run `37654882700`, `965e3d05`, 7-oct 16:48:07Z, tocada por última vez 12,9 min
después. **Cero** en 907 corridas de `pull_request` del 24-sep al 7-oct (`salida-3`, control a cero: 0). Su commit
se desplegó y sirvió 0,1 h.

| | corrida normal en rojo | cancelada sin jobs (`36881969807`) | `failure` sin jobs (`37654882700`) |
|---|---|---|---|
| `status` / `conclusion` | completed / failure | completed / cancelled | completed / failure |
| jobs (`/jobs`, o `checkRuns.totalCount`) | > 0 | 0 | 0 |
| se distingue con UNA llamada | — | sí, por `conclusion` | **no**: es idéntica a las otras 242 `failure` |
| `gh run view` | sus jobs | la frase de la sustitución (SCRUM-1498) | «This run likely failed because of a workflow file issue» |

Se separa con dos llamadas (la corrida y sus jobs). Cómo la lee cada instrumento: la lista de Actions, **rojo**;
el latido, «sin veredicto» y sin contarla entre las canceladas; el vigía del silencio, job ausente. La causa no la
he buscado: es `ci.yml`, de S5.

## Las salidas, con su coste. No elijo

| salida | qué cubre | qué no | coste y de quién es |
|---|---|---|---|
| A · no construir nada: alguien corre el latido antes de cada parte | el rojo que esté vigente al mirar | el que nace y se tapa entre dos miradas (40 min de mediana de vida); la corrida sin jobs | 18 s por pasada. Es un compromiso de proceso, no un mecanismo |
| B · un workflow con `schedule` que corra el vigía y escriba en un issue | lo mismo que A, sin depender de una sesión | 22 de 24 rojos vivieron menos de dos horas, y el cron de GitHub ha dejado huecos de hasta 9,8 h (SCRUM-1324) | un workflow: S5 y fundador |
| C · reaccionar al final de cada corrida de `main` (como el avisador) mirando el JOB obligatorio | los 24 rojos, a los 10 min de mediana | los commits sin corrida propia: no hay evento que avise de lo que no corrió | un workflow: S5 y fundador. Ruido: 24 avisos en 30 días si mira el job; 243 si mira la corrida |
| D · que el despliegue espere al veredicto | que no se sirva un rojo ni un commit sin probar | — | cambia producción: fundador. Hoy sólo el 41 % de los commits tiene verde propio, así que choca de frente con SCRUM-1498. No he mirado si Railway lo permite |
| E · dejarlo como está, y escribirlo | nada | todo lo de arriba | cero. Lo medido hoy: 21 rojos servidos y el 11,8 % de las horas sin cubrir, en 30 días |

## Lo que NO he hecho y lo que NO he medido

- No he construido el `vigia:main` del ticket ni he tocado `latido.mjs` ni `vigia-silencio-de-main.mjs`.
- No he clasificado los 24 rojos (defecto, intermitente o cuelgue), ni he leído sus logs.
- No he medido el efecto del avisador sobre una corrida de `main`: lo afirmo por lectura del código.
- El rastro del latido es de UNA máquina; el equipo de Luis tiene el suyo y no lo veo.
- No he medido qué pasó en los días sin pushes ni antes del 7-sep. La ventana tiene 15 días anteriores a
  SCRUM-935b y 16 posteriores: son dos regímenes, y las cifras de arriba los mezclan.
- «Servido» es lo que Railway le cuenta a GitHub (`SUCCESS`), no una lectura de `yaqu.app/version` en cada momento.
- El cuelgue del obligatorio de #2272 (aparte, abajo) no lo he perseguido.

## De paso: el rojo de #2272 (SCRUM-1498) no es del PR

Job `112906403918`: «TANDA SIN VEREDICTO (SCRUM-858): 912 s sin escribir nada». 5.757 líneas ✔, 0 ✖, sin resumen.
El PR sólo toca `docs/`. Los dos PR vecinos en rojo de esa hora caen distinto (5 ✖ con nombre). Qué fichero se
colgó no está medido. Se lo pasé al orquestador, que es quien relanza.

## Errores propios

1. El de la línea A9: la primera salida mezclaba la hora local del commit con la hora en Z del veredicto. Lo vi al
   leer una fila en la que el rojo era anterior a su commit, antes de enviar nada.
2. Lancé un `cp` con un comodín sobre la carpeta de la instalación del equipo hacia un directorio que no existía,
   con los errores tirados: no copió nada y no dijo nada. Lo repetí con el único fichero que hacía falta.
3. Agrupé las corridas del avisador por rama para ver qué hace con `main`: en un `workflow_run` la rama es siempre
   `main`, así que la cuenta no decía nada. La descarté; por eso esa fila del censo va «por lectura».

## Cómo se repite

Todo está en `docs/master/evidencias/SCRUM-1393/`. Sin red: `node docs/master/evidencias/SCRUM-1393/analiza.mjs`
(`salida-1`), `disparos.mjs .` (`salida-2`) y `cero-jobs.mjs <runs.json>…` (`salida-3`). Para datos nuevos:
`recoge.mjs push|pull_request <desde> <hasta> <salida.json>`, `jobs.mjs <runs.json> <salida.json>` (los dos son los
de SCRUM-1498, sin cambiar) y `despliegues.mjs <desde> <salida.json>`.

---

# SCRUM-1393 (segundo tramo, «1393b») · Los checks que nadie lee: los PR que entraron en `main` el 7 y el 8 de octubre

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T01:06:23Z

A9: aviso → cicatriz J3 «Di por verde un job que acabó en `success` sin ejecutar el paso que le da nombre: mi primer PR de control «verde entero» no había abierto el navegador.» — no se pudo comprobar: es un guion de evidencias que corre a mano fuera de la tanda; lo que queda es que `clasifica.mjs` lleva la lista de pasos que deciden y, en su control C3, un `success` fabricado sin ese paso tiene que salir CIEGO

J3 (jv-j3), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). **Es LECTURA:** la API de
GitHub (PR, corridas, jobs, check-runs, logs) y las reglas de `main`. No se ha tocado ningún workflow, test ni
instrumento, no se ha arreglado nada de lo encontrado y no se ha transicionado el ticket. La hora es la de la
cabecera `Date:` de GitHub. El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j3`: es
SCRUM-1498, carril de S5); seguí por orden de la ficha, y aquí no se construye.

## Lo primero

**ROJOS REALES DE CÓDIGO que entraron en `main` el 7 y el 8 sin que nadie los viera, entre los checks no
obligatorios: CERO.** De los 16 checks que GitHub da por `failure` o `cancelled`, 15 son CIEGO (el instrumento
no pudo juzgar) y 1 es un fallo de la infraestructura. Ese cero vale por lo que lleva detrás: tres sondas de
acuerdo, el cero derivado con su positivo, el PR fabricado sin corridas, el verde conocido y el rojo conocido.
**Y no es un «todo bien»: 15 veces hubo algo sin juzgar y nada volvió a mirarlo.**

## La pregunta y la respuesta

**¿Cuántos de los PR que entraron en `main` el 7 y el 8 de octubre tienen algún check NO obligatorio en `failure`
o `cancelled`?** **15 de 53.** Son 16 checks: 12 `failure` en 12 PR y 4 `cancelled` en 4 PR (el #2261 lleva uno
de cada).

Y lo que cambia la lectura, con los 16 logs leídos (`salida-2-logs.txt`): **ninguno de los 12 `failure` es un
defecto demostrado del código que entró.** GitHub tiene dos colores; por dentro son tres estados:

| lo que dice GitHub | lo que dice el log | checks |
|---|---|---|
| `failure` | **ROJO de verdad** (una mutación MUDA, un test que cae) | **0** |
| `failure` | **CIEGO**: el instrumento dice que no pudo juzgar (meta-guard con `mudas 0` y alguna ciega o un fichero muerto; constancia «NO PUDE PREGUNTAR») | 11 |
| `failure` | fallo de la operación, no del código (GitHub devolvió un error al armar el auto-merge) | 1 |
| `cancelled` | **CIEGO**: el job tocó su techo de 45 min tras 36-44 min sin escribir nada | 4 |

Los 15 CIEGO, por causa y sin agrupar, porque cada una es un arreglo distinto: **8** checks por la mutación de
`scrum859`; **1** por `vigia-atascados` (3 mutaciones ciegas dentro de ese único check, #2284); **1** por un
fichero muerto al mutar, `scrum834` (#2282); **1** constancia del ALTER que no pudo preguntar a producción
(#2285); **4** trinquetes de zona en su techo. 8 + 1 + 1 + 1 + 4 = 15.

**No es que nadie los lea por descuido: es que NO SE PUEDEN LEER ANTES.** **14 de los 16 acabaron DESPUÉS del
merge de su PR**, entre 3,3 y 34,7 min después: el auto-merge entra en cuanto el obligatorio sale verde (11,1
min de mediana en estos 53) y el meta-guard (21,3) y el trinquete (17,3, o 45 si se cuelga) terminan más tarde. Y **los 15 PR
tienen 0 comentarios**. Los otros dos (#2234 y #2285) sí estaban en rojo al mergear, 654,1 y 13,6 min antes.

La instrucción «lee también el meta-guard y el trinquete antes de dar por entregado» **era imposible de cumplir
en 14 de 16 casos.** El orquestador `cobroflash-backend-90`, que la llevaba dos días repartiendo, pide que conste
como error SUYO y no de las sesiones (mensaje del 8-oct, tras leer esta medición). Quién abrió qué check, en
cambio, no se puede medir: ni GitHub ni el repositorio lo guardan.

## Población y sondas

53 PR con base `main` y `merged_at` entre el 6-oct 22:00Z y la recogida (8-oct 01:06:23Z): los días 7 y 8 de
Madrid, 46 y 7. El primero entró a las 06:43:02Z del 7 y el último a las 00:54:26Z del 8. De la PUNTA de cada uno:
159 corridas, 436 jobs contando todos los intentos (424 en el último intento), 8 nombres de check. Ningún PR sin
corridas, ninguna corrida con 0 jobs, ningún check ausente.

- **Segunda sonda** (`commits/<sha>/check-runs`, otra puerta de la API): 436 de 436 con la misma id y la misma
  conclusión; 0 sólo en una de las dos.
- **Tercera sonda** (el primer padre de `main` en la ventana, por git): 53 commits, los 53 `merge_commit` de la
  API están entre ellos, y ningún número de PR de los asuntos falta en la API ni al revés.
- El nombre del obligatorio se LEE de las reglas de `main` (`datos-reglas-main.json`): «build + tests (con banco
  desechable)». En los 53 está en verde en su último intento (en #2264 y #2272, tras un primer intento en rojo).

## Los tres controles

1. **Cero derivado, corrido antes de dar el número** (`salida-1-checks.txt`, apartado C). La misma función que
   cuenta los hallazgos da **0** con un nombre de check que no existe (el más largo de la población más « +1») y
   **0** con el PR mayor de la población más uno (#2294); y con el nombre y el PR reales de los que se derivan da
   1 y 3. Un PR fabricado sin corridas da 0 VERDE y 8 CIEGO de 8. Ningún número va escrito a mano.
2. **Un PR que se sabe verde entero: #2292.** El método lo da por verde entero; `gh pr checks 2292` (sonda
   independiente) da `pass` en los siete que corren, con el navegador 10 min 46 s; y el log de su meta-guard
   dice «vivas 520 · mudas 0 · ciegas 0 · ficheros muertos 0». El rojo conocido, #2281, sale en la lista.
3. **Verde, ROJO y CIEGO.** Jobs fabricados (C3): `cancelled`, sin acabar y `success` con su paso saltado dan
   CIEGO; `failure`, ROJO; `success` con su paso, VERDE.

## La lista: PR, check, conclusión de GitHub y lo que dice su log

| PR | check | GitHub | acabó respecto al merge | lo que dice el log |
|---|---|---|---|---|
| #2234 | abrir-pr-y-armar-automerge | failure | 654,1 min antes | «GraphQL: Something went wrong» al armar el auto-merge |
| #2240 | meta-guard | failure | 6,0 min después | vivas 509 · mudas 0 · ciegas 1 (`scrum859`) |
| #2247 | meta-guard | failure | 13,9 min después | vivas 509 · mudas 0 · ciegas 1 (`scrum859`) |
| #2251 | meta-guard | failure | 4,4 min después | vivas 515 · mudas 0 · ciegas 1 (`scrum859`) |
| #2257 | trinquete de zona | cancelled | 31,5 min después | 44,4 min de silencio antes de medir la primera zona |
| #2259 | meta-guard | failure | 11,5 min después | vivas 515 · mudas 0 · ciegas 1 (`scrum859`) |
| #2261 | meta-guard | failure | 11,1 min después | vivas 517 · mudas 0 · ciegas 1 (`scrum859`) |
| #2261 | trinquete de zona | cancelled | 32,5 min después | midió Kiritimati (10.805 pruebas) y 38,1 min de silencio |
| #2263 | trinquete de zona | cancelled | 34,7 min después | midió Kiritimati (10.860 pruebas) y 36,1 min de silencio |
| #2273 | trinquete de zona | cancelled | 29,6 min después | 44,4 min de silencio antes de medir la primera zona |
| #2277 | meta-guard | failure | 6,0 min después | vivas 519 · mudas 0 · ciegas 1 (`scrum859`) |
| #2281 | meta-guard | failure | 3,8 min después | vivas 519 · mudas 0 · ciegas 1 (`scrum859`) |
| #2282 | meta-guard | failure | 3,3 min después | vivas 519 · mudas 0 · ficheros muertos 1 (`scrum834`) |
| #2284 | meta-guard | failure | 11,9 min después | vivas 517 · mudas 0 · ciegas 3 (`vigia-atascados`) |
| #2285 | constancia del ALTER (informativo) | failure | 13,6 min antes | «NO PUDE PREGUNTAR: producción responde 520» |
| #2290 | meta-guard | failure | 7,7 min después | vivas 519 · mudas 0 · ciegas 1 (`scrum859`) |

Nombres completos de los checks: «meta-guard · los guards caen cuando deben» y «trinquete · ningún test nuevo
mide la zona de la máquina». Los id de job y las horas, en `salida-1-checks.txt`, apartado E.

Lo que se repite: **la mutación de `scrum859` sale ciega en 8 de 53 pasadas** (faltan 4 de sus 20 tests en la
pasada mutada), y en las otras 45 no; **el trinquete se cuelga en 4 de 53** (5 con el primer intento de #2272),
los cinco arrancados entre las 15:29Z y las 16:50Z del 7. Los 49 que salen bien tardan entre 11,0 y 18,8 min (mediana 17,3).

## Lo que este barrido encontró sin buscarlo: verdes que no midieron

| check | VERDE | ROJO | CIEGO | de 53 |
|---|---|---|---|---|
| build + tests (obligatorio) | 53 | 0 | 0 | 53 |
| meta-guard | 43 | 10 (por dentro: 0 mudas) | 0 | 53 |
| trinquete de zona | 49 | 0 | 4 cancelados | 53 |
| guards de navegador | 32 | 0 | **21: `success` sin el paso «Guards de navegador»** | 53 |
| constancia del ALTER | 52 | 1 (por dentro: no pudo preguntar) | 0 | 53 |
| vigía del despliegue | 0 | 0 | 53 `skipped` (su `if` sólo lo corre en `push`) | 53 |
| abrir-pr-y-armar-automerge | 52 | 1 | 0 | 53 |
| ¿este PR toca la zona roja? | 53 | 0 | 0 | 53 |

- **«guards de navegador» sale `success` en los 53, y en 21 no abrió el navegador**: el PR era sólo de docs y el
  workflow salta 7 de sus 15 pasos. Está escrito así a propósito; lo que no hay es forma de distinguirlo en la
  lista de checks: los dos salen `pass`. **Un check que dice «pasa» sin haber hecho su trabajo es peor que un
  rojo: fabrica confianza.** Y el vigía del despliegue se salta en 53 de 53. **Verdes enteros de verdad: 25 de 53**; 15 con algún `failure` o
  `cancelled`; los 13 restantes, verdes salvo ese navegador que no se abrió.
- La columna CIEGO de las dos últimas filas con contenido (21 y 53) es **por una condición escrita en el
  workflow**, y por eso NO está en los 15.

## Lo que ya tiene ticket (leído sólo el TÍTULO de cada uno, no su cuerpo ni sus comentarios)

`scrum859` ciega en el meta-guard: SCRUM-1321. `vigia-atascados` inestable al mutar: SCRUM-1100. El job de zona
que se cuelga hasta su techo de 45 min: SCRUM-1494 (equipo de Luis). Un check no obligatorio en `failure` que el
auto-merge deja entrar: SCRUM-963 (S5). Nadie vigila el silencio: SCRUM-1324. No he comprobado que lo de hoy sea
el mismo defecto que describe cada uno: coinciden el fichero y el síntoma.

## Lo que NO he medido

- **Quién leyó qué.** No deja rastro. «0 comentarios» no es «nadie lo leyó»; «acabó después del merge» sí es
  «nadie lo leyó antes de entrar».
- **Si una ciega esconde un defecto.** Una mutación ciega no dice que el guard caiga ni que no: 16 veces en dos
  días hubo algo sin juzgar, y nada volvió a mirarlo. Tampoco he mirado por qué `scrum859` pierde 4 tests.
- **Los 43 meta-guard verdes por dentro**: sólo el de #2292. Su `success` exige `mudas 0` y `ciegas 0` por código
  de salida, pero eso lo afirmo por los 11 logs leídos, no por el fuente del guion.
- **Sólo la PUNTA de cada PR.** Las corridas de puntas anteriores (canceladas al empujar encima) no están.
- **Sólo `main` no:** qué dijeron esos mismos checks sobre el commit de merge en `main` es el primer tramo de
  este registro, y no lo he cruzado con éste.
- **La lista de «pasos que deciden» está escrita a mano** y tiene una entrada. De los otros siete jobs sólo se
  juzga la conclusión: un `success` suyo que no hubiera medido nada pasaría por verde.
- Los dos intentos tapados del obligatorio (#2264, #2272) no son la pregunta; el de #2272 ya está en el primer tramo.

## Errores propios

1. El de la línea A9. Mi primera pasada daba 38 verdes enteros y elegí #2293 como control; al pedirle a
   `gh pr checks` que lo confirmara vi el navegador en 12 s. Eran 25, y el control pasó a ser #2292.
2. **Tres de los 15 son PR míos** (#2263, #2282 y #2290), y son parte del dato: entregué leyendo el obligatorio
   por nombre y dejé el meta-guard y el trinquete «sin leer», escrito así en mi propio traspaso. Que acabaran
   después del merge explica que no los leyera ANTES; no explica que no volviera a mirarlos. Los he leído hoy.
3. La primera salida decía «−654,1 min antes del merge»: signo y palabra a la vez. Corregido antes de entregar.
4. Un `grep -c` de `\r` me devolvió 5 al comprobar la cicatriz: contaba líneas con la letra «r». Lo medí por
   bytes (0), que es lo que mi memoria ya decía que hiciera.

## Cómo se repite

En `docs/master/evidencias/SCRUM-1393/checks-sin-leer/`. Sin red:
`node clasifica.mjs datos-pr.json datos-reglas-main.json datos-main-primer-padre.txt` (`salida-1-checks.txt`).
Con red: `node recoge-pr.mjs <desde ISO> <hasta ISO> <salida.json>` y
`node lee-logs.mjs datos-pr.json <carpeta fuera del árbol> 2292` (`salida-2-logs.txt`; baja 20 logs).
