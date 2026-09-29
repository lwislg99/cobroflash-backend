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

---

# SCRUM-1205b · el guard de la lista declara el modo de emisión (arreglo del equipo de Javier)

**Medido contra:** `origin/main` = `eb22747894488820a6f09ffb091e1340e6fea187` · 2026-09-28T21:05:43Z (J2, equipo de Javier)

## Por qué toca esto el equipo de Javier

`scripts/guard-lista-trabajos-917.mjs` es del equipo de Luis. Lo toca el de Javier **por decisión del
fundador**, citada literal en el **comentario 17434 de este ticket** (Jira): «2-No, da igual, si no si lo
podemos hacer nosotros lo hacemos y se lo incluimos en el mensaje de esta noche». El motivo es el
bloqueo: `main` estaba en rojo en el job «guards de navegador» por sí solo, y ningún PR auto-mergeaba
en ningún equipo. **Si al equipo de Luis le parece mal, se revierte sin discusión.**

**Su código no estaba mal.** La puerta de SCRUM-1205 es correcta y se queda como está; lo desfasado era
el guard, que medía una expectativa caducada. Es el caso CONTRARIO al que vigila la regla 41 (ya dicho
en el comentario 17406).

## La causa, re-medida (corrige un detalle del 17406/17434)

La puerta que rompió C.1 es la de **`jobsView.js`** (`cobraAqui` exige `facturaFiscalDisponible()`), que
entró con `7c2bd6bc`. La de `jobNextAction.js:72-74` es anterior (SCRUM-1160, `d9aca2ea`, 26-sep) y no
hacía caer el guard porque la fila pintaba su propio «💰 Cobrar el resto». Con las dos puertas, y sin
`window.appModoEmision` en el montaje (lo pone `app.js`, que el banco no carga), `facturaFiscalDisponible()`
falla cerrado y el botón no sale nunca. Reproducido en local: 2 de 49 en rojo, las dos de C.1.

## Qué cambia (ni `jobsView.js` ni `jobNextAction.js` se tocan)

- `scripts/_banco-lista.mjs`: una ruta puede declarar `modoEmision` (solo los valores del contrato de
  `app.js`, o `null`; otro valor lanza). Aditivo: una ruta sin la clave produce el MISMO documento que
  antes, así que los demás guards del banco no cambian.
- `scripts/guard-lista-trabajos-917.mjs`: las cuatro rutas de siempre declaran `fiscal` (el modo del
  inventario de SCRUM-917) y una ruta nueva `/t-justificante` declara `receipt`, con los MISMOS Trabajos.
  **C.6 nuevo:** en modo justificante, ningún control de la lista dice «Cobrar». Con suelos: si la
  página no lleva `receipt`, si faltan filas o falta la del terminado con saldo, NO SUPE MIRAR.
- No se quita ni se baja nada: C.1 sigue exigiendo «💰 Cobrar el resto (740,00 €)» como única primaria.

## Cómo se prueba

- Guard entero: 50 de 50 (49 de antes + C.6), salida 0.
- Mutaciones (árbol restaurado y comprobado con `git status` tras cada una):
  - M1 `/t` sin declarar el modo → C.1 cae (2 rojos) — el rojo de `main`, reproducido.
  - M2 el banco no emite el modo → C.1 cae y C.6 sale NO SUPE MIRAR (salida 2).
  - M3 `jobsView.js` sin `puedeFacturar` en `cobraAqui` → C.6 cae.
  - M4 `jobNextAction.js` sin `puedeFacturar` → C.6 cae (la escalera también se vigila).
  - M5 `/t-justificante` declarado `fiscal` → NO SUPE MIRAR (salida 2).
- Tests que leen el banco, el guard o la puerta de CI (11 ficheros): 97/97; los que censan `scripts/`: 80/80.

## Lo que queda fuera

- `scripts/capturas-lista-trabajos-917.mjs` usa el mismo banco sin declarar modo: fotografía hoy la lista
  sin «💰 Cobrar el resto». No es un guard ni corre en CI; se deja al equipo de Luis.
