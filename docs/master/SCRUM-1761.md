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
