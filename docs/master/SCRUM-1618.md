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

### Texto nuevo, SIN FIRMAR (regla 39) — por eso la rama NO se ha empujado

No había literal firmado de «fecha de cobro» en el panel (`grep` en `public/`, `docs/microcopy/` y `src/`:
solo comentarios de código). Propuestas, para ✅/❌ en Jira:

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
  entran en la dirigida; no he abierto la pantalla en un navegador. yaqu.app: no verificado (no empujado).
