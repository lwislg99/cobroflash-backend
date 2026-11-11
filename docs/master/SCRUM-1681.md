# SCRUM-1681 · PILOTO-1 · TRABAJOS · modales sin relleno, cierre sin aviso de albarán, alta de cliente

**Medido contra:** `origin/main` = `59540a52a3e783c4ec9f45cea35430afdec5e775` · 2026-11-11T10:33Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1681-modales-trabajo-con-relleno.test.mjs`

Puesto: S2. El ticket trae tres P1; van en ramas separadas, una por punto, y el ticket NO se cierra
hasta que las tres estén en `main` y verificadas en yaqu.app (regla 42).

| punto | rama | estado |
|---|---|---|
| ① relleno 0 en los modales de Trabajos | `scrum-1681-modales-trabajo-relleno` | esta entrega |
| ② «Cerrar trabajo» no avisa del albarán emitido sin firmar | `scrum-1681b-aviso-albaran-sin-firmar` (lleva fusionada la de ①+③, para compartir este registro sin choque) | entregado en rama (apéndice ② abajo) |
| ③ «Trabajo nuevo» sin alta de cliente | `scrum-1681-modales-trabajo-relleno` (la misma: ① salió con dos defectos de guard, A9 y filtro propio, y se arreglan en el mismo empuje) | entregado en rama |

## ① Relleno de los modales de Trabajos

**Skill UI:** cargada (yaqu-premium-ui). Sin token nuevo: 24 px es `spacing.lg` de `DESIGN.md`, y es
el mismo relleno lateral que `.modal-body` («Trabajo nuevo»), que es el objetivo de la aceptación.

### Causa

«Agendar», «Cerrar trabajo» y «Técnicos» salen los tres del MISMO ayudante, `jobsModal()`
(`public/dashboard/js/jobAgendar.js:37`), que monta `.modal.jobs-modal` y le mete el título, el
cuerpo y el pie DIRECTAMENTE, sin `.modal-header`/`.modal-body`/`.modal-footer`. En el resto del
panel el relleno lo ponen esos hijos; `.modal` no pone ninguno, y `.jobs-modal`
(`styles.css`, bloque «El modal de la casa») sólo fijaba `max-width`.

### Arreglo

`public/dashboard/css/styles.css`: `.jobs-modal { max-width: 420px; padding: 24px; }`. Un solo
sitio, y alcanza a los tres modales sin tocar `jobsView.js` (S4). La hoja inferior de móvil
(`.modal-overlay .modal`, <640 px) no declara `padding`, así que no lo pisa; el test lo vigila.

### Medida (sonda `sondas-s2/prod-1681.mjs`, yaqu.app, cuenta QA, sólo GET; control positivo del interceptor dentro)

Abre «Agendar» de verdad (`abrirAgendarTrabajo` con el trabajo #79 tal como lo devuelve el GET).
`prod` = lo que sirve yaqu.app; `local` = el mismo panel con el `styles.css` de esta rama servido en su lugar.

| ancho | modo | padding | título → borde izq./sup. | pie → borde der./inf. | desborde H | no-GET | errores |
|---|---|---|---|---|---|---|---|
| 390 | prod | 0px | 0 / 0 | 0 / 0 | no | 0 | 0 |
| 1280 | prod | 0px | 0 / 0 | 0 / 0 | no | 0 | 0 |
| 390 | local | 24px | 24 / 24 | 24 / 24 | no | 0 | 0 |
| 1280 | local | 24px | 24 / 24 | 24 / 24 | no | 0 | 0 |

Capturas: `sondas-s2/cap1681/agendar-{prod,local}-{390,1280}.png` (fuera del repo, que es público).

### Test

`tests/scrum1681-modales-trabajo-con-relleno.test.mjs` — rojo sin el arreglo («`.jobs-modal` no
declara `padding`»), verde con él (3/3). Los 96 ficheros de test que leen `styles.css`: 815 tests,
814 pass, 0 fail, 1 skip (preexistente).

### Pendiente para cerrar ①

Tras el merge: `node prod-1681.mjs <out> prod - 79 testigo` (el testigo exige que el CSS servido
lleve `SCRUM-1681`) a 390 y 1280.

## ③ «Trabajo nuevo»: alta de cliente sin salir (y sin preselección de oficio)

**Medido contra:** `origin/main` = `59540a52a`; prod servía `65b37b8d8` al medir. Skill UI cargada.

### Antes (sonda `sondas-s2/prod-1681c.mjs … prod`, cuenta QA)

El `<select>` traía sólo los clientes, con el primero (`86`) elegido de oficio; ninguna entrada de
alta. Con un cliente nuevo había que cerrar el modal, ir a Clientes y volver.

### Arreglo (`public/dashboard/js/jobNuevoModal.js`)

EL MISMO selector que el del presupuesto (SCRUM-591, `quotesView.js` `pintarOpcionesDeCliente`):
1. «Selecciona un cliente…» vacío arriba: ya no se elige a nadie de oficio (el «Elige un cliente.» que
   ya existía para el envío vacío).
2. «+ Nuevo cliente» JUSTO DETRÁS, no al final (regla del asesor del 3-sep-2026 para el presupuesto).
3. Elegirlo abre `window.altaClienteModal.abrirNuevo` —el formulario de Clientes, con NIF, switch
   Empresa/Persona y aviso de duplicado— y el selector vuelve a lo que tenía (si se cancela, no queda
   la acción marcada). Al guardar, el creado entra en la lista, queda ELEGIDO y «Abrir trabajo» se
   enciende (también si era el primer cliente: el aviso «Primero necesitas un cliente.» se retira).

**Textos: CERO nuevos (regla 39).** Los dos rótulos son, palabra por palabra, los que el selector del
presupuesto ya pinta en producción; «+ Nuevo cliente» se firmó el 3-sep-2026 precisamente para una
`<option>`. El test lo ata: si el presupuesto cambia el suyo, sale rojo aquí.
`No se ha podido abrir el alta de cliente.` (sólo si `altaClienteModal` no cargó) es también el
literal que ya usa el presupuesto en el mismo caso.

### Medida (sonda `prod-1681c.mjs … local`, yaqu.app con el JS de la rama servido; el POST de alta lo CONTESTA la sonda con un cliente de mentira, id 990001: nada se escribe en prod)

| ancho | selector al abrir | formulario de alta ENCIMA (`elementFromPoint`) | foco en el alta | tras guardar | «Abrir trabajo» | no-GET | errores |
|---|---|---|---|---|---|---|---|
| 390 | `''` «Selecciona un cliente…», 2.º «+ Nuevo cliente» | sí | INPUT (nombre) | `990001` elegido | activo | 1 (POST /admin/customers, contestado por la sonda) | 0 |
| 1280 | ídem | sí | INPUT (nombre) | `990001` elegido | activo | ídem | 0 |

Capturas: `sondas-s2/cap1681/nuevo-{prod,local}-{390,1280}-*.png`.

### Test

`tests/scrum1681c-trabajo-nuevo-alta-de-cliente.test.mjs` — EJECUTA el fichero real en `vm` con un
`<select>` de juguete que parsea sus `<option>` y lleva `value` como el navegador. Rojo 5/5 contra el
código de main (stash del fichero), verde 5/5 con el arreglo.

### Lo que ③ NO hace (queda en el ticket)

- La «Dirección de la obra» no se rellena con la del cliente elegido (ticket, punto 3, última frase).
  No es aceptación; es un cambio de conducta con su propia pregunta (¿dirección fiscal o sitio
  guardado? SCRUM-1144 ya tiene el selector de sitios en el presupuesto).
- P2 del ticket (Agendar sin fecha propuesta; «?»/«×» < 44 px): fuera de esta rama.

## ② «Cerrar trabajo» avisa del albarán emitido sin firmar · 2026-11-11T11:17Z (GitHub) · `origin/main` = `db202031a449ba21c3cccf32d74afc8ecbda4a33`

A9: comprobación → `tests/scrum1681b-cierre-avisa-albaran-sin-firmar.test.mjs`

**Textos:** firmados. N.º 4 (SCRUM-1656 c.21405): «Este trabajo tiene {n} albarán sin firmar. Si lo cierras, se queda así.»
y su plural (SCRUM-1656 c.21408 ②c): «Este trabajo tiene {n} albaranes sin firmar. Si lo cierras, se quedan así.» Cero textos nuevos.

- `jobsCierreTrabajo.js`: `albaranesEmitidosSinFirmar(job)` (cuenta sólo `estado === 'emitido'`: un borrador no se ha enviado
  y un firmado ya está) y `textoAvisoSinFirmar(n)`. APARTE de `CIERRE_TEXTOS`: aquella tabla es la del saldo, fijada en
  `scrum344` contra su propia firma (SCRUM-1502); ésta se fija carácter a carácter en el test nuevo.
- `jobDetailView.js` (el modal de cierre de la ficha, desde SCRUM-1680): `p.alert` con `role="note"` ANTES de
  `jobCierreSection`. Avisa y NO bloquea: cerrar sigue siendo el mismo PATCH. La sección de cierre de la LISTA vive en
  `jobsView.js` (S4) y no se toca.
- Rojo sin el arreglo: 3 de 5 (literales, singular, plural). Verde 5/5 + vecinos (`scrum344`, `scrum1680`, `scrum402`, `scrum628`) 51/51.

**Medida en yaqu.app:** PENDIENTE. La cuenta QA no tiene ningún trabajo `terminado` (inventario 11:15Z: #79 cerrado,
#78 agendado, #77 y #76 pendiente_agendar; #76 lleva los albaranes 46/50/51 emitidos). Se mide en el recorrido real de
SCRUM-1680: llevar #76 a `terminado` por la UI y abrir el modal (sonda `sondas-s2/prod-1681b.mjs`, sólo GET, no pulsa cerrar).
