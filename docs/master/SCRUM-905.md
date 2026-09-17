# SCRUM-905 · Lo que SCRUM-895 dejó: facturar y consolidar donde dan 409, modo desconocido, id crudo y marcador

**Fecha:** 17-sep-2026 · **Carril:** Sesión 4 · microcopy / parte / albarán
**Medido contra:** `origin/main` = `f3ab211d54fb4b04129498985b6a78079cf78448` · 2026-09-17T10:11:51Z
**Rama:** `scrum-905-facturar-solo-si-se-puede`
**Horas:** las de la API de GitHub.

## ① PASO 0 · ¿pasa hoy?

Sí, sobre `b0650ac3` (main con el #1406). **Medido en banco, no en staging:** el merchant QA de staging
sólo tiene un albarán SIN_VALORAR y no hay merchant demo ni VALORADO sin escribir datos (aceptado y
declarado por el orquestador). El banco pinta `renderAlbaranDetailView` y `renderJobDetailView` con
los scripts reales de `index.html`.

| Modo | Detalle VALORADO | Detalle SIN_VALORAR | Ficha del Trabajo |
|---|---|---|---|
| `receipt` | «Facturar lo entregado» (hoja → `facturar-parcial` → 409) | — | «Facturar lo entregado», «🧾 Consolidar en factura» (409 `consolidacion_no_disponible`) |
| `null` | «Facturar lo entregado» | «[PENDIENTE microcopy oficial]» | «Facturar lo entregado», «btnConvertirFactura», «🧾 Consolidar en factura» |
| `demo` / `fiscal` | «Facturar lo entregado» | «[PENDIENTE microcopy oficial]»; al pulsar, franja info con el marcador | «btnConvertirFactura» (id crudo) |

## ② Lo construido

- `facturaFiscalDisponible()` (`albaranAccion.js`) = `fiscal` o `demo`. Falla CERRADO con el modo
  desconocido: el #1406 lo dejaba abierto a propósito; SCRUM-905 decidió lo contrario y el test del
  #1406 cambia con ese motivo escrito.
- Se aplica a las dos primarias de facturar de `firmado` (convertir y «Facturar lo entregado») y a
  «🧾 Consolidar en factura» en la ficha del Trabajo (alcance ampliado por el orquestador).
- La fila del Trabajo no pinta una primaria sin rótulo firmado (criterio de SCRUM-831 en la lista):
  ni id crudo ni marcador.
- **L2** «Convirtiendo…» en la franja mientras convierte, firmado por delegación (comentario 15696).
- **L1** («Convertir en factura», rótulo del botón) **NO se pone**: `MICROCOPY_BLOQUEADA` en
  `scrum302-rotulos-completos` lo bloquea por la sección G de las preguntas al asesor (pregunta 25). La
  firma delegada se retiró (orquestador, 17-sep 14:12 CEST): la delegación de microcopy no levanta un
  bloqueo legal. En demo/fiscal el botón del detalle sigue con el marcador; en `receipt` no se ofrece.
- ⛔ Nada del camino de emisión: las rutas sólo se leen. SCRUM-825 no se toca. Sin schema.
- SCRUM-887 PR 2 (409 `albaran_con_descuento_global`) entró en main durante el trabajo: el manejador
  del botón pinta `e.data.message`, así que su literal se ve tal cual.

## ③ Rojo, verde y mutaciones

- Rojo `36a12db0`: 15 tests (① receipt facturar, ② modo desconocido ×3, ③ id/marcador en la fila ×4,
  ④ consolidar ×2 con su suelo, ⑤ L1 y L2). Suelos en verde: con `fiscal` el banco ve facturar,
  convertir y consolidar.
- Arreglo sin literales `a7ef695d`; L2 `dc624230` (el test de L1 se retiró con la
  firma: ningún test exige L1).
- Mutación: con el marcador de vuelta en la franja, cae el test de L2.
- Fixtures de `scrum304` y `scrum831` miden con `appModoEmision: 'fiscal'`.

## ④ Hallazgos fuera de este ticket

1. El banco de `guard:marcadores-en-pantalla` fuerza `estado = 'borrador'` y no ve albaranes firmados
   (carril S3, ya en el ticket).
2. «📷 Añadir foto» en un albarán firmado responde 409 `albaran_locked` siempre (lo midió el #1406).
