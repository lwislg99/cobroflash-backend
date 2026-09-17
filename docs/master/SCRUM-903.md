# SCRUM-903 · El marcador de microcopy que se imprime en el PDF

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T09:41:22Z
**Rama:** `scrum-903-marcador-impreso` · **Carril:** Sesión 3
**Gate:** 🔴 el texto que sustituya a cada marcador es del fundador. Se propone en §5 y **se para**.

> Una pantalla mal rotulada se arregla y se recarga. Un PDF mal rotulado ya está en el móvil de un
> cliente, y ahí no llega ningún despliegue.

---

## 0 · Lo primero: ¿cuántos documentos se han emitido ya con el marcador dentro?

**No lo he contado, y no puedo: no toco producción.** Lo que sí he hecho es acotar QUÉ habría que
contar, que antes no estaba acotado — el ticket daba por hecho que `pdf.service.ts` sirve también
albaranes y partes, y **no es así**:

| | medido |
|---|---|
| Generadores de PDF en el árbol | **2**: `pdf.service.ts` y `albaranPdf.service.ts` |
| El marcador del ticket (`pdf.service.ts:613`) | vive en `generateInvoicePdf` → **sólo facturas** |
| ¿Albaranes y partes pasan por ahí? | **No.** `albaranPdf.service.ts` sólo le toma `loadLogoBuffer` y `TITULO_OBSERVACIONES` |

Así que **el camino ① sólo puede haber tocado facturas**, y producción tiene 0 facturas (medido por
el orquestador el 17-sep) → **cero documentos afectados por ese camino**.

**Pero hay un segundo camino que el ticket no listaba como impreso, y ése sí es de albaranes** (§1).
Para contar los dos, las dos consultas —para ejecutar en producción, no aquí—:

```sql
-- ① facturas con MÁS DE UN tipo de IVA (las únicas que entran en el bloque del desglose)
-- El desglose se calcula sobre las líneas; hay que contar tipos distintos por factura.

-- ② albaranes cuya calidad guardada NO es una de las seis válidas (imprimen el marcador)
SELECT COUNT(*) FROM "Albaran"
WHERE "firmadoPorCalidad" IS NOT NULL
  AND split_part("firmadoPorCalidad", ':', 1) NOT IN (
    'el_propio_cliente','en_nombre_del_cliente','familiar_o_conviviente',
    'encargado_o_personal_de_obra','portero_o_conserje','otro');
```

⚠️ Y un dato que cambia qué significa ese número: **el PDF del albarán se guarda en disco**
(`ensureAlbaranPdf` sólo regenera con `force`). Lo que se imprimió una vez sigue impreso aunque el
código se arregle — y no se reescribe (regla 29).

## 1 · Los nueve, uno a uno

**POBLACIÓN MIRADA:** 380 ficheros del programa (285 `.ts` de `src/` + 95 `.js` del panel), **8.363
literales de cadena recorridos por AST**. Por AST y no por `grep`: un marcador en un comentario no
se imprime nunca, y contarlo habría inflado la población del lado tranquilizador.

De ahí: **27 literales contienen un marcador** · 21 son la declaración de una constante · **10 son
usos** · de esos, **9 son el texto entero** (y 1 va acompañado: `criterioCaja.ts:77`).

⚠️ **El censo hubo que hacerlo DOS VECES, y la primera se dejaba fuera el más grave.** El marcador
vive bajo **cinco nombres distintos**:

| nombre | dónde se declara |
|---|---|
| `MICROCOPY_PENDIENTE_290` | `albaranes.routes.ts:1335` |
| `MICROCOPY_PENDIENTE_308` | `invoicesAdmin.routes.ts:950` |
| `MARCADOR_MICROCOPY_DESGLOSE` | `pdf.service.ts:51` |
| `PENDIENTE` | `albaranFirmante.ts:43` (exportado) |
| `MARCA_PENDIENTE` | `librosAeat.ts:52` (exportado, **sin usos** en `src/`) |

Un censo calibrado a `MICROCOPY_PENDIENTE` devuelve 8 y parece completo. **El que se quedaba fuera
era el del PDF.** Por eso el censo final busca por VALOR y descubre los nombres, no al revés.

### Los ocho de API — salen mal, alguien lo ve, se arregla

Todos responden `message:` con el marcador **como texto entero** y con su `error:` en claro al lado,
así que el frontal tiene un código con el que decidir; lo que no tiene es qué decirle al profesional.

| sitio | `error` que acompaña | se alcanza cuando |
|---|---|---|
| `albaranes.routes.ts:1368` | `albaran_no_firmado` | se intenta facturar un albarán que no está firmado |
| `albaranes.routes.ts:1371` | `albaran_ya_facturado` | el albarán ya tiene `invoiceId` |
| `albaranes.routes.ts:1388` | `facturacion_no_disponible` | el merchant está en modo `receipt` |
| `albaranes.routes.ts:1426` | `albaran_no_convertible` | hay motivos de casación (van en claro aparte: son diagnóstico) |
| `albaranes.routes.ts:1565` | — (éxito parcial) | se facturó pero el sellado VeriFactu falló o hubo fallo adicional |
| `albaranes.routes.ts:1572` | `facturacion_no_disponible` | el `catch` del mismo camino |
| `invoicesAdmin.routes.ts:986` | el de `puedeRectificarse` | se rectifica una factura en un estado no permitido |
| `criterioCaja.ts:77` | — | **no es texto entero**: el marcador va seguido de una frase |

### 🔴 El noveno, y el décimo que no estaba en la lista

**`pdf.service.ts:613` — la cabecera del desglose de IVA de una FACTURA.** Se alcanza sólo cuando la
factura tiene **más de un tipo impositivo** (`tiposDeIva.length > 1`); con un solo tipo el bloque ni
se pinta. Lo que se ve en su lugar: la línea de cabecera sobre las filas de tipo/base/cuota.

**`albaranFirmante.ts:269` NO es una respuesta de API: se imprime en el PDF del ALBARÁN.**
`etiquetaCalidad()` lo devuelve, y `albaranPdf.service.ts` lo pinta en la línea «En calidad de: ».
Medido ejecutando la función real:

```
"el_propio_cliente"            -> "El propio cliente"
"encargado_o_personal_de_obra" -> "Encargado o personal de la obra"      (las seis, escritas)
"administrador"                -> "[PENDIENTE microcopy oficial]"   <-- MARCADOR IMPRESO
"ADMINISTRADOR"                -> "[PENDIENTE microcopy oficial]"   <-- basta un cambio de mayúsculas
"id_retirado_en_el_futuro"     -> "[PENDIENTE microcopy oficial]"
```

**Alcanzabilidad, medida:** hoy las dos rutas de firma (`albaranes.routes.ts` y
`albaranPublic.routes.ts`) validan contra el set, así que un dato NUEVO no puede entrar mal. Queda
abierto: (a) datos escritos antes de esa validación, (b) el día que se retire o renombre un id —
todos los albaranes firmados con él quedan huérfanos y **reimprimen el marcador al regenerar**.

Y de paso: el comentario de `albaranPdf.service.ts` afirmaba que las seis etiquetas seguían sin
aprobar y que por eso se imprimía el marcador. **Llevaba tiempo siendo falso.** Corregido, y atado
con un caso: un comentario que miente sobre el estado es peor que ninguno.

## 2 · Lo construido — la mitad que no necesita firma

`src/core/documentos/sinMarcadorPendiente.ts`: `textoParaDocumento(valor, donde)` devuelve el texto
y **lanza** si lleva un marcador. Aplicado en los dos sitios que imprimen. No escribe ni una palabra
de microcopy: sólo cambia quién se entera.

⚠️ **El primer arreglo era peor que el defecto, y se detectó porque el caso rojo no cayó.** El
bloque de firma del albarán termina en `catch {}` **vacío** (está para que un PNG corrupto no tumbe
el documento). Con la comprobación dentro, encontrar un marcador no daba «el PDF no se genera»:
daba **un albarán firmado sin su firma, sin nombre y sin fecha, en silencio**. La etiqueta se
resuelve FUERA del `try`, y hay un caso que vigila justo eso.

**9 casos, código 0, 0 saltados.** Cada criterio con sus dos mitades: factura con dos tipos de IVA
falla / con uno se genera igual que siempre; albarán con calidad desconocida falla / con una de las
seis se genera y la imprime. Y un trinquete que exige que **todo** generador de PDF del árbol filtre:
si mañana aparece un tercero, cae.

**Vecinos:** 82 casos de los tests de PDF, 81 pasan, 0 fallan, 1 salto que declara su motivo (BD).

## 3 · La red — PROPUESTA, no implementada

⛔ No he tocado `guard-marcadores-en-pantalla.mjs`.

**Por qué no veía nada de esto, medido leyéndolo:**

1. Su población son **vistas del router y scripts del panel**. Una respuesta de API y un PDF de
   servidor no son ninguna de las dos cosas. Un guard sólo vigila el sitio donde está.
2. `ESTADOS = ['con-datos', 'sin-datos', 'error']` son estados **de carga**, no de documento.
3. Su banco (`rico()`) fabrica **un único juego de datos**, con cinco campos de estado fijados:
   `status:'pending'`, `estado:'pendiente'`, `estadoCobro:'Pendiente'`, `firmado:false`,
   `emitido:false` — más el override de la línea 194, `v.estado = 'borrador'` para todo albarán.

**La respuesta al número que pedías: 22 de 92 scripts del panel ramifican por un estado de
documento**, y el banco sólo les sirve un valor de cada campo. No es que una vista tenga el banco
fijado: es que **ninguna vista se prueba en más de un estado de documento**, y `albaran-detail` es
sólo donde ya se ha notado.

**Qué propongo (para decidir tú, no para hacer ahora):**

- **Un SEGUNDO guard, no ampliar el actual.** El de pantalla necesita un navegador y un DOM; las
  respuestas de API y los PDF no. Meterlos en la misma población obligaría a levantar el panel para
  comprobar un `res.json`, y un guard lento se acaba desactivando.
- **Qué mediría:** por AST, todo literal que acabe en un campo que viaja al usuario — `message` de
  un `res.json`, argumento de `doc.text` — y que sea o contenga un marcador. Dos cifras siempre:
  cuántas superficies hay y cuántas se vigilan.
- **Qué caso de HOY lo pondría rojo:** los 8 de API de §1. Hoy los 9 están en verde para todo guard
  del repo; con esto, 8 en rojo el primer día — y ése es el punto: el número no puede salir 0 el
  día que se enciende, o no está mirando.
- **El banco por estados es un ticket aparte y más grande**: servir cada vista en sus estados reales
  multiplica la matriz (22 scripts × sus estados) y hay que decidir de dónde salen esos estados sin
  inventarlos. Lo dejo medido, no empezado.

## 4 · Lo que este PR NO hace

1. **No escribe ningún texto.** Los 9 marcadores siguen ahí; los 2 que se imprimían ahora fallan.
2. **No toca los 8 de API**: salen igual que hoy. Fallar ahí dejaría al profesional sin respuesta,
   y su coste —una pantalla mal rotulada— se arregla y se recarga.
3. **No reescribe ningún documento emitido** (regla 29).
4. **No cuenta los documentos ya emitidos**: no toco producción. Las consultas están en §0.

---

## 5 · 🔴 EL LITERAL, PROPUESTO Y SIN FIRMAR

> **No está escrito en el producto**, a propósito: una frase plausible puesta por una sesión parece
> aprobada, y el marcador al menos se ve. Aquí, y en el comentario del ticket, para que lo firmes.
> Va en este fichero y **no** en `docs/microcopy/`, que exige firma válida a todo lo que contiene
> (SCRUM-726) y es el archivo de lo firmado, no el buzón de lo pendiente.

**Hace falta UN texto: la cabecera del desglose de IVA de la factura** (`pdf.service.ts:613`). El
otro camino (el albarán) **no necesita texto**: sus seis etiquetas ya están escritas y lo que fallaba
era el caso de un id desconocido, que ahora no se imprime.

Dónde se ve: en la factura, encima de las filas `tipo · base · cuota`, sólo cuando hay más de un
tipo de IVA. Una línea, ancho de la caja de totales.

| propuesta | a favor | en contra |
|---|---|---|
| **«Desglose por tipo de IVA»** | dice exactamente lo que hay debajo; «desglose» es la palabra que usa la propia AEAT | «IVA» se queda corto si algún día hay IGIC o IPSI — el código ya llama a esa variable `impuesto` porque el nombre cambia por territorio |
| **«Desglose por tipo impositivo»** | no se rompe con IGIC/IPSI, y es el término del reglamento | más frío y más largo; un autónomo no dice «tipo impositivo» |
| **«Bases imponibles»** | es literalmente lo que enumera la columna ancha | no menciona que hay varias cuotas, y la tabla también las trae |

**Mi recomendación: «Desglose por tipo impositivo»**, porque es el único de los tres que sigue siendo
cierto en Canarias, Ceuta y Melilla, y esto es una factura. Si prefieres hablar como habla el
profesional, «Desglose por tipo de IVA» y se acepta que habrá que tocarlo el día del IGIC.

⚠️ Sea cual sea, **es texto de un documento fiscal**: lo firmas tú (reglas 30 / 39) y hasta entonces
el PDF de una factura con varios tipos **no se genera**. Con 0 facturas en producción, eso hoy no
afecta a nadie.
