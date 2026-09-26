# SCRUM-1124 · Retirar el marcador `[PENDIENTE microcopy oficial]` no fiscal (censo + firma + limpieza)

**Medido contra:** `origin/main` = `032afc9ccd2fca0e160af40fcbf1acc0bcf43e0d` · 2026-09-26T06:16:30Z

**25-sep-2026 · Sesión 4 · rama `scrum-1124-marcador-huerfano-jobasignados-parte`.**

## Encargo

Censo completo del marcador `[PENDIENTE microcopy oficial]` en pantallas no fiscales,
propuesta de texto, firma del orquestador por delegación permanente del fundador
(`docs/equipo/limites-del-fundador.md` §Delegación permanente) en el comentario 17002 de
SCRUM-1124, y construcción de los 12 textos + 2 huérfanos de limpieza.

## Lo firmado y aplicado (comentario 17002)

| Sitio | Fichero | Texto |
| --- | --- | --- |
| Buscador «Nuevo albarán» (6) | `albaranDesdePresupuestoModal.js` | ver `docs/microcopy/2026-09-25-SCRUM-1124-buscador-albaran-presupuesto.md` |
| Muestra insuficiente WhatsApp | `reportsView.js` | «Aún no hay suficientes envíos para calcular esto: ${sample} de ${minimo} en los últimos 7 días.» |
| Proveedor duplicado | `providersView.js` | «Ya tienes un proveedor con ese nombre» |
| Switch Empresa/Persona (3) | `switchFormaJuridica.js` | «Este contacto es» / «Empresa» / «Persona» |
| Estado de cobro sin mapear | `invoicesView.js` | «Estado no reconocido: ${codigo}» |
| Referencia de presupuesto en albarán | `albaranPrecios.ts` | «Presupuesto nº» |
| Dirección con albarán firmado | `jobDireccion.ts` | ver `docs/microcopy/2026-09-25-SCRUM-1124-direccion-albaran-firmado.md` |
| Acciones del detalle de albarán (3) | `patronDetalleAcciones.js` / `albaranDetailView.js` | «Procesando…» / «Acción» / «No se ha podido completar la acción. Vuelve a intentarlo.» |

Los 9 sitios fiscales (VeriFactu, libro registro, AEAT) quedan FUERA — no los firma el
orquestador, van al asesor / SCRUM-1041 bloque B.

## Los 2 huérfanos, y la corrección sobre la marcha

`jobAsignados.js` (`MARCA_ASIGNADOS`) y `parteDetailView.js` (`var M`) tenían sus textos YA
aprobados desde `docs/microcopy/2026-09-04-SCRUM-720-los-diez-que-faltaban.md` y
`2026-09-04-SCRUM-720-rotulos-del-parte.md`, con la constante huérfana (ningún texto la
concatenaba ya).

🔴 **Se intentó retirar la constante entera y SE REVIRTIÓ**: `tests/scrum720-marcadores-en-lo-pintado.test.mjs`
fija que el mecanismo se **VACÍA, no se retira** — tiene que seguir existiendo para que el
rótulo que alguien añada mañana sin firmar siga naciendo marcado. Las dos constantes se
dejaron declaradas y sin usar (mismo reparto que `productsView.js`/`providersView.js` con su
marcador de último recurso), y sus entradas en el censo de SCRUM-402 se quedaron en 1
(no se borraron).

## Censos actualizados

- `tests/scrum402-marcador-no-se-pinta.test.mjs` — CENSO: bajan `invoicesView.js`,
  `albaranDesdePresupuestoModal.js`, `reportsView.js`, `switchFormaJuridica.js`,
  `patronDetalleAcciones.js` (entradas BORRADAS); `providersView.js` se queda en 1 (marcador
  de último recurso).
- `tests/scrum755-el-contador-que-cuadro-solo.test.mjs` — CENSO_DE_SITIOS: bajan los mismos
  ficheros; `providersView.js` de 3 a 2 sitios; suelo de alcance bajado de 20 a 8 (población
  real medida); el ejemplo de la vía «literal» se sustituyó por un CONTROL construido, porque
  el árbol real ya no tiene ninguno.
- `tests/scrum667-marcador-visible.test.mjs` — CENSO_SERVIDOR: bajan `albaranPrecios.ts` y
  `jobDireccion.ts`; `EN_EL_PAPEL` pierde `ROTULO_PRESUPUESTO_ORIGEN` (ya no imprime marcador).
- `tests/scrum650d-pantalla-asignar.test.mjs` — literal-con-marcador se queda en 1 (la
  declaración huérfana de `MARCA_ASIGNADOS`), no en 0.

## Tests que dependían del marcador y se reescribieron con el literal aprobado

`scrum530` (WhatsApp), `scrum644` (proveedor duplicado), `scrum574` (switch), `scrum748`
(estado sin mapear), `scrum283` (retirada la comprobación de `MICROCOPY_PENDIENTE`, que dejó
de existir).

## Verificación

Barrido dirigido de ~28 ficheros de test (los 8 sitios + sus consumidores + el registro de
microcopy): **250+ tests, 0 fallos**. Suite completa: 8247 tests, 66 fallos — TODOS
preexistentes y ajenos a este ticket (drift de esquema `CustomerSite`/`retencionGarantia*`/
`sku` ya diagnosticado en SCRUM-1122, más webhooks de Stripe/MP/WhatsApp con secretos de
entorno). Ninguno menciona un fichero tocado aquí.

`npm run build` falla por el mismo drift de esquema (no relacionado con este ticket); `tsc`
emite igualmente el JS de los dos ficheros `.ts` tocados aquí pese al error, así que `dist/`
refleja el cambio.
