# SCRUM-1219 · «Sin condiciones específicas» volvía como «Pago 100% al aceptar» al usar la plantilla

**Medido contra:** `origin/main` = `a59dc1e692bae683d2d035fe52534b5589d0c7b3` · 2026-09-28T14:57:35Z

## Qué pasaba

La opción «Sin condiciones específicas» vale `''`. SCRUM-1188 hizo que «Guardar como plantilla»
guardara la condición de cobro, pero solo las tres con nombre: `''` se mandaba como `null`. Al usar la
plantilla, el editor (que nace en `FULL_UPFRONT`) no restauraba nada, y «Usar» desde Plantillas solo
restaura `if (template.paymentTerms)`, así que `''` tampoco pasaba. La plantilla cambiaba la condición
de cobro sin avisar. **No lo causó 1188**: antes se perdía la condición entera; 1188 lo destapó.

Decisión del orquestador (en el ticket): se arregla guardando `''` y restaurándolo, **no con un aviso**,
porque aquí el dato cabe entero. `payment_terms` es `String?` (no enum) y el POST guarda
`paymentTerms ?? null`, así que `''` llega tal cual: **sin ALTER**.

## Qué cambia (solo front, `quotesView.js`)

- `CONDICIONES_QUE_GUARDA_UNA_PLANTILLA` incluye `''`: se guarda y la ficha rápida lo restaura.
- «Usar» desde Plantillas (`loadInitialData`) restaura también `''`, salvo en el documento suelto, donde
  el bloque de condiciones no se pinta.
- Sin cambiar el número de líneas: el ancla de `scrum601` está justo debajo de la constante.

## Cómo se prueba

`tests/scrum1219-plantilla-sin-condiciones.test.mjs` (mismos ayudantes que 1188): elegir «Sin
condiciones» → guardar → servidor en memoria con la regla de la ruta → OTRO editor → ficha rápida / «Usar»
→ sigue en «Sin condiciones». Controles: una plantilla vieja (`null`) abre en `FULL_UPFRONT`; «Personalizado»
sigue guardándose sin condición.

- En rojo: sin `''` en la lista caen 2 · sin restaurar en «Usar» cae 1.
- Vecinos (97 ficheros que cargan `quotesView` o tocan plantillas): 900 pasan, 0 fallan (5 saltos declarados).
- yaqu.app: NO VERIFICADO (lectura de producción bloqueada por permiso, 28-sep).
