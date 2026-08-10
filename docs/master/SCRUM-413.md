# SCRUM-413 · `Invoice.type` está abierto, y el mapeo a AEAT sella F1 todo lo que no es R1

**Medido contra:** `origin/main` = `4cc5e0451e7e5706acaf6e1acd9b5aed6065f523` · 2026-08-10T17:52:40+02:00
**Rama:** `scrum-413-tipo-cerrado`

> **STOP PARCIAL (regla 38).** Leer el camino de emisión no es stop; modificarlo sí. Esta entrega es
> **medir + preparar el diff + esperar GO**. El diff está escrito abajo y **NO APLICADO**:
> `git diff` sobre `src/` y `prisma/` está **vacío**. Lo único que entra es el guard.

---

## PASO 0 · (1) Censo DERIVADO de los valores de `Invoice.type`

Se cuentan **escrituras al modelo**, no apariciones del literal — la lección la dejó escrita el
censo de `status` en `librosAeat.ts`: `already_paid` parecía un estado y era un campo de respuesta
de la API. Un `grep` habría contado ése y no habría visto los que llegan por ternario.

**211 ficheros `.ts`, 179.659 nodos. 13 escrituras, CERO opacas:**

| valor | dónde se escribe |
|---|---|
| `F1` · `JUST` | `lib/invoicing.ts:328` · `invoicing.service.ts:82` · `jobs.routes.ts:900` · `quotes.routes.ts:617` · `quotesAdmin.routes.ts:209` y `:412` — siempre por el ternario `isReceiptNumber(number) ? 'JUST' : 'F1'` |
| `R1` | `invoicesAdmin.routes.ts:904` (literal) |

**El código escribe exactamente tres: `F1`, `JUST`, `R1`.** El `@default` del schema es `F1` — un
cuarto camino por el que un valor llega sin que nadie lo escriba.

Comparaciones contra esos valores: `JUST` × 3 · `R1` × 5.

### En las TRES bases (censo de SOLO LECTURA)

| base | resultado |
|---|---|
| **staging** `acela/railway` | `JUST` 6 (6 con nº `J-`, 0 selladas) · `F1` 1 |
| **producción** `autorack` | `JUST` 44 · `F1` 11 |
| **desarrollo** `acela/yaqu_dev_javier` | ⚠️ **no medida: no hay credencial en esta máquina** (`DATABASE_URL_DEV` no existe en ninguna `.env`; es la base del carril B) |

🔴 **Y el cruce en producción, que es el hallazgo:**

| tipo | nº `J-` | sellada | n |
|---|---|---|---|
| F1 | no | no | 4 |
| F1 | no | **sí** | 2 |
| **F1** | **sí** | no | **5** |
| JUST | sí | no | 44 |

**Hay 5 facturas en producción con `type: 'F1'` y número `J-…`.** Tipo y número **ya se
contradicen** en datos reales. Son dos ejes distintos y nadie los ata.

## PASO 0 · (2) Qué le pasa a cada uno en `inv.type === 'R1' ? 'R1' : 'F1'`

El mapeo está en **dos sitios**: `verifactu.service.ts:286` y `:703`.

**Medido por AST sobre toda la cadena de funciones contenedoras:**

| sitio | cadena | ¿algo bloquea un `J-`? |
|---|---|---|
| `:286` | `applyVeriFactu` (162-309) → anónima (249-304) | ✅ **sí** — `isReceiptNumber(number)` lanza en `:176` |
| `:703` | `buildVerifactuRegistrosXml` (488-843) → `construirRegistro` (591-771) | 🔴 **NADA en toda la cadena** |

Y la consulta que alimenta el segundo trae **todas** las facturas del merchant de ese año, sin
filtrar por tipo ni por sellado. Solo se excluye lo que lanza `RegistroNoEmitibleError`.

### 🔴 El test que decide, EJECUTADO

No se comprueba que el ternario exista: se alimenta el constructor de XML con una factura de cada
tipo —con la forma **real** de producción, `vf_hash` a `null`— y se lee el `TipoFactura` que saldría.

| tipo interno | se declara HOY | debería |
|---|---|---|
| `F1` | **F1** | F1 ✅ |
| `R1` | **R1** | R1 ✅ |
| **`JUST`** | **F1** | 🔴 **no debe declararse en absoluto** |
| **`ANT`** | **F1** | 🔴 sin dictamen (P16.2) |
| **`LO-QUE-SEA`** | **F1** | 🔴 no debería ni compilar |

**Tres de cinco difieren.** Con `F1` y `R1` coinciden — y eso es el **suelo de la sonda**, no un
resultado: si también hubieran salido distintos, la sonda estaría rota y el rojo no significaría
nada.

> **Lo que esto significa:** los 44 `JUST` y los 5 `F1`-con-número-`J` de producción — **49
> documentos que no son facturas fiscales** — se declararían a la AEAT como facturas completas si
> ese export se ejecutara.

⚠️ **La sonda me mintió a la primera** y conviene dejarlo escrito: mi fixture no traía
`country: 'ES'`, así que los cinco casos lanzaban `verifactu_not_applicable` y parecía que nada
llegaba al mapeo. **El resultado era del fixture, no del mecanismo.** Corregido el fixture, el
mapeo aparece.

## PASO 0 · (3) La reserva de `'ANT'`

`invoicing.service.ts:28`:

```ts
type?: string;  // default 'F1' (se fuerza 'JUST' si la serie sale J-); FISCAL-1 usará 'ANT'
```

Viene de **SCRUM-17** (`7500782`, 22-jul-2026, Luis — «factura recapitulativa con motor de rotura
por mes natural, FISCAL-2»). Es una **nota anticipando FISCAL-1**, que es SCRUM-16/142: los
anticipos. **No hay decisión escrita en ninguna otra parte** — ni entrada de máster, ni pregunta al
asesor. El día que FISCAL-1 escriba `'ANT'`, se sellará como F1 **por el `else`**. Puede que sea lo
correcto; lo que no puede es serlo por accidente. Es P16.2.

---

## La unión cerrada PROPUESTA, valor por valor

| valor | qué es | `TipoFactura` AEAT propuesto | ¿lo sé? |
|---|---|---|---|
| `F1` | factura completa ordinaria | **F1** | ✅ es lo que ya hace |
| `R1` | rectificativa por diferencias | **R1** | ✅ es lo que ya hace |
| `JUST` | justificante de cobro (`J-…`), fuera de toda serie fiscal | **NINGUNO — se excluye del registro** | ⚠️ **P16.1** |
| `ANT` | anticipo (reservado, aún no se escribe) | **F1**, si el asesor lo confirma | ⚠️ **P16.2** |

**Lo que no sé no lo invento**: las dos filas con ⚠️ van a `docs/legal/PREGUNTAS_ASESOR.md` como
**P16.1 y P16.2**, con el formato de P13/P15. También van P16.3 (la final que compensa anticipos) y
P16.4 (si falta algún tipo del catálogo — el XSD admite `F2` y `R2`–`R5`, y el código solo conoce
dos).

**`ANT` NO entra en el guard todavía**, y es deliberado: hoy nadie lo escribe. El día que alguien lo
escriba, el guard se pone **rojo** — que es exactamente lo que tiene que pasar, porque hoy se
sellaría como F1 sin decisión.

---

## 📋 EL DIFF DEL CAMINO DE EMISIÓN — ESCRITO Y **NO APLICADO** (regla 38, esperando GO)

Dos piezas. La primera cierra el tipo; la segunda **sustituye el `else` mudo por un mapeo
explícito** que no compila si aparece un valor sin decidir.

```diff
--- a/src/modules/invoicing/domain/invoicing.service.ts
+++ b/src/modules/invoicing/domain/invoicing.service.ts
+/**
+ * SCRUM-413 · LOS TIPOS DE DOCUMENTO, EN UNIÓN CERRADA.
+ *
+ * Era `String` libre, y el mapeo a AEAT (`type === 'R1' ? 'R1' : 'F1'`) declaraba como factura
+ * completa CUALQUIER cadena que llegara. Cerrarlo hace que un valor nuevo **no compile** hasta
+ * declarar con qué `TipoFactura` se sella — que es dictamen fiscal, no una decisión de código.
+ *
+ * `ANT` (anticipo, reservado desde SCRUM-17) NO está: entra cuando P16.2 tenga respuesta.
+ */
+export type TipoDocumento = 'F1' | 'R1' | 'JUST';
+
 export interface EmitInvoiceInput {
-  type?: string;              // default 'F1' (se fuerza 'JUST' si la serie sale J-); FISCAL-1 usará 'ANT'
+  type?: TipoDocumento;       // default 'F1' (se fuerza 'JUST' si la serie sale J-)

--- a/src/modules/invoicing/domain/verifactu.service.ts
+++ b/src/modules/invoicing/domain/verifactu.service.ts
+/**
+ * SCRUM-413 · EL MAPEO INTERNO → AEAT, EXPLÍCITO Y EXHAUSTIVO.
+ *
+ * `type === 'R1' ? 'R1' : 'F1'` declaraba como F1 todo lo demás EN SILENCIO: un justificante, un
+ * anticipo o una cadena inventada acababan siendo una factura completa ante Hacienda. Medido por
+ * ejecución (SCRUM-413): JUST → F1, ANT → F1, «LO-QUE-SEA» → F1.
+ *
+ * `null` significa **no se declara**, y no es lo mismo que un tipo: un `J-` no es una factura y no
+ * tiene sitio en el registro de facturación (P16.1).
+ */
+const AEAT_POR_TIPO: Readonly<Record<TipoDocumento, 'F1' | 'R1' | null>> = Object.freeze({
+  F1: 'F1',
+  R1: 'R1',
+  JUST: null,   // fuera de toda serie fiscal — no se declara
+});
+
+export function tipoAeatDe(tipo: string | null): 'F1' | 'R1' | null {
+  const t = AEAT_POR_TIPO[tipo as TipoDocumento];
+  if (t === undefined) {
+    // Un tipo desconocido NO se declara como F1 «por si acaso»: se para. Declarar de más ante
+    // Hacienda con el nombre de un profesional encima es peor que no declarar.
+    throw new RegistroNoEmitibleError(`tipo_de_factura_desconocido:${tipo}`);
+  }
+  return t;
+}
@@ applyVeriFactu (≈:286)
-      tipoFactura: invoice.type === 'R1' ? 'R1' : 'F1',
+      tipoFactura: exigirTipoDeclarable(invoice.type, invoice.number),
@@ construirRegistro (≈:703)
-    const tipoBase: 'F1' | 'R1' = inv.type === 'R1' ? 'R1' : 'F1';
+    const declarable = tipoAeatDe(inv.type);
+    if (declarable === null) {
+      // Un justificante no se declara. Se EXCLUYE con motivo, que es el camino que este
+      // constructor ya tiene para «no se puede calificar» — no se omite en silencio.
+      throw new RegistroNoEmitibleError('documento_no_declarable:justificante');
+    }
+    const tipoBase: 'F1' | 'R1' = declarable;
```

### Lo que este diff NO hace, y hay que decirlo antes de aplicarlo

1. **No toca ninguna factura ya emitida** (regla 29). Las 5 filas de producción con `F1` + número
   `J-` **se quedan como están**. Qué hacer con ellas es parte de P16.1.
2. **No cambia el sellado de nada que hoy se selle**: `F1`→F1 y `R1`→R1 son idénticos. Lo único que
   cambia es lo que hoy sale mal.
3. **`exigirTipoDeclarable` en `applyVeriFactu` está por escribir**: ahí el `null` debe comportarse
   como el `throw` que ya existe en `:176`, no como una exclusión silenciosa. Se concreta con el GO.
4. **No toca `INVOICING_ES_ENABLED`** (regla 24) ni `prisma/schema.prisma`.

---

## Lo que SÍ entra: el guard, derivado

`tests/scrum413-tipo-factura-cerrado.test.mjs` — 7 tests, ninguno toca el camino de emisión:

1. **SUELO**: si el censo devuelve **cero tipos**, falla **declarándose ciego** — «nadie escribe
   `Invoice.type`» y «no supe encontrar quién lo escribe» son el mismo número y significan lo
   contrario. También exige >50.000 nodos recorridos.
2. **El conjunto, cerrado por censo**: ningún valor escrito fuera de `{F1, JUST, R1}`, **ninguna
   escritura opaca** (si el valor llega por variable, el censo no puede saber cuál es), y el
   `@default` del schema dentro del conjunto.
3. **Hermano positivo** (SCRUM-237): el censo reconoce un tipo nuevo teniéndolo delante.
4. **Suelo de la sonda**: `F1` y `R1` ya se declaran bien — si eso fallara, la sonda estaría rota.
5. **El vector**: un `JUST` se declara **F1**, ejecutado.
6. Un tipo **desconocido** también.
7. **`ANT`**: hoy se sellaría F1, y el comentario que lo reserva **sigue ahí** — si desaparece sin
   que nadie decida, la pregunta se pierde y el valor entra sin dictamen.

**Comprueba la ESTRUCTURA, no la presencia**: lee el `<sum1:TipoFactura>` que sale del XML, no que
la palabra aparezca en el fichero. Es la corrección que me llevé hace una hora con el CSV, donde el
texto estaba y lo que fallaba era **dónde**.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión (diff sin aplicar) · `INVOICING_ES_ENABLED` (regla 24)
· ninguna factura emitida (regla 29) · los dos libros de SCRUM-325/426, que están entregados.
