# SCRUM-1426 · El parte dice que hay una firma guardada en este móvil, y pregunta antes de firmar encima

**Medido contra:** `origin/main` = `894a037aaaa8273aa59890ddc175c33455c4c5f5` · 2026-10-02T17:59:47Z
A9: comprobación → `tests/scrum890-parte-vacio.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio en `public/dashboard/js/parteDetailView.js`: reutiliza la píldora y el texto de `estadoFirma.js` (inventario AB3), sin componente ni clase nuevos.

2-oct-2026 · **S4** (`s4-2octd`) · rama `scrum-1426-parte-firma-guardada-en-el-movil`. Firma: SCRUM-1426 c.18232. Ficha: `docs/microcopy/2026-10-02-SCRUM-1426-parte-firma-guardada.md`.

## Qué pasaba

Se firma un parte sin red. La firma queda en la cola del móvil. Cerrado el pad, la ficha se veía igual que si nadie hubiera firmado: decía «Falta la firma del cliente», no decía que había una firma guardada, y pulsar otra vez firmaba encima sin avisar. Es lo que SCRUM-1353 arregló en el albarán.

## Lo que se midió antes de firmar el texto

La cola guarda una entrada por documento **y tipo**: `firma:parte:<id>` (cliente) y `firma:parte-tecnico:<id>` (técnico). En un parte puede haber guardada una, la otra o las dos. Por eso la caja va dentro de la caja de su firma, y la pregunta tiene dos variantes.

## Qué cambia

- **La caja.** Con una firma de este parte en la cola, dentro de la caja de ESA firma sale la caja del albarán tal cual («Solo en este móvil» y su detalle, de `estadoFirma.js`). No se copia el literal: se pinta con `pintarEstadoDeFirma`.
- **«Falta la firma del …»** no sale en la caja cuya firma está guardada en el móvil. Vale para las dos.
- **La pregunta.** Pulsar firmar con esa firma ya guardada pregunta antes de abrir el pad, con el texto del cliente o el del técnico. Si se dice que no, no se abre el pad ni se toca la cola. Se pregunta en el clic, no al pintar.
- **Al cerrar el pad** tras firmar sin red, la ficha pinta la caja sin pedir nada al servidor: sólo mira el móvil.
- **Si el almacén no se puede leer** no se afirma nada: ni caja ni pregunta, y «falta» se sigue diciendo.
- Cuando la firma sube, el repintado de SCRUM-1422 se lleva la caja.

## El fallo propio de este ticket

La primera versión esperaba a la cola (`await`) antes de llamar a `firmarParte`, en todos los clics. Eso retrasaba el aviso de «parte vacío», que SCRUM-890 decidió que sale en el mismo clic, y `tests/scrum890-parte-vacio.test.mjs` cayó en rojo. Se arregló el código: un parte que no va a abrir el pad no consulta la cola y sigue por el camino de siempre.

## Verificado, ejecutando

`tests/scrum1426-parte-firma-guardada-en-el-movil.test.mjs`, 12 tests. Vista, cola y almacén reales; el pad es fingido.

- **Antes: 7 rojos y 5 verdes.** Los verdes son los controles (cola vacía, firmas de otro documento, la otra firma no pregunta, almacén ilegible, almacén que lanza).
- **Después: 12 de 12.**
- Con el JS del árbol servido encima de yaqu.app (parte 9 de la cuenta QA, todo lo que no es GET cortado): la caja sale al cerrar el pad sin reabrir, a 8 px del botón; las dos preguntas salen con su texto; decir que no deja el pad cerrado y la cola igual; tras recargar, las dos cajas siguen. El parte real, igual que antes.

## Lo que NO está medido, y lo que queda fuera

- Con el JS **desplegado**: va en el comentario de entrega del ticket.
- El caso «la firma sube y la caja se va» está en el test, no visto en yaqu.app (habría que dejar subir una firma de verdad).
- Un rechazo viejo del servidor sobre una firma del parte: no se toca; lo pinta `avisarDeUnRechazo`, como antes.
- La caja usa un margen en línea de 8 px, el mismo que ya usa el aviso de rechazo de esta sección; no hay clase para eso.
