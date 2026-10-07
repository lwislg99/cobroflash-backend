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
