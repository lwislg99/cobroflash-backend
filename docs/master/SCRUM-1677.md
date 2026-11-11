# SCRUM-1677 · PARTES · un parte firmado deja de ser un callejón sin salida (PILOTO-1)

**Medido contra:** `origin/main` = `9ff55cb3d9fe56669f956814451435027fda67fb` · 2026-11-10T18:21:57Z

A9: comprobación → `tests/scrum352-target-tactil-variantes.test.mjs`
A9: comprobación → `tests/scrum710b-anclaje-por-identidad.test.mjs`

**Puesto:** S4 · **Rama:** `scrum-1677-parte-firmado-salida-al-trabajo` (sale de `275bc626371e63231556c04de6e9db44cff2629e`; fusionada con `main` tras entrar SCRUM-1675, #3047)
**Skill UI:** cargada (`yaqu-premium-ui`; componentes existentes `.detail-migas`/`.detail-miga-link` y `.btn-primary`/`.btn-secondary`, ningún token nuevo)

## Firma de los textos

Entradas 5 y 6 de la tanda única de PILOTO-1 (SCRUM-1656 c.21405), **firmadas por el fundador**:
SCRUM-1656 comentario 21408. La rectificación SCRUM-1656 c.21411 solo deja sin efecto lo que
c.21408 daba por cubierto del máster y del flag de invitados; las entradas 1-23 siguen firmadas tal
cual. Ficha: `docs/microcopy/2026-11-10-SCRUM-1677-salida-al-trabajo.md`.

> ← Trabajo: {cliente}
>
> Volver al trabajo

## Causa, medida

- `public/dashboard/js/parteDetailView.js` `renderParte`: la cabecera es `<h3>` con el número y un
  `<p>` con el cliente; **ningún enlace** al trabajo en ningún estado, aunque el servidor ya manda
  `jobId` (`partes.routes.ts`, `serializeParteParaElTecnico` y el serializador de la oficina).
- Con el parte firmado, `pintarLasDosFirmas` cambia los dos botones por texto y `pintarDatosDelParte`
  solo trae filas plegables: **0 botones** en la página (medido en el banco, `antes-firmado-390.png`:
  `document.querySelectorAll('button')` con texto = `[]`), igual que lo midió SCRUM-1658 en yaqu.app.

## Arreglo

- **Miga** `← Trabajo: {cliente}` encima del número, en todos los estados (`data-parte-al-trabajo`,
  componente `.detail-migas` de la ficha del trabajo, 44 px de toque).
- **«Volver al trabajo»** bajo las firmas cuando el parte ya no es editable (firmado / facturado,
  `data-parte-volver-al-trabajo`). Primario si no queda firma por dar; **secundario** si queda una,
  para no poner un segundo verde al lado de la firma pendiente (canon SCRUM-823).
- Las dos navegan a `jobs-detail` con el `jobId` del parte (el mismo camino que usa
  `albaranDetailView.js`).
- Bordes, declarados: sin `jobId` no se pinta ninguna (no hay a dónde volver). Sin nombre de cliente
  no se pinta la miga (el literal firmado lo lleva; «← Trabajo» a secas no está firmado) y SÍ sale
  «Volver al trabajo».
- **La copia al cliente** (PDF / WhatsApp) no se construye aquí: no existe ninguna ruta de copia o
  PDF del parte y el canal cruza con S1 y J2/J6. Queda decidida en ticket propio: **SCRUM-1688**
  (aceptación 3).

## Prueba

- `tests/scrum1677-parte-firmado-tiene-salida.test.mjs` — 5 casos en el banco del panel entero
  (`cargarDashboard`): pinta con `renderParteDetailView`, PULSA los botones y mira a dónde navega el
  panel. **Rojo sin el cambio**: 5/5 (vista de `origin/main` repuesta en el árbol y vuelta a quitar).
  Con el cambio: 5/5.

## Capturas (banco con la vista y el CSS REALES, `evidencias/SCRUM-1677/banco/servir.mjs`)

| caso | 390 | medido |
| --- | --- | --- |
| antes · firmado por los dos (main) | `evidencias/SCRUM-1677/antes-firmado-390.png` | 0 botones |
| después · firmado por los dos | `evidencias/SCRUM-1677/despues-firmado-390.png` | miga 44 px · «Volver al trabajo» 44 px, fondo `rgb(22,163,74)` |

El «antes» en yaqu.app es el de SCRUM-1658: `evidencias/SCRUM-1658/capturas/13-firma-cliente-firmada-390.png`
y `22-parte-firmado-1280.png`.

**Falta:** la verificación en **yaqu.app** del «después», que sólo existe cuando el PR entre en
`main` (regla 42: el ticket no se cierra hasta entonces).
