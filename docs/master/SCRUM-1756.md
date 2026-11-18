# SCRUM-1756

## SCRUM-1756b · 18-nov: recibo público y portal del cliente sin CSS en línea (J2)

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:11:12Z (hora de GitHub; sesión J2 `jv-j2d1`, por encargo del orquestador `cobroflash-backend-ee`; la rama lleva main fusionado)

A9: aviso → cicatriz J2 «pasé una mutación por `sed -i` con `\n` dentro de la cadena y la escribió como un salto de línea REAL: el guion de mutaciones quedó con una cadena partida; lo vi al leer la salida antes de correrlo y lo rehíce con la herramienta de edición» — no se pudo comprobar: lo que se teclea en la consola no lo ve ningún guard

Las dos filas de J2 de la tabla de SCRUM-1756. Receta de SCRUM-1723b/c, sin ruta nueva y sin tocar
`publicAccessDeclarations.ts`.

### PASO 0 (sobre `8c8c2b7c2`)

0 commits en main con SCRUM-1756, 0 ramas `scrum-1756*` (control positivo: `scrum-1732c-invoice-payments` sí sale),
0 PR, ticket con 0 comentarios. HTML **servido** (sonda `evidencias/SCRUM-1756/contar-html.mjs.txt`, `dist` de main,
prisma doblado): recibo pagado 2 `<style>` y 9 `style=`; pendiente 1 y 9; portal 1 y 19 (8 en el fuente: la etiqueta
de estado se repite por tarjeta); portal 404 1 y 2. Control sembrado: 1 y 1.

### Qué cambia

- `src/modules/billing/app/routes/reciboPortalEstilo.ts` (nuevo): tres hojas, **copiadas tal cual** por
  `evidencias/SCRUM-1756/generar.mjs.txt` (aborta ante `${`, comilla grave, CR o un ancla que no esté las veces esperadas):
  `recibo` (el `<style>` de la cabecera + 9 clases), `recibo-valoracion` (el `<style>` del bloque de valoración, solo con
  el cobro pagado; su `<link>` queda dentro del bloque, después de la del recibo, como antes) y `portal` (el `<style>` +
  las clases de sus 8 `style=`). La etiqueta de estado del portal pintaba `${c.bg}`/`${c.fg}` de un mapa cerrado: el mapa
  se muda a la hoja y sale una clase por estado, con el gris de antes para un estado desconocido.
- `pagoEstilo.ts`: las tres hojas se sirven por la MISMA ruta, `GET /pay/css/pago.css?p=<hoja>&v=<huella>` (declarada en
  SCRUM-1723 c.21719: recurso constante, sin datos). Van en su propio mapa: `PAGO_CSS` no cambia y el suelo de 9 del test
  de 1723 sigue intacto. `payInvoice.routes.ts`: la ruta sirve `cssDeHoja(pagina)`.
- `receipt.routes.ts` y `customerPortal.routes.ts`: la `<link>` en el hueco de cada `<style>` y las clases. Nada de cómo se
  calcula, cobra o sella. Textos que ve el usuario: **ninguno** nuevo ni cambiado.

### Medido

| qué | resultado |
| --- | --- |
| Sonda del HTML servido, rama | recibo pagado / pendiente, portal y portal 404: **0 `<style>` y 0 `style=`** en las cuatro |
| `tests/scrum1756b-recibo-portal-sin-estilo-en-linea.test.mjs` + el de 1723 | 18/18 (7 nuevos + 11). Rojo primero: sobre main no carga (falta la hoja) — el rojo de contenido lo da la sonda de arriba |
| Edge (`scripts/_navegador.mjs`), `evidencias/SCRUM-1756/recorrido.*` + `servidor-csp.cjs.txt`, 5 vistas (recibo pagado con valoración y bloques de desarrollo, pendiente, fallido; portal con 8 estados; portal 404) × 390/1280 | **A main sin ↔ C rama con política aplicada: 10/10 idénticas** byte a byte · A↔D 10/10 · **control B main con ↔ C: 0/10** |
| Informes CSP en C | **0 de `style-src*`**. Sí hay **8 de `script-src-elem`**: recibo pagado 1 por carga, portal 2, portal 404 1 (ver «Sin hacer») |
| Informes en B (control) | 118 (`style-src-elem`, `style-src-attr`, `script-src-elem`); sembrado 2/2 con política en B y C, 0 sin ella |
| Mutaciones: `MUTACIONES_QUE_ME_TUMBAN` con `correr` + `aplicarUna` de la casa (`evidencias/SCRUM-1756/mutar.mjs.txt`) | **6/6 cazadas**; base limpia 7/7; control inocuo: **MUDA** |
| `tsc -p . --noEmit` con tipos | salida 0, 0 errores |

Mutaciones: `tests/scrum1756b-recibo-portal-sin-estilo-en-linea.test.mjs` → 6/6 (catálogo de la casa; `evidencias/SCRUM-1756/mutar.mjs.txt`).

Error propio en la medida, cazado por el control A↔D: la primera pasada dio **0/10** en A↔D porque compilé el `dist` de
main fuera del árbol y no encontraba `public/` (`inter.css` 404 solo en los puertos de main). Con el `dist` de main
dentro del árbol: 10/10. Lo único que queda en «recursos que faltan» es `favicon.ico` en los cuatro escenarios (el recibo
no lleva `<link rel="icon">`, también en main).

### Sin hacer

1. **Los `<script>` en línea (paso 2) — filas nuevas para la tabla de SCRUM-1756**: `receipt.routes.ts:383` (estrellas de
   valoración), `customerPortal.routes.ts:180` (desplegar líneas y formulario de solicitud) y `:574` (interpola la URL de
   la solicitud). Con la política aplicada dan `script-src-elem` y esos botones dejan de responder. Decisión del orquestador
   (mensaje a esta sesión, 18-nov): rama aparte `scrum-1756c-js-recibo-portal`, para un relevo; esta sesión no tiene contexto.
2. Tanda entera local: la parte corrida está en la entrega de Jira; otros navegadores y yaqu.app: no medidos.

## SCRUM-1756c · 18-nov: recibo público y portal del cliente sin `<script>` en línea (J2)

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:33:55Z (hora de GitHub; sesión J2 `jv-j2d2`, por encargo del orquestador `cobroflash-backend-ee`; rama `scrum-1756c-js-recibo-portal` sobre `scrum-1756b-css-recibo-portal` @ `5e5b1e99c`, que ya lleva main fusionado)

A9: aviso → cicatriz J2 «el recorrido del portal iba a pulsar «Enviar solicitud» con la URL de `data-url`, que es `${BASE_URL}/cliente/…`: sin fijar `PUBLIC_BASE_URL`, el navegador del recorrido la habría mandado a donde dijera el entorno de la máquina; lo vi al leer `env.ts` antes de correrlo» — no se pudo comprobar: el recorrido en navegador no lo ejecuta ningún test

### Qué cambia

Las tres filas que `jv-j2d1` declaró en c.22010, con la receta de SCRUM-1647 (c.21631):

- `receipt.routes.ts` · el `<script>` de las estrellas de la valoración (solo con el cobro pagado) → `${etiquetaGuionDePago('recibo')}`, en el mismo hueco, después del formulario.
- `customerPortal.routes.ts` · el `<script>` del pie de toda página del portal (desplegar líneas y «Solicitar nuevo presupuesto»; también el 404) → `${etiquetaGuionDePago('portal')}`.
- `customerPortal.routes.ts` · `<script>window.PF_REQUEST_URL = "…"</script>`, que interpolaba la URL → fuera. La URL va en `data-url` del `#pf-req-form`, escapada con `esc`.

El código va a dos ramas nuevas de `PAGO_JS` (`pagoNavegador.ts`: `data-pagina="recibo"` / `"portal"`), que sigue siendo una cadena constante sin `${`. Las dos ramas salen antes del escuchador del logo, que esas páginas no tenían. **Ruta: la MISMA `GET /pay/js/pago.js?v=<huella>`**, ya declarada en `publicAccessDeclarations.ts` (SCRUM-1647). **Ninguna ruta nueva** y ese fichero sin tocar; el portal ya usaba `/pay/css/pago.css` desde 1756b. **Cero textos nuevos:** «Enviando…», «Enviar solicitud», los dos `alert` y ▲/▼ son los mismos, movidos de sitio. La huella de `pago.js` cambia, así que las páginas de pago piden el guion nuevo, que les hace lo mismo.

### Medido

- **Rojo primero:** `tests/scrum1756c-recibo-portal-sin-script-en-linea.test.mjs` sobre la rama sin el arreglo: 6 casos, 1 pasa (el control) y 5 caen por su aserción, no por los suelos. Con el arreglo, 6/6; junto con `scrum1756b` y `scrum1647`, 22/22. Tipos con cliente Prisma propio: salida 0.
- **Navegador** (Edge del arnés, `scripts/_navegador.mjs`; `evidencias/SCRUM-1756/j2d2-recorrido.*`). B = antes de este tramo (`5e5b1e99c`) con la CSP de 1637 aplicada, C = rama aplicada, D = rama sin política. Control sembrado: un `<script>` en línea da `script-src-elem` y no corre en B y C; en D, sí corre.
  - C y D: la 3.ª estrella pone `stars=3` y enciende 3; enviar sin estrella no navega; desplegar abre y pone ▲; «Solicitar» abre el formulario; enviar llega al servidor por `/cliente/portal1756/quote-request` y pinta el aviso. **0 informes CSP** en recibo, portal y 404. 0 peticiones fuera de 127.0.0.1 y 0 diálogos.
  - B (el control): `stars=""`, 0 encendidas, enviar sin estrella sí navega, no despliega, el formulario no se abre, 0 solicitudes, y `script-src-elem` en las tres páginas.
  - El POST de la solicitud lo contesta el servidor del recorrido, sin llegar a la app: no se envía nada (regla 28).
- **Muestra de guards (no es la suite entera):** 74 ficheros, los que nombran estos ficheros o estas rutas, más los que recorren el árbol y los registros. Resultado: 641 casos, 632 pasan, 2 caen y 7 saltados (gateados por base: 1390e ×4, 72, 74 y 967b). Los 2 rojos eran míos. `scrum237` cayó porque una negación de `PF_REQUEST_URL` no tenía su positivo con el mismo token, y `scrum976` cayó por arrastre. Arreglado con el positivo en el control sembrado, y vuelto a correr: 237, 976, 1756c, 1294, 267 y 273, 49/49.

Mutaciones: `tests/scrum1756c-recibo-portal-sin-script-en-linea.test.mjs` → 4/4 (catálogo de la casa, `correr` + `aplicarUna`; inocua de control MUDA; `evidencias/SCRUM-1756/j2d2-mutar.*`).

### Sin hacer

- La suite entera en local. Otros navegadores. yaqu.app. Enviar de verdad una solicitud (toca WhatsApp: regla 28).
- El paso 3 (`csp.ts` a aplicada) no es de este tramo.
