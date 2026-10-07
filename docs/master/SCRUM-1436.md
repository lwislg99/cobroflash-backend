# SCRUM-1436b · El recordatorio manual nombra el documento por su número

> Este tramo es **SCRUM-1436b**: sólo la parte de J1 del hallazgo 2 del ticket. Los hallazgos 1 y 3
> son de J2 y van en su propia rama, con su propio tramo en este fichero. Por eso hay dos tramos.

**Medido contra:** `origin/main` = `12ecc7bb3bad377e729a01b09fd755f978e125b9` · 2026-10-07T15:47:30Z

A9: comprobación → `tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`

Sesión J1 (`jv-j1`, 7-oct) · rama `scrum-1436b-el-recordatorio-nombra-por-el-numero`. Encargo del
orquestador de Javier, sobre lo que midió el equipo de Luis en SCRUM-1436.

## El defecto

`POST /admin/invoices/:id/send-reminder` manda al cliente, cuando el documento no tiene cobro, un
texto libre. Ese texto decía «el pago de la factura *N*» escrito a mano, también para un `J-…`, que
es un justificante y no una factura (reglas 24 y 26).

Visto ejecutando la ruta real de `dist/` (base doblada, WhatsApp en dry-run), antes de tocar nada:

    J-2026-0007 → «…tienes pendiente el pago de la factura *J-2026-0007* por *419,87 €*…»
    F260007     → «…tienes pendiente el pago de la factura *F260007* por *419,87 €*…»

## El arreglo

Una línea, en `src/modules/system/app/routes/invoicesAdmin.routes.ts`: la palabra la decide
`isReceiptNumber(invoice.number)`. Es el criterio que ya usan los otros dos emisores del mismo
documento (`invoiceWhatsApp.service.ts` y `invoiceReminder.service.ts`); el fichero ya lo importaba.
No hay criterio nuevo.

La forma es la acordada en el comentario 18287 del ticket: el artículo va dentro de la etiqueta,
«de la factura» / «del justificante». Ese comentario lo escribió la cuenta de Luis; aquí se cita
como la forma acordada, no como firma del fundador. Para una factura la frase no cambia ni una
letra, y el test lo comprueba entera.

No se ha tocado el camino de emisión: el cambio está dentro del handler del recordatorio y no
mueve ninguna línea del fichero (1 insertada, 1 borrada).

## El test

`tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`, 5 casos, por la ruta real:

| caso | antes del arreglo | después |
|---|---|---|
| SUELO: sin cobro sale un texto libre | pasa | pasa |
| 🔴 un `J-…` se llama «justificante» y no «factura» | **cae** | pasa |
| ✅ una factura dice «factura», con la frase entera de siempre | pasa | pasa |
| la palabra coincide con `isReceiptNumber` sobre 7 números (3 justificantes, 4 facturas) | **cae** | pasa |
| CONTROL: con cobro sigue yendo por la plantilla | pasa | pasa |

Antes: 5 casos, 3 pasan, 2 caen. Después: 5 casos, 5 pasan, 0 caen.

## Mi error

El positivo cayó la primera vez sobre el código SIN tocar. El importe lleva un espacio de no
separación (U+00A0) y yo lo había escrito en el test como un espacio normal: dos cadenas que en
pantalla son iguales. Lo delató que un caso que tenía que pasar cayera, no leerlo. Ahora el test
saca el importe del helper de la casa (`formatMoneyEs`) y comprueba su forma antes de usarlo.

## Lo que NO lleva

- **El camino con cobro.** Ahí el recordatorio va por la plantilla `payment_request_es`, cuyo texto
  es de Meta. No se ha mirado qué palabra lleva esa plantilla para un justificante.
- **El recordatorio automático** (`invoiceReminder.service.ts`, «el pago del factura»): es de J2.
- **La otra rama del hallazgo 2:** el recordatorio manual con cobro manda siempre la plantilla, sin
  probar antes la ventana abierta. No se ha tocado.
- **No se ha visto en yaqu.app.** Pide una sesión con un justificante sin cobro y un cliente con
  teléfono.
- **Tipos:** el build local es `--noCheck`. Los tipos los comprueba el CI.

## SCRUM-1436d · Los importes en crudo (hallazgo 4): los cuatro de J1, y los siete de J2 sin tocar

> Cruce de carril: **no lo hay**. El encargo permitía hacer también los de J2 declarándolo aquí, pero
> la cerradura de carril pide que el cruce esté en `docs/equipo/dos-equipos.md` §3.4, y ese fichero
> es de la S0. Los de J2 se quedan medidos, con su test en rojo y el cambio escrito abajo.

**Medido contra:** `origin/main` = `9acfbeba61c997aa838ad2460103a219141cd293` · 2026-10-07T16:40:12Z (hora de GitHub)

A9: comprobación → `tests/scrum1436d-los-importes-en-crudo.test.mjs`

Sesión J1 (`jv-j1`, 7-oct, relevo de la de SCRUM-1436b) · rama `scrum-1436d-los-importes-en-crudo`.

### Lo primero que se midió: ¿alguno es un log?

Ninguno. Son once sitios (los diez del ticket y el undécimo del comentario 18194), y a los once se
llegó EJECUTANDO la ruta o el servicio real de `dist/`, con la base doblada y el WhatsApp en dry-run.
Lo que salió, antes de tocar nada (12 casos, 3 pasan, 9 caen):

| sitio | dueño | dónde lo lee alguien | lo que salía |
|---|---|---|---|
| `invoiceWhatsApp.service.ts:137` | J1 | historial de la ficha del cliente | `1419.87 EUR` |
| `invoicesAdmin.routes.ts:323` | J1 | aviso de la factura y del trabajo, e historial | `Recibidos 300.00 de 1419.87 EUR (faltan 1119.87). …` |
| `invoicesAdmin.routes.ts:324` | J1 | los mismos | `Recibidos 1500.00 EUR (sobran 80.13). …` |
| `invoicesAdmin.routes.ts:378` | J1 | paquete de disputa, que se imprime y va al banco | `1419.87 EUR` |
| `psp.routes.ts:317` | J2 | historial de la ficha | `1419.87 EUR · Justificante J-2026-0007` |
| `psp.routes.ts:348` | J2 | WhatsApp al profesional (texto libre) | `💰 Pago recibido de Cliente de prueba: 1419.87 EUR` |
| `psp.routes.ts:349` | J2 | WhatsApp al profesional (variable de `merchant_alert_es`) | no visto (*) |
| `mpWebhook.routes.ts:214` | J2 | historial de la ficha | no visto (*) |
| `mpWebhook.routes.ts:243` | J2 | WhatsApp al profesional (texto libre) | `… de Cliente de prueba: 1419.8 EUR` |
| `mpWebhook.routes.ts:244` | J2 | WhatsApp al profesional (variable de plantilla) | no visto (*) |
| `payBizum.routes.ts:197` | J2 | WhatsApp al profesional, las dos vías | `… dice que te ha enviado 1419.87 EUR por Bizum. …` (el texto libre; la otra vía, no vista (*)) |

(*) La llamada se ejecutó y llegó a ese sitio, pero el caso cayó en la comprobación anterior y no
imprimió ese valor. Que lleva el mismo `toFixed(2)` más el código está leído, no visto salir.

Las líneas son las de `origin/main` del 7-oct; las del ticket iban una por debajo en
`invoicesAdmin.routes.ts`. Que el historial y el aviso se pintan tal cual está leído en
`customerDetailView.js:469`, `invoiceDetailView.js:475` y `jobDetailView.js:2186`, no ejecutado en
un navegador.

### El arreglo (sólo J1)

- **Historial de la factura enviada:** reusa el `importe` que la misma función ya calcula con
  `formatMoneyEs` para el mensaje del cliente.
- **Paquete de disputa:** su `money()` llama a `formatMoneyEs`.
- **Importe distinto:** la frase lleva tres cifras y una sola moneda. Para no añadirle dos símbolos
  que no tenía, la cifra que ya iba con la moneda pasa por `formatMoneyEs` y las otras dos por
  `formatImporteEs` (la misma forma, sin símbolo). Queda «Recibidos 300,00 de 1.419,87 € (faltan
  1.119,87). …». Ninguna palabra cambia: el test compara la frase entera y, aparte, su esqueleto sin
  cifras contra el de la frase vieja.

`formatMoneyEs` no se toca y no entra ningún formateador nuevo. No se toca el camino de emisión:
`invoicesAdmin.routes.ts` tiene la puerta de emisión, pero los cambios están en `payment-anomaly` y
`dispute-package`, que no emiten.

**Un test que ya existía fijaba el formato viejo:** `tests/scrum342-dispute-package-quote-nulo.test.mjs`
exigía `250.00 EUR` en el paquete. Cayó con el arreglo y se le cambió esa línea para que pida la
forma de la casa, sacada del helper. Es consecuencia del cambio, no un guard relajado: sigue
comprobando que el importe del presupuesto sale.

### El test

`tests/scrum1436d-los-importes-en-crudo.test.mjs`, 7 casos. Contra el código sin tocar caían 5 (los
cuatro sitios y el de moneda no euro) y pasaban 2 (el suelo y el positivo de la frase). Después, 7 de 7.
Los importes esperados salen del helper, nunca tecleados, por el espacio duro.

Corrido después del último cambio de código: los 51 ficheros de `tests/` que nombran los dos ficheros
tocados o sus rutas, 525 casos, 521 pasan, 0 caen, 4 saltan (dos piden `LIBRO_PG_URL` y dos
`QA_DB_TEST`). Y `scrum411`, `scrum262`, `scrum1415`, `scrum237`, `scrum708`, `scrum931`, `scrum636`.

### Mi error

El caso positivo («la frase no cambia») cayó la primera vez con el arreglo puesto, y el fallo era
mío: la expresión que quita las cifras pedía un límite de palabra detrás de «€», que nunca casa,
así que dejaba el símbolo suelto. Con el formato viejo («EUR») sí casaba, y por eso había pasado
antes. Lo delató el positivo, y el caso lleva ahora la comprobación contra la frase vieja.

### Lo que queda para J2 (medido, no hecho)

El banco completo está en
`docs/master/evidencias/SCRUM-1436/propuesto-j2-los-importes-de-los-avisos.test.mjs.txt`: sus cuatro
casos de J2 caen hoy. El cambio en cada sitio es el mismo: `formatMoneyEs(<importe>, <moneda>)` en
lugar de `toFixed(2)` más el código. Dos cosas a mirar al hacerlo:

- `psp.routes.ts` y `mpWebhook.routes.ts` no importan nada de `core/utils/utils`: hay que añadir el
  import. Sus comentarios de SCRUM-931 («`amt` sigue vivo debajo…») dejan de ser ciertos.
- `mpWebhook.routes.ts:243` pinta `payment.amount`, lo que dice el proveedor, y la línea de al lado
  pinta `updated.amount`, lo del cobro. Son dos fuentes para el mismo importe; el test propuesto
  conserva cada una.

La variable de `merchant_alert_es` con «1.419,87 € · F260007» pasa el validador de la casa
(`validateTemplateComponents`), y la muestra aprobada de esa plantilla ya lleva esa forma. No se ha
enviado nada a Meta.

### Lo que NO lleva

- Los siete sitios de J2.
- La tanda completa en local, y los tipos: el build local es `--noCheck`.
- Nada visto en yaqu.app.
