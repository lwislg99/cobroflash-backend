# SCRUM-1761 · Zona horaria: restos de J1 de la decisión c.21896 (SCRUM-1445) — tramo 1761a: el año del XML de VeriFactu y el ② de SCRUM-1055b

**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:39:19Z
**Rama:** `scrum-1761a-anio-del-xml` · **Carril:** J1 · sesión jv-j1ff
A9: comprobación → `tests/scrum1761a-anio-del-xml-por-zona.test.mjs`
Mutaciones: catálogo → `tests/scrum1761a-anio-del-xml-por-zona.test.mjs`

**Error propio (A9).** En la primera sonda pasé la zona del proceso desde Git Bash (`TZ=Europe/Madrid node …`) y no llegó: node imprimió `TZ undefined` y la pasada salió idéntica a la de UTC, que se lee como «la zona del proceso no cambia nada». Lo cacé porque la sonda imprime la zona y `new Date(2026,0,1)` antes de medir. En el test, la zona se fija DENTRO de node (`process.env.TZ`), y su tercer caso de control es la comprobación: si la asignación no surtiera efecto, el caso «con el proceso en la zona del emisor» saldría DEFECTO y caería.

Piezas ① y ③ del ticket. La pieza `libroRegistro.routes` NO es de este tramo: la decide el PR-2 de SCRUM-1732 (jv-j1fd, #3224).

## ① El año del XML (camino de emisión: sólo leído y ejecutado, regla 38)

`buildVerifactuRegistrosXml` (`src/modules/invoicing/domain/verifactu.service.ts:715`) elige las facturas del año con `createdAt` entre `new Date(params.year, 0, 1)` y `new Date(params.year, 11, 31, 23, 59, 59, 999)` (`:733-734`): el calendario del PROCESO. La `FechaExpedicionFactura` que imprime el mismo XML sale en la zona del emisor (`zonaDelMerchant`, `:727`, SCRUM-735).

El test ejecuta el servicio de `dist/` sin tocarlo (ya es exportado y recibe `prismaClient` inyectable), con una base doblada que aplica de verdad el filtro `createdAt` que el servicio le pide. Proceso en UTC (en Railway no hay `TZ`: SCRUM-1055 c.21873; que el defecto sea UTC no está medido leyendo la hora del proceso).

| factura | emisor | proceso | XML 2026 | XML 2027 | estado |
|---|---|---|---|---|---|
| 2026-12-31T23:30Z | Pacific/Kiritimati (allí 1-ene 13:30) | UTC | 1 registro, `FechaExpedicionFactura` **01-01-2027** | vacío | **DEFECTO** (declarado) |
| 2026-12-31T23:30Z | Pacific/Midway (allí 31-dic 12:30) | UTC | 1 registro, 31-12-2026 | vacío | coincide (control) |
| 2026-12-31T23:30Z | Pacific/Kiritimati | Pacific/Kiritimati | vacío | 1 registro, 01-01-2027 | coincide: lo decide el PROCESO (control) |
| 2027-01-01T05:00Z | Pacific/Midway (allí 31-dic 18:00) | UTC | vacío | 1 registro, 31-12-2026 | DEFECTO (el otro sentido, control) |

Test: `tests/scrum1761a-anio-del-xml-por-zona.test.mjs`, 5/5 verde con el defecto DECLARADO (`DEFECTO_CONOCIDO.anioDelXmlEnZonaDelProceso`). Mutación de catálogo: retirar la declaración → cae «el año del XML sigue en la zona del proceso» (corrida a mano, 4 pass · 1 fail, fichero restaurado). El año del emisor se mide con dos sondas independientes (la fecha que imprime el servicio e `Intl`); si discrepan, CIEGO.

**La decisión que FALTA (no es de J1; preguntada en SCRUM-1761 para J5/asesor):** qué año manda para el registro de facturación VeriFactu en un XML por ejercicio: ¿el de la fecha de expedición en la zona del emisor? Arreglarlo es tocar `:733-734` del camino de emisión: STOP y GO del fundador.

## ③ El defecto ② de SCRUM-1055b, medido en main

Descrito en SCRUM-1055 c.21863: el borde del trimestre se calcula en la zona del proceso (`rangoTrimestre`). Hoy:

- **Sigue, pero sólo SIN zona.** `rangoTrimestre(año, t, zona?)` (`src/modules/fiscal/modelo303/modelo303.ts:209`): con `zona`, bordes del calendario de esa zona (`:214`); sin ella, `new Date(año, …)` del proceso (`:215-220`). `tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs` ② sigue verde como DEFECTO declarado: 9/9, «proceso UTC → T[1] · proceso Europe/Madrid → T[2]».
- **Los lectores de J1 ya pasan la zona** (SCRUM-1445f): 303, 130, 347, 111/115, libros AEAT, paquete (`grep -rn "rangoTrimestre(\|rangoAcumulado(" src`: 18 llamadas, 16 con zona).
- **Las 2 sin zona son de S1** (`node scripts/carriles.mjs de` → S1): `src/modules/reports/app/routes/reports.routes.ts:274` y `:368`. No se tocan desde J1.
- La declaración ② de `scrum1055b` NO se retira: el camino sin zona sigue existiendo y lo alcanzan esas dos rutas. 1055 está `esperando-asesor`: no se construye nada.

# SCRUM-1761b

**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:41:32Z
**Rama:** `scrum-1761b-anio-del-xml-norma` · **Carril:** J5 · sesión jv-j5bi · sólo documentos
A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: ningún guard sabe qué parte de un texto del BOE es imagen

LECTURA de la norma para la pregunta de c.22059 ① (encargo c.22087). Entrega completa, con los literales: SCRUM-1761 c.22115. No es respuesta de asesor (reglas 17 y 26). No se propone código: `:733-734` es camino de emisión (regla 40).

**Error propio (A9).** Busqué `FechaExpedicionFactura` y `FechaHoraHusoGenRegistro` en el texto de la Orden y salió 0. Casi lo leo como «la Orden no los nombra». Las tablas de campos del anexo son imágenes en el BOE (23 `<img>`), así que el formato de los campos sale del XSD de la AEAT y no del BOE, y se dice así.

**Veredicto: (b).** Ni el RRSIF ni la Orden HAC/1177/2024 conocen el «año» ni el «ejercicio» de un registro de facturación: el criterio es una decisión de producto. Lo único que dicen sobre exportar por tiempo es la Orden art. 8.2: «exportar todos los registros de facturación generados en un periodo». Es decir, por **generación**, y sin fijar el periodo ni su calendario.

| norma (API consolidada del BOE, `Date:` 18-nov-2026 23:39Z) | id | sha256 |
|---|---|---|
| RD 1007/2023 (RRSIF) | BOE-A-2023-24840 | `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38` |
| Orden HAC/1177/2024 | BOE-A-2024-22138 | `284db49ed40e17ad47fb2447a6e37ef087c192d68336df9bd465fdfcbfd4a4ff` |
| Ley 37/1992 (LIVA) | BOE-A-1992-28740 | `5fb06ddd1015fb9b42fb76f8fccfaddd5335ca4ce488b085197f0aa658a8d34d` |
| RD 1624/1992 (RIVA) | BOE-A-1992-28925 | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |

- **Fecha de expedición:** RRSIF art. 10.1.e). Ningún texto le pone huso. En el XSD es `sf:fecha` (`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd:71`, tipo en `:667-671`), `dd-mm-aaaa`, sin hora ni huso.
- **Generación del registro:** RRSIF art. 10.1.p) y art. 11, letra g. La Orden la regula en el art. 7: la letra e) dice «de acuerdo al territorio desde donde se expide la correspondiente factura» y la g) «deberá incluir el huso horario». En el XSD es `dateTime` (`:176`, `:205`).
- **La cadena no es anual:** Orden art. 7.b-c, «una única cadena» por obligado y sistema, desde la puesta en marcha. Contradice el motivo escrito en `docs/YAQU_MASTER.md:766-768` («la cadena de huellas es anual»). El máster no se toca aquí (regla 35, SCRUM-273): se le pasa al orquestador.
- **IVA:** RIVA art. 69, 69 bis y 71.3 (el período es el trimestre natural). La LIVA y el RIVA no dicen ni huso ni zona: «huso», «zona horaria» y «hora oficial» dan 0. El positivo, «periodo de liquidación», da 9 y 51.
- **Controles:** «huso horario» da 4 en la Orden y «zzqx» da 0 en los cuatro textos.
- **Es nuestro:** el XML por año natural lo decidió el fundador en SCRUM-82 (`docs/YAQU_MASTER.md:766`), para el pack de inspección (`docs/RUNBOOKS.md` R13, `docs/legal/PACK_GESTORIA.md:56`).
- **Opciones para el orquestador** (con su coste, en c.22115): A · año de la expedición en la zona del emisor; B · calendario UTC del proceso, que es lo de hoy; C · año de la generación con su propio huso, la única que sigue el literal del art. 8.2. A y C tocan el camino de emisión: GO del fundador. En c.22115 va también el literal propuesto para una fila de SCRUM-1264, si el fundador la quiere.

**Sin medir:** las imágenes del anexo de la Orden; con qué fecha imputa la AEAT el `PeriodoImputacion` de `ConsultaLR.xsd:21`; si `createdAt` coincide con el instante de generación del registro.
