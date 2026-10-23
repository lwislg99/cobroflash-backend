# SCRUM-1471 · El recibo y el portal pintan el día del negocio: un pago de las 00:30 ya no sale con la víspera

**Medido contra:** `origin/main` = `fdac6867180adf6892fa3cb0f514ebbf69d04ab5` · 2026-10-06T13:33:29Z

A9: comprobación → `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs`

Sesión J3d (`jv-j3`) · rama `scrum-1472-fecha-impresa-zona-del-negocio` · **cruce de carril declarado
por el orquestador de Javier** (el ticket es `area-j2`). La forma y el porqué de ir los tres juntos
están en `docs/master/SCRUM-1470.md`.

## El rojo, ejecutado ANTES de tocar nada

El enunciado decía de estos sitios «NO lo he ejecutado: sale de leerlos». Ejecutado ahora, con el
proceso en UTC, el negocio en `Europe/Madrid` y un pago del 3-oct-2026 a las 00:30 de Madrid, por
las dos rutas reales (`GET /recibo/:token` y `GET /portal/:token`, con un Prisma de mentira):

| Papel | Antes | Después |
|---|---|---|
| recibo | «Pagado el **02** de octubre de 2026» | «Pagado el 03 de octubre de 2026» |
| portal, la factura | «02 oct 2026 · Pagada **02** oct 2026» | «02 oct 2026 · Pagada 03 oct 2026» |
| portal, el presupuesto | «**02** oct 2026» | «03 oct 2026» |
| CONTROL · el mismo pago a las 14:00 | 02 en los tres | 02 en los tres: no se mueve |
| el mismo instante, negocio SIN zona | 02 en los tres | 02 en los tres: no se mueve |

En invierno (+1) y en Canarias pasa lo mismo, con sus días; son casos aparte en el test.

## Qué se ha cambiado

- `receipt.routes.ts`: «Pagado el …» y la hora de los eventos llevan `timeZone: zonaDelMerchant(…)`.
  ⚠️ La lista de eventos sólo se pinta fuera de producción («Dev · eventos del cobro»): el cliente
  no la lee. Se arregla igual: un sitio que hoy no se ve es el que mañana se enseña sin revisar.
- `customerPortal.routes.ts`: `dateShort` recibe la zona del negocio, resuelta una vez por página.

## Lo que NO se ha cambiado, con su motivo y con QUÉ decisión lo desbloquea

**La fecha de la FACTURA en el portal** (el primer dato de su tarjeta) sigue con el reloj del proceso.
Vive ahora en una función con su nombre, `fechaDeLaFactura`, y está en la clase IMPRIME del censo
con este motivo: su gemelo es la «Fecha:» del PDF de esa factura (`dateStr`), que se pinta igual y
es fiscal. La regla del ticket —«cambian juntos o no cambian»— manda dejarla.

- **La desbloquea** la aceptación 2 de SCRUM-1470: qué día imprime el PDF de la factura, que decide
  el fundador. Ese día `fechaDeLaFactura` desaparece y la tarjeta entera usa `dateShort`.
- **Su coste, dicho:** hasta entonces esa línea mezcla dos relojes para una factura emitida y pagada
  de madrugada («02 oct 2026 · Pagada 03 oct 2026»). La alternativa —pasarla ya a la zona del
  negocio— la habría hecho discrepar del PDF de la factura. Lo decidió el orquestador de Javier (b).
- El caso «DECLARADO» del test la sujeta: si alguien la mueve sin mover el PDF, cae.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Un pago con instante 00:30 hora del negocio, con la zona declarada, imprime SU día en el recibo («Pagado el …») y en el portal («Pagada …»), y los dos dicen el mismo. | `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs` · «SCRUM-1471 · 🔴 un pago de las 00:30 del negocio…», por las dos rutas y con el proceso en UTC |
| 2. La fecha del presupuesto y de la factura en el portal es la misma que imprime su PDF. | Presupuesto: el mismo test, «SCRUM-1471 · la fecha del presupuesto en el portal…» (el PDF del presupuesto no imprime fecha de creación; se compara con la de su firma y su página). Factura: NO HECHO → espera la aceptación 2 de SCRUM-1470; no cambia, y coincide con su PDF porque ninguno de los dos se ha tocado. |
| 3. Las 3 filas salen de la clase IMPRIME del censo, o quedan con su motivo escrito. | `censar()`: las 2 del recibo han salido; la del portal ha salido como `dateShort` y queda UNA, `fechaDeLaFactura`, con su motivo en `USO`. |

## Lo que no se ha mirado

- **No está visto en yaqu.app:** la rama no está mergeada.
- El PDF de la factura no se ha ejecutado ni tocado.

## SCRUM-1471b · La fecha de la FACTURA en el portal es el día de su registro (J2, jv-j2ak, 23-oct-2026)

**Medido contra:** `origin/main` = `f1c0ff3094c004ea7b99ffe2f1d13a21213c5ad1` · 2026-10-23T14:50:33Z (hora de GitHub)

A9: comprobación → `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs`

Lo desbloquea la decisión del fundador en SCRUM-1470 c.20530 («Sí, el mismo día»): la «Fecha:» del PDF
de la factura imprime el día natural de su registro. Lo hace SCRUM-1470c (J1, rama
`scrum-1470c-factura-dia-del-registro`, sin mergear al escribir esto). Este tramo es su gemelo en el portal (regla del ticket: el papel y su gemelo cambian juntos).

**Qué cambia.** `fechaDeLaFactura` (`customerPortal.routes.ts`) pide el día a
`diaNaturalEn(createdAt, zonaDelMerchant(m))`, la MISMA función que usan el registro y el `dateStr` de
1470c, y sólo le pone la forma corta (`timeZone: 'UTC'` sobre ese día). No usa `dateShort`, aunque
daría el mismo día: así el portal no puede decir un día distinto del registro aunque las dos formas de
calcularlo divergieran. Ningún texto cambia: la forma sigue siendo «03 oct 2026».

**El rojo, por la ruta real y con el proceso en UTC** (`tests/_sonda-fecha-impresa.mjs`, `GET /portal/:token`),
antes de tocar `src/`: el caso nuevo cae con «02 oct 2026 · Pagada 03 oct 2026» (verano, 00:30 de Madrid),
y cae también el censo. Después: 15 de 15, 0 caen, 0 saltos.

**Sin zona declarada no cambia nada:** lo sujeta el caso «CONTROL» que ya existía (`sinZona` y
`zonaRota` siguen diciendo «02 oct 2026 · Pagada 02 oct 2026», y mediodía no se mueve en verano ni en
invierno). Pasa sin tocarlo.

**Mutaciones**, con la base sin mutar en verde:
- M1 (`dist/`: la tarjeta recibe `'UTC'` en vez de la zona del negocio) → cae el caso «SCRUM-1471b».
- M2 (`src/`: se quita `timeZone: 'UTC'` del formato) → este fichero NO la ve, porque el proceso del
  test ya va en UTC. La caza `tests/scrum1093h-censo-fecha-sin-zona.test.mjs`: caen «RATCHET» y
  «ninguna entrada de RETIRADAS ha vuelto». Base de ese fichero con el cambio: 21 de 21.

**Censo:** `customerPortal.routes.ts::fechaDeLaFactura` sale de `USO` y entra en `RETIRADAS`. En los cinco
ficheros del test quedan 5 filas que IMPRIMEN, no 6.

**Choque con 1470c, declarado:** las dos ramas tocan las mismas líneas del test (el caso «DECLARADO» y la
lista del censo) y de `scripts/_censo-fecha-sin-zona.mjs`. La que entre segunda tendrá un conflicto de
texto. Se resuelve quitando las tres filas de `dateStr` y la de `fechaDeLaFactura` (quedan 2), y
dejando las dos identidades en `RETIRADAS`. El caso «DECLARADO» de 1470c desaparece: lo sustituye el de aquí.

| aceptación (literal) | dónde se ve |
|---|---|
| 2. La fecha del presupuesto y de la factura en el portal es la misma que imprime su PDF. | Factura: `tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs` · «SCRUM-1471b · 🔴 la fecha de la FACTURA en el portal…»: contra el día escrito a mano y contra `diaNaturalEn`, que es el día del PDF (lo comprueba `tests/scrum1470c-…` en la rama de J1). La comparación directa portal ↔ PDF de la factura NO está hecha: el PDF de la factura no está en main todavía. |
| 3. Las 3 filas salen de la clase IMPRIME del censo, o quedan con su motivo escrito. | `censar()`: salen las 3 (`fechaDeLaFactura` en `RETIRADAS`) · `tests/scrum1093h-censo-fecha-sin-zona.test.mjs` |

**Lo que no se ha mirado:** yaqu.app (sin mergear); la tanda completa (sólo la muestra de guards de la
entrega); el typecheck completo da 17 errores en cuatro ficheros de presupuestos que este tramo no
toca (árbol anidado con el cliente de Prisma compartido); no lo he cruzado con un árbol limpio.
