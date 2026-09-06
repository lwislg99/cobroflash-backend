# SCRUM-799 · El presupuesto que el cliente FIRMÓ se vuelve a dibujar en cada apertura

**Fecha:** 6-sep-2026 · **Carril:** DOC / integridad del documento firmado · **Gate:** MEDIR — no se construye
**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T22:27:14+01:00
**Tanda:** 5692 tests, 5596 pass, 0 fail, 96 skipped (salida 0)

> **Esto es el hermano del SCRUM-762 y es PEOR.** La factura al menos INTENTA reutilizar el
> fichero de disco (`ensureInvoicePdf` mira `fs.existsSync`, aunque en Railway el fs sea efímero
> y el intento falle siempre). El presupuesto **no lo intenta**: la ruta no tiene `existsSync` ni
> `needs` — llama al generador y ya. Cada apertura es un documento nuevo.

---

## La respuesta, en una línea

**Sí, y también cuando está firmado.** El mismo presupuesto abierto dos veces **en procesos
distintos**, con un cambio visible del generador en medio, sale **distinto**. No es una
suposición leída en el código: está medido, y se enseña QUÉ línea cambió.

---

## Obligación 1 · ¿queda constancia de lo que se firmó? **NI canónica NI PDF**

`model Quote` (`prisma/schema.prisma:446`) guarda de la firma exactamente **dos** cosas:

| campo | qué es |
|---|---|
| `signatureUrl String? @db.Text` | la IMAGEN del trazo, data-URI crudo |
| `acceptedAt DateTime?` | cuándo aceptó |

No hay huella de nada: ni del contenido, ni del PDF, ni de la propia imagen.

**Censo ejecutable**, patrón `createHash|sha256`:

- `src/modules/quotes/` → **0 ficheros**.
- **CONTROL POSITIVO**, mismo patrón, `src/modules/jobs/` → **4 ficheros**
  (`albaran.service.ts`, `albaranVerificacion.ts`, `fotoDuplicada.ts`, `parteTrabajo.ts`).

El instrumento sabe encontrar hashing cuando lo hay. En el presupuesto **no lo hay**.

### El matiz que evita exagerar el hallazgo

Las CIFRAS firmadas sí sobreviven, pero en la FILA, no en el documento: ningún `quote.update` del
repo (19 sitios) escribe `lines`, `total`, `quoteNumber`, `docFields` ni `currency` — sólo
`status`, `pdfUrl`, `reminderSentAt`, `internalNotes`, `decisionToken` y `customBillingPlan`.
**CONTROL POSITIVO:** la misma ventana sobre `quote.create` sí ve `lines:` y `total:`, así que el
detector no es ciego a esos nombres.

O sea: **lo que cambia no son los importes, es el DOCUMENTO** — qué se pinta, cómo, y con qué
nombre. Y el documento es justamente lo que el cliente miró antes de firmar. Un cambio como el de
SCRUM-589 (elegir entre razón social y nombre comercial) reescribe el nombre del cliente en
presupuestos firmados hace un año.

Por el criterio del encargo esto **no escala a 🔴🔴** (no hay huella que se contradiga: no hay
huella en absoluto), así que no se paró aquí y se siguió midiendo.

---

## Obligación 2 · ¿quién ve este PDF?

- **Ninguna ruta pública lo sirve.** La única es `GET /admin/quotes/:id/pdf`
  (`quotesAdmin.routes.ts:529`), y `/admin` va detrás de `requireAuth` (`src/app.ts:359`).
- **El cliente firma SIN ver el PDF.** La landing donde decide y firma
  (`quoteDecisionLanding.routes.ts`, 803 líneas) menciona «pdf» **0 veces**. *Control positivo en
  el mismo fichero:* 30 «firm», 13 «presupuesto», 20 «canvas» — el contador no está mudo.
- **El correo adjunta el PDF, pero *best-effort*** (`email.service.ts:144-151`): lee el fichero de
  disco `if (fs.existsSync(disk))` y, si no está, el correo sale **sin adjunto**. Con el fs efímero
  de Railway, la única copia que el cliente podría conservar es la que menos garantías tiene.

---

## Obligación 3 · a cuántos alcanza (censo con hora, medido DOS veces)

| | CENSO 1 · 2026-09-06T21:20:48Z | CENSO 2 · tras limpiar |
|---|---|---|
| presupuestos (dev) | **15** | **15** |
| `accepted` / `sent` / `draft` / `rejected` | 9 / 3 / 2 / 1 | 9 / 3 / 2 / 1 |
| con `signatureUrl` (FIRMADOS) | **0** | **0** |
| con `acceptedAt` | 9 | 9 |

**Se dice lo que este censo NO puede decir:** es **dev**, no producción, y aquí hay **cero**
presupuestos firmados. La población real de afectados **no está medida** y no se estima. Lo medido
es el MECANISMO, y el mecanismo no distingue entornos.

---

## Obligación 4 · qué cuesta cada apertura

5 aperturas del mismo presupuesto: **37 · 37 · 39 · 37 · 36 ms** (mín 36, máx 39), 1 995 bytes.

No hay caché **de ningún tipo**: la ruta no consulta el disco antes de generar. Cada visita del
profesional al PDF de un presupuesto es una generación completa.

---

## Los tres controles

**✅ EL POSITIVO — el instrumento no grita solo.** Dos aperturas con el generador SIN TOCAR →
**mismo texto**, 1 995 bytes las dos. (Se compara TEXTO y no bytes a propósito: el PDF lleva dentro
la fecha de creación, así que el mismo generador da bytes distintos. Ése fue uno de los falsos
rojos del 762.)

**🔴 EL QUE DECIDE.** Mismo presupuesto, **procesos distintos** (la caché de módulos de Node fue lo
que dio el falso verde en el 762), con un cambio visible del generador y `tsc` en medio: en
`generateQuotePdf` (`pdf.service.ts:770`), `Cliente:` → `Cliente (v2):`.

```
¿el TEXTO ha CAMBIADO? SI 🔴
lineas distintas: 1
   linea 3  antes  : "Cliente: Cliente de medicion"
   linea 3  despues: "Cliente (v2): Cliente de medicion"
y el presupuesto SIGUE FIRMADO: signatureUrl presente = true
```

Cambió **exactamente** la línea que se tocó y ninguna más. Un rojo difuso no habría valido.

**🧹 LA LIMPIEZA, VERIFICADA.** Generador restaurado **byte a byte** (sha256 idéntico al de
partida) y recompilado; fixtures borrados; censo **15 → 15 ✅**. Nada quedó sembrado en dev.

### Confesión: el primer intento fue un VERDE por el motivo equivocado

La primera mutación tocó `'CLIENTE'` dentro de **`generateInvoicePdf`** — la FACTURA — y el
veredicto salió «NO ha cambiado». Habría firmado justo lo contrario de la verdad. Lo cazó que la
línea de evidencia salía `undefined`: **si el veredicto no puede enseñar QUÉ cambió, el veredicto
no vale.** Por eso arriba se imprime el diff completo y no una línea elegida a mano.

---

## Hallazgo colateral que el encargo no pedía (no se arregla aquí)

El portal del cliente es **público** (`app.use('/cliente', …)`, `src/app.ts:139`, montado 220
líneas antes de `requireAuth`) y pinta un botón **«📄 Ver PDF»** cuyo `href` es
`BASE_URL + quote.pdfUrl` (`customerPortal.routes.ts:302-305`).

Y `quotes.pdf_url` lo escribe la propia ruta del PDF con su valor de retorno. **Medido**, no
deducido: el generador devuelve `publicUrlPath = "/admin/quotes/362/pdf"`. Es decir, el portal
público acaba enlazando a una URL **bajo `requireAuth`**.

Hoy está **latente**: los 15 presupuestos de dev tienen `pdf_url = NULL` y el botón no se pinta
(*control positivo del clasificador:* con `/admin/quotes/7/pdf`, `PENDING_PDF`, `null` y una `http`
absoluta acierta las cuatro). Se activa en cuanto el profesional abre **una vez** el PDF desde el
panel. Es el mismo error que `docs/BUGS.md:284` ya cerró para la factura —enlazar el `pdfUrl`
crudo— reaparecido en la cara del cliente. Queda registrado en `docs/BUGS.md`; **no se toca aquí**.

---

## Lo que NO se ha hecho (prohibiciones del encargo, respetadas)

- **No se ha construido la solución.** Congelar exige almacenamiento persistente que hoy no existe:
  es infraestructura y es del fundador.
- **No se ha tocado el camino de emisión de la factura** (es el 762 y está en su mesa). La única
  mutación fue temporal, dentro de `generateQuotePdf`, y se revirtió byte a byte.
- **`package.json` intacto:** se comprobó que SCRUM-790 sigue sin mergear en `origin/main`.
- **Nada contra staging ni producción.** Todo contra dev, con el guard de destino diciendo `cuadra`
  en cada script.

---

## Lo que decide el fundador (aquí no se elige)

1. **Congelar al firmar** — guardar el PDF tal cual se firmó. Necesita almacén persistente (hoy el
   fs de Railway muere en cada deploy). Es la única que preserva el documento.
2. **Huella y no documento** — guardar un hash del contenido canónico al aceptar. No devuelve el
   papel, pero permite DETECTAR que algo cambió. Mucho más barato.
3. **Asumirlo y decirlo** — dejar claro que el PDF del presupuesto es una vista de los datos de
   hoy, no un documento archivado.

Las tres son compatibles con dejar la factura como está: son documentos distintos y la factura
tiene su propio ticket.
