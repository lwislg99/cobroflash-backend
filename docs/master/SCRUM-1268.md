# SCRUM-1268 — `scripts/qa/sembrar-qa.mjs`: escritura ESTRECHA en la cuenta QA para QA en producción

**Medido contra:** `origin/main` = `b1d8845daf38394c33a22814db323394517c091a` · 2026-09-29T09:59:24Z

Sesión 3 (instrumentos). Encargo del orquestador (`cobroflash-backend-57`), con autorización del fundador para
hacer QA en producción en la cuenta `luisdragonball+qa@gmail.com`, incluida la escritura en Configuración.

## Por qué existe

El clasificador de permisos deniega conducir un navegador contra producción. A S4 se lo denegó como
[Production Reads]; a S1, por dos motivos: el MCP no tiene `fs`, y el `playwright-core` local se marcó como
«Credential Exploration». Este fichero es la única vía, y es estrecha: una herramienta y una regla.

El primer intento, que añadía la escritura a `sesion-panel.mjs`, lo **denegó el clasificador** («Modify Shared
Resources»). No se rodeó. El fundador autorizó un fichero **aparte**: `sesion-panel.mjs` sigue siendo solo de
lectura, así que son dos ficheros con dos reglas. Para retirar la escritura basta borrar este fichero y su regla.

## Lo medido antes de construir (rutas, en el árbol)

| Operación | Ruta | Efectos |
| --- | --- | --- |
| ¿quién soy? | `GET /admin/me` | devuelve `merchantId`, `merchantName` e `isOwner`, pero **no el correo** |
| cliente | `POST /admin/customers` | solo BD; el teléfono no es único y se guarda tal cual |
| trabajo | `POST /admin/jobs` | solo BD + auditoría |
| albarán | `POST /admin/jobs/:id/albaranes` + `claveIdempotencia` | repetir devuelve **200 `repetida`** sin reservar número |
| emitir | `POST /admin/albaranes/:id/emitir` | **irreversible**: gasta número ALB. No envía nada ni factura |
| parte | `POST /admin/partes` | siempre en borrador; solo BD |
| perfil | `PUT /admin/merchant` | responde con la **fila cruda** del merchant (no se imprime) |

La cuenta QA es el merchant **46** («PruebaQA», owner, plan trial). Lo medí con `sesion-panel.mjs get /admin/me`, en solo lectura.

## Los cerrojos

- **Cuenta:** `GET /admin/me` → `merchantId === 46 && isOwner`. Si no se cumple, no sale **ninguna** escritura
  (salida 3). `escritura()` solo acepta el objeto que devuelve esa comprobación: uno fabricado no vale.
- **Lista blanca** de método + ruta (las 6 de arriba), más una lista de **prohibidas** redundante a propósito:
  envíos, facturas, cobros, onboarding, flags y borrados. Tampoco admite query ni fragmento, ni otro host.
  Todo esto se comprueba **antes de la red**.
- **Idempotente:** cliente por nombre exacto; trabajo por cliente y título; albarán por su clave fija por
  trabajo, y **se emite solo si no lo está**; parte en borrador por trabajo. Si hay ambigüedad o la lista viene
  llena (200), responde «no pude» (salida 1) en vez de crear otro.
- **Perfil:** GET → PUT → GET. Imprime, campo a campo, lo enviado y lo releído, y marca «CAMBIÓ SIN
  ENVIARSE» cuando algo cambia sin haberlo mandado. Así se ve solo lo que el esquema descarta en silencio (el
  defecto del IRPF) y lo que se borra al guardar (la familia de SCRUM-1227). `slug` e `invoiceSeriesPrefix` se
  rechazan.

## Pruebas

`tests/scrum1268-sembrar-qa.test.mjs` usa un `fetch` falso **con estado** y no toca la red. Cubre el sembrado
desde cero, la repetición (no crea nada ni vuelve a emitir), el cerrojo en 4 variantes con su control positivo,
la lista blanca (11 rutas fuera y 6 dentro), la cuenta fabricada, 4 casos de fail-closed, el perfil con el
IRPF descartado y el campo borrado, las exclusiones y la falta de sesión. Tiene **3 mutaciones** declaradas
(quitar el cerrojo, quitar la lista blanca, emitir siempre) y las 3 caen.

## Regla de EJECUCIÓN (la añade el fundador; no se ha ejecutado contra producción)

```
"Bash(node scripts/qa/sembrar-qa.mjs sembrar)",
"Bash(node scripts/qa/sembrar-qa.mjs perfil:*)"
```

Antes hay que hacer `node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`, que ya está cubierto
por su regla.

## 1268b · el presupuesto (29-sep-2026, S3, encargo del orquestador)

Sin un presupuesto, S2 no podía verificar 1174 (PDF con cabecera y pie), 1180 («Duplicar» de las cláusulas)
ni 1205 (botón de cobro de la lista). `sembrar` añade un paso ⑤:

- **Lista blanca:** entra `POST /quote/create` y nada más de presupuestos (enviar, decidir, facturar y el
  WhatsApp siguen fuera; el test lo fija con 4 rutas nuevas fuera).
- **Qué crea:** un presupuesto en borrador para el «Cliente de pruebas QA», una línea de 10 € + 21 % IVA,
  con **cabecera y pie** que empiezan por la marca `[QA-1268]`. Gasta un número de la serie de presupuestos,
  que no es fiscal. Como owner no avisa a nadie: el WhatsApp solo sale con `needsApproval`, que exige un
  técnico (`quotes.routes.ts`).
- 🔴 **Idempotencia propia**, porque el servidor no deduplica: antes de crear, lista los presupuestos del
  cliente QA y abre el DETALLE de cada uno (la lista no trae cabecera ni pie) buscando la marca en la cabecera
  **o** en el pie. Dos con la marca → «no elijo» (salida 1). Lista llena (100, `TOPE_LISTADO_QUOTES`) y no
  está → «no lo sé» (salida 1), no crea.
- **Se relee:** tras el 201 se abre el detalle y se comprueba que la cabecera y el pie son los enviados. Un
  201 con un texto perdido sale con 1 y lo dice.
- ⚠️ Si S2 borra la marca de la cabecera **y** del pie al probar, la siguiente ejecución crea otro. Por eso
  la marca va en los dos.

**Regla de permiso:** la misma (`sembrar`); no cambia.

**Pruebas:** 2 tests ampliados (sembrado y repetición; la lista blanca pasa a 15 fuera y 7 dentro) y 3 nuevos
(dos con marca, lista llena con su control a 99, relectura con la cabecera perdida) y **2 mutaciones** más declaradas (no buscar la marca; no releer). Las 5
del fichero caen, comprobado a mano una a una.

**Medido contra:** `origin/main` = `8eaee4ac18dc8096cedc8a603aa99b372d0861bb` · 2026-09-29T10:29:38Z

---

# Apéndice · SCRUM-1268c · `sembrar-qa` mandaba el IVA en porcentaje, y su test no hablaba con el esquema

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
