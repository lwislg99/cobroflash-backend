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

## SCRUM-1498b (24-oct) · re-medido: el obligatorio da veredicto en el 33 % de los commits de `main` (26 % los últimos tres días), y el meta-guard vive pegado a su techo de 30 min

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T10:51:10Z

A9: aviso → cicatriz J3 «Pasé al hook de carril una entrada JSON escrita con printf en bash, no llegó a parsearse y salió 2 igual que un «te paro»: dos sondas, una de ellas el control positivo, daban la misma salida sin haber mirado nada.» — no se pudo comprobar: es cómo monto una sonda puntual fuera de la tanda, y ningún test del árbol lo ve

Sesión jv-j3bc (puesto J3). Encargo: SOLO medir y preguntar; no se toca ningún workflow (`.github/workflows/**` es de S5, `node scripts/carriles.mjs de .github/workflows/ci.yml` → S5). Datos recogidos con los MISMOS instrumentos del tramo anterior (`recoge.mjs` + `jobs.mjs`), sólo lectura de la API; el análisis nuevo es `obligatorio-24oct.mjs` (mismo criterio que `obligatorio.mjs`: veredicto = el JOB obligatorio acaba en `success` o `failure`).

**Población:** 489 runs de `ci.yml` por `push` a `main`, creados del 2026-10-08 al 2026-10-24 10:47Z; 0 días truncados; 487 acabados (2 sin acabar, fuera). 162 con jobs, las 162 suites recibidas, 0 truncadas. **Controles:** sembrados dentro del instrumento, no tomados del árbol: un run fabricado con el obligatorio en `SUCCESS` cuenta 1, uno con un nombre inventado cuenta 0, y si no, sale CIEGO con código 2. El nombre exacto del obligatorio aparece en 162 de 162 suites. Salida entera: `evidencias/SCRUM-1498/salida-9-24oct.txt`.

### Lo que el tramo anterior daba por cierto y hoy ya no lo es

| afirmación del 7-oct | hoy (24-oct) |
|---|---|
| veredicto del obligatorio en el 37-39 % de los commits, en banda «sin pendiente» | **41,5 %** (8-14 oct, 71/171) → **30,4 %** (15-21 oct, 51/168) → **26,4 %** (22-24 oct, 39/148). Total 33,1 % (161/487). **Ahora sí hay pendiente**, tres semanas seguidas. |
| meta-guard: 20,9 min de mediana, 23,1 de máximo | p50 23,0 → 30,3 → 28,9 min; **39 de 140** runs (8-oct a 23-oct 13:04Z) llegaron a 30,3 min, el `timeout-minutes: 30` de su job (`ci.yml:737`), y acabaron `CANCELLED`. El primero, el 16-oct 11:18Z. |
| run entero: 27-31 min de mediana | p50 29,0 → 35,7 → 33,2 min; máximo 67,0 min. |
| el último job en acabar es el meta-guard en 46 de 52 | 142 de 152 (el trinquete de zona, los otros 10). |
| el mecanismo: el pendiente lo sustituye el push siguiente | sigue igual: `ci.yml:37-39` no ha cambiado (`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`). Desde el 7-oct `ci.yml` sólo ha cambiado en `0dbe864cb` (SCRUM-1339, `continue-on-error`). |
| la cerradura de carril no para a ninguna sesión `jv-jN` | **sigue cierto.** `prueba-carril4.mjs` (la sonda de 7-oct, con `ci.yml` de destino y el nombre de hoy): `j3-prueba` → salida 2 («es de S5»), `jv-j3` → 0, `jv-j3bc` → 0. `puestoDeNombre` (`scripts/_carriles.mjs:195-205`) sólo casa `puesto-jN` y `jN-algo` por la forma; la vía nueva es la «mesa» (carpeta → puesto), y el hook de arranque de esta sesión dijo «SIN IDENTIDAD». |

### ① El mecanismo, otra vez run a run

326 cancelados con 0 jobs; 323 nacieron con otro run de `main` corriendo. Los 3 que el instrumento da por «no encajan» son de BORDE, comprobados uno a uno: `37705907035` (8-oct 00:05Z) tenía corriendo `37703702097`, creado el 7-oct y por eso fuera de la población; `40086784017` y `40087101250` (24-oct) tenían corriendo `40085895667`, que a las 10:47Z seguía sin acabar y el instrumento deja fuera. **Ninguno pide otra causa.** La frase de la página del run («Canceling since a higher priority waiting request…») NO la he releído hoy: me fío del tramo anterior (85 de 85) y de la coincidencia temporal.

### SCRUM-935d/935e no cambian la duración, cambian el desenlace

Entraron en `main` el 23-oct (`7d13cdd85` #2676 a las 13:04Z, `391212830` #2737 a las 13:38Z). Después de 935e: n=20, p50 28,9, máximo 29,1 min, 0 en el techo, **13 `FAILURE` y 7 `SUCCESS`**. Antes, en el mismo tramo de días: 9 `CANCELLED` y 9 `SUCCESS`. **El meta-guard ya no muere por el techo, pero sigue durando lo mismo y sale rojo en 13 de 20.** Si esos 13 son el «sale CIEGO» que 935d añadió o rojos de verdad: **NO LO HE MIRADO** (no he abierto ni un log). Muestra de 20: un instante, no un régimen.

### ③ En los PR: no lo he re-medido hoy. Vale lo del tramo anterior (6-7 oct, 0 de 106).

### Lo que queda vivo y de quién es

- **La decisión del ticket** (¿vale la opción B?): sigue sin tomar. Es del fundador; el workflow es de S5 (`ci.yml`, `dos-equipos.md:167`). Las preguntas ✅/❌ van en el comentario de Jira de esta entrega.
- **La cerradura que no reconoce `jv-jN`:** S5 (`scripts/_carriles.mjs`, `.claude/hooks/carril.mjs`). El prompt del orquestador la cita como SCRUM-1506; **no he leído ese ticket**.

### Lo que NO he hecho y lo que NO he medido

Ningún workflow tocado. Ni tanda ni build (orden de RAM). No he medido el cupo de runners ni la cola de Actions, ni la latencia push→veredicto de esta ventana, ni la cobertura por atribución (cuántos commits cubre cada veredicto). No he abierto ningún log del meta-guard. No he leído SCRUM-935d/935e más que por el título de sus commits.

**Contexto:** 94.377 al acabar el arranque · 117.786 al acabar Jira · ~158.000 al escribir este tramo (15M − restantes).

### Cómo se repite

`node docs/master/evidencias/SCRUM-1498/obligatorio-24oct.mjs docs/master/evidencias/SCRUM-1498/datos-push-main-2026-10-08..10-24.json docs/master/evidencias/SCRUM-1498/datos-jobs-2026-10-08..10-24.json` (sin red). La sonda del carril: `node docs/master/evidencias/SCRUM-1498/prueba-carril4.mjs <worktree> <carpeta temporal fuera del árbol>`.

## SCRUM-1498d (24-oct) · J6 · el vigía de `main` absuelve los sustituidos por job (decisiones del fundador c.20795 y c.20802)

**Medido contra:** `origin/main` = `9156927564adf54633aca0eac3ae3c867236e3b9` · 2026-10-24T15:11:56Z

A9: comprobación → `tests/scrum1498d-vigia-absuelve-obligatorio-verde.test.mjs`

Carril: `scripts/vigia-silencio-de-main.mjs` sólo tiene la fila general de `scripts/` (`node scripts/carriles.mjs de` → «SIN CERRADURA · sólo lo cubre la fila general»); lo construye J6 porque la decisión c.20795 lo nombra. Ningún workflow tocado. El sufijo «1498c» del encargo ya era de S5 (#2841 y su tramo «SCRUM-1498c»): esto va como 1498d (c.20802 lo confirma).

### Lo que decidió el fundador

- **c.20795** («Sí: basta con el obligatorio en verde»): un commit SUSTITUIDO cuyo «build + tests» dio success queda absuelto aunque el meta-guard u otro job largo no corriera en él. En la PUNTA, el meta-guard se sigue exigiendo.
- **c.20802** («Los cubre el siguiente verde»), que amplía la anterior después de la primera medición de este tramo: un sustituido cuyo «build + tests» no dio veredicto queda absuelto si el SIGUIENTE commit posterior con veredicto del obligatorio lo dio en verde. Si salió en rojo, no se absuelve y se dice cuál. Un sustituido con su propio obligatorio en rojo nunca se absuelve.

### Lo cambiado

- `canceladoSinArrancar(job)`: `cancelled` y ningún paso `completed` ni `in_progress`. Si los pasos no se leyeron, `false`: no se sabe.
- `veredictoDeCommit` reconoce dos formas nuevas. Las dos piden ningún job en rojo, la señal de nombres sin CIEGO, los seis jobs declarados presentes, y el resto en success o cancelado sin arrancar. Se miran ANTES que el CIEGO del meta-guard, que de otro modo saldría por «cancelado él solo».
  - (a) obligatorio en success → CIEGO con causa `CAUSA_SUSTITUIDO_CON_OBLIGATORIO_VERDE`.
  - (b) el obligatorio también cancelado sin arrancar → CIEGO con causa `CAUSA_OBLIGATORIO_SUSTITUIDO`.
  - Cada veredicto lleva además `obligatorio`: `'success'`, `'failure'` o `null`.
- `absolucionDeSustituidos`:
  - (a) lo absuelve su propio obligatorio, salvo en la punta (posición 0 de la línea), donde se avisa.
  - (b) sube por la línea hasta el primer commit cuyo `obligatorio` no es `null`. Si es `success`, queda absuelto por él. Si es `failure`, no se absuelve, y va a `tapados`, que `accionDelIssue` añade al motivo del aviso («el siguiente «build + tests» con veredicto, `<sha>`, salió en ROJO: no se absuelve»). Si antes encuentra uno CORRIENDO, espera. Si encuentra un commit sin juzgar, no se absuelve.
- `bajarPorSustituidos` baja también desde un commit cuyo obligatorio dio veredicto (un ROJO de otro job lo tiene), y sigue por las dos formas nuevas. `conRun` las cuenta como «con run».
- Sin cambios: el meta-guard cortado a mitad sigue siendo su CIEGO (1339r), y el «cancelled con 0 jobs» se sigue absolviendo por el verde que lo contiene (1393e).

### Rojo primero y mutaciones

Test nuevo, 12 casos, con un positivo SEMBRADO por clase:

| clase sembrada | lo que dice el vigía |
|---|---|
| sustituido-verde | absuelto por su obligatorio |
| sustituido-rojo | no se absuelve |
| sin veredicto + siguiente verde (también si el siguiente es un sustituido-verde o un ROJO de otro job) | absuelto |
| sin veredicto + siguiente rojo | no se absuelve, y el aviso nombra cuál |
| sin veredicto + siguiente corriendo | espera |
| sin veredicto en la punta, o con un hueco sin juzgar | no se absuelve |
| punta sin meta-guard | aviso, y no cierra |
| cancelado-0-jobs | absuelto como hoy |
| cortado a mitad, pasos sin leer, señal CIEGA, declarado ausente | no se absuelve |

Procedimiento: con el motor ya comiteado (`e1ad7290655e8ce42f076ed4ca42cd1de52606e4`), cada mutación se aplica (`git diff --numstat` 1/1 o 1/2), se corre el test y se restaura desde HEAD. **14 de 14 mueren, y en todas caen + pasan = 12.** M0 es el rojo primero: quita las dos formas nuevas, que es lo que hace `main`, y tumba 7 casos. La salida, con el ancla y el reemplazo de cada una, está en `1498d-salida-mutaciones.txt`. **El guion NO se sube:** `guards:entrada` (scrum976) tumba un banco de mutaciones nuevo con lista propia que no está registrado en el catálogo del meta-guard, y registrarlo no cabía en esta tanda. Queda como deuda declarada.

### La cifra: ¿cuántos commits absolvería el vigía con #2841?

**Qué se simula** (`evidencias/SCRUM-1498/1498d-simula-por-job.mjs`; salida en `1498d-salida-simulacion.txt`):
- **Datos:** los de S5, `1498c-datos-2026-10-17..10-24.json`, del commit `19eb5b933a5979a5e39c2479e3c703662f1dced7` de la rama de #2841. Son los 280 commits de primer padre del 17-oct 12:00Z al 24-oct 12:00Z, con la hora real de su run.
- **Grupos:** seis, uno por job, como en el `ci.yml` de #2841. En cada uno, uno corre y uno espera; el que llega sustituye al que espera, y éste queda cancelado sin arrancar.
- **Duración y conclusión de cada job:** las reales si corrió en ese commit; si no, remuestreadas de las reales de ese job.
- **Juez:** cada forma pasa por `veredictoDeCommit` y `absolucionDeSustituidos` del motor de esta rama.
- 500 réplicas; se da la mediana y el IC90.

| clase | (A) conclusiones reales | (B) todo en success |
|---|---|---|
| absuelto por el siguiente obligatorio en verde (c.20802) | 75 [65-82] · 26,8 % | 119 [116-121] · 42,5 % |
| absuelto por su obligatorio (c.20795) | 46 [38-53] · 16,4 % | 105 [100-108] · 37,5 % |
| VERDE | 9 [8-12] · 3,2 % | 55 [51-58] · 19,6 % |
| absuelto por un verde posterior (1393e/f) | 2 | 2 |
| CIEGO · meta-guard cortado a sus 30 min, con el obligatorio en verde o sin él (1339r) | 67 [59-75] + 31 [24-39] · 35,0 % | — |
| ROJO de otro job, obligatorio en verde | 29 [25-33] · 10,4 % | — |
| CIEGO · meta-guard, obligatorio en rojo | 12 [7-16] · 4,3 % | — |
| CIEGO · obligatorio sustituido, el siguiente salió ROJO | 7 [2-13] · 2,5 % | — |
| ROJO del obligatorio | 3 [2-4] · 1,1 % | — |

**Lo que dice:**
- **Con la cola sola (B), el vigía absuelve o da verde a los 280 commits:** 226 absueltos más 55 verdes. Las medianas suman 281 porque cada clase se calcula por separado.
- Antes de c.20802, los 119 «sin veredicto» eran CIEGO para siempre, y el Issue no se habría cerrado nunca.
- **Con las conclusiones reales (A), lo que queda sin absolver ya no es cosa de la cola.** Es el meta-guard cortado a sus 30 min (~35 %), los rojos de «guards de navegador» y del trinquete (~10 %) y los rojos del obligatorio. Eso es SCRUM-1538/935c, no este ticket.
- El obligatorio corre en ~57 % de los commits (B: 105 + 55 = 160 de 280). S5 daba ~58 % con otro modelo.

### Lo que NO he medido

- La forma que da GitHub a un job sustituido mientras espera en un grupo de job (`cancelled`, `steps: []`) es SUPUESTA: sólo se verá en `main` tras #2841. Si sale con algún paso `completed`, el motor NO lo absuelve: falla hacia el aviso, no hacia el silencio.
- Es un modelo. Supone runner libre al instante, y S5 vio 20 jobs corriendo y 12 en cola a las 13:08Z (c.20793). No lo he validado contra lo medido con un solo grupo, como sí hizo S5 (83 contra 81).
- (b) no absuelve si entre el sustituido y el siguiente con veredicto hay un commit que la pasada no juzgó. La bajada desde cada commit con veredicto los juzga; un pendiente del Issue con un hueco por encima se avisa en vez de callarse. No lo he medido contra el workflow real.
- **Suite entera local: NO CORRIDA** (10 sesiones a la vez). Guards dirigidos: 30 ficheros, 308 casos, 307 pasan. Cae `scrum836`, que es del ENTORNO: este árbol anidado no trae `dist/`, y el guard pide tres ficheros compilados de `scrum608` que no existen aquí. No viene de este cambio.

**Contexto:** ~90k al acabar el arranque · ~113k al acabar Jira · ~214k al avisar (cruzado 200k) · ~275k al escribir este tramo (15M − restantes).

### Cómo se repite

- El test: `node --test tests/scrum1498d-vigia-absuelve-obligatorio-verde.test.mjs`.
- Las mutaciones: a mano, con las anclas y los reemplazos de `1498d-salida-mutaciones.txt`; el guion no está en el árbol (motivo arriba).
- La simulación: `node docs/master/evidencias/SCRUM-1498/1498d-simula-por-job.mjs <1498c-datos-2026-10-17..10-24.json> 500` desde la raíz (sin red).
