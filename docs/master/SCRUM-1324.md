# SCRUM-1324 · Nadie vigila el silencio, sólo el rojo: censo de los jobs de `main` y un vigía que avisa

**Medido contra:** `origin/main` = `548d5148954b04559f43949f898cbff71a8010ee` · 2026-10-01T02:35:28Z
(J6 del equipo de Javier, sesión `jv-j6c`; umbrales aprobados por el orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum1324-nadie-vigila-el-silencio.test.mjs`

## Qué se entrega y qué NO

- **Se entrega:** el censo, un instrumento de sólo lectura (`scripts/vigia-silencio-de-main.mjs`,
  `npm run vigia:silencio`) y su test sobre el historial REAL de `main`.
- **NO se entrega, y es la mitad que falta:** que el aviso llegue solo a alguien. Hoy el vigía sólo
  habla si alguien lo lanza. Enchufarlo exige tocar un workflow, que afecta a los dos equipos y es
  decisión del fundador (§⑥). Hasta entonces es un instrumento, no un mecanismo.
- **No se hace obligatorio ningún check.** No se toca ningún workflow, ningún guard ni el camino de
  emisión.

## ① El censo

**Población:** 2.744 runs con rama `main`, del 20-sep 00:00Z al 1-oct-2026 02:06Z, de los 9 workflows
del repositorio. Jobs leídos en 2.743; 1 ciego (HTTP 502). 6 workflows tienen runs en `main`, con 11
jobs. El único check obligatorio es `build + tests (con banco desechable)` (ruleset de `main`, leído
con `gh api repos/…/rules/branches/main`): **10 jobs no obligatorios**.

Dos de los 10 son REACTIVOS («Avisador de PR en rojo», por `workflow_run`, 1.325 runs; «Claude Code»,
por `issue_comment`, 335) y no hablan del estado de `main`: saltarse es su estado normal (el avisador
se salta en 718 de 1.325). Quedan **9 jobs en 4 workflows** (1.084 runs), que son los que vigila el
instrumento. «Ejecutó» = terminó en `success` o `failure`.

Estado en `main` al cierre del historial (1-oct 02:06Z):

| job | obligatorio | ejecutó | ahora | rachas rojas en 11 días |
| --- | --- | --- | --- | --- |
| CI / guards de navegador | no | 160 de 487 | 🔴 35 seguidos desde 29-sep 00:14Z (47,5 h) | 35, 11, 10, 9, 4, 1 |
| CI / meta-guard | no | 190 de 487 | 🔴 31 seguidos desde 29-sep 09:54Z (37,8 h) | 31, 3, 3, seis de 2, veintitrés de 1 |
| CI / trinquete de la zona | no | 191 de 487 | verde | 3 y once de 1 (14 rojos, 7,3 %) |
| CI / constancia del ALTER | no | 251 de 487 | verde | 14 (24-25 sep, 24 h) |
| CI / vigía del despliegue | no | 254 de 487 | verde | 12 (25-sep, 7,6 h) y siete de 1 |
| Conflicto de registro / resolver | no | 445 de 487 | verde | ninguna (0 rojos) |
| Vigía de PR atascados (cron) | no | 52 de 52 | verde | ninguna |
| Vigía del despliegue (cron) | no | 55 de 56 | verde | 4 (24-25 sep, 16 h) y una de 1 |
| CI / build + tests | **sí** | 202 de 487 | rojo ×1 (`e9e71cab`) | una de 2 y nueve de 1 |

Lo que dice:

1. **El meta-guard no era el único ni el más viejo.** «Guards de navegador» llevaba 35 ejecuciones
   seguidas en rojo, 9 h 40 min más que el meta-guard (SCRUM-1313 lo tenía fichado, sin fecha).
2. **Dos sondas, un número.** El «31 de 31 en `main`» del meta-guard coincide con el de J3b, que lo
   midió leyendo logs; aquí sale de las conclusiones de job.
3. **No era la primera vez.** En 11 días hubo 7 rachas de 9 o más en jobs no obligatorios (35, 31,
   14, 12, 11, 10, 9). Cinco se cerraron solas en 5-26 h sin que nada avisara.
4. **El silencio es lo normal.** De 488 runs de CI en `main`, 230 no tienen ningún job y 2 más no
   ejecutaron ninguno: **232 de 488 commits de `main` no pasaron por el CI** (GitHub sustituye el run
   que espera; SCRUM-935b, opción B). Cada job se ejecuta en el 33-52 % de los commits. El hueco más
   largo: 21 runs seguidos sin meta-guard ni trinquete (21-sep 07:03Z → 08:27Z).
5. **Los cron pierden disparos.** «Vigía de PR atascados» (cada 3 h): 51 runs de 87 esperados.
   «Vigía del despliegue» (cada 2 h): 55 de 132. Hueco máximo entre dos runs: 9,8 h.

## ② Los umbrales, derivados

No se eligen: los calculan `umbralDeRojos`, `umbralDeRunsSinEjecutar` y `umbralDeHorasDeCron` sobre el
historial, y el test cae si la constante deja de coincidir con el dato.

| umbral | valor | de dónde sale |
| --- | --- | --- |
| rojos seguidos (job de push) | **5** | el menor N con menos de 1 racha por puro azar al mes en el peor job |
| runs sin ejecutar (job de push) | **22** | el hueco más largo visto en operación normal (21) + 1 |
| horas de un cron sin run, o sin verde | **10** | el mayor hueco entre dos runs de un cron (9,8 h), hacia arriba |

**Rojos.** El peor job es el meta-guard: fuera de su racha larga falla 41 de 159 (25,8 %; es la pérdida
de eventos de SCRUM-908, y coincide con el 26 % de J3b). A su ritmo (~17 ejecuciones al día), las
rachas esperadas por azar en 30 días son: N=2 → 11,5 · N=3 → 4,8 · N=4 → 1,7 · **N=5 → 0,44**. Por otro
lado, la distribución de las 73 rachas medidas (incluidos los dos reactivos) es 53 de 1, 7 de 2, 3 de
3, 3 de 4, y salta a 9 o más: el corte natural cae en el mismo sitio. El día que SCRUM-908 se arregle,
el umbral baja solo al regenerar el historial.

**Lo que N=5 pierde, declarado:** las rachas de 4. La de «guards de navegador» del 22-sep duró 0,7 h.

**El cron va en horas** (aprobado por el orquestador): da 4-5 runs al día y «5 seguidos» ahí es un día
entero. Dos preguntas: ¿cuánto hace del último run? (silencio) y ¿cuánto hace del último verde, con
2 rojos o más? (rojo). El «2» no es un umbral afinado: es el control positivo del ticket —uno que falla
una vez y se recupera no avisa— aplicado a un job lento.

## ③ Con los datos de entonces: qué habría avisado

`docs/master/evidencias/SCRUM-1324/barrido.mjs` pasa el vigía por 1.148 instantes del historial (uno
por run más una rejilla de 30 minutos). Salida en `barrido.txt`. **8 episodios, ninguno más:**

| aviso | habría saltado | real |
| --- | --- | --- |
| guards de navegador | 20-sep 19:30Z | 17,3 h en rojo |
| Vigía del despliegue (cron) | 25-sep ~04:20Z | 16 h en rojo |
| constancia del ALTER | 25-sep 12:44Z | 24 h en rojo (5 ejecuciones tardaron 20 h en llegar) |
| vigía del despliegue (CI) | 25-sep 13:24Z | 7,6 h en rojo |
| guards de navegador | 25-sep 17:03Z | 26 h en rojo |
| guards de navegador | 28-sep 18:50Z | 4,7 h en rojo |
| guards de navegador | 29-sep 09:54Z | seguía vivo el 1-oct |
| **meta-guard** | **29-sep 10:52Z** | **58 min después del primer rojo; lo real fueron 40 h** |

Los instantes dan por sabida la conclusión de un run en el momento en que se crea; en realidad llega
entre 1 y 45 minutos después.

**Positivos, medidos en el mismo barrido:** el resolver (446 verdes) no avisa nunca; el trinquete (14
rojos en 12 rachas, la mayor de 3) tampoco; las 31 rachas cortas del meta-guard, tampoco; el cron que
falló una vez el 30-sep y se recuperó, tampoco. **El silencio no saltó ninguna vez en el historial
real**, porque su umbral es el máximo observado más uno.

## ④ El silencio

Tres formas de callar, las tres cubiertas:

- **El job desaparece del run, se salta o se cancela** → cuenta como run sin ejecutar. A los 22: SILENCIO.
- **El workflow deja de dispararse** → no hay runs nuevos que mirar. El vigía lee los últimos 100
  commits de `main` y suma los que son más nuevos que el último run del workflow. Si no puede situar
  ese run en la lista, no inventa la cuenta y lo dice en el informe.
- **El cron no llega** → más de 10 h sin un run suyo.

La lista de jobs (`JOBS_DE_MAIN`) es DECLARADA, no derivada de los runs recientes: derivada, un job
borrado dejaría de echarse de menos al salir de la ventana. Un job que corre en `main` y no está en
la lista sale como `SIN-DECLARAR` y el vigía sale 1.

No hay caso real de un job desaparecido en la ventana. El del test se CONSTRUYE quitando el job de 22
runs reales seguidos; con 21 no avisa. El silencio del check obligatorio también avisa; su rojo no
(ése ya para la cola).

## ⑤ Cómo se comprobó

- **Test:** `tests/scrum1324-nadie-vigila-el-silencio.test.mjs`, 8 casos, 8 pasan. Sin red.
- **Mutaciones:** `docs/master/evidencias/SCRUM-1324/mutar.mjs`, salida en `mutaciones.txt`. Base
  verde antes y después; **15 de 15 muertas**; el fichero mutado queda idéntico por sha256. Las dos
  de umbral de silencio (22 → 23, 10 → 11) las caza sólo el caso ②: los bordes de ⑤ y ⑥ salen de la
  constante, así que se mueven con ella.
- **Repetido desde cero:** una segunda recogida de GitHub, la misma noche. De las 1.084 líneas del
  historial, **1.082 idénticas**; las 2 que cambian son el run que dio 502 (ahora leído: `success`) y
  el que estaba en marcha (ya terminado). Reducir dos veces la misma recogida da el mismo sha256, y
  el barrido, dos veces, también.
- **En vivo** (1-oct 02:35Z, `main` en `548d5148`, 260 runs, 0 sin leer): avisa de «guards de
  navegador» (36) y «meta-guard» (32); el trinquete lleva 1 rojo (`eabcb2d5`) y no avisa. Sale 1.

Reproducir, desde la raíz:

    node docs/master/evidencias/SCRUM-1324/recoger.mjs <dir fuera del árbol> 2026-09-20
    node docs/master/evidencias/SCRUM-1324/reducir.mjs <dir>/runs.json <salida.jsonl>
    node docs/master/evidencias/SCRUM-1324/barrido.mjs
    node docs/master/evidencias/SCRUM-1324/mutar.mjs
    node scripts/vigia-silencio-de-main.mjs

`recoger.mjs` hace unas 2.800 peticiones de sólo lectura con `gh`; el vigía, unas 270.

## ⑥ Dónde enchufarlo — DECISIÓN DEL FUNDADOR, sin aplicar

| opción | qué toca | coste | lo que no resuelve |
| --- | --- | --- | --- |
| (a) un paso en `vigia-atascados.yml` | un workflow del equipo de Luis | ~270 peticiones y ~1 min cada 3 h; reutiliza su issue y su «comenta sólo si empeora» | ese cron pierde el 41 % de sus disparos: pasaría cada ~5 h |
| (b) un workflow nuevo con `schedule` | un fichero nuevo en `.github/workflows/` | lo mismo, con issue propio | es otro cron: su propio silencio lo tendría que vigilar otro |
| (c) un job más en `ci.yml`, en el push a `main` | `ci.yml` | corre en cada merge que sobreviva a la sustitución | su resultado sería otro job no obligatorio en rojo: lo que nadie lee |
| (d) sin workflow: el orquestador lo lanza al arrancar | nada | ~1 min y ~270 peticiones de la cuota de `gh` | depende de acordarse, y sólo cubre al equipo que lo lance |

Recomendación de J6c: (a) o (b). (c) reproduce el defecto. (d) sirve desde hoy como parche y no es un
mecanismo. Actions no cuesta dinero mientras el repositorio sea público.

## ⑦ Lo que no cubre

- **Los PR.** Mide `main`. El PR que rompió el meta-guard (#1951) ya lo decía en su propio check, 2 de
  2, y entró: ése es el otro defecto del ticket (un aviso que no obliga) y sigue abierto.
- **El MUDO por dentro.** Un job que termina en `success` sin comprobar nada sale verde aquí.
- **Los dos workflows reactivos.** Fuera a propósito (§①).
- **La ventana.** 11 días. El umbral de 22 y el de 10 h son máximos observados: un día más tranquilo
  o un cron más lento que cualquiera de esos 11 daría un aviso falso.

## ⑧ Hallazgos que no son de este ticket (se reportan, no se arreglan)

- 232 de 488 commits de `main` sin CI: «`main` está verde» significa menos de lo que parecía.
- Los cron de GitHub entregan el 59 % y el 42 % de sus disparos.
- El trinquete de la zona falló en `main` en `eabcb2d5` (1 rojo, bajo umbral).
- El workflow `exp388.yml` sigue «active» en la API con su fichero ya borrado del árbol.

## ⑨ Errores propios

1. **Dije al orquestador «11,1 h → 12 h» para el cron y el dato es 9,8 h → 10 h.** El 11,1 era el hueco
   entre dos EJECUCIONES y contaba como hueco el run que no pude leer (502). Lo cazó recalcular el
   umbral con la función que usa la regla, en vez de con la exploración. Lo fija el caso ②.
2. **La primera regla del cron («horas sin verde») avisaba de un fallo suelto que se recuperó**, justo
   lo que el ticket prohíbe. El barrido por instantes de run no lo veía; lo destapó añadir la rejilla
   de 30 minutos. Lo fijan los casos ④ y ⑥, con el caso real del 30-sep.
3. Un comentario del script decía «10 jobs» y son 9; corregido antes del primer commit.

## SCRUM-1324b · El PR del vigía cayó por dos guards del CI: el vigía duplicaba lo que ya existía

**Medido contra:** `origin/main` = `a5b62893c7616ddd19626afe5921eec67c691e9e` · 2026-10-01T03:36:57Z
(J6 del equipo de Javier, sesión `jv-j6e`, relevo de J6c; encargo del orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum853-avisador-solo-obligatorio.test.mjs`

### Qué cayó, leído del log y no de los títulos

PR #2047, run `36807859456`, job «build + tests» (`110196119184`): 2 casos en rojo, los dos por lo
que la rama AÑADÍA. Reproducidos en local sobre la rama con `main` mergeado, antes de tocar nada:
52 casos, 50 pasan, caen esos mismos 2.

| guard | qué dijo | qué había en `scripts/vigia-silencio-de-main.mjs` |
| --- | --- | --- |
| `tests/scrum853-avisador-solo-obligatorio.test.mjs` · «CENSO · … UN solo sitio lee la lista de obligatorios» | «hay copias del lector: `scripts/vigia-atascados.mjs`, `scripts/vigia-silencio-de-main.mjs`» | una segunda lectura de las reglas de `main`, escrita a mano |
| `tests/scrum702-suelo-misma-poblacion.test.mjs` · «no entra NINGUNA dependencia del entorno nueva sin declararla» | «hay 20 ficheros leyendo una señal del entorno y el tope es 19» | elegía el binario de `gh` mirando la plataforma |

El encargo traía la segunda como «usa una variable de entorno sin declararla». Medido, no es una
variable: es la lectura de la plataforma. La diferencia decide el arreglo, porque la única forma de
«declararla» es subir el tope dentro del propio guard, y eso no se hizo.

### El arreglo: cambia el vigía, no los guards

- **Los obligatorios** los lee `checksObligatoriosDeReglas`, importada de `scripts/vigia-atascados.mjs`,
  que es el lector que `scrum853` protege. Y es mejor que la copia: devuelve `null` si no pudo leer la
  lista, y con `null` el vigía sale CIEGO. La copia devolvía una lista vacía, que se lee como «nada es
  obligatorio» y habría avisado también del rojo de «build + tests».
- **El `gh`** ya no se elige según la máquina: se prueban en orden los de `RUTAS_GH`
  (`scripts/equipo/ancla.mjs`, SCRUM-360), igual aquí que en CI. El que no existe deja paso al
  siguiente; el que existe y falla, no.
- **No se tocó** ningún guard, ningún tope ni ningún workflow. El tope de `scrum702` sigue en 19.
  El workflow nuevo con `schedule` (opción (b), decidida por el fundador en el comentario 17719 de
  Jira) NO entra en este PR.

### El negativo: los guards siguen cayendo

`docs/master/evidencias/SCRUM-1324/negativos.mjs`, salida en `negativos.txt`. Base verde antes y
después (44 casos de los dos guards). **4 de 4 cazados, cada uno por el guard esperado y sólo por él:**

| negativo | cae |
| --- | --- |
| N1 · el vigía vuelve a copiar la lectura de las reglas | el CENSO de `scrum853` |
| N2 · el vigía vuelve a elegir `gh` según la plataforma | el tope de `scrum702` |
| N3 · OTRO script nuevo copia la lectura | el CENSO de `scrum853` |
| N4 · OTRO script nuevo mira en qué máquina corre | el tope de `scrum702` |

El sujeto queda idéntico por sha256 y `git status` limpio.

### Lo demás que se comprobó

- Los dos guards, el test del vigía y `tests/vigia-atascados.test.mjs`: 116 casos, 116 pasan.
- Las 15 mutaciones de §⑤, repetidas sobre el script arreglado: 15 de 15 muertas, y las 15 líneas
  idénticas a las de `mutaciones.txt` (cambia sólo el sha256 del sujeto, que es otro fichero).
- En vivo, dos veces (03:34Z, 260 runs, 0 sin leer): lee «build + tests (con banco desechable)» como
  único obligatorio y avisa del meta-guard. La segunda, con `gh` fuera del PATH y un `GH_BIN` que no
  existe, para ejercer el paso al siguiente binario: mismo resultado.
- La tanda completa no se corrió en local; la cubre el CI del PR.

### Lo que NO es de este arreglo, medido y sin tocar

El mismo run tenía otros dos jobs en rojo, ninguno obligatorio:

- **«meta-guard»**: `scrum853` MUDO, dos veces. Es el rojo que este ticket censa; en `main` sigue igual
  (run `36808750944`).
- **«trinquete · ningún test nuevo mide la zona»** (job `110196119194`): 19 casos de
  `tests/vigia-atascados.test.mjs` salen «ausente» en `Pacific/Midway` (9.321 pruebas contra 9.302).
  **No reproducido:** en local, 64 de 64 en las dos zonas; el fichero no lee reloj, entorno ni disco; y
  el recuento no es estable (19 en la tanda, 30 a solas). En `main` ese job pasó (`36808750944`), y de
  7 PR hermanos de la misma media hora pasó en 5 y cayó en 2, con otros ficheros. La causa no está
  demostrada. El run nuevo del PR dirá si se repite.

### Errores propios

Ninguno que cambiara el resultado. El que generaliza es el de la entrega de J6c, y lo impide un guard
que ya existía: su muestra de «guards de suite» (17 ficheros) no llevaba los dos censos que cuentan
ficheros de `scripts/`, así que un script nuevo salió sin pasar por ellos y lo cazó el CI.
