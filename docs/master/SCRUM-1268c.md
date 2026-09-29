# SCRUM-1268c · `sembrar-qa` mandaba el IVA en porcentaje, y su test no hablaba con el esquema

**Rama:** `scrum-1268c-sembrar-qa-iva-en-fraccion` · **Carril:** S3 · instrumentos (s3-29e) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `9911a2dcd809780d80dd117cc6314093f4c6d90f` · 2026-09-29T17:38:28Z

## El defecto (lo midió S1)

`scripts/qa/sembrar-qa.mjs:200` mandaba `tax: 21` a `POST /quote/create`. El esquema
(`src/core/validation/schemas.ts:157`, SCRUM-217) exige la FRACCIÓN y solo tipos que existen. En
producción cada `sembrar` moría con `400 validation_error`, la cuenta QA tenía CERO presupuestos, y
S1 (SCRUM-1279) y S4 no podían verificar nada en pantalla.

## Por qué su test no lo cazó

`tests/scrum1268-sembrar-qa.test.mjs` prueba el guion con un panel falso, y ese panel aceptaba
**cualquier** cuerpo en `POST /quote/create`. Era un servidor de mentira que decía que sí a todo, así
que el guion se estaba probando contra sí mismo. Ahora `POST /quote/create` y `POST /admin/customers`
pasan por los esquemas de verdad (`CreateQuoteSchema` y `customerCreateSchema`, sacados de `dist/`,
los mismos que usan las rutas) y devuelven el mismo 400 que el servidor.

### Es la CUARTA vez hoy (29-sep): juntas son un patrón, sueltas parecen mala suerte

| ticket | el test contestaba con… |
|---|---|
| SCRUM-1229 | la firma del técnico: el cuerpo construido a mano, ya con el nombre correcto |
| SCRUM-1189 | el tipo del parte: un servidor falso que aceptaba cualquier `tipo` |
| SCRUM-1269 | la retención: saltándose el esquema del PUT, que era justo el eslabón roto |
| **SCRUM-1268c** | `sembrar-qa`: un panel falso que aceptaba cualquier cuerpo, así que el guion se probaba contra sí mismo |

El arreglo que se copia: **el cuerpo pasa por el esquema DE VERDAD (de `dist/`)**. Con eso el doble
puede decir que no, y el test puede fallar.

## Medido

| paso | resultado |
|---|---|
| test con el esquema de verdad y el guion SIN arreglar (`tax: 21`) | 🔴 6 fallos, con el mensaje de producción: `El IVA fuera de rango (0 a 1): 21` en `lines.0.tax` |
| guion arreglado (`tax: 0.21`) | ✅ 15/15 |
| **`node scripts/qa/sembrar-qa.mjs sembrar` contra PRODUCCIÓN** | ✅ `presupuesto #202 nº 1 · borrador · con cabecera y pie · CREADO` |
| relectura independiente, `sesion-panel get /admin/quotes/202` | merchant 46, cliente #83, línea 1×10 € con `tax: 0.21`, total 12,1, cabecera y pie `[QA-1268]` |
| `sembrar` otra vez | `presupuesto #202 … · ya estaba` (no se duplica) |

La mutación `tax: 0.21 → 21` queda declarada en `MUTACIONES_QUE_ME_TUMBAN` (la ejecuta `npm run meta:mutaciones`).
