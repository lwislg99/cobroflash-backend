# TAREA ACTIVA — SCRUM-65 · Albarán valorado (precios e IVA opcionales) + SCRUM-67 (PDF legal)

> Gobierna: `docs/YAQU_MASTER.md` + tickets **SCRUM-65** y **SCRUM-67** + `docs/legal/INVESTIGACION_ALBARANES.md` + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama `scrum-65-albaran-valorado` → PR (lo crea Luis a mano, NO uses `gh`) → merge de Luis → suite QA.
> Zona: albaranes (carril A). Toca **schema** (🚨 STOP) y el PDF. Sin dinero, sin fiscal activo, sin superficie pública nueva.

## POR QUÉ ESTA TAREA (contexto)
Es el **prerequisito duro de SCRUM-17** (factura recapitulativa): sin importes en las líneas del albarán no hay nada que consolidar en una factura. Estaba bloqueada por una duda fiscal que **la investigación ya resolvió**:

> **El albarán PUEDE llevar precios** (se llama "albarán valorado") **y sigue SIN tener validez fiscal.** No devenga IVA, no sirve para deducir, no sustituye a la factura. Es práctica estándar del sector (construcción, equipamientos, hostelería). Fuentes: Wolters Kluwer, Cegid, Anfix, Billeo, Factorial.

Riesgo asociado, y por eso va la 67 de acompañante: si el albarán lleva precios y **no está rotulado**, el cliente puede confundirlo con una factura.

## 1. ALCANCE EXACTO

### 1.1 Schema (aditivo) — 🚨 STOP, enséñame el diff antes del db push
- `Albaran.modoValoracion` enum/string `SIN_VALORAR | VALORADO`, **default `SIN_VALORAR`** (el comportamiento actual queda intacto).
- Las **líneas** del albarán (hoy `{concepto, cantidad, unidad}` en `lineas Json`) admiten dos campos OPCIONALES más: `precioUnitario` (número, céntimos o decimal — sigue la convención de la casa) y `tipoIva` (número, p. ej. 21/10/4/0). `descuento` opcional si es trivial; si no, difiérelo.
- **Sin migración destructiva.** Los albaranes existentes quedan `SIN_VALORAR` y sus líneas sin precios. Preview + host-check + `db execute`/`db push` según corresponda, **sin `--accept-data-loss`**.

### 1.2 Validación (patrón `validarLineas` existente, función pura)
- En modo `SIN_VALORAR`: `precioUnitario` y `tipoIva` deben venir vacíos/null → si llegan, error `lineas_invalidas` con mensaje claro.
- En modo `VALORADO`: `precioUnitario` obligatorio y `tipoIva` obligatorio en **todas** las líneas; números válidos y no negativos. Mensaje humano indicando la línea exacta (patrón de la casa).
- Aritmética en **enteros de céntimos** (regla de la casa), nunca floats.

### 1.3 UI (`jobDetailView.js`, carril A)
- Al crear un albarán: **toggle de modo** (`Sin precios` / `Con precios`). Copy sugerido: **"Incluir precios en el parte"** con subtexto **"El parte sigue sin ser una factura"**.
- En modo valorado, el editor de líneas muestra columnas de precio unitario e IVA, y un **total orientativo** (base + total, sin desglose de cuota).
- El modo se puede cambiar mientras el albarán está en **borrador**; una vez `emitido`, queda congelado.
- Cambio mínimo y localizado. `jobDetailView.js` NO está en el SHELL del SW → sin bump de `CACHE_NAME`.

### 1.4 PDF — incluye SCRUM-67 (va en este mismo PR)
**En AMBOS modos:**
- Rótulo destacado en cabecera: **"ALBARÁN / PARTE DE TRABAJO"**.
- Leyenda legal visible: **"Documento sin validez fiscal. No es una factura."**
- Serie y número (ya existe `ALB-YYYY-NNN`), **fecha de emisión** y **fecha de entrega/ejecución** (esta última es la que contará para el mes natural en la 17 — que se vea).
- **Emisor**: nombre/razón social, NIF, domicilio. **Receptor**: ídem (snapshot).
- Líneas con concepto, cantidad y unidad. Referencia al Trabajo/presupuesto origen.
- Bloque de firma + evidencias (fecha/hora, canal WhatsApp o in situ) — ya existe, respétalo.

**SOLO en modo VALORADO (adicional):**
- Precio unitario e importe por línea + total. **SIN desglose de cuota de IVA** (para no simular una factura).
- Leyenda: **"Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente."**

## 2. LO QUE NO INCLUYE
- NADA de facturación/consolidación (eso es SCRUM-17).
- NADA de `tipoOperacion` en el Trabajo (eso es SCRUM-66).
- NADA de evidencias de firma reforzadas (hash/IP) — eso es SCRUM-68.
- Sin tocar el flag `INVOICING_ES_ENABLED`, sin emitir facturas, sin VeriFactu.

## 3. 🚨 STOP CONDITIONS
- **Diff del schema** antes de aplicar a staging (preview + host-check, sin `--accept-data-loss`).
- Si algo empuja a tocar facturación, el flag fiscal o la FSM del albarán → PARA (no toca).
- Hallazgos → reporte (regla 9), no arreglo.

## 4. TESTS
- Puros: validación de líneas en ambos modos (valorado exige precio+IVA; sin valorar los rechaza), aritmética de totales en céntimos.
- Gateado contra staging: crear albarán valorado → emitir → PDF contiene precios, total y las dos leyendas; crear sin valorar → PDF sin importes y con leyenda; albarán existente (legacy) sigue funcionando como `SIN_VALORAR`.
- Suite: añadir asserts al paso de albaranes (§5) y subir versión.

## 5. DEFINICIÓN DE HECHO
- Schema aplicado (staging → mi OK → prod en el orden correcto). Validación pura + UI + PDF en ambos modos.
- build + test verdes; suite verde vía MCP.
- E2E humano: crear un albarán con precios, verlo en PDF con la leyenda, y confirmar que uno sin precios sigue igual que hoy.
- PR con descripción; SCRUM-65 y SCRUM-67 a "En revisión" (la 67 va cubierta aquí).

## 6. JIRA
Al abrir PR: SCRUM-65 → "En revisión" con diffs/tests/suite; comentar en SCRUM-67 que va cubierta en el mismo PR. NO transicionar a Finalizada.
