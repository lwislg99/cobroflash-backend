# SCRUM-1220 · Ajustes promete justificantes que no existen (modo `receipt`)

**Medido contra:** `origin/main` = `ebdb34720e59826865cc8bfbb74563a89660c821` · 2026-09-28T16:37:51Z (reloj de la máquina, UTC)

Sesión J3 (jv-j3). **Esta entrega MIDE y PROPONE; no cambia ningún texto.** El sustituto lo firma
el fundador (regla 39): hasta entonces `settingsView.js` queda como está.

## 1 · PASO 0 — ejecutado, no leído

Instrumento: `tests/banco-scrum1220/medir-ajustes-modo-justificante.mjs` (se sube, A8). Dos tramos,
y el segundo recibe lo que dio el primero:

1. **Servidor**: la app real (`dist/app.js`) con el doble de Prisma de `_banco-camino-real.mjs`.
   `GET /admin/me` de un merchant `country: 'ES'`, id 4242 (≠ 1, que es el demo), sin
   `INVOICING_ES_ENABLED`.
2. **Navegador**: el dashboard cargado en `_banco-vistas.mjs`, `window.appModoEmision` = lo que dijo
   el tramo 1, `renderSettingsView`, **se pulsa cada una de las 9 pestañas** y se lee el texto del
   panel que queda visible.

Control positivo: el mismo tramo 2 con `fiscal` tiene que pintar «Se emiten facturas» en la misma
pestaña. Lo pinta, así que el banco ve la fila y el resultado de `receipt` no es un cero ciego.

Resultado (178 nodos, 9 pestañas, 0 rechazos):

```
① /admin/me → HTTP 200 · modoEmision="receipt" · documentoSuelto="no"
② modo=receipt
  [Cobros] (cobro)
      › IBAN (para pagos por transferencia — España/Europa)
      › Móvil de Bizum (para cobros por Bizum)
      › El cliente verá este móvil en la página "Pagar por Bizum". Si lo dejas vacío se usa tu número de WhatsApp.
  [Cumplimiento] (cumplimiento) 2 textos
      › Se emiten justificantes de cobro
      › Cada cobro genera un justificante para tu cliente, con su propia referencia. No es una factura y no consume tu serie de facturación.
② modo=fiscal (control)
  [Cumplimiento] (cumplimiento) 2 textos
      › Se emiten facturas
```

**Veredicto: el defecto existe hoy y no es código muerto.** Un merchant ES real con la emisión
apagada recibe `receipt` del servidor, y la pestaña **«Cumplimiento»** le pinta las dos frases,
que son los **únicos dos textos** de esa pestaña.

Lo que las contradice, ejecutado: `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs` +
`tests/scrum396-referencia-justificante.test.mjs` → 20 de 20 en verde sobre este mismo árbol:
en `receipt`, `allocateInvoiceNumber` lanza `invoicing_es_disabled` (`invoiceNumber.service.ts:505`)
y no sale ni factura ni justificante.

## 2 · El IBAN y el Bizum de la pestaña «Cobros» (informe de la S0, 26-sep)

**Se pinta: medido** (arriba, con el tramo 2). **Que el cliente no llegue nunca a «Pagar por
Bizum»: LEÍDO, no ejecutado**, y se dice así. La cadena:

- `/pay/bizum/:token` se alcanza por `Charge.receiptToken`; la única página que enlaza a ella es
  `/pay/invoice/:token` (`payInvoice.routes.ts:120`).
- Los enlaces `/pay/invoice/…` que se le mandan al cliente salen de `invoiceWhatsApp.service.ts` y
  `invoiceReminder.service.ts`: los dos necesitan una factura emitida, que en `receipt` no existe.
- Creadores de `Charge` en `src/` (censo por `charge.create`, 2): `/charges` va detrás de
  `requireInternalSecret` (`app.ts:352`, no lo dispara el profesional) y la liberación de garantía
  (`chargesAdmin.routes.ts`) nace cobrada y no manda enlace.

Es carril de **J2** (formas de cobro): aquí no se toca.

## 3 · Propuesta de texto — ⛔ SIN FIRMAR, no se aplica

Solo la fila de la pestaña «Cumplimiento», claves `TITULO_MODO_EMISION.receipt` y
`DETALLE_MODO_EMISION.receipt`. `fiscal` y `demo` no se tocan.

**Opción A (recomendada)**

> Aún no se emiten documentos

> Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.

Cada afirmación, contra el código: «no genera facturas ni justificantes» = el `throw` de
`allocateInvoiceNumber` en `receipt` (20/20 arriba). No promete cobro ni fecha, y no nombra
VeriFactu, la AEAT, Hacienda ni el calendario (regla 26: eso es el guion H2). «Aún no…» sigue el
patrón ya firmado de «Aún no disponible en tu cuenta» (SCRUM-904).

**Opción B (no recomendada)**: callar la fila en `receipt`, como hizo SCRUM-1164 con sus notas.
Medido: deja la pestaña «Cumplimiento» **vacía** (sus dos textos son los de esta fila).

Si se firma A, el cambio es de dos cadenas y tiene que pasar por los guards de SCRUM-298 que
recorren las tres ramas del modo; se hará en esta misma rama.

## 4 · Carril

La fila del modo vive en «Cumplimiento», que no es formas de cobro ni datos fiscales: la trato como
«lo general» de `settingsView.js`. Si el orquestador la asigna a J1 (fiscal), se entrega a J1.

## SCRUM-1220b · Opción A aplicada con la firma delegada

**Medido contra:** `origin/main` = `2b4db6a2948ba062909c38f3cac7e495c2b1e8cc` · 2026-09-28T16:45:12Z (reloj de la máquina, UTC; main no toca ninguno de los ficheros de esta rama desde la base)

Firma: **SCRUM-1220 comentario 17385**, del orquestador por delegación del fundador, leída en Jira
antes de aplicarla. Ficha: `docs/microcopy/2026-09-28-SCRUM-1220-modo-justificante.md`.

- `settingsView.js`: `TITULO_MODO_EMISION.receipt` y `DETALLE_MODO_EMISION.receipt` con los dos
  literales firmados, más una nota que marca como historia el comentario de la redacción anterior.
  `fiscal` y `demo` no se tocan.
- `tests/scrum298-modo-visible.test.mjs`: en `APROBADOS` salen las dos frases retiradas y entran las
  dos nuevas, cada una con su procedencia (comentario 17385 y el `throw` que la sostiene). Es la vía
  que el propio guard dicta; no se relaja nada.
- Primero en rojo: con la vista cambiada y `APROBADOS` sin tocar, el guard cae con
  «HAY MICROCOPY ESCRITA SIN APROBAR … ["Aún no se emiten documentos","Por ahora, YaQu no genera
  facturas ni justificantes desde tu cuenta."]» (11 pass, 1 fail). Con `APROBADOS` al día: 12 de 12.
- El banco, corrido otra vez: en `receipt`, «Cumplimiento» pinta «Aún no se emiten documentos» y
  «Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.». En `fiscal` sigue saliendo
  «Se emiten facturas».
- Sin cargar `yaqu-premium-ui`: el cambio son dos cadenas de texto en una fila que ya existe; no
  cambia ni un token, ni la maquetación, ni un componente.
- `tests/scrum710b-anclaje-por-identidad.test.mjs`: al retirar la procedencia antigua desaparece su
  ancla `verifactu.service.ts:333`, y el trinquete lo cazó («se han ARREGLADO 1 anclaje(s) … declarados
  1, hay 0»). Se borra esa entrada de `CONOCIDOS_A` en el mismo cambio, como pide el propio guard.
