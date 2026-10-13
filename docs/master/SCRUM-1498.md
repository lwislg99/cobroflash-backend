# SCRUM-1498 · El obligatorio da veredicto en el 37-39 % de los commits de `main`: la cola la retiene el job más largo del run, y ése no es el obligatorio

**Medido contra:** `origin/main` = `f9b4074d33278023f55548b88306421531114174` · 2026-10-07T16:27:55Z

A9: aviso → cicatriz J3 «Conté los veredictos por la conclusión del RUN y no por la del job obligatorio: antes de 935b me salía un 33 % donde el job había dado veredicto en el 45,6 %.» — no se pudo comprobar: es un guion de evidencias que corre a mano fuera de la tanda; lo que queda es que `obligatorio.mjs` cuenta por el nombre exacto del job y lleva al lado el control de un nombre inventado, que da 0

J3 (jv-j3), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). **Es LECTURA:** la API de
GitHub, las páginas públicas de los runs y Jira. No se ha tocado `ci.yml`, ningún workflow, ningún test ni ningún
guard, y no se ha transicionado ningún ticket. Los datos se recogieron el 7-oct-2026 entre las 16:30Z y las 16:36Z.

## Lo que ya estaba decidido, y no se vuelve a decidir aquí

El encargo llegó como «nadie sabe si es a propósito». Lo es, y está escrito: `ci.yml` (comentario sobre
`concurrency`), `docs/master/SCRUM-935.md` (apartado 935b) y los comentarios 16149 y 16227 de SCRUM-935. El 21-sep
se eligió la opción B: en `main` no se mata al run que corre, y GitHub sigue sustituyendo al que ESPERA. SCRUM-935
se cerró el 26-sep con 22 de 58 runs «pendiente sustituido» (c.17143, c.17144).

Lo que se aceptó entonces fue un modelo (c.16149, punto 3): con un run de **11,2 a 16,5 min**, darían veredicto
**18 a 22 de 38** commits (47-58 %), con una latencia mediana de 15-25 min y máxima de 32 o menos. El propio
comentario avisa de que supone «que la duración de pared de un run es la de su job más largo».

## ① Quién los cancela: GitHub, al llegar el push siguiente. Los 365 medidos, sin otra causa

**Población:** 1.126 runs de `ci.yml` por push a `main`, creados del 7-sep al 7-oct (días UTC), uno por cada commit
de primer padre (1.123 commits; **0 sin run**; `salida-2`). El número de jobs de cada uno, por GraphQL.

Desde el 22-sep hay **365** runs `cancelled` con 0 jobs. Tres sondas distintas dicen lo mismo:

| sonda | cancelados sin jobs | control: runs CON jobs |
|---|---|---|
| al nacer, otro run del grupo estaba corriendo | 365 de 365 | 187 de 259 (los que esperaron y no fueron sustituidos) |
| mueren a menos de 5 s de nacer el push siguiente | 361 de 365 (los otros 4, entre 5 y 30 s después de que naciera) | 1 de 259 |
| su página dice «Canceling since a higher priority waiting request for ci-refs/heads/main exists» (ventana de J6) | **85 de 85** | **0 de 54** |

La API no dice quién cancela: el run sustituido tiene `jobs.total_count = 0`, ningún check-run y ninguna anotación,
igual que uno que todavía espera (`salida-8`). La frase sólo está en la página del run. La tercera sonda no se pasó
a los 365: se pasó a los 85 de la ventana de J6.

El par de control que pedía el ticket (`salida-8`), leído a las 16:31Z: el run de `f07622f3` corría desde las
16:06:14Z; el de `f9b4074d` nació a las 16:11:00Z, esperó, y murió a las 16:30:18Z, un segundo después de nacer el de
`818cb29b`. En ese momento el obligatorio de `f07622f3` **ya había dado `success`**; lo único que seguía corriendo
era el meta-guard. `f9b4074d` era el commit que producción servía a las 16:27Z.

## ② Desde cuándo: desde el día siguiente a 935b, de golpe. No hay caída del 55 % al 36 %

La serie por días (`salida-1`): hasta el 21-sep, el 86-100 % de los runs llega a tener jobs (y GitHub los mata a
medias). Desde el 22-sep: 39, 53, 75 (8 pushes), 63, 34, 35, 31, 43, 54, 40, 37, 38, 35 %. **Es un escalón el 22-sep
y luego una banda del 31 al 54 %, sin pendiente.** El 52 % de SCRUM-1324 (256 de 488) mezcla en su ventana los dos
días anteriores a 935b, en los que casi todos los runs arrancaban.

Contado por el **job obligatorio**, con su nombre exacto (`salida-3`):

| tramo | pushes | el obligatorio dio veredicto | run entero, p50 | obligatorio, p50 | meta-guard, p50 |
|---|---|---|---|---|---|
| 7-sep a 21-sep (antes de 935b) | 487 | 222 · **45,6 %** | 7,5 min | 4,5 min | 5,1 min |
| 21-sep a 25-sep | 176 | 92 · 52,3 % | 15,9 min | 8,0 min | 12,7 min |
| 26-sep a 2-oct | 385 | 147 · 38,2 % | 19,6 min | 9,0 min | 14,8 min |
| 6-oct y 7-oct | 76 | 28 · 36,8 % | 30,8 min | 10,8 min | 20,9 min |
| ventana de J6 (2-oct 01:54Z a 7-oct 15:44Z) | 139 | 54 · 38,8 % | 27,0 min | 10,4 min | 20,5 min |

**Qué cambió:** lo que dura el run. La decisión contaba con 11-16 min; hoy son 27-31 de mediana. El grupo de
concurrencia lo retiene el run ENTERO, y el último job en acabar es el meta-guard en 46 de 52 runs de la ventana de
J6 (el trinquete de zona en 5, con su techo de 45 min). El obligatorio acaba a los 10 min y el siguiente commit
sigue esperando otros 10-20 a dos jobs que no son obligatorios.

Dos cosas más, que nadie pidió:

- **Por el job obligatorio, la opción B no ha subido la cobertura: 45,6 % antes, 37-39 % ahora.** Son épocas
  distintas (entonces el obligatorio tardaba 4,5 min y solía acabar antes de que mataran el run): es una
  observación, no un experimento.
- **El meta-guard está en 20,9 min de mediana y 23,1 de máximo.** Su aviso está en 20 min y su techo en 30
  (SCRUM-935). El 20-sep el máximo era 14:16.

## Lo que de verdad se pierde: latencia y atribución, no cobertura

`main` es lineal: el veredicto de un commit posterior cubre a los anteriores (c.16149, punto 4). Medido así
(`salida-4`), **ningún commit se queda sin cubrir**: 0 en las tres ventanas.

| tramo | latencia push → veredicto que lo cubre (p50 · p90 · máx) | commits por veredicto (media · máx) |
|---|---|---|
| lo que prometía el modelo de B | 15-25 · 21-32 · ≤ 32 min | — |
| antes de 935b | 7,6 · 18,1 · 49,5 min | 2,19 · 11 |
| 26-sep a 2-oct | 19,4 · 35,3 · 63,8 min | 2,62 · 14 |
| ventana de J6 | 24,8 · 40,7 · 47,3 min | 2,57 · 8 |

En la ventana de J6 hubo 4 veredictos rojos del obligatorio; uno llevaba 6 commits debajo. Cada commit de `main` se
despliega: en esa media hora está en producción sin veredicto propio.

## ③ En los PR no pasa

106 runs de `pull_request` del 6 y 7-oct (`salida-6`): **0 cancelados sin jobs**; 20 cancelados con jobs, que es lo
que `cancel-in-progress` hace a propósito ahí. Es una muestra de dos días.

## Un modelo, que NO es una medición

`modelo.mjs` (`salida-5`): un servidor y un solo hueco de espera, con las horas reales de los 461 pushes del 26-sep
al 7-oct. Con la mediana real del run entero (16,4 min de trabajo) predice 200 de 461; corrieron 175. **Se pasa por
25, un 14 %**, porque usa una duración fija y las reales tienen una cola de 45 min. Con esa holgura: si el grupo se
soltara al acabar el obligatorio (9,3 min), correrían unos 291 de 461 (63 %). Vale para el orden de magnitud, no
para la cifra.

## Lo que NO he hecho y lo que NO he medido

- No propongo ni construyo ningún arreglo: todos pasan por un workflow, que es de S5 y del fundador.
- **Los «7 sin run de CI» de J6 no los reproduzco:** en mi población son 0 de 1.123 commits de primer padre, y en su
  ventana 139 pushes = 54 con veredicto + 85 sustituidos. No he leído su guion para saber de dónde salen.
- La tasa de nombres ausentes de SCRUM-1339 (56 %) no la he vuelto a medir. Las dos juntas: veredicto del
  obligatorio en el 38,8 % de los commits de la ventana, y de ésos, informe completo en 22 de 50.
- No he medido el cupo de runners ni si la cola de Actions alarga los runs; la duración que doy es la de los jobs.
- No he mirado los PR de antes del 6-oct, ni los días sin pushes (10 a 14 y 19 de septiembre, 3 a 5 de octubre).
- La hora es la cabecera `Date:` de GitHub; los datos de la API son una foto de las 16:30-16:36Z.

## De paso: por qué el hook de carril no paró a J3a (medido; el arreglo es de S5)

J3a escribió con `Write` un fichero nuevo en `scripts/equipo/` (carril S5) y nada la paró. Dos causas
independientes, y cualquiera de las dos basta:

1. **El hook no estaba cargado.** Las sesiones J3 arrancan en `cobroflash-jv3`, que está en una rama anterior a la
   cerradura: su `.claude/settings.json` nombra `carril` 0 veces (control: `latido`, 2) y no tiene
   `.claude/hooks/carril.mjs`. El transcript de J3a deja rastro de `SessionStart` y `Stop`, y de ningún otro hook.
2. **Aunque hubiera corrido, no la habría reconocido.** `puestoDeNombre('jv-j3')` devuelve `null`: la expresión
   admite `puesto-jN` y `jN-algo`, y las sesiones del equipo de Javier se llaman `jv-jN`. Sin `.yaqu-puesto.json`
   en la carpeta, no hay puesto, y sin puesto el hook deja pasar todo. Dándole al hook de `main` la escritura
   exacta de J3a: salida 0 con el nombre `jv-j3`, **salida 2 con `j3-prueba`** (`prueba-carril3.mjs`). Con `jv-j3`
   también deja pasar `.github/workflows/ci.yml` y `src/modules/invoicing/pdf.service.ts` (`prueba-carril2.mjs`).

O sea: hoy la cerradura de carril no para a ninguna sesión `jv-jN`. No lo arreglo: `scripts/_carriles.mjs` y los
hooks no son de J3.

## Errores propios

1. El de la línea A9: la primera tabla contaba «veredicto» por la conclusión del run. Lo corregí antes de enviar
   nada, al ver que no cuadraba con la medición de S3 en SCRUM-935.
2. Di por buena una ventana de ±15 s para «murió al nacer el siguiente» y dos runs se quedaron fuera por 2-3 s. La
   cambié por la distribución entera, sin ventana elegida.
3. El modelo se pasa un 14 % en su propia validación; va dicho arriba y no lo he afinado.

## Cómo se repite

Todo está en `docs/master/evidencias/SCRUM-1498/`. Sin red, sobre los datos guardados:
`node docs/master/evidencias/SCRUM-1498/regenera.mjs` (seis salidas). Con `--red` añade las dos que leen GitHub.
Para recoger datos nuevos: `recoge.mjs push <desde> <hasta> <salida.json>` y `jobs.mjs <runs.json> <salida.json>`.
