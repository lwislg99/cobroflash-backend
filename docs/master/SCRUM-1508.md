# SCRUM-1508 · Quién descansa en una escritura que no se espera y traga su error — medido, sin arreglar nada

**Medido contra:** `origin/main` = `789509a9e4a85e9f1cb2ff7de0889a2cee3158a8` · 2026-10-08T00:42:19Z

A9: comprobación → `docs/master/evidencias/SCRUM-1508/medir.sh`

J2 (sesión `jv-j2`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). **Es LECTURA y
EJECUCIÓN:** no se ha tocado `audit.service.ts` (S1), ni el camino de emisión, ni el reintento de SCRUM-1404, ni
ningún fichero de `src/`, test, guard o workflow. Lo único que entra es este registro, una línea de cicatriz y
los guiones de `docs/master/evidencias/SCRUM-1508/`. Nada contra producción ni staging: la sonda usa una base
falsa en memoria y WhatsApp en `WHATSAPP_DRY_RUN=1`.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j2`). Se siguió porque el encargo es
medir; el carril se aplicó a mano.

## 0 · La respuesta corta

| Pregunta del ticket | Medido |
| --- | --- |
| ① ¿Quién más LEE algo que escribe `recordAudit`? | **Nadie más.** En `src/` hay **3** lecturas de la tabla de auditoría: 2 leen `portabilidad_*` (que se escriben por la puerta que SÍ se espera) y 1 lee `sellado_fallido`, que es el reintento de SCRUM-1404, ya conocido. |
| ③ ¿La misma FORMA está en más sitios, con alguien dependiendo? | **Sí, tres medidos con sonda y los tres en WhatsApp/recordatorios (carril J2):** el candado del recordatorio de presupuestos, el del recordatorio de facturas y los topes anti-abuso de plantillas. |
| ¿Algo roto hoy en producción? | **No medido y no se afirma.** Se midió qué pasa SI la escritura falla, no cada cuánto falla. |

## 1 · Los instrumentos y sus controles (corridos ANTES de cada número)

Tres guiones por AST (`typescript` del repo, sin `grep`): `censo.cjs` (escritores y lectores de la tabla de
auditoría, y la forma «promesa suelta con `.catch` que no relanza»), `tragadas.cjs` (toda escritura prisma,
clasificada por si su fallo puede llegar al llamador; y toda lectura de un modelo) y `sonda.cjs`. `medir.sh` los
corre en orden y **sale 1 sin medir** si un control no da lo suyo. Salida entera: `salida-medir.txt`.

| Control | Esperado | Salió |
| --- | --- | --- |
| censo sobre el fixture (escritores / lectores / forma) | 4 / 5 / 2 | 4 / 5 / 2 |
| censo sobre `src/` real con un nombre que no existe | 0 / 0 | 0 / 0, sobre **321 ficheros y 266.283 nodos** |
| tragadas sobre el fixture (total · `.catch` · `try`) | 6 · 1 · 3 | 6 · 1 · 3 |
| tragadas sobre `src/` con un modelo que no existe | 0 | 0, sobre 321 ficheros |
| tragadas ve el `.catch` de `recordAudit` | 1 | 1 |

**Error propio, cazado por un control:** la primera versión de `tragadas.cjs` no veía el `.catch` encadenado y
daba `recordAudit` —el caso del ticket— como escritura que PROPAGA. Lo delató el control cruzado contra
`audit.service.ts:310`, corrido antes de medir; ahora ese control es obligatorio en `medir.sh`. **Y un segundo,
repetido:** escribí ese guion con un heredoc de bash, que se comió una barra invertida y no arrancó; es la
cicatriz de J2 del 1-oct, otra vez (`docs/equipo/cicatrices/J2.md`).

## 2 · La tabla de auditoría: quién escribe y quién lee

**Escritores en `src/` (23 hallazgos):** 13 llamadas a `recordAudit` (11 acciones), 6 a `recordAuditOrThrow`,
2 usos de la función sin llamarla (`supresionMerchant.service.ts`, inyección para test) y las 2 escrituras
directas, que son las dos puertas de `audit.service.ts`. Nadie más escribe la tabla.

**Lectores:** `src/` 3 llamadas · `scripts/` 1 (`cambiar-flag-fiscal.mjs:122`, lee `cambio_flag`, que se escribe
esperando) · `public/` 0 (sobre 98 ficheros) · sin SQL crudo contra `audit_log` que lea filas · el modelo no
tiene relaciones en `schema.prisma`, así que no hay lectura por `include`. Los tests leen la tabla (30
hallazgos) y se cuentan aparte: comprueban, no deciden.

| Acción (puerta que NO se espera) | Dónde se escribe | ¿Quién lo lee después? | Clase |
| --- | --- | --- | --- |
| `sellado_fallido` | `selladoEstado.ts:151` | `reintentoSellado.ts:274` lo CUENTA como tope · y una persona: `docs/RUNBOOKS.md:84` («Dónde mirar») | 🔴 decide (el caso de SCRUM-1404, ya con segundo cinturón) + ⚠️ informa |
| `encolado_fallido` | `encolarRemision.ts:83` | **Nadie**: ni código, ni runbook. Y ningún otro lector de la cola (`vfSubmission`: 4 lecturas, ninguna busca «sellada sin encolar») | ⚠️ informa, y es el caso correlacionado por construcción: se escribe justo después de que **otra escritura en la misma base** haya fallado |
| `factura_anulada`, `factura_rectificada` | `invoicesAdmin.routes.ts:977`, `:1133` | Nadie en código | sólo constancia — pero son hechos fiscales, y el comentario de `audit.service.ts:38` remite a `auditoriaFiscal.query.ts`, **que no existe en el árbol** |
| `marcar_pagado_manual`, `deshacer_pago` | `invoicesAdmin.routes.ts:492`, `:570`, `:600`, `:621` | Nadie | sólo constancia ✅ |
| `albaran_editado`, `trabajo_creado`, `tipo_operacion_elegido`, `operario_asignado` | `albaranes.routes.ts:774`, `jobs.routes.ts:897`, `:1127`, `job.service.ts:157` | Nadie | sólo constancia ✅ |
| `datos_exportados` | `exports.routes.ts:55` | Nadie | sólo constancia ✅ |

Las que se escriben esperando (`factura_emitida`, `exportacion_fiscal`, `cambio_flag`, `portabilidad_*`) no son
del ticket: si fallan, el llamador se entera.

## 3 · La familia: la misma forma fuera de la auditoría

Población: **209 escrituras prisma en `src/`**. **40** tienen un fallo que no llega al llamador y no contesta
HTTP (32 por `try` cuyo `catch` no relanza, 8 por `.catch`). Y **54** promesas sueltas con `.catch` que traga.
Las tres puertas que más se usan: `recordWaMessage` (16 llamadas sueltas con `.catch(() => {})`),
`recordCustomerEvent` (18 sueltas sin `.catch`, 1 esperada; traga dentro) y `recordAudit` (13).

Se leyó cada una de las 40 buscando **qué se lee después**. Las que alguien usa para DECIDIR:

| Escritura que traga | Quién decide sobre ella | Si la escritura falla | Medido |
| --- | --- | --- | --- |
| `reminder.service.ts:83` · candado `reminderSentAt` del presupuesto. Su comentario dice «evita reintentos infinitos» | El propio cron, **cada hora**: `where reminderSentAt: null` | El presupuesto vuelve a entrar en cada pasada | 🔴 sonda |
| `invoiceReminder.service.ts:90`, `:98` · candados `reminder7SentAt` / `reminder14SentAt` | El propio cron, **diario** | La factura vuelve a entrar cada día | 🔴 sonda |
| `whatsappLog.service.ts:33` · `recordWaMessage`, el registro de mensajes | `whatsapp.ts:376` y `:392`: los **topes** por comercio/día (100) y por cliente/día (3) se CUENTAN sobre esas filas | El contador no sube: el tope no llega | 🔴 sonda |
| `whatsappLog.service.ts:76` · entrante que abre la ventana de 24 h | `isServiceWindowOpen` | Ventana «cerrada»: se manda plantilla de pago en vez de texto gratis. Falla hacia entregar; cuesta dinero | leído, declarado en el código |
| `correoDeFacturaEnviado.ts:112` · marca de correo enviado | `yaSeEnvioElCorreo` | Un reintento repite el correo | leído; **asumido por escrito** en su comentario, y acotado por los reintentos de la pasarela |
| `disputes.service.ts:206` · marca de disputa atendida | `yaAtendida` | Aviso repetido al profesional | leído; **asumido por escrito** |
| `customerEvents.service.ts:21` · `recordCustomerEvent` | `existeEventoDePlan` (una vez por episodio) | No queda evento; al día siguiente lo vuelve a intentar. `avisarPlanSinCanal` devuelve `true` sin haber escrito | leído; se cura solo |

Y para INFORMAR a una persona: el mismo registro de mensajes alimenta el chip de entrega, el historial del
cliente y las métricas de coste (`getWhatsAppMetrics`): con la escritura caída, **coste del mes 0 € y ningún
fallo**, con los mensajes saliendo. `gatewayEvent.lastError` (`gatewayEvents.service.ts:184`) es diagnóstico.

El resto de las 40 son de otra clase y no se cuentan como casos: guardan la ruta de un PDF, un estado tras un
envío ya hecho (SCRUM-1465, declarado), o devuelven su desenlace al llamador (`registrarEnvio`,
`sellarTrasEmision`, `encolarAltaTrasSellado`).

### La sonda (módulos compilados de `dist/`, control primero)

Lo único que cambia entre columnas es qué escritura falla. «Salieron» = plantillas que el módulo real mandó
(dry-run, Meta no se toca).

| Sonda | CONTROL (todo se escribe) | Falla el candado | Falla el registro de mensajes | Fallan los dos |
| --- | --- | --- | --- | --- |
| Recordatorio de presupuesto · 48 pasadas (2 días de cron horario) · 1 presupuesto | **1** | 🔴 **48 de 48** | 1 | 🔴 48 de 48 |
| Recordatorio de factura · 30 pasadas (30 días) · 1 factura | **2** (7 d y 14 d) | 🔴 **60** (2 al día, siempre) | 2 | 🔴 60 |
| Tope por cliente · 10 plantillas al mismo cliente el mismo día | **3** salen, 7 bloqueadas | — | 🔴 **10 de 10**, 0 bloqueos | — |

Dos cosas que la sonda enseñó y no se buscaban:

- **Con el candado caído y el registro de mensajes SANO, el tope por cliente tampoco frena el recordatorio de
  presupuestos** (48 de 48, 0 bloqueos, 48 filas escritas). `reminder.service.ts:47` llama a
  `sendWhatsAppTemplate` sin `log.customerId`, y el tope por cliente sólo se evalúa si llega
  (`whatsapp.ts:390`). Le queda el tope por comercio: 100 al día.
- **En el de facturas el tope por cliente no llega por aritmética:** 2 al día contra un tope de 3.

## 4 · Lo que NO se midió

- **Cada cuánto falla una de estas escrituras.** No hay dato y no se inventa. Los modos en que falla la
  escritura y no la lectura existen en el propio código: `whatsappLog.service.ts:2` se declara tolerante a «la
  tabla aún no existe en prod».
- **La sonda mide la lógica del módulo, no a Postgres**: la base es un doble en memoria.
- **Los tragados en dos saltos** (`try { await f() } catch {}` donde es `f` quien escribe): `tragadas.cjs`
  clasifica dentro de cada función. Las 54 promesas sueltas se listan; se leyó adónde escriben las que nombran
  una escritura, no las 54 una a una con sonda.
- **`scripts/` y `tests/` como dependientes**: sólo como lectores de la tabla de auditoría.

## 5 · Las salidas, con su coste — sin elegir

| Salida | Qué es | Coste | Qué deja sin cubrir |
| --- | --- | --- | --- |
| **A · Esperar la escritura sólo donde alguien depende** | Que el candado, o la anotación que cuenta, deje de tragar: si no se escribe, la pasada lo sabe y para o lo nombra | Recordatorios y topes: pocas líneas, carril J2; pide DECIDIR qué hace un cron que no puede escribir su candado, y el tope cambiaría de «si no puedo contar, dejo pasar» a lo contrario (afecta a la entrega). `sellado_fallido`: es `selladoEstado.ts`, camino de emisión (regla 40, J1): STOP. No hace falta tocar `audit.service.ts`: `recordAuditOrThrow` ya admite cualquier acción | Un proceso que muere entre el envío y la escritura |
| **B · Segundo cinturón que no dependa de esa escritura** | Como el reloj de SCRUM-1404: acotar por geometría (p. ej. recordar sólo dentro de una franja de edad del documento) o pasar el cliente al tope | Más código y un test por cinturón; cada uno trae su propio punto ciego. Tocar cuándo se manda un recordatorio es regla de canal (J6, regla 28) | La causa: la escritura sigue fallando en silencio |
| **C · Declararlo por escrito** | Decir en cada sitio que esa escritura no es fiable y que nadie cuenta con ella | Cero código | Lo medido sigue igual: 48 de 48. Y hoy sólo está declarado en 2 de los 7 (correo y disputa) |
| **D · Que la puerta devuelva su desenlace** (lado de S1; se le dice, no se le hace) | `recordAudit` devolviendo si escribió, sin lanzar | Cambio aditivo en `audit.service.ts`; los 13 llamadores siguen igual | No arregla a ninguno por sí sola: cada dependiente tiene que mirarlo |
| **E · Un trinquete** | Un test por AST que caiga cuando aparezca un lector nuevo de una acción de la puerta que no se espera, con el reintento de 1404 declarado como excepción | Un test y su lista; `censo.cjs` ya hace la mitad | Sólo la tabla de auditoría, no la familia |

Para `encolado_fallido` hay además una pregunta previa que no es de código: **¿quién tiene que mirarlo?** Hoy
nadie, y no está en `RUNBOOKS.md`.

## 6 · Reproducir

```
node node_modules/typescript/bin/tsc --noCheck -p tsconfig.json   # sólo si falta dist/
bash docs/master/evidencias/SCRUM-1508/medir.sh
```
