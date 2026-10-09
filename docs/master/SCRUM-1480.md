# SCRUM-1480 · Dos filas que faltaban en la tabla de dueños: `scripts/qa/` y el vigía de sesiones

**Medido contra:** `origin/main` = `8dcc6d2ad6cab55e9b550220868b12adc82eb40e` · 2026-10-06T13:19:06Z

A9: sin fallo que generalice — el hueco lo destapó etiquetar dos tickets con la tabla delante, y lo que lo impide es la propia fila; una tabla no se puede probar contra los ficheros que aún no existen.

Carril S0 (`docs/equipo/dos-equipos.md` es suyo). Sólo cambia §3.3. No toca §3.1 ni §3.2, que son las que
lee `tests/scrum514-aprobado-y-aplicado.test.mjs`.

## Qué pasaba

§3.3 dice de quién es cada fichero. Su fila de `scripts/` recogía todo lo demás: «`scripts/` (verificación,
censos de consulta) → S0, salvo `scripts/equipo/` (S5) y `scripts/_suelo-*` (S3)». El 6-oct, al etiquetar
SCRUM-1466 y SCRUM-1467, los dos ficheros caían ahí y cada uno tenía dos lecturas:

| ticket | fichero | por área (§2.1 y `orquestador.md` §11bis) | a la letra de §3.3 |
|---|---|---|---|
| SCRUM-1466 | `scripts/qa/sembrar-qa.mjs` | S3: sondas e instrumentos | S0 |
| SCRUM-1467 | `scripts/vigia-sesiones-jv.mjs` | S5: vigías | S0 |

El orquestador de Luis decidió por el área, y el motivo es suyo: un hueco en la tabla no significa «es de
S0», significa que falta una fila.

## El cambio

Tres líneas de §3.3:

- La fila de `scripts/` nombra las excepciones nuevas y dice que no recoge lo que nadie clasificó.
- Fila nueva: `scripts/qa/**` → S3.
- Fila nueva: `scripts/vigia-sesiones-jv.mjs` → S5, con el aviso de que lo escribió el equipo de Javier
  para su máquina y de que un cambio se le avisa antes a su orquestador.

## Lo que medí para escribirlas (6-oct-2026, sobre `origin/main`)

| fichero | quién lo escribió, según su registro |
|---|---|
| `scripts/qa/sembrar-qa.mjs` | S3 (`docs/master/SCRUM-1268.md`, «Carril: S3», tres entregas) |
| `scripts/qa/sembrar-casos.mjs`, `sembrar-albaranes.mjs` | S3 (`docs/master/SCRUM-1367.md`, «Carril S3») |
| `scripts/qa/sesion-panel.mjs` | **no lo dice** (`docs/master/SCRUM-1222.md` no nombra carril). Entra en la fila por la carpeta, por decisión del orquestador |
| `scripts/vigia-sesiones-jv.mjs` | J6 del equipo de Javier (`docs/master/SCRUM-1000.md`, sesión `jv-j6`) |

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| §3.3 tiene una fila `scripts/qa/**` → **S3**, con su motivo. | `docs/equipo/dos-equipos.md`, §3.3 |
| §3.3 tiene una fila para el vigía de sesiones (`scripts/vigia-sesiones-jv.mjs`) → **S5**, y dice que lo escribió el equipo de Javier para su máquina (SCRUM-1000) y que un cambio se le avisa a su orquestador. | `docs/equipo/dos-equipos.md`, §3.3 |
| La fila de `scripts/` nombra las dos excepciones nuevas, para que nadie vuelva a leerla a la letra. | `docs/equipo/dos-equipos.md`, §3.3 |
| El formato que lee `tests/scrum514-aprobado-y-aplicado.test.mjs` (§3.1 y §3.2) no se toca: ese test sigue verde. | `tests/scrum514-aprobado-y-aplicado.test.mjs` |
| Dicho en el registro qué queda SIN fila después de esto. | «Lo que sigue sin fila», abajo |

## Lo que sigue sin fila, dicho

No lo clasifico yo: una decisión tomada para un caso no se estira a otro parecido.

- **`scripts/vigia-silencio-de-main.mjs`.** Lo escribió J6 del equipo de Javier (`docs/master/SCRUM-1324.md`).
  Es un vigía, pero no «de sesiones», y ningún workflow de `.github/` lo nombra. No tiene fila.
- **Los scripts de los workflows que viven en `scripts/`** (`vigia-atascados.mjs`, `vigia-pasada.mjs`,
  `vigia-despliegue-aviso.mjs` y otros). `orquestador.md` §11bis se los da a S5 («`.github/workflows/` y sus
  scripts»), pero §3.3 sólo nombra `.github/workflows/**`. No los he contado todos.

Los dos van al orquestador como pregunta.

## Para #2001

El PR #2001 (en borrador) genera ficheros con el número de línea de cada fila de este documento y con su
huella. Al traer `main` con estas tres líneas hay que volver a correr `node scripts/carriles.mjs generar`
después del commit de la fusión.

---

# SCRUM-1480b · Los scripts de workflow, contados: dos filas más y una fila general sin cerradura

**Medido contra:** `origin/main` = `f8da1ec83777c4110228e82093047e69a671dfe1` · 2026-10-06T17:18:24Z

A9: aviso → cicatriz S0 «Una frase que resume una lista se comprueba contra la lista antes de escribirla: la fila decía que sus ayudantes sólo los importaban sus scripts, y dos tenían más importadores.» — no se pudo comprobar: es prosa de una celda de la tabla de dueños, y ningún test lee qué afirma una nota

Carril S0 (`docs/equipo/dos-equipos.md` y `docs/equipo/cicatrices/S0.md` son suyos). `docs/equipo/orquestador.md`
es del orquestador de Luis: se le quita UNA palabra con su autorización escrita (abajo).

## La pregunta, y lo que resultó ser

La primera entrega dejó dos preguntas al orquestador: `vigia-silencio-de-main.mjs` y «los scripts de los
workflows que viven en `scripts/`… no los he contado todos». Su encargo de la tarde: contarlos antes de decidir.

Contados sobre 296 ficheros rastreados en `scripts/` y 8 workflows (3.304 líneas de yml; 1.567 son comentario
y no cuentan como ejecución):

| qué | cuántos | con fila propia | sin fila |
|---|---|---|---|
| A · los ejecuta un workflow: su ruta, o un `npm run` que resuelve a ella, en una línea no comentada | 24 | 3 | 21 |
| B · sólo llegan por `import` desde los de A (leído con el compilador de TypeScript, no por texto) | 20 | 1 | 19 |
| A + B | 44 | 4 | 40 |

El orquestador había nombrado tres «y otros». Eran 21 directos y 40 con sus imports.
`vigia-silencio-de-main.mjs` no lo ejecuta ningún workflow: es el número 41 y va aparte.

Y debajo hay un hueco mayor que la pregunta: **273 de los 296 ficheros de `scripts/` sólo los cubre la fila
general.** Esos no se clasifican aquí.

El censo lleva un control positivo (ve `vigia-pasada.mjs`, que `vigia-atascados.yml` corre) y uno negativo
(deja fuera `_evidencia-tanda.mjs`, que `ci.yml` sólo nombra en un comentario). Se repite con:

    node docs/master/evidencias/SCRUM-1480/censo-scripts-de-workflow.mjs <raíz del árbol>
    node docs/master/evidencias/SCRUM-1480/importadores.mjs <raíz del árbol> docs/master/evidencias/SCRUM-1480/lista-de-los-45.txt

Las salidas de ese día están al lado (`salida-*.txt`). La función `fila()` del censo lleva escritas las filas
que había ANTES de este cambio: su «sin fila» es la foto de partida, no la de después.

## Lo que se firmó y lo que no

Propuse 17 ficheros a S5, 23 a S3 y uno que se queda en S0. El orquestador de Luis firmó con recortes
(mensaje a la S0 del 6-oct-2026, tarde):

| fichero o grupo | propuesto | firmado | motivo del orquestador |
|---|---|---|---|
| 16 del bucle PR → CI → merge → aviso | S5 | **S5** | lo dicen §3.3 (`.github/workflows/**`) y `orquestador.md` §11bis |
| `vigia-silencio-de-main.mjs` | S5 | **sin fila** | lo escribió J6 y SCRUM-1324 sigue En curso con `area-j6`; pregunta a los dos orquestadores |
| ocho ayudantes compartidos (de 5 a 51 importadores) | S3 | **sin fila** | no se clasifica un ayudante antes que quienes lo usan |
| `guards-visuales.mjs`, `senal-de-nombres.mjs` | S3 | **sin fila** | ticket vivo del equipo de Javier (SCRUM-1313, 1320, 1339) |
| `trinquete-de-zona.mjs`, `_trinquete-de-zona.mjs` | S3 | **sin fila; excepción** | S3 los toca por SCRUM-1335, comentario 18387; el ticket lleva `area-j6` |
| `meta-guard-mutaciones.mjs` | S3 (dos textos se contradecían) | **S3** | §3.3 da «mutación» a S3 y la medición de hoy es suya |
| el resto de instrumentos del CI | S3 | **S3** | |
| `censo-regla-42.mjs` | S0 | S0 (fila general) | es un censo de consulta |

**Desviación mía, declarada:** el orquestador contó 13 en la fila de S3 y la fila lleva 9. Dos salen porque él
mismo los pasa a excepción (el trinquete de zona). Los otros dos son `_solape-de-guards.mjs` y
`_senal-de-nombres.mjs`: son los ayudantes de `guards-visuales.mjs` y de `senal-de-nombres.mjs`, que él dejó
fuera, y un ayudante no se queda en un carril mientras su script espera a otro equipo. Es su misma regla
aplicada a dos ficheros que no nombró; si no la quiere así, se devuelven a la fila.

## El cambio

- `docs/equipo/dos-equipos.md` §3.3: fila nueva de 16 rutas → S5; fila nueva de 9 rutas → S3; y la fila general
  de `scripts/` deja de llevar el dueño como un puesto a secas. Esto último es la decisión (a) del orquestador
  para el PR #2001: su cerradura lee esa celda, y con «**S0**» a secas cerraba con llave 275 ficheros a nombre
  de S0. Corrido el hook de #2001 con siete casos: bloqueaba a una sesión de S5 en `vigia-atascados.mjs` y a una
  de S3 en `meta-guard-mutaciones.mjs`, y dejaba pasar a una de S0 en el vigía, que la propia fila dice que no
  es suyo. Donde nadie ha decidido no hay cerradura.
- `docs/equipo/orquestador.md` §11bis, fila de S5: sale «meta-guard» de la lista del bucle. Autorización escrita
  del orquestador de Luis, dueño del fichero, en ese mismo mensaje: «te AUTORIZO por escrito a quitar
  "meta-guard" de la fila de S5 en el mismo PR».
- `docs/equipo/cicatrices/S0.md`: dos líneas.

No toca §3.1 ni §3.2, que son las que lee `tests/scrum514-aprobado-y-aplicado.test.mjs`.

## Lo que sigue sin fila, dicho

- `vigia-silencio-de-main.mjs`, `guards-visuales.mjs` y `senal-de-nombres.mjs` (con sus dos ayudantes): esperan a
  que lo hablen los dos orquestadores, y el canal entre ellos es un jefe.
- Los ocho ayudantes compartidos y el resto de los 273 de la fila general. Clasificarlos es una tanda entera y
  no está encargada.

## Para #2001

Al traer `main` con estas filas: `node scripts/carriles.mjs generar` después del commit de la fusión, y volver a
correr la sonda de la cerradura. Se marca listo al EMPEZAR una tanda, no al final (decisión del orquestador).

---

# SCRUM-1480c · La fila de S3 baja de 9 a 7, y la cifra de la fila general estaba medida antes de tiempo

**Medido contra:** `origin/main` = `8f77f96dd12c0cc7cad87f94d166b58601741b5f` · 2026-10-06T17:57:09Z

A9: aviso → cicatriz S0 «Una cifra que describe una tabla se mide después del último cambio del mismo PR: escribí que la fila general cubría sola 273 ficheros, y con las dos filas que entraban con esa frase eran 248.» — no se pudo comprobar: es una cifra en la prosa de una celda, y ningún test lee qué afirma una nota

Carril S0 (`docs/equipo/dos-equipos.md`, `afirmaciones-verificadas.md` y `cicatrices/S0.md` son suyos). Sólo cambia
§3.3. No toca §3.1 ni §3.2, que son las que lee `tests/scrum514-aprobado-y-aplicado.test.mjs`.

## Qué pasaba

El PR #2227 entró en `main` a las 17:45:34Z con 9 rutas en la fila de S3. El orquestador de Luis decidió después
que salen también los dos ayudantes del censo táctil, con la misma regla que ya había sacado a los otros: un
ayudante espera a quienes lo usan. Así que `main` afirmaba 9 donde lo firmado eran 7.

De dónde sale la decisión, dicho: llegó en el mensaje de arranque del orquestador a esta sesión (6-oct, tercera
tanda). En Jira no está: SCRUM-1480 tenía a las 17:57Z dos comentarios, los dos entregas de la S0. Queda escrita
en la entrega de este cambio.

## Lo que medí antes de quitar nada

Quién importa cada una de las 9 rutas, leído con el compilador de TypeScript sobre 1.727 ficheros (`scripts/`,
`tests/` y `.claude/hooks/`), con su control (ve que `suelo-de-la-tanda.mjs` importa `_suelo-de-la-tanda.mjs`):

| fichero | lo importan, dentro de `scripts/` | ¿tienen fila? |
|---|---|---|
| `_medidor-de-toque.mjs` | `censo-objetivo-tactil-panel.mjs`, `guard-objetivo-tactil.mjs`, `guard-a11y-landing.mjs` | el censo sí (S3); los dos guards no |
| `_pagina-panel.mjs` | `censo-objetivo-tactil-panel.mjs`, `guard-objetivo-tactil.mjs` | el censo sí (S3); el guard no |
| `_arbol-quieto.mjs` | `meta-guard-mutaciones.mjs` | sí (S3) |
| `frontera-dist.mjs` | `meta-guard-mutaciones.mjs` | sí (S3) |

Lo que afirmó el orquestador se sostiene: a los dos que salen los importan guards sin clasificar. Los dos que se
quedan sólo los importa, dentro de `scripts/`, un fichero de la misma fila.

Se repite con:

    node docs/master/evidencias/SCRUM-1480/importadores.mjs <raíz ABSOLUTA del árbol> docs/master/evidencias/SCRUM-1480/lista-de-la-fila-de-s3.txt

La salida de ese día está al lado (`salida-importadores-fila-de-s3.txt`).

**Lo que la regla no dice, para que nadie la estire:** a `meta-guard-mutaciones.mjs` también lo importa un script
sin fila (`censo-guards-gateados.mjs`), además de `_suelo-contra-main.mjs` y de 28 tests. Se queda en la fila: no
es un ayudante, el CI lo corre por su ruta (`npm run meta:mutaciones`) y su dueño se firmó por nombre.

## La segunda corrección, que nadie pidió y es mía

La fila general decía «medido ese día: 273 de los 296 ficheros de `scripts/` sólo los cubre esta fila». La cifra
era cierta sobre el `main` de antes del PR #2227, y ese mismo PR añadía dos filas con 25 rutas. Contado leyendo
las filas del documento de cada commit:

| commit | qué es | ficheros en `scripts/` | con fila propia | sólo la fila general |
|---|---|---|---|---|
| `6aaec0dc` | antes de SCRUM-1480 | 296 | 18 | 278 |
| `f8da1ec8` | antes de #2227 (donde se midió el 273) | 296 | 23 | 273 |
| `8f77f96d` | `main` con #2227 | 298 | 50 | 248 |
| esta rama | con la fila de S3 en 7 | 298 | 48 | 250 |

Los dos ficheros de más son de `scripts/equipo/`, que tiene fila. «Con fila propia» cuenta también los tres
`scripts/_suelo-*`, que no tienen fila sino una excepción nombrada en la nota de la fila general.

    node docs/master/evidencias/SCRUM-1480/recuento-de-la-fila-general.mjs <raíz del árbol> [commit]

Lleva tres controles: que la fila de `scripts/equipo/` casa con algún fichero (si no, sale CIEGO con código 2), que
ninguna ruta nombrada se queda sin fichero y que ningún fichero casa con dos rutas. Los tres, limpios en los
cuatro commits.

Esa cifra se había repetido ya fuera del documento («los 273 sin clasificar»). Lo que cambia para quien la usó:
los que no tienen cerradura porque nadie los ha clasificado son 250, no 273.

## El cambio

- `docs/equipo/dos-equipos.md` §3.3, fila de S3: salen `scripts/_medidor-de-toque.mjs` y `scripts/_pagina-panel.mjs`;
  «los 9 instrumentos… con sus ayudantes» pasa a «los 7… con los dos ficheros que dentro de `scripts/` sólo
  importa el meta-guard»; los ayudantes compartidos que quedan fuera pasan de ocho a diez, con quién los comparte;
  y dice la consecuencia: el censo táctil es de S3 y sus dos ayudantes siguen en la fila general, sin cerradura.
- La misma tabla, fila general: la cifra lleva su «antes de» y la de hoy, con el comando.
- `docs/equipo/afirmaciones-verificadas.md`: dos filas del 6-oct (los scripts de workflow contados; el PR #2218).
- `docs/equipo/cicatrices/S0.md`: una línea.

## Aceptación → dónde se ve

La aceptación es el encargo del orquestador de Luis a esta sesión; no está escrita en el ticket.

| aceptación | dónde se ve |
|---|---|
| Las dos rutas salen de la fila de S3, que queda en 7 | `docs/equipo/dos-equipos.md` §3.3 |
| Los ayudantes que quedan fuera pasan de ocho a diez | la nota de esa misma fila |
| Anexo en el registro | esta sección |
| Las dos filas del 6-oct en `afirmaciones-verificadas.md` | `docs/equipo/afirmaciones-verificadas.md`, las dos últimas filas |

## Lo que no se ha hecho

- No he corrido los instrumentos del PR #2218: su fila en `afirmaciones-verificadas.md` sale de leer su registro, su
  PR y su ticket, y lo dice.
- No he corrido la suite completa (memoria de la máquina): los tests que leen los documentos tocados y
  `guards:entrada`.

## Para #2001

La fila de S3 cambia otra vez: al traer `main` con esto, `node scripts/carriles.mjs generar` después del commit de
la fusión. La sonda de la cerradura no cambia de veredicto por esto (`meta-guard-mutaciones.mjs` sigue en la fila
de S3), pero un caso nuevo sí: una sesión de S3 en `_medidor-de-toque.mjs` ya no encuentra cerradura, ni a favor
ni en contra.

# SCRUM-1480d · La fila de `quoteRevisiones.js`, y cuántos ficheros del panel están como estaba él

**Medido contra:** `origin/main` = `be48345279da158bc81aebbea543eb926ae9eb88` · 2026-10-09T08:22:54Z

A9: sin fallo que generalice — una fila nueva que confirma al dueño que el fichero ya tenía; las cifras de este anexo salen de comandos que van escritos al lado

Carril S0 (`docs/equipo/dos-equipos.md` y `afirmaciones-verificadas.md` son suyos). Toca §3.2, que lee
`tests/scrum514-aprobado-y-aplicado.test.mjs`: se añade UNA fila con el formato que ese test espera, y eso no necesita
aviso (lo dice la cabecera de §3). Con ella cambian dos ficheros generados (`.claude/carriles.json` y
`.claude/rules/carril-s2.md`): los escribe `node scripts/carriles.mjs generar`, no una mano.

## Qué pasaba

El 7-oct-2026 la S4 tuvo que preguntarle al orquestador de quién era `public/dashboard/js/quoteRevisiones.js`. El
orquestador contestó S2, por la fila general, y el 9-oct-2026 (orden de arranque de las 08:10Z) mandó ponerle fila
propia y mirar si había más ficheros del panel en la misma situación.

## Lo que medí antes de escribir la fila

| Qué | Resultado | Comando |
|---|---|---|
| De quién es el fichero ANTES de la fila | S2, por el patrón `public/**` (la fila general) | `node scripts/carriles.mjs de public/dashboard/js/quoteRevisiones.js` |
| De quién es DESPUÉS | S2, por su propio patrón | el mismo |
| Un hermano sin fila (`quoteSuplido.js`), después | S2, por `public/**`: la fila nueva no arrastra a nadie más | el mismo, con esa ruta |
| Ficheros de `public/dashboard/js/` | 95 | `git ls-files public/dashboard/js` |
| Con fila propia | 30 (J2 10 · J1 8 · J3 6 · S4 3 · S2 3) | el comando `de`, una vez por fichero |
| Sólo por la fila general, antes de este cambio | **65** (todos S2) | lo mismo |
| De esos 65, con un nombre que se parece a los de OTRO puesto | 7: `albaranAccion.js`, `albaranActionsRegistry.js`, `albaranDesdePresupuestoModal.js`, `parteOficinaView.js` (S4) · `facturasRecibidasView.js` (J1) · `etiquetasDelDocumento.js`, `jobCobroHuecos.js` (J2) | `node scripts/carriles.mjs huecos` |

**`quoteRevisiones.js` no sale en el censo de huecos**, y es coherente: ningún otro puesto tiene un fichero con «quote»
ni con «revisiones» en el nombre. El censo busca parecidos de nombre, y aquí no lo había: la duda no venía del nombre.

**Lo que la herramienta ya contestaba.** La cerradura no deduce: lee `.claude/carriles.json`, y ahí el fichero era de
S2 antes y después. Quien tenía que deducir era la sesión que leía la tabla. La pregunta de la S4 se contestaba con
el comando de la primera fila, que está en `main` desde el 6-oct-2026 (#2001).

## El cambio

- `docs/equipo/dos-equipos.md` §3.2: una fila, `dashboard/js/quoteRevisiones.js` → S2, con quién lo decidió y cuándo.
- `.claude/carriles.json` y `.claude/rules/carril-s2.md`: regenerados (60 filas, 157 reglas, 137 con dueño; antes 59,
  156 y 136). Segunda pasada: 0 escritos.
- `docs/equipo/afirmaciones-verificadas.md`: tres filas del 9-oct.

## Aceptación → dónde se ve

La aceptación es el punto 4 del encargo del orquestador de Luis a esta sesión (9-oct-2026, 08:10Z); no está escrita en
el ticket.

| aceptación | dónde se ve |
|---|---|
| «`quoteRevisiones.js` no tiene fila en `dos-equipos.md`… Ponle fila explícita» | `docs/equipo/dos-equipos.md` §3.2, la fila anterior a la general |
| «mira si hay más ficheros de `public/dashboard/js/` en la misma situación» | la tabla de arriba: 65 de 95, con su comando |

## Lo que no se ha hecho, dicho

- **No he dado fila a los otros 64.** El orquestador decidió UNO. Siete de ellos son la pregunta de §7.4, que es de los
  dos jefes, y una fila mía la contestaría por ellos.
- **Dos familias que el censo de huecos no ve, y se parecen a ficheros de S4.** Diez `job*.js` (`jobDetailView.js`,
  `jobActionsRegistry.js`, `jobAgendar.js`, `jobAsignados.js`, `jobDocsReparto.js`, `jobNextAction.js`,
  `jobNuevoModal.js`, `jobRailBlocks.js`, `jobTrabajoPlegable.js`, `jobsCierreTrabajo.js`) frente a `jobsView.js`, y
  `albaranesView.js` frente a `albaranDetailView.js`. Motivo, leído en `palabrasDe` (`scripts/_carriles.mjs`): no cuenta
  palabras de menos de cinco letras («job», «jobs») y al plural sólo le quita la «s» final («albaranes» queda en
  «albarane», que no es «albaran»). Es un límite del instrumento, no arreglado aquí: cambiarlo mueve la cifra «32» de
  §7.4 y abre más preguntas para los jefes.
- **No he corrido la suite completa** (memoria de la máquina): los tests que leen los documentos tocados y
  `guards:entrada`.
