# SCRUM-903 · 🔴 El marcador de microcopy que se imprime en el PDF

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T09:41:22Z
**Rama:** `scrum-903-marcador-impreso` · **Carril:** Sesión 3
**Gate:** el texto que apaga el marcador de la factura es del fundador. Propuesto en §5, **sin firma**.

> Una pantalla mal rotulada se arregla y se recarga. Un PDF mal rotulado ya está en el móvil de un
> cliente, y ahí no llega ningún despliegue.

**La gravedad baja de 🔴🔴 a 🔴** (decisión del orquestador, 17-sep): no hay ni un documento con el
marcador impreso en manos de nadie. El defecto es real —había un camino sin vigilar— pero es una
bomba desactivada antes de existir, no un incendio.

---

## 0 · Cuántos documentos hay afectados: CERO, y qué significa ese cero

Medido **en producción por el fundador**, no por esta sesión:

| | albaranes totales | con calidad «rara» |
|---|---|---|
| **producción** | **0** | **0** |
| staging | 1 | 0 |

⚠️ **La consulta que yo propuse habría fallado.** Escribí `"Albaran"` y `"firmadoPorCalidad"`, que son
los nombres del **modelo de Prisma**; la tabla real es `albaranes` y la columna `firmado_por_calidad`
(text). Lo destapó preguntarle al catálogo en vez de fiarse del esquema. La buena:

```sql
SELECT COUNT(*) FROM albaranes
WHERE firmado_por_calidad IS NOT NULL
  AND split_part(firmado_por_calidad, ':', 1) NOT IN (
    'el_propio_cliente','en_nombre_del_cliente','familiar_o_conviviente',
    'encargado_o_personal_de_obra','portero_o_conserje','otro');
```

🔴 **Y EL CERO ES SOBRE POBLACIÓN CERO. Que nadie lo cite dentro de un mes como prueba de que esto
funciona.** En producción no hay ningún albarán, así que el segundo cero no dice que el filtro sepa
reconocer una calidad rara: dice que no se ha enfrentado a ninguna. **Se ha medido el mundo, no el
instrumento.** Al instrumento lo miden los casos de §2, que sí le ponen delante una.

Del otro camino (la factura) ya se sabía: 0 facturas en producción, y además hace falta más de un
tipo de IVA.

## 1 · Los nueve, uno a uno

**POBLACIÓN MIRADA:** 380 ficheros del programa (285 `.ts` de `src/` + 95 `.js` del panel), **8.363
literales de cadena recorridos por AST**. Por AST y no por `grep`: un marcador en un comentario no se
imprime nunca, y contarlo habría inflado la población del lado tranquilizador.

De ahí: **27 literales contienen un marcador** · 21 son la declaración de una constante · **10 son
usos** · de ésos, **9 son el texto entero** (y 1 va acompañado: `criterioCaja.ts:77`).

⚠️ **El censo hubo que hacerlo DOS VECES, y la primera se dejaba fuera el más grave.** El marcador
vive bajo **cinco nombres distintos** — `MICROCOPY_PENDIENTE_290`, `MICROCOPY_PENDIENTE_308`,
`MARCADOR_MICROCOPY_DESGLOSE`, `PENDIENTE`, `MARCA_PENDIENTE` (esta última exportada y **sin usos**).
Un censo calibrado a `MICROCOPY_PENDIENTE` devuelve 8 y parece completo; el que se quedaba fuera era
justo el del PDF. Por eso el censo final busca por VALOR y descubre los nombres, no al revés.

### Los ocho de API — salen mal, alguien lo ve, se arregla

Todos responden `message:` con el marcador como texto entero, con su `error:` en claro al lado.

| sitio | `error` que acompaña | se alcanza cuando |
|---|---|---|
| `albaranes.routes.ts:1368` | `albaran_no_firmado` | se factura un albarán sin firmar |
| `albaranes.routes.ts:1371` | `albaran_ya_facturado` | el albarán ya tiene `invoiceId` |
| `albaranes.routes.ts:1388` | `facturacion_no_disponible` | el merchant está en modo `receipt` |
| `albaranes.routes.ts:1426` | `albaran_no_convertible` | hay motivos de casación (van en claro aparte) |
| `albaranes.routes.ts:1565` | — (éxito parcial) | se facturó pero falló el sellado o el adicional |
| `albaranes.routes.ts:1572` | `facturacion_no_disponible` | el `catch` del mismo camino |
| `invoicesAdmin.routes.ts:986` | el de `puedeRectificarse` | se rectifica una factura en estado no permitido |
| `criterioCaja.ts:77` | — | **no es texto entero**: el marcador va seguido de una frase |

### 🔴 El noveno, y el décimo que no estaba en la lista

**`pdf.service.ts:613`** — cabecera del desglose de IVA de una FACTURA, sólo con más de un tipo
impositivo. **Este ya estaba declarado y vigilado** (§3).

**`albaranFirmante.ts:269` NO es una respuesta de API: se imprime en el PDF del ALBARÁN.**
`etiquetaCalidad()` lo devuelve y `albaranPdf.service.ts` lo pinta en «En calidad de: ». Medido
ejecutando la función real:

```
"el_propio_cliente"            -> "El propio cliente"          (las seis, escritas)
"administrador"                -> "[PENDIENTE microcopy oficial]"   <-- MARCADOR IMPRESO
"ADMINISTRADOR"                -> "[PENDIENTE microcopy oficial]"   <-- basta cambiar mayúsculas
```

**Alcanzabilidad:** las dos rutas de firma validan contra el set, así que un dato NUEVO no puede
entrar mal. Queda abierto: datos anteriores a esa validación, y el día que se retire o renombre un
id — los albaranes firmados con él quedarían huérfanos y reimprimirían el marcador al regenerar.

Y se corrige un comentario que llevaba tiempo mintiendo: decía que las seis etiquetas seguían sin
aprobar y que por eso se imprimía el marcador. Están escritas, y ahora hay un caso que lo ata.

## 2 · Lo construido

`src/core/documentos/sinMarcadorPendiente.ts` · `textoParaDocumento(valor, donde)` devuelve el texto
y **lanza** si lleva un marcador. **Aplicado en un solo sitio: el albarán** (el porqué, en §3).
No escribe ni una palabra de microcopy: sólo cambia quién se entera de que falta.

⚠️ **El primer arreglo era peor que el defecto, y se detectó porque el caso rojo no cayó.** El bloque
de firma del albarán termina en `catch {}` **vacío** (está para que un PNG corrupto no tumbe el
documento). Con la comprobación dentro, encontrar un marcador no daba «el PDF no se genera»: daba
**un albarán firmado sin su firma, sin nombre y sin fecha, en silencio**. La etiqueta se resuelve
FUERA del `try`, y hay un caso que vigila justo eso.

**9 casos propios, código 0, 0 saltados**, cada criterio con sus dos mitades.

## 3 · 🔴 LA PREMISA DEL TICKET ERA FALSA, y esto es lo que más importa del ticket

El enunciado decía: «9 sitios, y **ninguno dentro de la población de ningún guard**». **No es cierto
para los que se imprimen**, y lo destapó la tanda completa: mi arreglo puso **17 casos en rojo**.

Lo que ya existía, medido leyéndolo:

- **`scripts/censo-marcadores.mjs` barre `public/`, `public/dashboard/js` y `src/`.** La premisa de
  que «`src/` no lo mira nadie» es falsa para el censo, y está escrita en el propio fichero de
  SCRUM-667 desde entonces.
- **`tests/scrum667-marcador-visible.test.mjs`** vigila las dos preguntas caras: cuántos marcadores
  VE alguien, y **cuál llega al PDF DEL CLIENTE**. Tiene un registro `EN_EL_PAPEL` con los
  **declarados** —hoy dos: el desglose de la factura y el pie del albarán con su presupuesto— y
  exige que el papel traiga **exactamente** ésos. Ni uno más ni uno menos.

Por eso **la mitad de la factura se ha retirado**: hacerla fallar cambiaba por la puerta de atrás una
política decidida en SCRUM-667, con su registro y su control negativo. Regla 41: se arregla el
código, no el guard.

⚠️ **Y `pdf.service.ts` queda IDÉNTICO a `main`, byte a byte — ni siquiera un comentario.** Al
retirar el filtro dejé escrito ahí *por qué* no va, y saltaron otros dos guards (SCRUM-603b y
SCRUM-723): vigilan que el ámbito que genera la factura no cambie respecto a la base de la rama,
porque cambiar lo que imprime una factura ya emitida es la regla 29. Miden **caracteres**, así que
un comentario cuenta. Tienen razón: el sitio para explicar por qué ese fichero no se toca es éste y
el caso de la tanda, no el fichero. Un tercer guard (SCRUM-838) cazó además una tautología que dejé
en mis propios casos —`assert.equal(antes, antes)`—, y también tenía razón: se ha sustituido por un
control que compara con el mismo albarán y una calidad válida, para que el rojo pruebe el filtro y
no otra avería. Lo que apaga ese marcador es **escribir el texto** y retirarlo de `EN_EL_PAPEL`
en el mismo commit — el propio guard lo dice en su mensaje de fallo.

**El hueco real, y es el que este ticket cierra:** el banco de SCRUM-667 genera su albarán con
`firmadoPorCalidad: null`, así que **la rama de la calidad no se ejercita nunca**. El guard existía,
miraba el sitio correcto, y su banco no llegaba a ese caso. Es exactamente el mismo patrón que el
`v.estado = 'borrador'` de `guard-marcadores-en-pantalla.mjs`.

## 4 · La red — PROPUESTA, no implementada

⛔ No he tocado `guard-marcadores-en-pantalla.mjs`.

**Por qué no veía el frontal:** su población son vistas y scripts del panel; `ESTADOS` son estados
**de carga** (`con-datos`, `sin-datos`, `error`), no de documento; y su banco (`rico()`) fabrica **un
único juego de datos** con cinco campos de estado fijos —`status:'pending'`, `estado:'pendiente'`,
`estadoCobro:'Pendiente'`, `firmado:false`, `emitido:false`— más el `v.estado = 'borrador'` de la
línea 194.

**El número que pedías: 22 de 92 scripts del panel ramifican por un estado de documento**, y el banco
sólo les sirve un valor de cada campo. No es que una vista tenga el banco fijado: **ninguna vista se
prueba en más de un estado de documento**; `albaran-detail` es sólo donde ya se notó.

**Qué propongo, para decidir tú:**

- **No hace falta un guard nuevo para el papel: ya está y funciona** (SCRUM-667). Lo que le falta es
  **que su banco cubra las ramas**, empezando por un albarán con `firmadoPorCalidad` puesto. Es más
  barato y más honesto que añadir un segundo vigilante al mismo sitio.
- **Para las respuestas de API sí falta población**, y ahí sí propondría algo aparte: por AST, todo
  literal que acabe en el `message` de un `res.json`. **Qué caso de hoy lo pondría rojo:** los 8 de
  §1 — y ése es el punto, el número no puede salir 0 el día que se enciende.
- **El banco por estados es un ticket aparte y más grande**: 22 scripts × sus estados, y hay que
  decidir de dónde salen esos estados sin inventarlos. Medido, no empezado.

## 5 · 🔴 EL LITERAL, PROPUESTO Y SIN FIRMAR

> No está escrito en el producto: una frase plausible puesta por una sesión parece aprobada, y el
> marcador al menos se ve. Aquí y en el comentario **15694** del ticket — **no** en `docs/microcopy/`,
> que exige firma válida a todo lo que contiene (SCRUM-726) y es el archivo de lo firmado, no el
> buzón de lo pendiente.

Hace falta **un** texto: la cabecera del desglose de IVA de la factura (`pdf.service.ts:613`). El
albarán **no necesita texto nuevo**: sus seis etiquetas ya están escritas.

| propuesta | a favor | en contra |
|---|---|---|
| **Desglose por tipo de IVA** | dice lo que hay debajo; «desglose» es la palabra de la AEAT | «IVA» se queda corto con IGIC o IPSI — el código ya llama `impuesto` a esa variable |
| **Desglose por tipo impositivo** | no se rompe en Canarias, Ceuta ni Melilla; término del reglamento | más frío y más largo: un autónomo no dice «tipo impositivo» |
| **Bases imponibles** | es lo que enumera la columna ancha | no menciona las cuotas, y la tabla también las trae |

**Recomendación: «Desglose por tipo impositivo».** Al escribirlo hay que **retirar
`MARCADOR_MICROCOPY_DESGLOSE` de `EN_EL_PAPEL` en el mismo commit**, o SCRUM-667 se queda esperando
un marcador que ya no sale.

## 6 · Lo que este PR NO hace

1. **No escribe ningún texto.** Los 9 marcadores siguen ahí.
2. **No toca los 8 de API**: salen igual que hoy.
3. **No toca la factura**: su marcador está declarado y vigilado (§3).
4. **No reescribe ningún documento emitido** (regla 29) — y no hay ninguno.
