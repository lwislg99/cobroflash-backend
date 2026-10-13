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

# SCRUM-1404c · PR-1: los rojos del obligatorio, cerrados menos uno — SIGUE A MEDIAS (falta el segundo cinturón del tope)

**Medido contra:** `origin/main` = `fca2f2e934e30690e04ad7b9fe3ccfcae152a802` · 2026-10-08T00:07:24Z (hora de GitHub)

A9: comprobación → `tests/scrum1404b-el-reintento-del-sellado.test.mjs`

*(Escribe J6, relevo, equipo de Javier. Cruce de carril declarado: el ticket es `area-j1` y lo autorizó
el orquestador `cobroflash-backend-90`. La rama NO lleva `origin/main` mezclado: va 4 commits por detrás.)*

## Qué había y qué queda

El obligatorio de la punta anterior (`4cda5f87`, run 37704496194, job 113075521722) se leyó por nombre:
11.062 casos, 7 caen, 93 saltos. Mi antecesora anunció 3. **Eran 7: su tanda dirigida no incluía
`scrum289` ni `scrum1325`.** Los doce «SCRUM-1404 · » salían bien (control de un nombre que no existe: 0).

| rojo del obligatorio | qué era | qué se hizo |
|---|---|---|
| `SCRUM-1185 · ①` | tres piezas sin consumidor, a propósito | declaradas en `scripts/_sin-consumir-declarados.json` con motivo, quién las retira (el PR-2) y prueba; decisión en el comentario 18855 |
| `SCRUM-411 · no crecen` | 6 módulos y el número era 5 | el número sube a 6 con su entrada fechada, calcada del caso de `emisorCongelado`; decisión rectificada en el comentario 18856 |
| `SCRUM-205 · ①` | reconoce un registro por la forma `action: 'sellado_fallido'` y la línea era una LECTURA | la acción pasa a una constante del módulo, atada por AST a lo que escribe `selladoEstado.ts`; decisión en el comentario 18857 |
| `SCRUM-289` | un `where` traído de una función es opaco para el censo | el `where` va escrito en la consulta; `whereDelReintento` se retira y el test lo lee de la propia pasada |
| `SCRUM-1325` ×3 | una expresión regular con letras sin catalogar | la fecha de corte se valida sin expresión regular: tiene que ser lo que `toISOString` escribe |

Los tres de `SCRUM-475` que caían en local **no son de este PR ni de `main`**: en el obligatorio de este
PR pasan (47 «SCRUM-475 · » bien) y en el de `main` @ `a65a8c75` también. En el árbol anidado caen porque
`scripts/preview-migracion.mjs` busca el CLI de Prisma en el `node_modules` del propio árbol, y no lo hay.

## Lo medido antes de decidir

- **Declarar en la lista NO baja `scrum411`.** Con las tres claves puestas (`git diff --numstat`: 3 0),
  `scrum1185 ①` pasa y `scrum411` sigue en 6. Control hecho antes de tocar: los otros 5 inalcanzables
  están los 5 en esa lista y los 5 cuentan. Son dos mecanismos distintos: una lista y un número con bitácora.
- **El tope descansa en un registro que nadie espera.** `sellarTrasEmision` anota el fallo con
  `recordAudit`, que no se espera y traga su error. Sonda de 40 pasadas con el módulo compilado y un
  sellado que falla siempre: si el fallo queda anotado, 5 llamadas a sellar y «agotada» desde la pasada 17;
  **si no queda anotado, 40 llamadas en 40 pasadas, «agotada» nunca y `todo_en_orden` 40 de 40.**
  La cabecera del módulo lo llamaba «un intento de más»: son infinitos. NO medido: con qué frecuencia
  falla esa escritura (no hay fallos reales a mano y no se consulta producción).
- **La pasada llamaba a la puerta por un alias**, y el censo de llamadores de SCRUM-205 los busca por el
  nombre `sellarTrasEmision`. Ahora la llama por su nombre cuando no se inyecta un doble.

## Comprobado después del último cambio

`tsc` con tipos: sale 0. 18 ficheros, 172 casos, 0 caen (el test propio con 14, `scrum289`, `scrum1325`,
`scrum411`, `scrum1185`, los tres `scrum205`, `scrum237`, `scrum976`, `scrum622`, `scrum377`, `scrum864c`,
`scrum702`, `scrum812`, `scrum710b`). `mutar-reintento.mjs`: 9 de 9 vivas. `mutar-declaracion.mjs`
(nuevo): 4 de 4 vivas, y el fichero mutado quedó idéntico.

## 🔴 Lo que NO lleva, y por eso no es una entrega

1. **El segundo cinturón del tope (decidido en el comentario 18857, SIN CONSTRUIR).** Una factura que
   sigue pendiente pasado el tiempo en que ya debería estar agotada se cuenta, se nombra en el parte y
   pone `hay_que_mirar`; la cuenta sale siempre, también a cero; el plazo se DERIVA de `TOPE_DE_FALLOS` y
   `ESPERA_INICIAL_S` (la espera inicial más las de los fallos 1 a 4: 16 minutos con los números de hoy).
   Sin él no se puede activar el reintento.
2. La cabecera del módulo sigue diciendo «un intento de más». Se corrige con el cinturón.
3. Esperar la anotación dentro de `sellarTrasEmision` es el arreglo de raíz y es camino de emisión: no se toca.
4. El segundo PR entero (fecha, línea de `cron.ts` de S1, el `catch` de las dos rutas, `puntoDeFallo`).

## Lo que NO se midió

- No vi en rojo el caso nuevo de la acción (④) ni comprobé por efecto que el censo de SCRUM-205 cuenta
  ya a la pasada como llamadora: sólo que los tres ficheros `scrum205` pasan.
- `medir-1404.mjs` y el banco de J2 NO se han vuelto a correr tras estos cambios.
- La tanda completa no se corrió en local. El obligatorio de la punta nueva está sin leer al escribir esto.
- De los otros dos ficheros `scrum205` leí los nombres de sus casos, no el cuerpo.

## Mis errores

- Medí el contexto tarde: 255.865 cuando el aviso era a 200.000. Me lo comieron las lecturas del PASO 0.
- Al escribir el `where` en la consulta dejé `whereDelReintento` huérfano y `scrum1185` volvió a caer; lo
  cazó la tanda dirigida, no yo.
- Di por buena la lista de tres rojos de mi antecesora hasta leer el obligatorio: eran siete.

# SCRUM-1404d · PR-1: el segundo cinturón del tope, construido y visto en rojo

**Medido contra:** `origin/main` = `9dd6aa773799565c3753c51f289efae1a4ecbca0` · 2026-10-08T00:19:27Z (hora de GitHub)

A9: comprobación → `tests/scrum1404b-el-reintento-del-sellado.test.mjs`

*(Escribe J6, relevo, equipo de Javier. Cruce de carril declarado: el ticket es `area-j1` y lo autorizó
el orquestador `cobroflash-backend-90`. La rama sigue SIN `origin/main` mezclado. El módulo sigue inerte:
`REINTENTO_ACTIVO_DESDE` vale `null` y nadie lo importa.)*

## Qué se construyó (la c del comentario 18857)

- `plazoDeAgotamientoS()`: la espera inicial más la de cada fallo anterior al último. **Derivado** de
  `TOPE_DE_FALLOS`, `ESPERA_INICIAL_S` y `esperaTrasFalloS`; hoy da 960 s (16 min). El 16 sólo aparece en un
  comentario; el código no lleva ningún 16 ni ningún 960.
- `fueraDePlazo` en el parte: la candidata que **sigue pendiente tras la pasada**, **no consta agotada**
  y nació hace MÁS del plazo. Sale del reloj, no del registro de auditoría. Entran la que sigue pendiente,
  la que lanza y la que está en espera; no entran la que esta pasada sella, la que no lleva sello ni la
  agotada (ésa ya se nombra en su lista).
- `conclusionDelReintento` da `hay_que_mirar` si hay alguna.
- `resumenDelReintento` lleva la cuenta **siempre, también a cero**, con el plazo dentro de la etiqueta
  y los nombres cuando hay.
- La cabecera ya no dice «un intento de más»: dice infinito, con la sonda que lo midió.

## Lo medido

| qué | resultado |
|---|---|
| el test del reintento | 17 de 17 (eran 14: tres casos nuevos) |
| la sonda, ahora dentro del test: 40 pasadas, sellado que falla siempre, fallo SIN anotar | 40 llamadas, «agotada» nunca; fuera de plazo 0 en las pasadas 1-16 y 1 en las 24 siguientes, con `hay_que_mirar` en esas 24 |
| su control: el fallo SÍ se anota | 5 llamadas, agotada desde la pasada 17, fuera de plazo 0 en las 40 |
| el borde | justo en el plazo, 0; un milisegundo después, las tres que siguen pendientes |
| mutaciones sobre la copia compilada | 17 de 17 vivas (9 de antes, 7 del cinturón, 1 de la acción); restaurado idéntico |
| el caso de la acción (④), visto en rojo por su nombre | cae al cambiar la constante en la copia compilada; caen con él otros 6, porque el doble de la base exige la misma acción |
| `medir-1404.mjs` repetido | idéntico byte a byte a la salida guardada: 1.686 B, sha256 `c17e1f60…6494f` |
| el banco de J2 (`poblacion-b.mjs`) repetido con un PGlite prestado | 9 veredictos, 0 caen, salida idéntica a la guardada (3.468 B) |
| compilación con tipos | sale 0 |
| guards alrededor (1185, 1325 ×2, 205 ×3, 237, 289 ×2, 411, 976 y el propio) | 12 ficheros, 129 casos, 0 caen, 0 saltos |

## 🔴 Lo que el cinturón NO hace, dicho antes de que alguien lo suponga

1. **No para el reintento: lo señala.** Con la anotación perdida la factura se sigue reintentando en cada
   pasada, y cada parte lo dice. Pararla por reloj dejaría sin sellar una factura sana tras una parada
   larga de la tarea, y eso no lo ha decidido nadie. Si se quiere que además pare, es una decisión.
2. **Supone una pasada por minuto o más rápida.** Con una cadencia más lenta, una factura sana que va
   agotando su tope a su ritmo sale señalada antes de agotarse: avisa de más, nunca de menos. La
   cadencia la pone la línea de `cron.ts` (SCRUM-1507), que no es de este PR.
3. **`hay_que_mirar` es una palabra en un valor de retorno.** Hasta que PR-2 lo cablee, nadie la lee; y
   cuando lo cablee, quien la lea es el log de la tarea. Que eso llegue a una persona no está construido.
4. El arreglo de raíz (esperar la anotación dentro de `sellarTrasEmision`) sigue sin hacer: es STOP.

## Lo que NO se midió

- El caso ④ se vio caer moviendo la constante del módulo, **no** el literal de `selladoEstado.ts`: ese
  fichero es camino de emisión y no se toca ni para mutarlo.
- Que el censo de SCRUM-205 cuenta ya a la pasada como llamadora sigue sin comprobarse por efecto: sus
  tres ficheros pasan, y es todo lo que sé.
- La tanda completa no se corrió en local.
- Con qué frecuencia falla de verdad la escritura de auditoría: no hay fallos reales a mano.

## Mis errores

- Los tres casos nuevos salieron verdes a la primera, y un verde a la primera no dice nada: lo que los
  respalda son las 7 mutaciones del cinturón, corridas después, no el haberlos visto pasar.

# SCRUM-1404e · los dos huecos que PR-1 declaró sin medir: medidos por efecto, sin tocar `src/` ni ningún test

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T00:54:25Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1404/censo-scrum205-por-efecto.mjs`

*(Escribe J6, relevo, equipo de Javier. Cruce de carril declarado: el ticket es `area-j1` y lo autorizó
el orquestador `cobroflash-backend-90`. El hook de arranque volvió a decir «SIN IDENTIDAD… no construyas»
(SCRUM-1498, de S5); se siguió por la norma común del 8-oct. Este tramo añade dos guiones y sus dos
salidas en `docs/`: **cero líneas de `src/` y cero de `tests/`**. PR-2 sigue cerrado y no se abre aquí.)*

## Cómo se mutó `selladoEstado.ts` sin tocarlo

Mi antecesora no mutó el literal porque el fichero es camino de emisión. El encargo pide mutarlo ahí.
Las dos cosas caben: `censo-scrum205-por-efecto.mjs` monta un **espejo** (copia de `src/`, de `dist/`,
de los tres tests y de la lista de declaradas) dentro de `dist/`, que git ignora, y muta el espejo. Los
tests calculan su raíz desde su propia carpeta, así que los del espejo leen el `src/` del espejo. Antes
de juzgar nada coteja por sha256 que los 6 ficheros que importan son idénticos a los del árbol
(distintos: 0), y al acabar vuelve a medir los 6 del árbol (movidos: 0) y borra el espejo.

⚠️ Lo que eso es y lo que no: el literal mutado es el de una copia byte a byte, leída por el test
byte a byte idéntico. **El fichero del árbol no se ha mutado nunca.**

Cada mutación lleva escrito en el guion, antes de correr, qué caso tiene que caer —o que se espera
muda, cuando lo que se quiere enseñar es un límite—. Se declararon con el código quieto: este tramo no
cambia código.

## Hueco (2) · el caso ④, mutado donde toca: CAE, y cae sólo él

Base sin mutar: 17 casos, 0 caen.

| mutación sobre el `selladoEstado.ts` del espejo | esperaba | visto |
|---|---|---|
| D1 · el literal de la acción cambia (sólo la fuente) | cae el ④ de la acción, y sólo él | cae 1 de 17: ése |
| D2 · el mismo cambio en la fuente y en su compilado | lo mismo | cae 1 de 17: ése |
| D3 · control: cambia OTRO literal del mismo registro | no cae nada | no cae nada |
| D4 · el fichero pasa a escribir una segunda acción | cae el ④ | cae 1: ése |
| D5 · la acción deja de ser un literal | cae el ④ | cae 1: ése |

El test está atado a lo que cree. La diferencia con lo que vio mi antecesora (7 caídos al mover la
constante) es la esperada: el doble de la base exige la acción de la constante, no la del sellado.

## Hueco (1) · qué vigila `scrum205-fallo-de-sellado-no-entrega`, ejecutándolo

Base: 3 casos, 0 caen.

| | mutación en el espejo | esperaba | visto |
|---|---|---|---|
| ① | A1 · el fallo de sellado devuelve «sellado» | cae ①, señalando `selladoEstado.ts` | así |
| ① | A2 · el sellado renombra la acción | cae ① por escáner ciego | así |
| ① | A4 · el reintento vuelve a leer la acción con el literal | cae ①, señalando `reintentoSellado.ts` | así: es el falso positivo de PR-1, reproducido |
| ① | **A3 · límite:** devuelve «sellado» y el estado bloqueante sólo queda en un comentario | muda | **muda** |
| ② | B1 · el portón deja pasar todo | cae ② | así |
| ② | B2 · el portón bloquea también «no aplica» | cae ② | así |
| ② | **B3 · límite:** el predicado sigue bien y quien genera el PDF deja de preguntarle | muda | **muda** |
| ③ | C1 · el reintento sella, tira el resultado y entrega el PDF | cae ③, señalando `reintentoSellado.ts` | así |
| ③ | C2 · el reintento sella y tira el resultado, sin entregar | cae ③ por su tope de descartes | así |
| ③ | **C3 · límite:** lo mismo que C1 llamando a la puerta por un alias | muda | **muda** |
| ③ | **C4 · límite:** el reintento lee el resultado y, con «sigue pendiente», entrega igual | muda | **muda** |

Y `scrum205-un-solo-punto-de-sellado` (6 casos): si el reintento sella por su cuenta sin pasar por la
puerta (P1), cae y lo señala.

**17 mutaciones declaradas, 17 salen como se predijeron, 0 ciegas.** Salida entera:
`salida-censo-scrum205-por-efecto.txt`.

**¿Cuenta el censo de ③ a la pasada como llamadora? Sí, medido dos veces.** Mi lectura da **11
llamadas a la puerta en 8 ficheros**, una de ellas `reintentoSellado.ts:289` (control con un fichero
que no existe: 0). Como esa lectura es la regla del test vuelta a escribir y no el test, se cotejó con
él: sólo dice cuántas ve cuando ve menos de 8, así que se le quitaron al espejo 4 ajenas —dijo «veo
7»— y luego además la del reintento —dijo «veo 6»—. Cuadra. Sin la del reintento nada más, sigue
verde: el suelo de 8 no descansa en ella. De las 11, dos descartan el resultado y no son la pasada.

### Los cuatro límites, que son del instrumento y no se tocan (regla 41)

- **A3:** ① reconoce el corte por texto dentro del bloque (un `return` con el nombre del estado a
  menos de 200 caracteres, o la palabra `throw`). No lee qué se devuelve.
- **B3:** ② ejecuta el predicado; no mira que alguien lo llame. **Pero ejecutado no es un agujero:**
  quitado ese corte del compilado, `ensureInvoicePdf` sigue sin entregar, porque el segundo portón
  (`exigirDocumentoEmitible`) rechaza con otro código. Son dos cortes redundantes.
- **C3:** ③ busca a los llamadores por el nombre. Es el punto ciego del alias que ya se cerró en
  PR-1 por el lado del código; aquí queda visto por efecto.
- **C4:** ③ entiende por «descartar» que nadie recoja el valor. Recogerlo y no hacerle caso no lo ve.

Ninguno de los cuatro ocurre hoy en el camino del reintento: es lo que mide el guion de abajo.

## ¿Se cumplen hoy las tres en el camino del reintento? Ejecutado por la puerta real

`reintento-por-la-puerta-real.mjs` corre la pasada compilada **sin doblar la puerta**: llama al
`sellarTrasEmision` y al `applyVeriFactu` de `dist/`. Sólo se dobla la base, con estado. El fallo es
una factura fiscal sin líneas, que el propio sellado rechaza. 30 comprobaciones, 0 caen; salida en
`salida-reintento-por-la-puerta-real.txt`.

| | el registro del fallo se escribe | el registro NO se puede escribir |
|---|---|---|
| ① la factura sale como «sigue pendiente» | sí | sí |
| ① registros del fallo pedidos / guardados | 5 / 5, con la acción que la pasada cuenta | 24 / 0 (24 errores tragados) |
| ① escrituras sobre la factura, y cómo queda | 0 · pendiente, sin huella | 0 · pendiente, sin huella |
| ② pedirle el PDF a `ensureInvoicePdf` | se niega, con el código de «sin sellar» | se niega igual |
| ③ intentos de sellar en 24 pasadas | 5, y consta agotada desde la 17 | 24, y nunca consta agotada |
| ③ el segundo cinturón | no dice nada | la señala desde la pasada 17 |

Controles: sin fecha de corte, 0 llamadas a la base; un justificante pasa por la puerta real, queda
«no aplica» con 1 escritura y deja de ser candidato; el mismo instrumento del PDF contesta tres cosas
distintas a otras tres filas. **Visto en rojo** sobre una copia del compilado: con la puerta
devolviendo «sellado» al fallar caen 4; con el primer corte del PDF quitado caen 2.

La columna derecha es la sonda de PR-1 repetida por la puerta real en vez de con un doble: mismo
resultado. La excepción del «no infinito» sigue viva y declarada (comentario 18872); esto no la cierra.

## Lo que NO se midió

- **Un sellado que sale bien por el reintento.** Calcularía una huella contra un doble: no diría nada
  de la cadena. Tampoco un fallo de la base a mitad del sellado: el fallo provocado ocurre antes de
  leer la cadena.
- El doble evalúa los `where` en JavaScript: sigue sin ser Postgres.
- Del fichero `scrum205-sql-a-mano-contra-schema` nada: mide SQL contra el esquema, no el reintento.
  De `un-solo-punto` una mutación de seis casos.
- Si algún OTRO test de la tanda caza B3, A3 o C4: sólo se corrieron los tres ficheros nombrados.
- La tanda completa no se corrió. Nada en yaqu.app, staging ni producción.
- `prisma generate` escribió el cliente en el `node_modules` del checkout compartido, que es el que
  este árbol anidado hereda: no he medido si eso le cambia algo a otra sesión.

## Mis errores

- La primera pasada del censo no arrancó: copiaba `dist/` dentro de `dist/`. No llegó a mutar nada.
- Al añadir un control al segundo guion metí un salto de línea dentro de una cadena y dejé una salida
  rota en el árbol; el hook me paró al ir a pisarla. Borrada y regenerada.
- Los dos guiones salieron verdes a la primera. Del censo lo que vale es que 12 de sus 17 mutaciones
  son rojos predichos; del segundo, las dos mutaciones del compilado que lo tumban, corridas después.
