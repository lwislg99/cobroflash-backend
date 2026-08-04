# SCRUM-299 · GUARD-COPY-FACTURA: el copy público no promete «factura» sobre el documento post-pago

**Fecha:** 4-ago-2026 · **Carril:** B (QA/guards) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `17289f59f73e041b8989bddd69868aca056eec17` · 2026-08-04T15:42:36+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo** (`4d254a6`), no una lectura de
> reloj — el ancla apunta al árbol contra el que se midió, igual que SCRUM-252/273 (R14).

## El defecto que vigila

**Parte M del máster:** sin las variables `INVOICING_ES`, el documento post-pago es «**justificante
de cobro**» (sin numeración de factura, sin QR) — el copy público **NUNCA** lo promete como
«factura». Medido por otra sesión: `public/index.html` lo prometía en tres sitios (`:380` «Recibe la
factura», `:424` «Aquí tienes tu factura», `:433` «Factura #F-128»).

**Esto vigila el COPY, no la emisión.** El código de emisión YA distingue bien: `allocateInvoiceNumber`
corre en los 7 caminos, lee `getEmissionMode`/`INVOICING_ES_ENABLED` y marca `JUST` (V0-0) — medido
en SCRUM-276. Tocar ese camino, el flag o `allocateInvoiceNumber` sería **STOP (regla 38)**; el guard
no los toca. **El TEXTO de los seis copies lo decide el fundador (reglas 26/30)** — esto es solo el
detector. «Imposible antes que vigilado.»

## Qué distingue una PROMESA de una MENCIÓN (declarado en `_copy-publico.mjs`)

El discriminador **no mira la palabra**; mira si hay **señal de ENTREGA AL CLIENTE FINAL** pegada a
«factura».

- **(A) PROMESA — CAE.** «factura» es el documento que el cliente final recibe/paga/tiene. Tres
  formas: **posesivo** (`tu/su factura`), **verbo de entrega** (`recibe/recibirás… factura`),
  **documento numerado** (`factura #/nº`). Son `:424`, `:380`, `:433`.
- **(B) MENCIÓN — NO CAE.** «factura(s)» como **categoría de producto** (que es cierta), meta o
  fiscal/config, sin entrega al cliente: `:317` «clientes, gastos y facturas», la `<meta>` `:7`, el
  **JSON-LD** `:37`, la FAQ, «facturación VeriFactu» `:498`, `terminos:82` «cumplimiento fiscal recae
  en ti», «Serie factura» (config del pro), «ya puedes emitir la factura» (email al merchant).
- Detalle que importa: **«recibo» (sustantivo justificante) ≠ «recibir» (verbo)** — el patrón de
  entrega exige formas verbales y excluye «recibo/recibos», o el comentario `recibo/factura` de
  `whatsapp.ts` caería en falso.

## Cómo está construido (los cinco de la casa)

1. **Censo DERIVADO por recorrido**, nunca lista a mano: `public/**` (todos los formatos: `<meta>`,
   `manifest.json`, `sitemap.xml`, JSON-LD, landing JS) + los emails de `src/modules/messaging/` + el
   copy de `src/integrations/whatsapp.ts`. Un fichero de landing nuevo entra solo. **21 ficheros hoy.**
2. **SUELO:** si el censo deja de leer, FALLA. Control positivo que ya funcionó: «presupuesto» da
   **34** en `index.html`. Si el detector no las ve, no está leyendo.
3. **ROJO POR EL MECANISMO:** commit ANTES; inyectada `Recibe tu factura #F-777` en `precios.html`
   (no baselined) → cae **nombrando** `public/precios.html:129 [posesivo del cliente]` con el
   fragmento, no por un error de parseo. Revertido con `git checkout`, árbol limpio.
4. **CONTROL NEGATIVO:** los tres (A) caen; los ocho (B) —incluidos `:7` (meta) y `:37` (JSON-LD),
   dos formatos distintos— NO caen. Ahí es donde el guard se gana el sueldo.
5. **TRAMPA DE LA CASA:** `public/dashboard/**` (la app del PRO) se **excluye del censo por su
   frontera de carpeta** (no por lista): «Facturas» ahí es del pro, no una promesa al cliente. Un
   test lo verifica.

**BASELINE por FICHERO+CANTIDAD (no por línea — SCRUM-243):** `index.html = 3`. Son las tres promesas
conocidas que corrige el fundador (regla 30). El guard cae si aparece una promesa en un fichero **no
baselined** o si el conteo de uno baselined **sube**; **baja a 0** cuando se limpie el copy, y entonces
exige CERO. Verde hoy y mergeable; caza cualquier promesa NUEVA desde ya.

**COBERTURA (no es SCRUM-253):** el guard corre en `npm test` — suite **1276 · 1209 pass · 0 fail ·
67 skip**; SCRUM-237 NINGUNO 0. No es un script suelto que nadie ejecuta.

## Fuera de alcance (no tocado)
El copy (los seis textos, del fundador), el guion H2 de la FAQ (`:498`, regla 26), el camino de
emisión / el flag / `allocateInvoiceNumber` (regla 38), y el rediseño de la landing (F1).

## Ficheros
- `tests/_copy-publico.mjs` — censo derivado + `promesasDeFactura` (discriminador A/B declarado)
- `tests/scrum299-copy-factura-publico.test.mjs` — 4 tests, sin gate (suelo · ratchet · control negativo · trampa)
