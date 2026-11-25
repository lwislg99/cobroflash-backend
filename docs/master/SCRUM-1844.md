# SCRUM-1844 · «+ Añadir miembro» a 44 px de toque

**Skill UI:** cargada (`yaqu-premium-ui`, su checklist AB6: targets ≥ 44 px)

## SCRUM-1844 · J3 · la regla acotada a la cabecera de Equipo, con rojo primero

**Medido contra:** `origin/main` = `f23697aa1c7a7b9715ded3be545a50aaa1597706` · 2026-11-25T02:28:41Z

Puesto J3 (relevo de jv-j3db, que midió el plan en SCRUM-1844 c.22711), rama `scrum-1844b-anadir-miembro-44`,
por encargo del orquestador. Sesión jv-j3dc.

**El defecto.** En la vista Equipo (`renderTeamView`, `public/dashboard/js/teamView.js`), «+ Añadir miembro»
(`#btn-invite-member`, `btn-primary btn-sm`) toca 30,7 px a 390 y 30,8 a 1280: `.btn-sm` lo deja en 30.

**La cura** (la misma de SCRUM-1841 y SCRUM-1148, por contenedor): la tarjeta de cabecera lleva además la
clase `equipo-cabecera`, y en `public/dashboard/css/styles.css`, en un bloque J3 junto al de SCRUM-1639c,
`.equipo-cabecera > .btn-sm { min-height: 44px; }`. `.btn-sm` global no se toca, ni el manejador del clic
(es de S1, SCRUM-1678). Ningún texto nuevo. A 390 la cabecera ya era `flex-wrap: wrap` y el botón no se
sale: el caso b) del test lo mide (un botón recortado no lo alcanza el árbitro y sale corto).

**Antes / después**, medido con `tests/scrum1844-anadir-miembro-44.test.mjs` (copiado del de SCRUM-1841):

| | 390 px | 1280 px |
|---|---|---|
| antes (regla quitada, el test en rojo: 3 fallos de 4, 2 de 2 mediciones cortas) | 30,7 | 30,8 |
| después (4 de 4 en verde) | ≥ 44 | ≥ 44 |

El control c): «Ver su trabajo →» (`btn-ghost btn-sm` de la tarjeta del miembro, fuera de la cabecera) mide
lo mismo con la regla y sin ella, y la caja de «+ Añadir miembro» vuelve a < 44 al quitar la regla real.

**Lo que NO hice, y por qué** (contexto a 128,7k con un tope de 145k: el encargo manda empujar a 130k):
las capturas de 390 y 1280 en `docs/master/evidencias/SCRUM-1844/`; la tanda dirigida (1639, los que
nombran `teamView`, 419, 1415, 1294, 267, 854, 811c, 719); `scripts/guard-objetivo-tactil.mjs`; la suite
entera. Sólo corrí el test nuevo (rojo y verde) y `npm run guards:entrada`. `tests/scrum1639c*` no existe
en el árbol: el de 1639 es `tests/scrum1639-filas-con-teclado.test.mjs`, y no lo corrí.

A9: sin fallo que generalice — el único tropiezo fue lanzar el test sin `dist/` (salió CIEGO, no verde, y lo dijo); ya lo recoge la memoria del equipo sobre los árboles anidados.

## SCRUM-1844c · J3 · verificación alrededor del arreglo (relevo jv-j3dd)

**Medido contra:** `origin/main` = `f23697aa1c7a7b9715ded3be545a50aaa1597706` · 2026-11-25T02:33:36Z

Rama `scrum-1844b-anadir-miembro-44`, punta de partida `f3a3f29ae54576dfa50bf0132c2ebd59500b3d5b` (0 commits por detrás de main). Sin cambios de código en este tramo: solo se mide.

| paso | resultado |
|---|---|
| ① `npm run build` (tsc con tipos) | salida 0; el guard del cliente de Prisma, ✔ |
| ① tanda dirigida: 14 ficheros (`tests/scrum1639-filas-con-teclado.test.mjs`, los 6 que nombran `teamView`, y los de 1844, 419, 1415, 1294, 267, 854, 811c y 719) | 173 casos · 173 pass · 0 fail · 0 skipped · 0 `not ok` de raíz |
| ② `node scripts/guard-objetivo-tactil.mjs` | salida 2: 0 hallazgos · 4 ciegos. Las 4 líneas «FUENTE ROTA en /» (3 de 41 caras de la landing sin bajar) son de esta máquina y no se tocan. Mide 5 vistas del panel a 929 y 390 px; **la de Equipo no está entre ellas**, así que no hay suelo ni excepción de Equipo que poner al día y no se ha usado la autorización de SCRUM-1841 c.22708 |
| ③ capturas a 390 y 1280 de Equipo | **NO HECHO**: no cabía en el contexto del relevo (118k de un tope de 140k). Haría falta un guion nuevo con datos de `/admin/team`. Lo que sí mide la pantalla en navegador es `tests/scrum1844-anadir-miembro-44.test.mjs` |
| ④ `npm run guards:entrada` | salida 0 · 16 guards (con este tramo ya escrito) |

Suite entera NO corrida (el encargo la excluye y no cabía en el contexto).

A9: sin fallo que generalice — el control positivo de `ls-remote` del PASO 0 lo saqué de una rama ya mergeada y borrada (salió vacío); A4 ya exige una rama que exista hoy, y la de 1844b sí salió.
