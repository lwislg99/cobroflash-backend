# SCRUM-1681 · PILOTO-1 · TRABAJOS · modales sin relleno, cierre sin aviso de albarán, alta de cliente

**Medido contra:** `origin/main` = `59540a52a3e783c4ec9f45cea35430afdec5e775` · 2026-11-11T10:33Z (cabecera `Date:` de GitHub)

Puesto: S2. El ticket trae tres P1; van en ramas separadas, una por punto, y el ticket NO se cierra
hasta que las tres estén en `main` y verificadas en yaqu.app (regla 42).

| punto | rama | estado |
|---|---|---|
| ① relleno 0 en los modales de Trabajos | `scrum-1681-modales-trabajo-relleno` | esta entrega |
| ② «Cerrar trabajo» no avisa del albarán emitido sin firmar | — | espera al merge de SCRUM-1680 (mueve el modal de cierre a la ficha) |
| ③ «Trabajo nuevo» sin alta de cliente | — | pendiente |

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
