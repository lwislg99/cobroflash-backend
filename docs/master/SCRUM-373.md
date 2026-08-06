# SCRUM-373 · Ante el mismo fallo, una pantalla daba una salida y la otra un diagnóstico

**Fecha:** 5-ago-2026 · **Carril:** B (microcopy + guard) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `76f8b8eeb6a04fa0c1c456f0f311cd3b79affadd` · 2026-08-05T17:39:44+01:00

**Tanda:** 1779 tests, 1712 pass, 0 fail, 67 skipped (los 67 son los gateados de staging)

## El defecto

`albaranesView.js` e `invoicesView.js` son pantallas hermanas. Ante **el mismo fallo** —el listado no
carga— una nombraba lo que falló y ofrecía una salida, y la otra empezaba por «Error» y se quedaba
en el diagnóstico:

| Dónde | Decía | Dice |
| --- | --- | --- |
| `invoicesView.js:409` — cargar el listado | `Error cargando facturas.` | `No se han podido cargar las facturas. Vuelve a intentarlo.` |
| `invoicesView.js:542` — pestaña «Pendientes» | `Error cargando pendientes de facturar.` | `No se han podido cargar los pendientes de facturar. Vuelve a intentarlo.` |
| `invoicesView.js:269` — marcar pagadas en bloque | `Error al actualizar las facturas.` | `No se han podido marcar como pagadas. Vuelve a intentarlo.` |

La víctima es el profesional al que se le cae el listado: leía un diagnóstico y no sabía si se
arregla solo, si tiene que recargar o si ha perdido algo. Los tres textos los firmó el asesor; aquí
se copian tal cual.

## Lo que se midió ANTES de escribir el tercero

El asesor pidió expresamente comprobar **qué acción falla de verdad** en `:269` antes de nombrarla,
para que un texto suyo no acabara nombrando mal la acción. Medido, y **su supuesto era correcto**:

* el botón es `#bulk-paid-btn`, cuyo rótulo es `✓ Marcar como pagadas`;
* llama a `POST /admin/invoices/bulk-paid`, y esa ruta hace
  `updateMany({ status: 'paid', paidAt: new Date() })` (`invoicesAdmin.routes.ts:355`);
* el éxito dice «N facturas marcadas como pagadas».

Así que la acción que falla **es** marcar como pagadas. Por eso el verbo es ése y no «actualizar las
facturas», que no dice qué se intentó, ni «cargar», que es de otra ranura y mandaría a recargar
cuando lo que hay que hacer es reintentar la acción.

### Y dos cadenas más, que NO son de este ticket (medido, no supuesto)

`fetchInvoices` y `fetchPendientesFacturar` lanzan `new Error('Error cargando facturas')` y
`new Error('Error cargando pendientes de facturar')` (`:13` y `:21`). Parecen las mismas, pero
**su mensaje no llega a ninguna pantalla**: en toda la vista no se pinta `err.message` en ningún
sitio — solo alimentan `console.error`. Son diagnóstico para quien mira la consola, no copy.

Queda con su propio test: si algún día alguien pinta `err.message`, esas dos cadenas **pasan a ser
copy sin aprobar** y el guard lo dice.

## El guard, al patrón de SCRUM-301: ranura a ranura sobre el AST

Y aquí importa más que allí, porque **las tres frases se parecen muchísimo**: las tres empiezan igual
y las tres acaban en «Vuelve a intentarlo.». Identificarlas por la variable tampoco vale —
`statusBox.textContent` se asigna en **tres** sitios de esta vista (el éxito del marcado, su error y
el error de carga).

Cada aviso se lee **dentro de su `catch`**, y cada `catch` se identifica por lo único que tiene:

| Ranura | Cómo se distingue |
| --- | --- |
| `cargarListado` | su `console.error('[renderInvoicesView] error', …)` |
| `cargarPendientes` | su `console.error('[renderInvoicesView] pendientes error', …)` |
| `marcarPagadas` | estar **dentro del listener** de `#bulk-paid-btn` |

## Verificado en rojo

Seis sabotajes sobre el fichero real, aplicados y revertidos con verificación byte a byte. **Los seis
nombran la ranura tocada**:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| Una letra en `cargarListado` | `cargarListado` |
| Una letra en `cargarPendientes` | `cargarPendientes` |
| Una letra en `marcarPagadas` | `marcarPagadas` |
| Vuelve el genérico «actualizar las facturas» | `marcarPagadas` |
| Un aviso vuelve a empezar por «Error» | `cargarListado` |
| **Los dos avisos INTERCAMBIADOS** entre sí | `cargarListado` |

El último es el que decide, y por eso lo pidió el asesor: **las dos frases siguen en el fichero,
palabra por palabra** —un guard que buscara cadenas daría verde—, pero cada una está en la ranura de
la otra. En pantalla, al fallar el marcado en bloque, el profesional leería «no se han podido cargar
las facturas» y se pondría a recargar en vez de reintentar la acción.

## Lo que NO cubre

* **`Cargando…` no se toca ni se vigila.** Es compartida (tres sitios de esta vista y la misma cadena
  que usa `albaranesView.js`): someterla aquí la convertiría en texto oficial de pantallas que este
  ticket no toca. Decisión del asesor.
* **No se han recapturado pantallas.** Son tres cadenas de aviso dentro de componentes que ya
  existen; no cambia ni un píxel de layout.
* 🔴 **Un hallazgo del handler de `:269` que NO se arregla aquí** (regla 37 — se reporta): el `catch`
  del marcado en bloque envuelve también al `await reload()` que va DESPUÉS del `POST`. Si la
  escritura sale bien y luego falla la recarga, la pantalla dice «no se han podido marcar como
  pagadas» **cuando sí se marcaron**. El defecto es de control de flujo y es anterior a este ticket;
  el texto nuevo no lo empeora ni lo mejora. Arreglarlo es mover `reload()` fuera del `try`, y eso
  toca el camino de una escritura de dinero: su ticket, no éste.

## Ficheros

* `public/dashboard/js/invoicesView.js` — las tres cadenas.
* `tests/scrum373-avisos-facturas.test.mjs` — **nuevo**, 5 tests.
