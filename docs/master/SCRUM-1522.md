# SCRUM-1522 · Dos «hoy» para las plantillas de WhatsApp: el del tope y el del panel

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:06:16Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1522/dos-hoy.cjs`

J2 (sesión `jv-j2`, equipo de Javier). **Medición y propuesta. No se ha cambiado ninguno de los dos
cálculos, ni nada de `src/` ni de `public/`.** Sin escribir en producción ni en staging y sin mandar
ningún WhatsApp.

## 0 · Lo primero: cuántos merchants tienen `timezone` declarada

**No lo he medido en producción** (no me toca: pedido al orquestador). Lo que sí se puede leer:

- `docs/master/SCRUM-643.md:807` y `:1083` registran que el relleno a `Europe/Madrid` se aplicó en
  producción a **13 de 13**. Es un dato de primeros de septiembre, copiado del registro.
- En `src/` **ningún camino escribe `timezone`**: de sus apariciones fuera de comentarios y de tipos,
  9, las 9 son lecturas (`select` o desestructurar el perfil). No hay pantalla ni ruta que la declare.
- El fundador midió 14 merchants el 8-oct.

Lo que se sigue de ahí, **sin medir**: 13 con `Europe/Madrid` y 1 sin declarar (el que nació después).
Si es así, **la divergencia no es teórica: vale para 13 de 14**, todos de prueba. La consulta que lo
zanja: `SELECT timezone, count(*) FROM merchants GROUP BY 1;`

Y la frase «sin zona los dos lados caen a UTC» lleva una tercera pieza dentro: el tope cae a UTC
porque lo dice `zonaDelMerchant`; las métricas, porque **el proceso** corre en UTC. Con el proceso en
otra zona, un comercio sin declarar también diverge (medido abajo). Que Railway corre en UTC lo dice
`src/core/zonaDelMerchant.ts:9`; yo no lo he medido.

## 1 · Dónde está cada cálculo

| | fichero y línea | qué «hoy» usa | qué filas cuenta |
|---|---|---|---|
| **el tope** | `src/modules/messaging/domain/whatsappLog.service.ts:105-112` (`reservarPlantilla`) | el día del comercio: `inicioDelDiaEn(diaNaturalEn(new Date(), zona), zona)`, con `zona = zonaDelMerchant(comercio)` | plantillas con identificador del proveedor **o** en `queued` |
| **las métricas** | el mismo fichero, `:419-420` (`dayStart.setHours(0, 0, 0, 0)`) y `:434` (`templateToday`) | el reloj del proceso | **todas** las plantillas del día, también las `failed` |
| el mes del panel | el mismo fichero, `:417` (`new Date(now.getFullYear(), now.getMonth(), 1)`) | el reloj del proceso | todas las del mes |

Quién lo enseña: `GET /admin/metrics/whatsapp` (`src/modules/metrics/app/routes/metrics.routes.ts:76`)
y `public/dashboard/js/reportsView.js:812`, que pinta «Hoy: N plantillas · M por ventana» dentro de la
tarjeta «WhatsApp · este mes». `settingsView.js:1224` pide la misma ruta; no usa `templateToday`.

El bloqueo no enseña ningún número: los textos de `daily_cap` (`src/lib/sendOutcome.ts:39`,
`src/modules/invoicing/domain/envioQueNoSale.ts:27`) dicen que se alcanzó el tope diario, sin cifra.
El profesional compara ese aviso con el «Hoy: N» del panel.

**Carril** (`docs/equipo/dos-equipos.md`): `whatsappLog.service.ts` es de **J2** (`:124`), o sea los
dos cálculos. La ruta de métricas es de **S1** (`:136`) y `reportsView.js` de **S2** (`:152`): la
pantalla es del otro equipo.

## 2 · Cuánto difieren

Instrumento: `docs/master/evidencias/SCRUM-1522/dos-hoy.cjs`. Pasa las **mismas filas** por las dos
funciones reales de `dist/` con una base en memoria, y barre los 525.600 minutos de 2026. Tres
pasadas: proceso en UTC, en `Europe/Madrid` y con el reloj de esta máquina.

**Con el proceso en UTC**, comercio en `Europe/Madrid`:

- Los dos «hoy» **no empiezan a la vez ningún minuto del año** (0 de 525.600). El del tope empieza a
  las 00:00 del comercio; el del panel, 2 h más tarde en verano y 1 h más tarde en invierno.
- **De 00:00 a 02:00 del comercio (verano; 210 días) y de 00:00 a 01:00 (invierno; 155 días) hablan de
  días distintos**: el tope ya está en el día nuevo y el panel sigue enseñando el de ayer. 575 horas
  al año.
- **El resto del día** hablan del mismo día, pero el panel no ve lo enviado en esa primera franja.
  Coinciden sólo si de madrugada no salió nada.

| caso (proceso en UTC) | panel «Hoy» | cuenta el tope | el envío |
|---|---|---|---|
| 1 · 13 de madrugada + 87 de día, a las 18:00 de Madrid | **87** | **100** | BLOQUEADO |
| 2 · 100 ayer, a las 00:30 de Madrid | **100** | **0** | sale |
| 3 · control: 87 de día, nada de madrugada | 87 | 87 | sale |
| 4 · las filas del caso 1, zona sin declarar | 87 | 87 | sale |
| 5 · invierno, 13 a las 00:30 + 87 de día | **87** | **100** | BLOQUEADO |
| 6 · Canarias en verano, 13 a las 00:30 + 87 de día | **87** | **100** | BLOQUEADO |
| 7 · 90 enviadas + 15 rechazadas, de día, zona sin declarar | **105** | **90** | sale |
| 8 · control: 5 de hoy + 40 de anteayer | 5 | 5 | sale |

El caso 1 es el ejemplo del ticket, tal cual. Canarias (`Atlantic/Canary`): días distintos 1 h al día
en verano (210 días) y ninguna en invierno, cuando va con UTC.

**Con el proceso en `Europe/Madrid`** se invierte: el comercio peninsular coincide siempre y el que no
ha declarado zona diverge 575 horas al año. O sea, lo que hace divergir no es «tener zona», es que la
zona del comercio y la del proceso sean distintas.

### La segunda diferencia, que no es de reloj

Caso 7: el panel cuenta las plantillas que el proveedor **rechazó** y el tope no (devuelven el hueco:
P1 de SCRUM-1513). Con la zona sin declarar y todo de día, panel 105 y tope 90. **Igualar el reloj no
iguala los dos números**: el panel puede enseñar más de 100 sin que haya bloqueo. Las reservas que se
quedan en `queued` las cuentan los dos.

## 3 · Las dos salidas

### A · Las métricas pasan al día del comercio

- Qué se toca: `whatsappLog.service.ts` (J2). Ninguna pantalla, ningún texto.
- **Hacia atrás no se mueve nada guardado.** `templateToday` y `windowToday` se calculan en cada
  petición y no se guardan en ningún sitio (los nombran el servicio, un test y una pantalla). El panel
  no compara meses: sólo enseña el mes en curso.
- Lo que sí cambia es el **mes**, si se mueve también `:417`: las plantillas de la primera hora o dos
  del día 1 pasan del mes anterior al nuevo, y con ellas el «Coste estimado». Si se mueve sólo el día,
  queda un «hoy» del comercio dentro de un «mes» del proceso, en la misma tarjeta.
- `scripts/_censo-fecha-sin-zona.mjs:378` tiene `getWhatsAppMetrics` clasificado como `AGREGADO`:
  alguien decidió que ese reloj del proceso era aceptable. Cambiarlo es revisar esa decisión, y el
  trinquete de SCRUM-1093h baja; la bajada hay que declararla.
- No arregla el caso 7. Para que «Hoy» y el tope digan lo mismo hay que decidir además si «Hoy» cuenta
  las rechazadas.

### B · Las métricas se quedan como están y la pantalla dice de qué día habla

- Es texto que ve el usuario (regla 39) en `reportsView.js`, que es de S2, del equipo de Luis.
- «Hoy: N plantillas» no tiene ficha en `docs/microcopy/`: entró el 5-jul-2026 (`972b795ba`).
- Habría que explicarle al profesional un día que no es el suyo. No he escrito ningún literal.

### Lo que propongo

**A, con el mes incluido, y decidir aparte el caso 7.** No hay histórico que proteger y no pide texto
nuevo. B deja el defecto en pie y lo rotula.

## Verificación en yaqu.app del PR #2325 (el cerrojo)

- `GET https://yaqu.app/version` → 200, `0472952cd2c54e1c336170fa502ca902e6fda8cf`, que es
  `origin/main` (cabecera `Date: Tue, 13 Oct 2026 00:05:28 GMT`).
- #2325: `MERGED` el 2026-10-08T10:33:45Z, merge `be48345279da158bc81aebbea543eb926ae9eb88`; su punta
  `9cb348e32b58c55f1b2256c08913cb5f142ab9ea` es ancestro de `origin/main`. **El cerrojo está en lo
  desplegado.**
- En pie, sólo lectura y sin sesión: `/`, `/login.html`, `/dashboard/`, `/precios.html` y
  `/dashboard/js/reportsView.js` dan 200; `/admin/metrics/whatsapp` y `/admin/merchant` dan 401
  `not_authenticated`; una ruta inventada da 404 (control).

## Lo que NO he medido

- La columna `timezone` en producción, ni la zona en que corre el proceso de Railway.
- Nada con sesión iniciada en yaqu.app: ni el panel de Informes pintado, ni un envío. El tope no se
  ha vuelto a probar (orden).
- El obligatorio de `main` sobre `0472952cd`: en la primera página de sus comprobaciones sólo salen
  `vigia`, `vigilar`, `avisar` y `claude`; el de «build + tests» no lo he leído.
- Cuántas plantillas salen de verdad entre las 00:00 y las 02:00. Hay un cron cada hora
  (`src/core/cron/cron.ts:58`, recordatorio de presupuestos); no he mirado qué manda a esas horas.
- La tanda completa. No se ha tocado código; sólo `guards:entrada` y los guards del registro.
- Las dos pasadas del barrido son de 2026. Cada caso es una pasada.

## Errores propios

- La primera pasada «en Madrid» no lo era: en Git Bash un `TZ=Europe/Madrid` delante de `node` no le
  llega, y corrió con el reloj de esta máquina (UTC+1 ese día). Lo delató la primera línea de la
  salida, que imprime el desfase del proceso: decía 60 minutos donde tocaban 120. La zona va ahora por
  argumento (`--tz=`) y la salida vieja está borrada.
- Avisé de los 200k a 194.501, con la medición ya hecha y antes de escribir este registro.


# SCRUM-1522b · El panel cuenta las plantillas de hoy con el mismo filtro que el tope

**Medido contra:** `origin/main` = `6834c4b8ded04eaedb5cea07f2c5cb94bafbe6d9` · 2026-10-13T00:31:19Z (hora de GitHub)

A9: comprobación → `tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`

J2 (sesión `jv-j2`, relevo, equipo de Javier). **Construido con las tres decisiones del fundador,
Jira SCRUM-1522 c.19157:** ① las métricas pasan al día del comercio, igual que el tope · ② el mes
también · ③ «Hoy» no cuenta las plantillas rechazadas: cuenta lo mismo que el tope. La medición de
partida es el tramo de arriba (c.19150).

## Qué se ha cambiado

Sólo `src/modules/messaging/domain/whatsappLog.service.ts` (carril J2). Ninguna pantalla, ninguna
ruta, ningún texto.

- Una función nueva, `plantillasDeHoy(merchantId, zona, ahora)`, que devuelve el filtro: plantillas
  desde el inicio del día del comercio, con identificador del proveedor o en `queued`. No se exporta.
- `reservarPlantilla` (el tope) pide ese filtro en vez de escribirlo. Cuenta lo mismo que antes.
- `getWhatsAppMetrics` lee la zona del comercio (`zonaDelMerchant`) y:
  - `templateToday` es un `count` con ese mismo filtro (antes: todas las filas desde la medianoche
    del proceso, rechazadas incluidas);
  - `windowToday` cuenta desde el inicio del día del comercio;
  - el mes (`monthStart`) empieza el día 1 del mes del comercio: con él se mueven `month.*`, el
    coste estimado, `byTemplate`, `windowMonth` y el ahorro.
- La ventana de 7 días de la alerta no se toca: son 7 × 24 h hacia atrás, sin calendario.

Un comercio sin zona declarada sigue en UTC en los dos lados, como antes.

## El control, visto en rojo antes de construir

`tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`: las mismas filas por las dos funciones reales
de `dist/`, con una base en memoria que evalúa el filtro que cada una pide. La zona del proceso se
cambia dentro del test (`process.env.TZ`) y se comprueba que ha entrado, con el desfase de un
instante de verano, antes de medir. Se corre en tres zonas de proceso: UTC, `Europe/Madrid` y
`America/New_York`.

| caso (comercio en Madrid, proceso en UTC) | antes: panel · tope | después: panel · tope |
|---|---|---|
| 13 de madrugada + 87 de día, a las 18:00 de Madrid | 87 · 100 (BLOQUEADO) | 100 · 100 (BLOQUEADO) |
| 90 enviadas + 15 rechazadas | 105 · 90 | 90 · 90 |

- **Antes** (`docs/master/evidencias/SCRUM-1522b/rojo-antes.txt`): 13 casos, pasan 2, caen 11. Los
  dos que pasaban: el suelo, y el caso del fundador con el proceso en `Europe/Madrid`, donde el reloj
  del proceso coincide con el del comercio.
- **Después** (`verde-despues.txt`): 13 de 13. Con los vecinos, 14 ficheros: 187 casos, pasan 181,
  caen 0, saltan 6 (los seis piden una base: `A55_DB_TEST`, `SERIE_PG_URL`, `LIBRO_PG_URL`).
- **Barrido** (dentro del test): 3.456 instantes (3 zonas de proceso · 4 ventanas de 48 h —los dos
  cambios de hora, un fin de mes y el fin de año— · 3 zonas de comercio · 96 instantes), sobre una
  bolsa de filas de todos los estados. Antes: 3.456 de 3.456 con el panel y el tope contando distinto.
  Después: 0. Lleva dos suelos: más de la mitad de los instantes tienen algo que contar, y hay
  instantes en que dos zonas dan cuentas distintas (si no, la igualdad se cumpliría sin mirar la zona).

## Qué pieza hace el trabajo

`docs/master/evidencias/SCRUM-1522b/quitar-una-pieza.cjs` quita una pieza cada vez, recompila y
corre este test y el del censo (34 casos). Salida en `salida-quitar-una-pieza.txt`:

| se quita | caen | cuáles |
|---|---|---|
| nada (base) | 0 de 34 | |
| la zona del comercio en las métricas | 8 | el caso del fundador en las tres zonas de proceso, el mes, la ventana y el barrido |
| el `count` con el filtro del tope en «Hoy» | 5 | las rechazadas en las tres zonas, las de en cola y el barrido |
| el mes en la zona del comercio | 5 | el mes en las tres zonas y **dos casos de `scrum1093h`** (ver abajo) |
| la exclusión de las rechazadas en el filtro común | 4 | las rechazadas y las de en cola: el test fija el 90, no sólo que coincidan |

## 🔴 El trinquete de SCRUM-1093h BAJA, y se declara

`getWhatsAppMetrics` estaba en `scripts/_censo-fecha-sin-zona.mjs` clasificada `AGREGADO`: dada por
buena leyendo el reloj del proceso. Ya no lo lee (ni `getFullYear`, ni `getMonth`, ni `setHours`),
así que su fila desaparece del censo. **Con el permiso de Jira SCRUM-1522 c.19157**, la entrada sale
de `USO` y entra en `RETIRADAS`. Es apretar: una `AGREGADO` que desaparece no la vigila nadie; una
`RETIRADA` que vuelve a aparecer pone en rojo «ninguna entrada de `RETIRADAS` ha vuelto a aparecer
en el censo». Visto en rojo: es la tercera fila de la tabla de arriba.

## Tocado fuera del fichero del arreglo, y por qué

- `tests/scrum530-…` y `tests/scrum862-…`: sus dobles de la base sólo tenían `findMany`. Las métricas
  leen ahora también el comercio y hacen un `count`; sin eso el servicio se traga el error y devuelve
  ceros. Cada doble aprende las dos lecturas (comercio sin zona, cuenta 0). Ninguno de los dos mira
  «Hoy»; sus aserciones no cambian.
- `docs/master/evidencias/SCRUM-1522/dos-hoy.cjs`: mismo motivo, y peor. Tras el arreglo daba
  «panel 0» en los 8 casos con `EXIT=0` y «SUELO: los 8 casos tenían filas»: su doble no tenía el
  comercio fuera de la transacción y las métricas se tragaban el error. Arreglado el doble, y el
  suelo exige ahora que el panel haya visto las filas del mes. Salidas de después, con el proceso en
  UTC y en Madrid: `docs/master/evidencias/SCRUM-1522b/dos-hoy-despues-*.txt` (8 de 8 coinciden).

## Lo que queda distinto a propósito, y lo que no he medido

- **El mes sigue contando las rechazadas** (`month.total`, `month.failed`, el coste estimado). La
  decisión ③ es sobre «Hoy». Con 90 enviadas y 15 rechazadas la tarjeta dice «105 plantillas» del
  mes y «Hoy: 90». No lo he tocado ni lo propongo: lo digo.
- **No he medido nada en yaqu.app**: el PR no ha entrado. Ni el panel pintado con sesión.
- **No he corrido la tanda completa** en local (el arnés la mata por memoria). Sí `guards:entrada`
  y los vecinos de arriba. La pasada completa es el obligatorio del PR.
- La zona del proceso de Railway sigue sin medir. Ya no decide: el test da lo mismo en las tres.
- Los tests gateados por base (`a55-window-quote` y los de staging) no se han ejecutado.

## Errores propios

- **Mi arreglo dejó mudo el instrumento de mi antecesora y no lo vi venir bien.** Supuse que
  `dos-hoy.cjs` pasaría a comparar el panel consigo mismo (porque las métricas ahora también hacen
  `count`). Al correrlo era otra cosa: «panel 0» por un error tragado, con salida 0. La suposición la
  corrigió ejecutarlo. Lo que lo impide en el test nuevo: el doble apunta todo filtro que no conoce y
  el caso cae si apuntó alguno, y la cuenta del tope se toma después de vaciar la lista y tiene que
  ser exactamente una.
- La ficha del encargo daba `origin/main` = `0472952cd`; medido, `6834c4b8d` (habían entrado #2343,
  #2342 y #2341). La rama se adelantó a `main` antes de empezar.
