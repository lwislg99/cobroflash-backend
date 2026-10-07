# SCRUM-1404 · El PDF de una factura sin sellar contesta 500: medido ejecutando las dos rutas, sin tocar nada

**Medido contra:** `origin/main` = `965e3d053f1f7d9ba24830f17abc7a54254c83f9` · 2026-10-07T17:05:20Z (hora de GitHub)

A9: comprobación → `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`

Sesión J1 (`jv-j1`, 7-oct), por encargo del orquestador de Javier: **medir y parar**. No se ha tocado
`src/`, ni un test, ni un texto. Al cerrar, `origin/main` iba por `60f1933845705618e5b82847d6090158f730a390`;
los cinco ficheros leídos abajo son idénticos en los dos (diff vacío).

## Qué se hizo

`docs/master/evidencias/SCRUM-1404/medir-1404.mjs` carga de `dist/` las dos rutas que sirven el PDF de
una factura, con la base doblada, y les pide el PDF. `ensureInvoicePdf`, el portón y el `catch` de
cada ruta son el código de producción. Salida entera: `salida-medir-1404.txt`, al lado. Tres casos por
dos rutas, seis llamadas, seis hechas.

| la factura | panel · `GET /admin/invoices/:id/pdf` | cliente final · `GET /recibo/:token/pdf` |
|---|---|---|
| ① `pendiente_de_sellado` (España, con NIF, sin huella) | **500** · `{"error":"pdf_generation_failed"}` | **500** · página «Documento no disponible», con «Este enlace no corresponde a ningún documento activo.» |
| ② control: `sellado` en la columna y sin huella | 409 · `invoice_sin_sellar` y su frase firmada | 409 · página «Factura en proceso» y su frase firmada |
| ③ control: la factura llega sin su cliente | 500 · `pdf_generation_failed` | 500 · «Documento no disponible» |

El defecto existe hoy, y son **dos rutas**, no una: el ticket nombra la del panel; la del recibo es
pública y la abre el cliente final.

## Por qué: los dos códigos nacieron distintos

- `src/lib/invoicing.ts:61-62` · si `vfEstado` es `pendiente_de_sellado`, `ensureInvoicePdf` lanza
  `new Error('invoice_pendiente_de_sellado')` (la constante `ERROR_PDF_SIN_SELLAR`). Entró el
  29-jul-2026, commit `f0a005d61` (SCRUM-205/206 parcial).
- `invoicesAdmin.routes.ts:1290` y `receipt.routes.ts:509` · el `catch` pregunta `esErrorSinSellar(err)`,
  que sólo reconoce `invoice_sin_sellar` (el código del portón, `portonDocumento.ts:117`). Entró el
  30-jul-2026, commit `58d6d136d` (SCRUM-206).

El ticket suponía que el error «cambió de forma y el `catch` se quedó con la anterior». No es eso: el
`throw` es un día anterior al `catch`, y nunca casaron. La comprobación de la línea 61 corta antes de
llegar al portón de la línea 104, así que el 409 sólo se alcanza con una fila incoherente (el caso ②).
Para una factura que de verdad espera su sellado, el 409 no se alcanza nunca.

**Los dos textos del 409 llevan en el código una marca de aprobación del 30-jul-2026 y hoy no los
ve nadie.** Están en `invoicesAdmin.routes.ts:1295` (panel) y en `portonDocumento.ts:51-52` (cliente);
no se copian aquí a propósito (ver «Mi error», abajo). ⚠️ Esa aprobación **no la he comprobado en su
origen**: lo único que la sostiene, que yo haya visto, es el comentario del propio código.

## Censo de quien llama a `ensureInvoicePdf`

Cuatro llamadas en `src/` (control con un nombre inventado: 0).

| quién | qué hace con el rechazo | ¿500? |
|---|---|---|
| `invoicesAdmin.routes.ts:1280` · panel | `catch` con el código que no casa | sí, ejecutado |
| `receipt.routes.ts:498` · recibo público | el mismo `catch` | sí, ejecutado |
| `email.service.ts:76` · correo de la factura | deja constancia del fallo y relanza | leído, no ejecutado |
| `exports.routes.ts:201` · ZIP de datos | la factura va a `fallidos` y el ZIP sigue | leído, no ejecutado |

Aparte, `POST /admin/invoices/:id/regenerate-pdf` (`invoicesAdmin.routes.ts:1210`) mira el estado él
mismo y contesta 409 con `invoice_pendiente_de_sellado`, sin frase. Son tres respuestas distintas
para la misma situación.

## Quién lo ve

- **El profesional**, en el detalle de la factura: «Descargar PDF» hace `window.open` de la ruta
  (`public/dashboard/js/invoiceDetailView.js:360`). Se le abre una pestaña con el JSON en crudo. Con
  el 409 de hoy también vería JSON en crudo: la frase firmada viaja en un campo `message` que esa
  pestaña no pinta como pantalla. Leído, no visto en navegador.
- **El cliente final**, en la página del recibo: el enlace «Descargar … en PDF» se pinta siempre que
  el cobro está pagado y hay factura (`receipt.routes.ts:184-189`), sin mirar si está sellada. Lo que
  lee es «Este enlace no corresponde a ningún documento activo», que es falso: el documento existe.
- **Ningún cron** pide estas rutas.

## Lo que la frase firmada promete y no he encontrado construido

«Se reintenta solo» y «Vuelve a intentarlo en un minuto». En `src/`, `scripts/` y `public/` sólo
siete ficheros de `src/` nombran el estado, y ninguno lo usa para buscar facturas pendientes: no hay
tarea programada que las vuelva a sellar. El único camino que vuelve a intentarlo es
`ensureInvoiceForCharge` (`invoicing.ts:240`), cuando llega otra vez el mismo cobro. Es lectura por
texto, no ejecución: puede haber un reintento que no nombre la columna.

Si es así, una factura cuyo sellado falló se queda pendiente hasta que alguien la mire, y quien vuelva
«en un minuto» encuentra lo mismo.

## Las opciones, sin elegir

| opción | qué le dice a quien lo abre | qué habría que tocar |
|---|---|---|
| 409 con las frases ya firmadas | «no está registrada todavía», al profesional y al cliente | el `catch` de las dos rutas o el código que lanza `invoicing.ts:62`; la frase sólo es verdad si existe el reintento |
| 202 | «está en marcha, vuelve»: la misma promesa de reintento | lo mismo, más una frase nueva (regla 39) |
| 404 | «no existe»: es lo que ya lee hoy el cliente, y es falso | sólo el código |
| el PDF sin el QR, con una marca | entrega algo que parece una factura sin estar registrada | la generación del PDF; es lo que SCRUM-206 cerró a propósito |
| dejarlo | un fallo previsto cuenta como avería del servidor | nada |

Todas menos la última modifican el camino de emisión o la ruta que lo sirve: regla 40, GO del fundador.
`receipt.routes.ts` es del carril de J2.

## La pregunta para el fundador y el asesor

1. Una factura con número que todavía no se ha registrado, ¿se le puede entregar al cliente en algún
   formato, o no sale nada hasta que lo esté? (SCRUM-206 decidió que no sale nada; se pregunta si
   sigue siendo así.)
2. Si no sale nada: ¿valen las dos frases del 30-jul tal cual, sabiendo que hoy nada reintenta el
   sellado por su cuenta? ¿O se construye antes el reintento, o se cambian las frases?
3. El enlace al PDF en el recibo del cliente, ¿se sigue pintando mientras la factura no está
   registrada?

## Mi error

La primera versión de este registro (punta `edf4e4d3`) copiaba las dos frases enteras al lado de la
atribución de su firma. El obligatorio cayó en `SCRUM-921c · el trinquete tampoco baja en silencio`
(«quedan 27 y el trinquete dice 28»): ese guard busca el literal de cada marca de aprobación en
`docs/`, y mi registro pasó a contar como respaldo documental de una firma que sólo repetía del
código. Separado por ejecución: el guard pasa en la base del CI (`938c73a6`) y en `origin/main`
(`6536e63e`), y cae en mi punta. Se arregla aquí, quitando la copia; el trinquete no se toca.

De paso, y es un dato: esa marca es una de las 28 que el trinquete tiene por «sin respaldo». Dónde
consta la firma del 30-jul no está escrito en ningún sitio que el guard encuentre.

## Lo que NO lleva

- Ningún arreglo y ningún test en la tanda: el script es evidencia, no un guard.
- El PDF de una factura ya sellada (el control «sigue saliendo igual»): ejecutarlo escribe en disco.
- El correo y el ZIP, ejecutados.
- Nada visto en yaqu.app ni en un navegador.
- Si en producción hay hoy alguna factura en `pendiente_de_sellado`: no se consulta producción.

## SCRUM-1404 · la fecha de la población B: medida, y la premisa de la pregunta no existe

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:28:00Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1404/poblacion-b.mjs`

Sesión J2 (`jv-j2`) · rama `scrum-1404-banco-de-la-poblacion-b` · **cruce de carril declarado por el
orquestador de Javier (`cobroflash-backend-90`): el ticket es `area-j1`, quien escribe es J2, y el
cruce fue SÓLO DE LECTURA.** Este tramo añade un banco y su salida en `docs/`; cero líneas de `src/`
y cero de `tests/`. Entrega en Jira: comentario 18836. Decisión que lo pide: comentario 18833
(población B: el reintento sólo toca las facturas nacidas después de una fecha fija).

### La pregunta y lo que salió

Se pidió «desde cuándo `vf_estado` se escribe DE VERDAD en el camino de alta». **Medido: nunca.**

- En `src/` hay dos escrituras de `vfEstado`, las dos en `selladoEstado.ts` (líneas 134 y 145),
  dentro de `sellarTrasEmision`: `no_aplica` y `sellado`. Ocurren DESPUÉS del commit del alta.
  Ninguna escribe `pendiente_de_sellado`. Control: un nombre de campo inventado da 0.
- `estadoAlNacer`, la función que debía fijarlo al nacer, no la llama nadie en `src/`: la nombran
  un test y dos listas de exportaciones sin consumidor (`tests/_huerfanos-declarados.mjs`,
  `scripts/_sin-consumir-declarados.json`).
- El alta pasa por `crearFacturaEmitida` (9 llamadas en 6 ficheros). Ninguna lleva el campo.

**Toda factura nace `pendiente_de_sellado` por el valor por defecto de la columna, igual que lo
heredó el histórico.** El campo no distingue «falló el sellado» de «el relleno no la tocó». Lo único
que las separa es la fecha de nacimiento.

### La fecha: lo que el código da y lo que no puede dar

| qué | valor | de dónde sale |
|---|---|---|
| el sellado al emitir entra en `main` | `2026-07-30T13:15:25Z` | merge `5c272ca1f` (PR #321), que trae `f0a005d61`, `17a21e372` y `09543a3ed`; ninguno de los tres estaba en el padre 1 de ese merge |
| desde cuándo PRODUCCIÓN corre ese código | NO MEDIDO | es un dato del despliegue, no del repositorio |

**La primera es un suelo, no la fecha.** Entre el merge y el primer despliegue bueno, producción
siguió con el código anterior, que sellaba al abrir el PDF y no tocaba el estado; y
`docs/MIGRATIONS_PENDING.md` da el `ALTER` de producción «por INFERENCIA» y su relleno «SIN MEDIR»
(medición del 6-ago-2026, no de hoy). Una factura nacida en ese hueco tiene fecha posterior al merge
y puede estar ya sellada con el estado en el valor por defecto.

Las dos salidas, sin elegir: **(a)** la fecha del despliegue del propio reintento, que no necesita
medir el pasado; **(b)** el 30-jul, sólo con la hora del primer despliegue bueno leída en Railway.
En las dos, añadir «y sin huella» a la selección: es «la huella manda» del propio SCRUM-205.

### El banco

`docs/master/evidencias/SCRUM-1404/poblacion-b.mjs`, salida en `salida-poblacion-b.txt`. Un Postgres
desechable en memoria (PGlite 0.5.8, PostgreSQL 18.3). Reproduce el mecanismo, no su resultado: la
tabla SIN la columna con 5 facturas históricas; el `ALTER` literal leído de
`docs/MIGRATIONS_PENDING.md` y cotejado con el `@default` del esquema; 5 facturas nuevas insertadas
sin nombrar la columna; y los dos `UPDATE` de `sellarTrasEmision`. Las fechas se derivan de D.

    node docs/master/evidencias/SCRUM-1404/poblacion-b.mjs . <carpeta de @electric-sql/pglite> [D]

| selección | filas | qué trae |
|---|---|---|
| sólo por estado | 8 | las 5 históricas, dos de ellas YA SELLADAS con su huella, más 3 nuevas |
| población B con D = `2026-07-30T13:15:25Z` | 3 | sólo las 3 nuevas pendientes |
| borde: nacida 1 ms antes de D | fuera | |
| borde: nacida exactamente en D | dentro | |
| nueva ya sellada, y justificante nuevo | fuera | |
| control a cero: D diez años en el futuro | 0 | |
| control malo: una D «por lo bajo», un año antes | 8 | idéntica a la selección sin fecha |

10 fabricadas, 10 contadas; 9 comprobaciones, 0 caen. El banco sale CIEGO, sin dar ningún número, si
el documento mide menos de 1.000 caracteres, si no encuentra exactamente UN `ALTER` distinto, si el
`ALTER` y el `@default` no dicen lo mismo, o si lo fabricado no coincide con lo contado.

### Los cuatro límites, que valen tanto como las 9 comprobaciones

- **El banco valida que la selección corta donde dice para CUALQUIER D; no valida que D sea la
  frontera real de producción.** Nace de filas fabricadas, no de la base.
- **No se ejecutaron los caminos de alta reales.** Que no escriben el campo sale de leer `src/` por
  texto, con su control a cero. No es un AST.
- **El emparejamiento alta → `sellarTrasEmision` se vio por FICHERO, no llamada por llamada:** los 6
  ficheros que crean lo nombran, y los 4 llamadores de `emitInvoice` también.
- **No se fabricó el caso «el relleno sí corrió»**, ni se ejecutó `prisma/backfill/scrum205-vf-estado.sql`.

Tampoco se miró staging, producción, Railway ni yaqu.app. PGlite no está en `node_modules` del
repositorio: se usó la copia de una carpeta de trabajo de la máquina, y por eso va como argumento.

### Para quien construya

- Con (b), el reintento sellaría hoy facturas fiscales pendientes desde el 30-jul. Qué fecha lleva
  ese registro y dónde cae en la cadena NO se ha mirado: es camino de emisión, de J1.
- Un justificante (`J-…`) también nace pendiente y pasa a `no_aplica` sólo cuando corre
  `sellarTrasEmision`; si el proceso muere antes, entra en la selección B (leído, no ejecutado).

### Mi error

Al buscar el merge que metió los tres commits en `main`, la primera orden devolvió la PUNTA de `main`
para los tres, y el control negativo que le puse era un sha que sí estaba en `main`. Lo delató que
los tres «entraran» con un merge de ayer. Rehecho cruzando la línea principal con el camino de
ascendencia, y comprobando que el commit no estaba en el padre 1 del merge hallado.

---

# SCRUM-1404b · PR-1: el reintento del sellado, construido e INERTE — A MEDIAS, parado por contexto

**Medido contra:** `origin/main` = `edfbd86e7c193ce5b35f20269c478acc6e9b2777` · 2026-10-07T23:48:36Z (hora de GitHub)

A9: aviso → cicatriz J6 «Un PR inerte nace sin consumidor: los censos de piezas sin consumir caen por diseño, y se miran ANTES de escribir el fichero, no al final.» — no se pudo comprobar: son los propios censos (scrum1185, scrum411) los que lo dicen, pero sólo después de escrito

🔴 CRUCE DE CARRIL DECLARADO (A20): el ticket es `area-j1` y escribe J6 (sesión `jv-j6`), por encargo del
orquestador de Javier (`cobroflash-backend-90`). El hook de arranque dijo «SIN IDENTIDAD… no construyas»
(SCRUM-1498, de S5); se siguió por la norma común del 8-oct. La cerradura de carril no reconoce el nombre
`jv-j6` y no para nada: el carril se aplicó a mano.

## Qué es esto, para que no se lea como un PR vacío

Un PR que **no cambia ninguna respuesta** y que es la primera mitad de la decisión del fundador. El diseño
en dos PR lo aprobó el orquestador por mensaje; dice haberlo dejado en SCRUM-1404, comentario 18849, que **NO he abierto yo**:

- **PR-1 (éste):** el mecanismo entero del reintento, sin fecha de corte (`REINTENTO_ACTIVO_DESDE = null`)
  y sin que nadie lo llame. Con `null` no hace ni una consulta.
- **PR-2 (activación), los tres A LA VEZ:** ① la fecha, escrita después de que PR-1 esté desplegado;
  ② la línea de `src/core/cron/cron.ts`, que es de **S1** y la pide el orquestador por Jira; ③ el arreglo
  del `catch` de las dos rutas del PDF. Así la fecha es posterior a la existencia del mecanismo en
  producción por construcción, sin ALTER y sin leer Railway, y la respuesta no va antes que el reintento.

Autorizaciones leídas de primera mano: SCRUM-1404 comentarios 18783 (C con reintento y el orden), 18833
(población B) y 18840 (fecha, tope, cadencia, etiqueta); SCRUM-1502 comentario 18835 (la frase del
profesional; la del cliente consta en `docs/YAQU_MASTER.md:1374`, comprobado: 1 aparición, control 0).
El comentario 18851 (vocabulario `emision` | `reintento` y el parámetro en `sellarTrasEmision`) me lo
anunció el orquestador: **NO lo he abierto yo**, y nada de lo que hay aquí lo usa.

## Lo que lleva

- `src/modules/invoicing/domain/reintentoSellado.ts` — la selección (estado **y** nacida desde la fecha
  **y** sin huella), el tope, la espera, la pasada y su parte.
- `tests/scrum1404b-el-reintento-del-sellado.test.mjs` — 12 casos.
- `docs/master/evidencias/SCRUM-1404/mutar-reintento.mjs` y su salida — 9 mutaciones, 9 vivas, base limpia.

## Lo medido

| qué | resultado |
|---|---|
| el rojo de partida (`medir-1404.mjs`, 6 llamadas) antes de escribir nada | 500 en las dos rutas; controles 409 y 500 |
| el mismo guion DESPUÉS de este PR | salida idéntica byte a byte (1.686 B, mismo sha256): no cambia ninguna respuesta |
| el test nuevo | 12 de 12 |
| mutaciones sobre la copia compilada | 9 de 9 vivas; restaurado idéntico |
| el banco de J2 (`poblacion-b.mjs`) re-ejecutado en este árbol con un PGlite prestado de otro trabajo | 9 veredictos, 0 caen, salida idéntica a la guardada |
| compilación con tipos (`tsc`, sin `--noCheck`) | sale 0 |

Tope y espera: **5 fallos** y espera ×2 desde 60 s. No son números míos: son los de la cola de remisión
(`src/modules/fiscal/verifactu/sif.cola.ts:30-36`), y un test fija que hoy coinciden. Con tope 5 las esperas
son cuatro: 1, 2, 4 y 8 minutos.

## 🔴 Lo que está ROJO y por qué NO se ha empujado como entrega

Corridos 47 ficheros de la casa más el mío (459 casos): **6 caen**. Tres son de este PR:

1. `SCRUM-1185 · ① ninguna pieza NUEVA construida y sin consumir` — el módulo no tiene consumidor, a
   propósito. Su salida es declararlo en `scripts/_sin-consumir-declarados.json`. **No hecho.**
2. `SCRUM-411 · los módulos de dominio inalcanzables NO crecen` — «6 módulos y el tope es 5». Subir ese
   tope es mover un número de un control: **decisión del orquestador, no mía.**
3. `SCRUM-205 · ① un sellado_fallido registrado va atado a un estado que bloquea` — señala
   `reintentoSellado.ts:236`, que LEE esa acción en un `where`, no la registra. **Sin investigar.**

Los otros tres son de `SCRUM-475` («la herramienta de la casa no responde»): **no he comprobado** si caen
igual sin mi cambio.

## Lo que NO lleva y lo que NO se midió

- El arreglo del `catch`, la línea de cron y la fecha: son PR-2.
- `puntoDeFallo`: un fallo del reintento saldría anotado como `emision`. Con PR-1 inerte no se escribe ninguno.
- **El hueco del cinturón:** una factura con la huella escrita y el estado sin marcar queda fuera de la
  selección para siempre. La pasada la cuenta y la nombra en cada parte, también a cero; no la toca.
- «Marcada para que alguien la mire» es DERIVADO (pendiente, sin huella, 5 fallos) y sale en la línea de
  log. Un aviso a una persona es canal y texto nuevos: no construido.
- El doble de la base del test evalúa el `where` en JavaScript: **no es Postgres**. La consulta de Prisma
  no se ha ejecutado contra ningún motor.
- Los controles del arreglo de la respuesta (PDF de una sellada idéntico por bytes; un fallo de verdad
  del generador sigue en 500): son de PR-2, **no hechos**.
- Tanda completa y `guards:entrada`: no corridos. Nada en yaqu.app.

## Mis errores

- Le dije al orquestador «espera 1-2-4-8-16 min» con tope 5: con ese tope son cuatro esperas, no cinco.
- Mi primer caso de la pasada daba por «en espera» una factura a la que ya le tocaba (leí mal mi propia
  progresión); lo cazó el test al correrlo.
- Medí el contexto tarde: 328.859 cuando la orden era parar a 300.000.
