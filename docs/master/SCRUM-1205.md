# SCRUM-1205 · «💰 Cobrar el resto» de la LISTA de Trabajos fallaba siempre en modo justificante

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:48:53Z

## Qué pasaba

SCRUM-1160 arregló la ficha: `jobNextAction` salta el cobro sin `facturaFiscalDisponible()`. La LISTA
(`jobsView.js`) calculaba su propio `cobraAqui` sin mirar el modo. `POST /admin/jobs/:id/collect-rest`
emite una factura y en `receipt` responde 409 `facturacion_no_disponible` con el `message` sin firmar.
`avisoDeFallo` lo pintaba: toast rojo «No se pudo generar el cobro: [marcador]». `receipt` es hoy el modo
de todo merchant español real.

## Qué cambia (solo front; `jobs.routes.ts` no se toca)

- `cobraAqui` exige `facturaFiscalDisponible()`, el mismo criterio que la ficha (falla cerrado con el modo
  desconocido). Sin él, `siguiente` (la escalera) ya se salta el cobro y la fila sigue con su siguiente
  paso: no queda un botón muerto.
- Cinturón: si aun así llega ese 409 (o un `message` con el marcador), el toast es el texto FIRMADO de
  SCRUM-1160 (`textoDeErrorDeFacturar`, «Desde tu cuenta todavía no se pueden generar facturas.»). Los
  demás errores siguen saliendo por `avisoDeFallo` como antes. Sin texto nuevo.

## Cómo se prueba

`tests/scrum1205-cobrar-resto-lista-modo.test.mjs` mide el viaje: merchant → `modoEmisionVisible` (de
`dist`) → la sentencia REAL de `app.js` → `renderJobsView` con un Trabajo terminado con saldo → ¿botón?
Casos: ES real (receipt) no · sin modo no · **control positivo** con el flag (fiscal) sí, con su importe ·
cinturón: 409 → texto firmado, nunca el marcador · control: otro 409 firmado sale como antes.
Control de ceguera: la fila del Trabajo (su cliente) tiene que estar pintada.

- En rojo: sin la condición de modo (= main de hoy) caen 2 · sin el cinturón cae 1.
- Vecinos (124 ficheros que cargan `jobsView`, el dashboard, la escalera o `albaranAccion`): 1175/1175.

## Lo que queda fuera

- Menores del ticket (`jobDetailView.js` consolidar y facturar-parcial con `message` crudo): hoy
  inalcanzables porque esos botones ya se ocultan en `receipt`. No se tocan aquí.
- **yaqu.app: NO VERIFICADO.** La lectura de producción la bloqueó un permiso («Production Reads»,
  28-sep); avisado al orquestador. Y la cuenta demo está en modo `demo`, donde el botón SÍ debe salir:
  el defecto solo se reproduce con un merchant en `receipt`.
