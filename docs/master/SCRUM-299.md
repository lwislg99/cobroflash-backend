# SCRUM-299 · GUARD-COPY-FACTURA: el copy público no promete «factura» sobre el documento post-pago

**Fecha:** 4-ago-2026 · **Carril:** B (QA/guards) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d4bbea95d69802b5eabf9a020cbbd7e80f1a3ac3` · 2026-08-04T16:08:44+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo** (`8275da3`, el trinquete
> bidireccional; el guard original se midió contra `17289f5`/`4d254a6` y ya está en `main`) — el
> ancla apunta al árbol contra el que se midió, igual que SCRUM-252/273 (R14).

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

**BASELINE por FICHERO+CANTIDAD (no por línea — SCRUM-243), TRINQUETE BIDIRECCIONAL:**
`index.html: { n: 3, limpiadoPor: null }` + una `DEUDA_ORIGINAL` inmutable. Cae en **los dos
sentidos**: ⬆️ **SUBIÓ** (promesa en fichero no baselined o `detectado > n`) nombra la nueva; ⬇️
**BAJÓ** (`detectado < n`: se limpió el copy y el baseline quedó viejo) obliga a bajar `n` **y** anotar
en `limpiadoPor` el sha del commit que lo limpió; ✍️ bajar `n` por debajo de la deuda **sin**
`limpiadoPor` también cae. **Por qué los dos:** un baseline que solo mira hacia arriba deja que la
deuda baje **en silencio** —nadie se entera de que se arregló— y si sigue en 3 dentro de tres meses,
LEGITIMA los tres textos que existía para matar. El «porqué» se anota **en el propio baseline**
(campo `limpiadoPor`), no en un comentario suelto. **SUELO ANTES DE COMPARAR** (la mitad peligrosa):
dos controles positivos —lector `presupuesto=34` y detector de una promesa canónica— corren **antes**
de tocar el baseline; un conteo que baja a 0 con el detector roto es «no supe mirar», no «se limpió».
**VERIFICADO EN ROJO LAS DOS DIRECCIONES:** inyectada una 4ª promesa (3→4) → ⬆️ nombrando `:585`;
quitada una de las 3 (3→2) → ⬇️ «baja `n` y anota». Ambas revertidas con `git checkout`. **El texto de
los 3 lo aplica el fundador en su commit (regla 30); esto vigila el cambio.** Ungated **1281 · 1214
pass · 0 fail · 67 skip**.

**COBERTURA (no es SCRUM-253):** el guard corre en `npm test` — suite **1276 · 1209 pass · 0 fail ·
67 skip**; SCRUM-237 NINGUNO 0. No es un script suelto que nadie ejecuta.

## Cierre — textos aprobados aplicados y baseline a 0 (4-ago-2026, commit `246a582`)
Con el trinquete bidireccional ya en su sitio, se transcribieron los textos APROBADOS por el fundador
(reglas 26/30 — transcribir una decisión tomada NO es escribir microcopy), carácter a carácter:
- `index.html:380` «Recibe la factura» → «Recibe el enlace de pago»
- `index.html:424` «¡Genial! Aquí tienes tu factura. Págala cuando quieras:» → «¡Genial! Ya puedes pagar cuando quieras:»
- `index.html:433` «Factura #F-128» → «Reforma de baño»
- FAQ export → «clientes, presupuestos, facturas, cobros, trabajos y gastos se exportan en CSV cuando quieras»

**El baseline bajó a 0 en el MISMO commit**, con `limpiadoPor` anotado al lado — y no por disciplina:
el trinquete lo EXIGIÓ (con el copy limpio y el baseline aún en 3, el ⬇️ cayó pidiendo bajar `n` y
anotar). Verificado al revés: revertir un texto sube a 1 y ⬆️ cae. **La deuda no bajó en silencio: el
guard obligó a registrar el arreglo — la prueba de que el trinquete funciona.** `:317`/`:7`/`:37` NO se
tocaron (categoría de producto, ciertas).

🔴 **El guion H2 (`:498`) NO se aplicó — PARADO a propósito.** Al compararlo con el guion oficial
(`docs/YAQU_MASTER.md:214`, regla 26) falta MÁS que la frase transcrita: (a) una CUARTA frase entera
«Si quieres, le paso a tu gestor el detalle técnico cuando lo publique»; (b) «Te contesto» (oficial)
vs «Te contestamos» (`:498`). El límite del fundador era «si falta alguna otra parte que no
transcribisteis, PARAD; no lo completéis de memoria». Reportado para su decisión.

## Fuera de alcance (no tocado)
El guion H2 completo (`:498`, regla 26 — reportado arriba para decisión del fundador), los tres textos
de categoría (`:317`/`:7`/`:37`), el camino de emisión / el flag / `allocateInvoiceNumber` (regla 38),
y el rediseño de la landing (F1).

## Ficheros
- `tests/_copy-publico.mjs` — censo derivado + `promesasDeFactura` (discriminador A/B declarado)
- `tests/scrum299-copy-factura-publico.test.mjs` — 4 tests, sin gate (suelo · ratchet · control negativo · trampa)
