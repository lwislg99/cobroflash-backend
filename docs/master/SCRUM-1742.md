# SCRUM-1742 — El pad de firma del parte cabe en el móvil (filas 14, 15 y 16 del recorrido H6 de SCRUM-1686)

**Puesto:** S4 · **Rama:** `scrum-1742-pad-de-firma-cabe` · 16-nov-2026
**Skill UI:** no cargada · A9: debí cargarla antes de tocar la caja del pad y no lo hice. El cambio no trae token, color ni texto nuevo (usa `var(--border)`), pero eso no la sustituye.
**Medido contra:** `origin/main` = `f84a8ca16ce3b3365fb4e1c08635a48377bcc683` · 2026-11-16T17:10:06Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `scripts/guard-pad-de-firma-cabe.mjs`

## El defecto, medido

En yaqu.app, 16-nov-2026, a 390×844 (recorrido H6, apéndice H6b de `docs/master/SCRUM-1686.md`):

| fila | qué se veía |
|---|---|
| 14 | el pad medía más que la ventana: técnico 901 px, cliente 1.195. El recuadro del cliente EMPEZABA en y=925 y «Confirmar firma» quedaba en y=1129. Se desplazaba, pero el dedo sobre el recuadro dibuja |
| 15 | «Borrar», «Cancelar» y «Confirmar firma» medían 30 px de alto |
| 16 | «Nombre de quien firma» nacía vacío para el técnico, con el parte diciendo ya quién es |

**Rojo primero.** `scripts/guard-pad-de-firma-cabe.mjs` monta lo real (`parteDetailView.js`, `signaturePad.js`, `styles.css`, microcopy de `dist/`) y abre el pad por `window.firmarParte`. Sobre `main`, commit `535a1f7db9a2c588c2de96a01563bae327933812`: **11 de 11 casos en rojo**, con las mismas cifras que producción (recuadro del cliente y=925–1115, «Confirmar» y=1129–1159; técnico, «Confirmar» y=835–865; botones 30/30/30). Que el banco reproduzca los números de yaqu.app es su control.

## Lo que cambia

- **`signaturePad.js`** · la tarjeta tiene tres pisos: cabeza (título), cuerpo (pista, quién firma, resumen) y pie (confirmación, recuadro, aviso, botones). Sólo el cuerpo se desplaza. En ventanas de menos de 700 px de alto el recuadro mide 150 px en vez de 190.
- **`styles.css`** · `.firma-pad` limita el alto a la ventana (`100dvh`, con `100vh` de respaldo) con un suelo de 480 px; los tres botones del pie, a 44 px con regla acotada (patrón de SCRUM-962; `.btn-sm` global no se toca).
- **`parteDetailView.js`** · el pad del TÉCNICO nace con su nombre sólo si el parte nombra a UN técnico; editable y borrable. Decisión del orquestador (descripción de SCRUM-1742, opción «a»). El del cliente no se toca: SCRUM-300 sigue mandando.
- Ni un texto nuevo.

**Una decisión mía que conviene mirar.** Al empezar el trazo, el cuerpo se lleva al final para que el resumen quede pegado encima del recuadro. Sin eso, con el recuadro siempre a la vista, el cliente podría firmar con el resumen fuera de la vista, y SCRUM-466 pide «el albarán arriba y el recuadro debajo, a la vez». Al abrir, el pad del cliente enseña primero el nombre y las calidades; el resumen queda debajo, dentro del cuerpo.

## Verde

| qué | resultado |
|---|---|
| `npm run guard:pad-de-firma-cabe` | 11 de 11 · técnico y cliente a 390×844, 390×664, 320×568 y 1280×800; más 20 líneas, dos técnicos y ninguno. Tarjeta de 812 px a 390×844; recuadro y=560–750; «Confirmar» y=764–808; botones 44/44/44 |
| `tests/scrum1229-firma-del-tecnico-viaje.test.mjs` | 9 de 9 (4 nuevos, de SCRUM-1742). Vistos en rojo quitando `nombreInicial` del llamador: 2 de 9 caen (`git diff --numstat`: 1 y 1) |
| los 35 ficheros de `tests/` que nombran el pad, `firmarParte` o el registro de guards de navegador | 314 de 314 |

Capturas (ventana, al abrir y firmando, los 11 casos): fuera de git, en la máquina del equipo; se repiten con `PAD_CAPTURAS=<carpeta> npm run guard:pad-de-firma-cabe`.

## Lo que NO está hecho o no se ha medido

- **Regla 42:** no se ha visto en yaqu.app. Tras el merge, banco H6 (`b12-firmas.mjs`, en #3175) sobre un parte NUEVO en borrador (el #22 está firmado), a 390 y 1280.
- El móvil apaisado, el teclado en pantalla y Safari: el guard sólo mide Chromium.
- La entrada en `docs/BUGS.md`.
- La suite completa (`npm test`) no se corrió en local: el cliente de Prisma compartido no casa con el esquema de `main` (le faltan `Invoice.merchantCriterioCaja` y `Job.queHayQueHacer`) y no es mío regenerarlo. La juzga el CI.

## Segundo empuje (16-nov-2026, relevo de S4) · la entrada de `docs/BUGS.md`

Medido contra `origin/main` = `6c1024bf177daa47e8d64c60d45565c800137dfa` · 2026-11-16T17:18:27Z (cabecera `Date:` de `gh api -i zen`).

- Escrita la entrada **P1-1742** de `docs/BUGS.md`, en `[ ]` hasta su regla 42. Sólo documentación: este empuje no toca código, tests ni pantalla.
- De paso: la entrada **P1-1722c** pasa a `[x]`, con su regla 42 medida en yaqu.app (21 pasadas, 0 con desborde; SCRUM-1722, comentario 21954). Su rama ya estaba en `main` (#3173).
- Para la regla 42 de este ticket ya existe el parte en borrador que hacía falta: el #23, PT-2026-015, del trabajo QA #84.

**Lo que salió mal (A9).** No cargué la skill de UI antes de tocar el pad. Di una hora estimada («~17:20Z») en un mensaje al orquestador sin leerla de GitHub: eran las 17:0x. Y volqué dos listados largos al contexto en el arranque.

## Tercer empuje (17-nov-2026, relevo de S4) · el rojo del check obligatorio

Medido contra `origin/main` = `a3510f52b208b060e755c81e0c8cc1accc299672` · 2026-11-17T07:23:39Z (cabecera `Date:` de `gh api -i zen`).

El check «build + tests (con banco desechable)» de `d9c71526e` cayó con 2 «✖» de 13.690 tests (run 43917621948), los dos sobre el guard nuevo:

- `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`: el guard salía con cuentas escritas a mano cuando faltaba la microcopy en `dist/` (`veredictoDe` con dos números puestos por el guard). Arreglo en el guard, no en el censo: el ciego se apunta en la lista `ciegos` y la salida la decide `veredictoDe` sobre las listas. No se ha tocado `SALEN_A_MANO`.
- `tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`: el guard no tenía fila en `docs/equipo/dos-equipos.md` §3.3. Se le da fila de **S4** por el área del ticket que lo crea (`area-s4`, etiqueta leída en Jira el 17-nov) y se regenera con `node scripts/carriles.mjs generar`. No se ha tocado `suelo.quedan` ni la foto.

Visto después del arreglo, en este árbol:

- Los dos tests del rojo: 19 de 19. Con los seis de carriles y el del viaje de la firma: 53 de 53, 0 saltados.
- El guard en CIEGO (apartando `dist/modules/jobs/domain/albaranFirmante.js` y devolviéndolo): «0 hallazgos · 1 ciego → salida 2». En verde: 11 casos, medidos 11, salida 0.
- `node scripts/carriles.mjs de scripts/guard-pad-de-firma-cabe.mjs` → S4, `dos-equipos.md:189`.

**Lo que salió mal (A9).** El guard se empujó sin correr los dos censos que miran a todo guard nuevo (cómo sale y de quién es), y el rojo lo dijo el CI once minutos después en vez de mi árbol en uno. Antes de empujar un `scripts/guard-*.mjs` nuevo: `tests/scrum1327-…` y `tests/scrum1480f-…`, que juntos tardan segundos.
