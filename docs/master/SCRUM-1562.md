# SCRUM-1562 · filas del panel que sólo se abren con ratón

## 18-oct-2026 · S3 · la medida (sólo medir; no se ha tocado ninguna vista)

**Medido contra:** `origin/main` = `08a54862e5da60d723c7c5f6121c670d1e17c240` · 2026-10-18T00:13:55Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1562-sonda-filas-sin-teclado`.

A9: comprobación → `docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`

(Es una sonda, no un test: mide, no vigila.)

**Origen.** Al cerrar SCRUM-1560e, Partes de oficina quedó en «NO MEDIDAS» con 12 nodos de verdad:
una fila `div` clicable. El orquestador preguntó si esas filas se pueden usar sin ratón.
(Son 12 NODOS, no 12 filas: con los datos del censo es una sola fila.)

**Cómo.** `node docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs`. Usa el banco de vistas,
sin navegador. Monta las 29 vistas con los datos del censo táctil y saca cada nodo que recibe clic
sin ser un control nativo. De cada uno da `tabindex`, `role`, teclado y los nativos que lleva dentro.
El dueño sale de `node scripts/carriles.mjs de <fichero>` sobre el fichero que DEFINE el handler.
**Control:** la actividad de Inicio sale con `tabindex=0`, `role=button` y `keydown`: la sonda
distingue el caso bueno. Repetida desde el repo: el mismo resultado que en el temporal, 0 diferencias.

**Resultado: 13 elementos en 8 vistas.**

| grupo | vista | elemento | abre | teclado | alternativa nativa | fichero · dueño |
|---|---|---|---|---|---|---|
| bien | Inicio | `DIV.activity-item` | el presupuesto | tabindex 0 · role button · keydown | — | homeView.js · S2 |
| no es acción (delegación) | editor de presupuesto · documento suelto | `DIV.card.quotes-left-card` ×2 | (refresca los pasos) | — | — | quotesView.js · S2 |
| no es acción (delegación) | Ajustes | `DIV` del bloque de condiciones | (el clic va a botones de dentro) | — | — | settingsView.js · J3 |
| fila | Clientes | `TR` ×3 | la ficha 360 | ninguno | **sí**: «📊 Historial» (`openCustomer360`, la misma) | customersView.js · J2 |
| fila | Presupuestos (lista) | `TR` ×1 | el detalle | ninguno | **sí**: «Ver detalle» (`openDetail`, la misma) | quotesListView.js · S2 |
| 🔴 fila | Facturas | `TR` ×2 | el detalle de la factura | ninguno | **no** (dentro sólo la casilla) | invoicesView.js · J1 |
| 🔴 fila | Trabajos | `TR.jobs-fila` ×2 | la ficha del Trabajo | ninguno | **no** («+ Nuevo albarán», «Agendar», «⋯» hacen otra cosa) | jobsView.js · S4 |
| 🔴 fila | Partes de oficina | `DIV.customers-card` ×1 | el parte, para valorarlo | ninguno | **no** (ningún nativo dentro) | parteOficinaView.js · S2 |

Con teclado, desde esas tres listas no se abre ni una factura, ni un Trabajo, ni un parte.

**Lo que esto NO sabe.**
- Sólo el estado montado: sin modales ni pestañas abiertas.
- Los oyentes puestos en `document`: el banco no los guarda.
- Cuántas filas hay en producción: los datos del censo traen 1–3 por lista y el defecto es POR FILA.
- El ancho: es el mismo DOM a cualquier ancho, y el CSS no da teclado.
- Si otra pantalla, como el buscador global, abre esos detalles con teclado: si lo hace, el impacto
  baja, pero el defecto de la lista sigue.
