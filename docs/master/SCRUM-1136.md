# SCRUM-1136 · el importador de clientes perdía EN SILENCIO las columnas que el servidor reconocía

**Medido contra:** `origin/main` = `4fd0b309c265b10d0f376e2fdea856ed99a7d2ba` · 2026-09-28T21:54:31Z (J2, equipo de Javier)

## Qué pasaba (medido antes de construir)

El enunciado decía «el desplegable ofrece sólo los 4 campos viejos». Es cierto y se queda corto.
`/admin/customers/import/preparar` ya PROPONÍA `taxId`, `mobile`, `tags` y los `billing*` para las
columnas que reconoce (NIF, MOVIL, ETIQUETAS, DIRECCION…), pero `csvImport.js` sólo tenía opción para
`name`, `phone`, `email` y `notes`. En el navegador, un `<select>` sin la opción marcada vale la
primera: «— dejar fuera —». Y el aviso «No sabemos qué es esta columna» NO salía, porque el servidor sí
la había reconocido. El cliente se creaba sin su NIF ni su móvil, sin error y sin aviso: **pérdida
silenciosa de datos**. Lo midió también, como forma, SCRUM-1194 (su único PARCIAL).

## Qué cambia

- `public/dashboard/js/csvImport.js`: `CAMPOS` pasa de 4 a 12, en el orden de `CAMPOS_CLIENTE` del
  servidor. Los cuatro de antes no cambian.
- Los ocho rótulos nuevos están **firmados** por el orquestador por delegación del fundador en
  SCRUM-1136 comentario 17445. Registro: `docs/microcopy/2026-09-28-SCRUM-1136-columnas-importar.md`.
  Siete reutilizan literales ya aprobados en otras pantallas. El del país, «País (código, ej. ES)», se
  firmó desde cero: con «País» a secas, un CSV que diga «España» haría fallar TODAS las filas.
- El servidor no se toca.

## Cómo se prueba — el rojo es la PÉRDIDA, no el desplegable

`tests/scrum1136-columnas-reconocidas-llegan.test.mjs` mide el viaje entero: CSV → `proponerMapeo`
(de `dist`) → el modal REAL en el banco de vistas → el cuerpo que manda a `/import` →
`importarClientes` (de `dist`) → el cliente creado.

- **Contra el `csvImport.js` de `main`: caen 3 de 5.** El mapeo que manda la pantalla es
  `{"name":0,"phone":1,"email":4}` y el NIF no llega («el NIF se perdió por el camino»). Con el arreglo,
  5 de 5.
- Casos: NIF y móvil llegan · los DOCE campos llegan, cada uno a su sitio (la población es
  `CAMPOS_CLIENTE` entero) · cada desplegable ofrece exactamente los campos del servidor y en su orden,
  con los rótulos que constan firmados en SCRUM-1136 (`constaAprobado`) · control del helper · control
  negativo de rótulos parecidos.
- ⚠️ **Hueco del banco, declarado y no rodeado en silencio:** el mini-DOM parsea las `<option>` con su
  `selected` pero no deriva `select.value`. El test aplica la regla del navegador (la marcada, o la
  primera) sobre el marcado que pinta el producto. No lo arreglo en `_banco-vistas.mjs` esta noche:
  cambiaría el valor de todos los `<select>` de todas las vistas que mide el banco.
- La sonda de SCRUM-1194 (`docs/master/evidencias/SCRUM-1194/censo-vocabulario.mjs`) sobre este árbol:
  1136 pasa de PARCIAL a «ofrece todo, faltan = (nada)». Su control positivo, que exigía ver 1136
  PARCIAL, sale CIEGO justo por eso. Es un instrumento de un solo uso, no un guard: no se toca.
- Vecinos (59 ficheros que leen `csvImport`, el importador o la microcopy aprobada, más scrum237 y
  scrum976): 574 pass · 0 fail · 4 saltos (piden base de datos, ajenos).

## Lo que queda fuera

- **yaqu.app: NO VERIFICADO** en esta entrega. La verificación es importar en el panel un CSV con
  columna NIF y ver el NIF en la ficha del cliente creado.
- Encontrado y registrado en `docs/BUGS.md` (P3-CONT-1136b), sin arreglar: el servidor no reconoce
  como «exacta» una cabecera `billingAddress` en camelCase. Bajo impacto: no pierde datos, avisa.
