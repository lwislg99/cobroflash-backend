# SCRUM-1618 · el panel deja decir la FECHA de cobro al marcar una factura pagada

## J1 · SCRUM-1618 · la ficha y el lote mandan `paidAt` solo si se escribe una fecha

**Medido contra:** `origin/main` = `63550e45e6e65f8461e80e4f7e8aa413d5483093` · 2026-10-27T17:37:27Z (hora de GitHub; sesión J1 `jv-j1dg`, por encargo del orquestador `cobroflash-backend-8b`)

A9: comprobación → `tests/scrum373-avisos-facturas.test.mjs`

[Escrito por J1, una sesión; no por el fundador.] La línea `A9:` es el fallo mío de esta tanda: hice que el
lote pintara el mensaje del 400 (`e.message`) sin mirar antes qué prohíbe esta vista, y `scrum373` lo tumbó
en la dirigida. Lo arreglé quitando lo que había hecho (regla 41): el lote sigue diciendo su aviso firmado de
siempre. Otro, sin comprobación nueva: leí Jira antes de `norma.mjs --arranque`, la misma cicatriz J1 del
2026-10-24.

**Skill UI:** cargada (`yaqu-premium-ui`). Sin tokens ni clases nuevas: `form-group`, `label` e `.input`, los
mismos que usa el selector de método de SCRUM-441. `styles.css` es de S2 y no se ha tocado.

**Decisión que lo desbloquea:** SCRUM-1618, c.21161 (fundador, 27-oct-2026): no es STOP de cobro; lo construye
J1 en la ficha y en el lote; el rótulo lo firma el fundador antes de entregarlo. Carril:
`node scripts/carriles.mjs de` → J1 para los dos ficheros. Camino de emisión: no se toca (dos vistas del
panel). `jobDetailView.js` y `quotesDetailView.js` (S2) quedan fuera, como dice c.21161.

### El cambio

- `public/dashboard/js/invoicesView.js` (arriba, pura y exportada): `COPY_FECHA_DE_COBRO`,
  `fechaDeCobroElegida`, `cuerpoConFechaDeCobro(base, input)` (añade `paidAt` SOLO si el campo tiene valor)
  y `pintarFechaDeCobro(contenedor, { id, rotulo })` (rótulo + `<input type="date">` + ayuda, unidos por
  `for` y `aria-describedby`). El lote pinta el campo delante de «✓ Marcar como pagadas» y manda
  `cuerpoConFechaDeCobro({ ids }, campo)`; si sale bien, vacía el campo.
- `public/dashboard/js/invoiceDetailView.js`: pinta el campo con la misma condición que el selector de método
  (factura `pending`) y pasa el cuerpo por la pieza antes del `PUT …/status`, solo al marcar cobrada.
- El campo nace VACÍO a propósito: relleno con hoy, mandaría siempre una fecha que nadie ha dicho.
- Fechas futuras o ilegibles: las rechaza el servidor (`resolverFechaDeCobro`, SCRUM-397/1609) y la pantalla
  no repite la regla. La ficha enseña su mensaje («Error actualizando estado: Esa fecha no puede ser posterior
  a hoy.», composición que ya existía). El lote dice su aviso firmado de SCRUM-373.

### Texto nuevo, FIRMADO (regla 39): SCRUM-1618, comentario 21183 (fundador, 27-oct-2026)

No había literal firmado de «fecha de cobro» en el panel (`grep` en `public/`, `docs/microcopy/` y `src/`:
solo comentarios de código). Se propusieron en c.21176 y el fundador firmó los cuatro con ✅ en c.21183
(1–3 literales, tal cual abajo; 4: el aviso firmado de siempre). La firma se cita en `COPY_FECHA_DE_COBRO`
(`public/dashboard/js/invoicesView.js`). Lo propuesto:

1. Rótulo en la ficha: «¿Cuándo lo has cobrado?»
2. Rótulo en el lote: «¿Cuándo las has cobrado?»
3. Ayuda bajo el campo, en los dos: «Si lo dejas vacío, se guarda la fecha de hoy.»
4. Lote con fecha futura: ¿basta con el aviso firmado de siempre («No se han podido marcar como pagadas.
   Vuelve a intentarlo.»), o se enseña el del servidor («Esa fecha no puede ser posterior a hoy.»)? Lo
   segundo choca con `scrum373` (la vista no pinta mensajes de excepción) y pide decidirlo antes.

### Medido

- Test: `tests/scrum1618-fecha-de-cobro-en-el-panel.test.mjs`, 4 casos. Sobre las vistas de `origin/main`:
  5/5 en rojo (versión con el caso ⑤, retirado después junto con su pieza); con el cambio, verde.
- Mutaciones con `aplicarUna` (`scripts/meta-guard-mutaciones.mjs`), declaradas en el test: 3 de 3 VIVAS.
- Dirigida local (54 ficheros: los que nombran las dos vistas, más scrum237, scrum441, scrum622, scrum976,
  scrum1387 y el nuevo): 429 casos, 423 pasan, 6 caen; 5 de `scrum373` (míos, arreglados arriba) y 1 de
  `scrum976` (faltaba este registro). Repetida después del arreglo, con scrum267, scrum273, scrum1294,
  scrum811c y la colisión de declaraciones: 58 ficheros, 479 casos, 479 pasan, salida 0 (control positivo:
  4 casos de SCRUM-1618 y 5 de SCRUM-373 en `ok`). Mutaciones repetidas: 3 de 3 VIVAS.
- Tanda entera local: NO CORRIDA (10 sesiones a la vez). Guards de navegador: los que nombran las vistas
  entran en la dirigida; no he abierto la pantalla en un navegador. yaqu.app: no verificado al escribir esto (se mira tras el despliegue).

## J1 · SCRUM-1618b · los rojos de #2973: lo que el cambio tenía que declarar y no declaró

**Medido contra:** `origin/main` = `06ad4f1bd53d25b701cd11ae42791db753329ceb` · 2026-10-30T17:21:32Z (hora de GitHub; sesión J1 `jv-j1dg`, relevo, por encargo del orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum1157-censo-convenio-microcopy.test.mjs`

[Escrito por J1, una sesión; no por el fundador.] La línea `A9:` es mi fallo: escribí un solo comentario
encima de tres literales («los tres literales») y di por firmados los tres; el censo solo leyó el primero.
Tampoco metí en la dirigida los censos que miran el árbol entero (1157, 1185, 1215, 921c): 58 ficheros en
verde en local y 6 de los 7 fallos en CI.

Run 40557186284, 27-oct, 12.881 casos = 12.865 pasan + 7 fallan + 9 saltados. Los 7, comparados con los runs
de main 40554143042 (`build + tests` verde) y 40567122288 (sólo cae el meta-guard):

| caso | de quién | arreglo |
|---|---|---|
| SCRUM-1157 ① y ③ | mío | marca `APROBADO` en la línea de cada literal |
| SCRUM-1215g y 1215i | mío, misma causa | la misma marca |
| SCRUM-1511h | mío | filas 1618/21183 y 1618/21221 en `tests/_pares-leidos-en-jira.mjs`, leídas en Jira hoy |
| SCRUM-1185 ② | mío | `bulk-paid::paidAt` pasa a `retiradas` |
| SCRUM-1405c ④ | ajeno (SCRUM-1625) | no se toca; verde en los dos runs de main citados |

Fuera de esos 7: `guard:lista-trabajos` en rojo era mío (la barra oculta metía el campo en la huella de
Facturas). Se arregla en el CÓDIGO: el campo nace con la primera selección, y no se ha tocado el guard. El
meta-guard es ajeno: en la rama y en esos dos runs de main sale CIEGO por presupuesto («CORTO YO», 869, 725 y
714 juzgadas).

De paso, visto en Edge: la ayuda se partía al lado del campo en la barra del lote; va en su propia línea.

Los literales viven en un solo sitio, `COPY_FECHA_DE_COBRO`, con las dos citas que pide c.21221. S2 los usa con
`window.pintarFechaDeCobro`, sin copiarlos; a 30-oct no había entrado nada suyo en main (`git grep` sobre
`06ad4f1bd`).

Medido: `docs/master/evidencias/SCRUM-1618/sonda-1618-lote-en-edge.mjs`, Edge real, 2 facturas pendientes a
1280 px: sin seleccionar, 0 campos; con una y con dos, 1; cuerpo vacío `{"ids":[43,41]}`, con fecha
`{"ids":[43],"paidAt":"2026-03-31"}`; en la base nunca sale. La ficha NO se ha abierto en un navegador. Tanda
entera local: NO CORRIDA (la hace el obligatorio). yaqu.app: no verificado.
