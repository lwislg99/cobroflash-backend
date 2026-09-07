# SCRUM-762 · el PDF de una factura emitida se regenera con el código de hoy — medido

**Fecha:** 6-sep-2026 · **Carril:** fiscal · emisión · **Gate:** sin gate
**Medido contra:** `origin/main` = `ff4e1c4a14f474d0fb4095cb0643e069388e4935` · 2026-09-06T20:16:48+01:00
**Tanda:** 5683 tests, 5591 pass, 0 fail, 92 skipped (salida 0), tras mezclar main

> 🛑 **ESTE TICKET MIDE. NO CONSTRUYE.** El camino de emisión no se toca: el generador se mutó
> TEMPORALMENTE para poder medir y se restauró con `sha256sum -c`. El fixture vivió en la base de
> DESARROLLO y se borró. `git status` queda vacío y la decisión es del fundador.

---

## ① 🔴 EL CONTROL QUE DECIDE — el mismo documento, dos aspectos

Factura emitida en **desarrollo**, su PDF abierto dos veces sobre la MISMA fila y el MISMO número,
con un cambio visible del generador en medio y el fichero de disco borrado — que es exactamente
lo que hace Railway en cada despliegue (`fs` efímero, dicho por el propio `src/lib/invoicing.ts`).

```
(1) abierto con el generador de HOY  -> 5091 bytes
    [despliegue] generador cambiado + recompilado + fichero de disco borrado
(2) abierto DESPUES del despliegue   -> 5097 bytes

¿el TEXTO que ve el cliente ha CAMBIADO?  SI
rotulo antes  : "CLIENTE"
rotulo despues: "CLIENTE (v2)"
mismo numero  : si (2026-S762-001)
```

**La hipótesis del encargo queda confirmada.** El documento que el cliente descarga hoy no es el
que descargó ayer, con el mismo número y la misma fila.

### 🔴 Dos veces me equivoqué de instrumento antes de llegar aquí, y las dos importan

**(a) Comparar BYTES no vale.** Medido aparte: dos generaciones del MISMO documento con el MISMO
generador dan **bytes distintos** (el PDF lleva fecha de creación embebida) y **texto idéntico**.
El primer «rojo» que obtuve comparando `sha` no probaba nada — era un rojo por el motivo
equivocado. Se compara el TEXTO extraído del PDF.

**(b) Las dos aperturas en el MISMO proceso dieron VERDE, y era falso.** `import(...?v=2)`
invalida la caché de `invoicing.js` pero **no la de su dependencia `pdf.service.js`**, así que la
segunda apertura seguía usando el generador viejo. Un despliegue es un **proceso nuevo**: cada
apertura corre ahora en su propio proceso, que además es más fiel a lo que pasa en producción.

## ② ✅ CONTROL POSITIVO — lo que NO cambia, y lo que NO se pudo comprobar

| campo | resultado |
|---|---|
| `number` | IGUAL ✅ |
| `total` | IGUAL ✅ |
| huella del contenido de la fila | IGUAL ✅ |
| `vfHash` | los dos `null` ⚠️ **no prueba nada** |

**Queda separado lo que cambia (el ASPECTO) de lo que no (el CONTENIDO canónico)** — pero sólo en
los tres primeros. Y **dos correcciones al enunciado**:

- **`contentHash` NO EXISTE en `Invoice`.** Vive en `Albaran.firma` (JSON). En la factura la
  integridad canónica es `vfHash`, la huella de la cadena VeriFactu. Mi primera versión leía
  `f.contentHash`, obtenía `undefined` y comparaba `null` contra `null` de un campo inexistente.
- **En dev no hay ninguna factura sellada:** 0 de 5 tienen `vfHash` o `vfTimestamp`. Así que la
  parte del control positivo que mira la huella **no se ha podido ejercer**. Para cerrarla haría
  falta una factura sellada, y en dev no existe.

## ③ Cuántas hay — y el hallazgo que cambia la urgencia

En **desarrollo**: **5 facturas**, las cinco en `pendiente_de_sellado`.

```
PUEDEN producir PDF hoy: 0 de 5
```

🔴 **Ninguna de las cinco llega siquiera a la regeneración**: `puedeProducirDocumento` corta antes
con `invoice_pendiente_de_sellado`. Para poder medir hubo que crear una factura `no_aplica` (un
merchant sin NIF, que es lo que `entraEnLaCadena` mira). O sea: **en dev el defecto está latente
pero no se puede disparar con los datos que hay**.

⚠️ **Producción NO se ha tocado ni consultado.** Cuántas facturas emitidas hay ahí, y en qué
estado, **es el dato que decide la urgencia y hay que pedirlo**. Con 5 en dev y 0 producibles, lo
que esta medición demuestra es la **corrección** del defecto, no su tamaño.

## ④ Cuánto ha cambiado el generador desde la primera emisión

Primera factura de dev: **19-ago-2026**.

| fichero | commits totales | commits desde el 19-ago |
|---|---|---|
| `pdf.service.ts` (el generador) | 39 | **17** |
| `lib/invoicing.ts` (el que decide regenerar) | 21 | 2 |

**Diecisiete cambios del generador desde que existe la primera factura.** No es una ventana
teórica: si esas facturas hubieran sido producibles, su aspecto habría cambiado diecisiete veces.
*El daño no está demostrado; la exposición sí.*

## ⑤ El presupuesto: **peor que la factura**

`GET /admin/quotes/:id/pdf` (`quotesAdmin.routes.ts`) **regenera SIEMPRE**. No hay `existsSync`,
no hay condición `needs`: llama a `generateQuotePdf` en cada petición y sobrescribe `quote.pdfUrl`.
Su propio comentario lo dice.

O sea que un presupuesto **ya firmado por el cliente** (la ruta contempla explícitamente el caso:
«el PDF sale SIEMPRE con la firma») cambia de aspecto **en cada apertura**, no sólo tras un
despliegue. No está bajo la regla 29, pero es el documento que el cliente firmó.

## ⑥ El coste de la salida ① — lo medible, medido

Tamaño real de un PDF de factura, generado con el código de hoy:

| líneas | tamaño |
|---|---|
| 1 | 5,0 KB |
| 5 | 5,2 KB |
| 20 | 6,2 KB |
| 50 | 7,3 KB |

**El almacenamiento no es el problema**: diez mil facturas caben en menos de 75 MB.

**Lo que sí es el problema, medido:** no existe hoy ningún almacenamiento persistente en el
proyecto. `invoicesDir` es `process.cwd()/storage/invoices`, disco local del contenedor. No hay
S3, ni R2, ni volumen declarado. Congelar el PDF al emitir exige **infraestructura nueva** —
volumen persistente de Railway o almacén de objetos— y eso es **decisión del fundador** (una
dependencia nueva no la decide una sesión).

## ⑦ Las tres salidas, escritas como tales

**① Congelar al emitir.** El PDF se genera una vez, se guarda en almacenamiento persistente y
nunca se regenera. Coste: infraestructura nueva (decisión del fundador) + tocar el camino de
emisión (STOP con firma). El almacenamiento en sí es despreciable.

**② Versionar el generador** y conservar todas las versiones vivas para siempre. Coste: cada
cambio del generador queda inmortal; hoy serían 17 versiones desde agosto y subiendo. Es la
salida que más código deja vivo para siempre.

**③ NO DECIDIR — y hay que escribirla como salida.** Es lo que está pasando hoy: el aspecto de un
documento firmado deriva con cada despliegue y **nadie se entera**, porque el contenido canónico
verifica y el número no cambia. No hay ninguna alarma que salte. La única razón por la que hoy no
hay daño demostrado en dev es que ninguna factura es producible — y eso es una casualidad del
estado de sellado, no una protección.

---

**Tanda:** 5683 tests · 5591 pass · 0 fail · 92 skipped · salida 0, tras mezclar main. Ningún fichero de producción
modificado (`git status` vacío tras las mediciones; generador verificado byte a byte).
