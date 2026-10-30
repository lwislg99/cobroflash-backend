# SCRUM-1622 · Piezas de S1 que dejan abiertos tickets del equipo J

Ticket abierto por el orquestador del equipo J (27-oct-2026). Dos piezas:

| # | de | pieza | estado |
|---|---|---|---|
| 1 | SCRUM-1252 | el correo dice «Tu factura está lista» | **en main**: PR #2935 (anexo 1252g en `docs/master/SCRUM-1252.md`). No se repite aquí |
| 2 | SCRUM-1522 | `Europe/Madrid` fijo en tres sitios, en lugar de la zona del comercio | este tramo |

## 2026-10-27 · Pieza 2: la zona del comercio en lugar de `Europe/Madrid` fijo

**Medido contra:** `origin/main` = `1608087e64aaa4b08c2877ee3119cc2fad97e02e` · 2026-10-27T17:08:39Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum912-leer-ticket-gasto.test.mjs`

(Mi fallo: la primera versión de la ruta leía la zona de la base, y los casos de ruta de scrum912
corren SIN base; cayeron 5 con `500 internal_error`. Lo cazó el propio scrum912, que ahora dobla esa
lectura y exige que pregunte por ESE comercio y sólo por `timezone`.)

### ① El carril, medido fichero a fichero (el ticket lo pedía antes de tocar nada)

| fichero | `node scripts/carriles.mjs de <ruta>` |
|---|---|
| `src/modules/expenses/domain/lecturaTicket.ts` | S1 · `dos-equipos.md:136` (nombra `expenses`) |
| `src/modules/maintenance/domain/maintenance.service.ts` | S1 · `dos-equipos.md:136` (nombra `maintenance`) |
| `src/modules/jobs/domain/ventanaDeFirma.ts` | S1 · `dos-equipos.md:136` (nombra `jobs`) |
| `src/core/zonaDelMerchant.ts` (sólo se importa, no se toca) | S1 · `dos-equipos.md:136` |

Los tres son de S1 por la fila general, que los nombra uno a uno. Ninguno va a otro puesto.

### ② Qué cambia

| sitio | antes | ahora |
|---|---|---|
| `lecturaTicket.ts` `hoyEnMadrid(ahora)` | «hoy» en Madrid | `hoyDelComercio(ahora, zona)` = `diaNaturalEn` de `zonaDelMerchant`. `sanearLectura` y `leerTicket` reciben la zona |
| `expenses.routes.ts` `POST /leer-ticket` | clave del tope con el día de Madrid | lee `timezone` del comercio de la sesión (regla 2), `zonaDelMerchant`, y con ella la clave del tope y la lectura |
| `maintenance.service.ts` `isQuietHoursMadrid(now)` | corta el ciclo ENTERO si en Madrid es hora tranquila | `isQuietHours(now, zona)`, mirado **plan a plan** con la zona de su comercio (aviso de «sin canal» y propuesta). Un plan en hora tranquila no se toca y sigue vencido, como antes |
| `ventanaDeFirma.ts` `cruzaDias(ventana, zona = 'Europe/Madrid')` | sin zona, Madrid | la zona es obligatoria |

Sin zona, los tres **rechazan** (`zona_requerida`) en vez de caer: `Intl` sin `timeZone` usa el reloj
del PROCESO, que es justo el defecto que `zonaDelMerchant` existe para cerrar.

La regla de las horas tranquilas ya decía «hora del merchant» en el máster (J6, línea 326:
«automatismos 09:00-21:00 hora del merchant»): el código decía Madrid. No se inventa nada.

⚠️ **Lo que cambia para un comercio SIN zona declarada:** pasa de Madrid a UTC, que es la decisión A
del fundador para todo el producto (`zonaDelMerchant.ts`, `ZONA_POR_DEFECTO`). Según SCRUM-1522
c.19297 ②, los comercios a NULL son todos de prueba y no se tocan.

### ③ La ventana de firma y el sello del albarán

`ventanaDeFirma.ts` **no lo importa ningún fichero de `src/`** (medido: la única aparición del nombre
es su propia cabecera; `_sin-consumir-declarados.json:97` declara `cruzaDias` «sin enchufar»). Así
que este cambio **ni arregla ni rompe** la contradicción del sello del albarán (sello en hora del
proceso frente a «Firmado el» en la zona del negocio): esa vive en el PDF del albarán, no aquí, y
sigue esperando la decisión del fundador. `cruzaDias` sigue en la línea 182, que es la que cita el
censo.

No toca el camino de emisión ni ningún sellado: ningún fichero tocado lo importa la emisión, y
`zonaDelMerchant.ts` sólo se importa.

### ④ El test, rojo primero

`tests/scrum1622-zona-del-comercio.test.mjs`, sin base ni red. Instantes elegidos donde Madrid y
Canarias marcan distinto día u hora; Madrid es el control.

| caso | código de main | arreglado |
|---|---|---|
| ① `hoyDelComercio` Canarias/Madrid/UTC | ✖ | ✔ |
| ① ticket del 19 a las 23:30 del 18 en Canarias = futuro (control Madrid: vale) | ✖ | ✔ |
| ① sin zona se rechaza | ✖ | ✔ |
| ② `isQuietHours` 19:30Z: Madrid tranquila, Canarias no | ✖ | ✔ |
| ② el ciclo propone al canario a las 20:30 de Canarias | ✖ | ✔ |
| ② control: el peninsular a las 21:30 no recibe propuesta | ✔ | ✔ |
| ② el aviso «sin canal» se salta plan a plan | ✖ | ✔ |
| ③ `cruzaDias` sin zona se rechaza; con Canarias cruza, con Madrid no | ✖ | ✔ |

Rojo: 7 de 8 con el `dist/` de main; el control pasa en los dos. ⚠️ La mitad canaria del aviso
«sin canal» (que SÍ se registra) no se mira: `avisarPlanSinCanal` corre con sus dependencias reales
—el bucle no le pasa las suyas— y eso pide base.

Tests existentes ajustados para pasar la zona explícita (Madrid, la que ya suponían):
`scrum359` (3 llamadas a `cruzaDias`), `scrum912` (zona en `sanearLectura`/`leerTicket` y la lectura
de la zona doblada en la ruta), `scrum961b` (una llamada). Censo `tests/_huerfanos-declarados.mjs`:
el export renombrado (`isQuietHoursMadrid` → `isQuietHours`).

Tanda local de los 115 ficheros que miran estos módulos, los censos de exports o `Europe/Madrid`:
**1137 tests · 1135 pass · 0 fail · 2 skipped** (la misma población y los mismos 2 saltos que la
primera pasada, que dio 5 fail: los de §A9).

### ⑤ Fuera

- **Visto en yaqu.app: no.** La lectura de tickets gasta cuota de Google; el ciclo de mantenimientos
  va tras `MAINTENANCE_ENABLED` (OFF) y sólo corre por cron; `cruzaDias` no tiene consumidor. La
  cuenta QA tiene `timezone: null`, así que tampoco mostraría la diferencia Madrid/Canarias.
- El sello del albarán (§③): decisión del fundador, sin tocar.
