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

# SCRUM-1480e · Ocho filas de `scripts/` por el área del ticket que creó cada fichero, y el criterio escrito

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T10:01:47Z

A9: comprobación → `tests/scrum1295-carriles.test.mjs`

El fallo: regeneré los carriles y DESPUÉS retoqué una nota de la tabla; el generado lleva la huella del documento
entero y quedó distinto. Lo cazó ese test en la dirigida, antes de empujar. Cicatriz del 9-oct en
`docs/equipo/cicatrices/S0.md`.

Carril S0 (`docs/equipo/dos-equipos.md`, `afirmaciones-verificadas.md`, y desde este cambio `scripts/carriles.mjs`). Sólo
cambia §3.3, que no lee `tests/scrum514-aprobado-y-aplicado.test.mjs`. Los generados los escribe
`node scripts/carriles.mjs generar`.

## Qué pasaba

253 de los 302 ficheros de `scripts/` sólo los cubría la fila general, que no da dueño. El 7-oct la S0 midió cuánto
decide cada criterio posible (comentario 18635) y el 9-oct el orquestador de Luis aceptó uno: **el área del ticket que
creó el fichero**, «porque es el único que da PUESTO y no sólo equipo, y sale de un dato que ya está escrito». Encargo:
aplicarlo a los que decide, dejar el resto con la fila general diciendo que están sin puesto, no tocar los de Javier, y
escribir el criterio donde viva para que el siguiente fichero nazca con fila.

## Lo que recontré antes de escribir nada

La propuesta era del 7-oct sobre `73ce872c`. Una cifra heredada se recuenta:

| qué | resultado el 9-oct | comando |
|---|---|---|
| Ficheros de `scripts/` y cuántos sólo con la fila general | 302 y 253: igual que el 7-oct | `node docs/master/evidencias/SCRUM-1480/partir-scripts.mjs <raíz> <salida.tsv>` |
| ¿Son los MISMOS 253, con el mismo ticket creador? | sí: 0 salen, 0 entran, 0 cambian de ticket; 167 tickets creadores | las dos fotos comparadas como conjuntos (la del 7-oct no está en git) |
| Tickets creadores con etiqueta de área, hoy en Jira | 33, los mismos; 3 de ellos con dos áreas | `key in (<los 167>) AND labels in (area-s0 … area-j6)` |
| Ficheros que el criterio decide | **41**: 28 del equipo de Luis (S0 9 · S3 8 · S4 5 · S5 3 · S2 2 · S1 1) y 13 del de Javier (J6 5 · J1 4 · J3 2 · J4 1 · J5 1) | `node docs/master/evidencias/SCRUM-1480/escalera-scripts.mjs scripts-sueltos-9oct.tsv areas-de-tickets-9oct.tsv --listas` |
| Donde área y autor de git se pueden comparar, ¿se contradicen? | 0 de 41 | el mismo |
| De los 28, ¿algún ayudante lo importa un script de otro dueño o sin fila? | **ninguno**: 8 los importan sólo scripts de su mismo puesto y a 20 no los importa ningún script. Control: `_navegador.mjs` sale con 38 importadores, y el único de los 41 con importadores ajenos es `_hallazgos-y-ciegos.mjs` (37), que es de Javier y no se toca | `node docs/master/evidencias/SCRUM-1480/importadores-por-area.mjs <raíz> scripts-sueltos-9oct.tsv areas-de-tickets-9oct.tsv` |

Las salidas de hoy, en la misma carpeta: `salida-escalera-9oct.txt` y `salida-importadores-por-area-9oct.txt`.

## El cambio

- `docs/equipo/dos-equipos.md` §3.3: **ocho filas, 28 ficheros.** S0 ocho scripts · S0 (contenedor) una lista · S1 uno ·
  S2 dos · S3 cinco · S3 (contenedor) tres listas · S4 cinco · S5 tres. La fila general dice su cifra nueva: **225 de
  302** (contado después del commit, con `recuento-de-la-fila-general.mjs`: 77 con fila propia).
- Bajo la tabla, **«Cómo nace la fila de un fichero de `scripts/`»**: el criterio, cuándo calla, la regla del ayudante y
  la de la lista de declarados, y lo medido. Obliga al equipo de Luis; al de Javier se le propone por su orquestador.
- `scripts/carriles.mjs`: a quien pregunta `de <ruta>` por un script que sólo cubre la fila general se le dice ahí
  mismo que nadie ha decidido su dueño y cómo nace su fila. Es el comando con el que cada sesión respeta su carril, así
  que el criterio le llega sin tener que ir a leerlo.
- `tests/scrum1480e-la-fila-de-un-script-nace-con-el.test.mjs`: los 28 tienen fila que los NOMBRA y del puesto que dio el
  criterio; el aviso sale para un script nuevo y para uno viejo sin fila, y no sale para uno con fila, para uno de
  `scripts/equipo/` ni para uno de producto. Visto en rojo antes del cambio de `carriles.mjs` (1 de 2), y con la tabla de
  `origin/main` los 28 caen en la fila general (4 de muestra, los 4).
- `.claude/carriles.json` y seis `.claude/rules/carril-s*.md`: regenerados (68 filas, 185 reglas, 165 con dueño; antes
  60, 157 y 137). Segunda pasada: 0 escritos.
- `docs/equipo/afirmaciones-verificadas.md`: dos filas del 9-oct.

## Dos desviaciones, declaradas

1. **«Aplícalo a los 41» son 28 filas escritas, no 41.** De los 41, 13 son de áreas de Javier, y el mismo encargo dice
   que lo de Javier no se toca: van a su orquestador (lista en `salida-escalera-9oct.txt`, líneas `AREA j…`).
2. **Cuatro de los 28 van como contenedor, y eso no lo da el criterio: lo añado yo.** Son listas de declarados. Medido en
   dos: `_sin-consumir-declarados.json` lleva 44 commits de los dos equipos, y de `_entorno-prestado-declarados.json` la
   S5 retiró sus entradas en SCRUM-1359. En las otras dos (`_ciegos-por-entorno-declarados.json` y
   `_version-de-fila-dudosa-declaradas.json`) no está medido: sólo llevan el commit que las creó, y las trato igual por
   ser la misma clase de fichero. Con cerradura de puesto, quien tuviera que declarar o retirar SU entrada se pararía.

## Aceptación → dónde se ve

La aceptación es el punto 1 del encargo del orquestador de Luis a esta sesión (9-oct-2026, tercera tanda); no está
escrita en el ticket.

| aceptación | dónde se ve |
|---|---|
| «Aplícalo a los 41 que decide» | `docs/equipo/dos-equipos.md` §3.3, las ocho filas anteriores a `scripts/_suelo-*`: 28 de los 41 (desviación 1) · `tests/scrum1480e-la-fila-de-un-script-nace-con-el.test.mjs` |
| «Los 138 donde el autor sólo da equipo: déjalos con la fila general y DI que están sin puesto» | el último punto de «Cómo nace la fila…», en §3.3: 225 sin puesto, con su desglose · `node scripts/carriles.mjs de <uno de ellos>` lo dice |
| «Los 96 de Javier NO los toques: van en la lista de su orquestador» | ninguna fila con dueño J en este cambio · la lista de los 13 con área, en `salida-escalera-9oct.txt`; los 83 por autor, columna `quien` = `javier` de `scripts-sueltos-9oct.tsv` |
| «escribe el criterio donde viva (no en `YAQU_MASTER.md`), para que el siguiente fichero nuevo nazca con fila» | `docs/equipo/dos-equipos.md` §3.3, «Cómo nace la fila de un fichero de `scripts/`» · el aviso de `scripts/carriles.mjs de` |

## Lo que no se ha hecho, dicho

- **Nada obliga a que un script nuevo traiga fila.** El criterio está escrito y el comando lo recuerda, pero un PR que
  cree un script sin fila entra en verde. Lo que lo haría un rojo es un trinquete («los que sólo cubre la fila general
  no suben de 225»), y no lo he construido: saltaría también en los PR del equipo de Javier, sobre una tabla que ellos
  no editan. Cruza de equipo: lo deciden los dos orquestadores.
- **Los 55 de Luis sin puesto no se han leído** (paso 3 de la propuesta del 7-oct). Siguen en la fila general.
- **Los 17 que no nombra nada en el código y los 8 que sólo se corren a mano** siguen sin mirar: quizá sobran.
- **No he corrido la suite completa** (memoria de la máquina): la dirigida sobre lo tocado y `guards:entrada`.
