# SCRUM-924 — `/pay/mp` afirma «✅ ¡Pago aprobado!» leyendo el status de la QUERY STRING

*17-sep-2026 · rama `scrum-924-la-pantalla-que-se-cree-la-url`*

**Medido contra:** `origin/main` = `45a62542fff7b104813308a59e50426ef3fc38c7` · 2026-09-17T18:58:09+01:00

> **Encargo:** medir la población de caminos vivos y **PROPONER** remedios. No arreglar.
> Nada de `src/` se ha tocado: este PR es **un fichero de documentación y cero código**.

> ⚠️ **`main` avanzó 8 commits mientras duraba esta tanda, y eso NO invalida la medición.** «Main se
> ha movido mucho» y «main se ha movido DONDE YO TOCO» son cosas distintas, y sólo la segunda
> cuenta. Comprobado uno a uno: `payMp.routes.ts`, `mpWebhook.routes.ts`, `charges.routes.ts` y
> `schemas.ts` — **sin cambios** en esos 8 commits. Se deja dicho porque dentro de una semana la
> distancia parecerá un motivo para desconfiar del número, y el motivo no está en la distancia.

---

## PASO 0 · El defecto ocurre HOY, y CORRIENDO — no leído

Montando el router REAL sobre un express de verdad y pidiéndole una URL **fabricada a mano**:

    HTTP 200
    ¿dice «¡Pago aprobado!»?          true
    ¿dice «procesado correctamente»?  true
    ¿pinta la insignia APPROVED?      true
    CONTROL · con status=rejected dice «Pago rechazado»?  true
    CONTROL · y NO dice «¡Pago aprobado!»?                true

**Y es peor que lo que decía el ticket.** El token de la prueba es `UN-TOKEN-QUE-ME-INVENTO`, que
no existe en ninguna base, y la sonda corrió **sin base de datos en absoluto**. La ruta envuelve su
única lectura en un `try { … } catch {}` (`payMp.routes.ts:83-90`), así que cuando la consulta
falla **la página se pinta igual**, con el texto que diga la URL.

> No hace falta un cobro real, ni una clienta, ni una base en pie. Hace falta teclear una URL.

El **control positivo** es lo que hace válido el resultado: con `status=rejected` la misma sonda lee
«Pago rechazado» y **no** lee «¡Pago aprobado!». Sin eso, un `true` podría ser la sonda
inventándose la página en vez de leerla.

<details><summary>La sonda, entera, para que sea repetible (se ejecutó desde <code>dist/</code> y se retiró)</summary>

```js
import express from 'express';
import _mod from './modules/billing/app/routes/payMp.routes.js';
const payMpRouter = _mod.default ?? _mod;
if (typeof payMpRouter !== 'function') { console.log('CIEGO · el router no es montable'); process.exit(2); }

const app = express();
app.use('/pay', payMpRouter);
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

// SUELO: si la ruta no existe, la sonda es CIEGA y no puede dictar veredicto.
const sonda = await fetch(`${base}/pay/mp/UN-TOKEN-QUE-ME-INVENTO/result?status=approved`);
if (sonda.status === 404) { console.log('CIEGO · la ruta no responde'); server.close(); process.exit(2); }

const html = await sonda.text();
console.log(`HTTP ${sonda.status}`);
console.log(`¿dice «¡Pago aprobado!»? ${html.includes('¡Pago aprobado!')}`);

// CONTROL POSITIVO: con otro status tiene que decir OTRA cosa.
const otra = await fetch(`${base}/pay/mp/UN-TOKEN-QUE-ME-INVENTO/result?status=rejected`);
const html2 = await otra.text();
console.log(`CONTROL · «Pago rechazado»? ${html2.includes('Pago rechazado')}`);
console.log(`CONTROL · y NO «¡Pago aprobado!»? ${!html2.includes('¡Pago aprobado!')}`);
server.close();
```

</details>

El mecanismo, leído hoy: `payMp.routes.ts:80` `const status = String(req.query.status || 'pending')`
→ `:99` `statusMap[status]` → `:128` pinta el título. **Cero llamadas a Mercado Pago en la ruta.**

---

## ① LA POBLACIÓN · **cero caminos vivos**, y declarando dónde miré

🔴 **No se hereda la medición de S1: se ha vuelto a hacer.** Y un censo que sólo dice lo que
encontró no se puede auditar, así que aquí van **las nueve superficies miradas**, no sólo las que
dieron algo. Población del barrido: **3.097 ficheros** (repo sin `node_modules`, `.git` ni `dist`).

| # | superficie mirada | ¿lleva a `/pay/mp`? |
|---|---|---|
| 1 | `PAID_VIA` — conjunto cerrado de métodos (`paidVia.ts:23`) | **NO.** `['card','bizum_auto','bizum_manual','transfer','cash']` — `mp` no está |
| 2 | `method_preference` — el enum de la API (`schemas.ts:398`) | **SÍ lo acepta:** `['bank','card','mp']` |
| 3 | quién ESCRIBE `method_preference:'mp'` en el repo | **0.** El único literal que existe es `'card'` (`invoiceWhatsApp.service.ts:69`) |
| 4 | `public/` entero — 124 ficheros | **0.** `paymp` no aparece. `mercadopago` sale en 3, y los 3 son ETIQUETAS |
| 5 | consumidores de `paymp_url` | **0.** Sólo 4 apariciones: 2 en docs (que ya lo llaman *legacy*) y 2 el productor |
| 6 | `payBtns` del recibo (`receipt.routes.ts:117-127`) | **NO.** Sólo transferencia y tarjeta |
| 7 | selector de `payInvoice.routes.ts:119-122` | **NO.** Sólo `card` y `transfer` |
| 8 | portal de cliente (`customerPortal.routes.ts:372`) | **NO.** Sólo `card` |
| 9 | enlaces a `/pay/mp` fuera de su propia ruta | **0** — frente a **6** que enlazan `/pay/card` o `/pay/bank` |

### El control positivo del censo, y el que me falló

`paycard_url` y `paybank_url` dan **9 sitios cada uno**; `paymp_url`, **4**. El instrumento ve lo
que sabemos que está, así que su cero significa «no hay», no «no he mirado».

🔴 **Pero mi primer control positivo NO valía, y lo digo porque casi lo doy por bueno.** Busqué las
tres variables en `integrations/` y `messaging/` y salieron **las tres a cero** — incluidas las
vivas. Un control que da el mismo resultado sobre el caso bueno y el malo no discrimina nada. Lo
rehíce buscando los enlaces construidos (`/pay/xxx/${token}`), y entonces sí: **6 contra 0**.

### Lo único que SÍ alcanza la pantalla

`POST /charges` devuelve `paymp_url` **siempre**, pase lo que pase en `method_preference`
(`charges.routes.ts:81` y `:87` — no hay condicional). Y el único generador de la URL del
resultado son las `back_urls` que se le pasan a MP al crear la preferencia
(`integrations/mercadopago.ts:41-43`).

O sea: **desde el producto, cero. La pantalla se alcanza tecleando la URL, o pasando por el
checkout real de MP.** El router está montado y vivo (`app.ts:365`).

### 🔴 EL HUECO, con su nombre: quién llama a esta API DESDE FUERA

`POST /charges` es una API pública y **el repositorio no sabe quién la consume**. Si un integrador
externo pide cobros con `method_preference:'mp'` y reparte el `paymp_url` que recibe, hay usuarios
de esta pantalla y **desde aquí no se puede ver**. No lo deduzco de que el repo no lo enlace: eso
mediría el repo, no el mundo. **Queda declarado como no medible desde una sesión.**

---

## ② 🔴 LA PREMISA DEL TICKET ESTÁ MAL, Y CAMBIA EL REMEDIO

El encargo dice: *«el éxito verdadero TAMPOCO se registra (no escribe, luego el cobro queda
pendiente en la base aunque la clienta haya pagado)»*.

**La primera mitad es cierta. La conclusión no.** La pantalla, en efecto, no escribe: su único
acceso a base es un `findUnique` (`payMp.routes.ts:84`). Pero **el registro del éxito no es trabajo
suyo**, y hay quien lo hace — `POST /webhooks/mp` (`mpWebhook.routes.ts`), montado en
`app.ts:366`, y medido hoy:

| lo que hace el webhook | dónde |
|---|---|
| verifica la firma de MP, y **fail-closed** si falta el secreto | `:59-67` |
| **pregunta a Mercado Pago** por el pago de verdad (`getMpPayment`) | `:78` |
| resuelve el charge por `external_reference` | `:85-96` |
| **escribe `paid`** con `datosDeCobroPagado`, `method`, `reference` y conciliación | `:101-127` |
| emite la factura automática si procede | `:137-140` |

Y la preferencia se crea pasándole `notificationUrl: ${BASE_URL}/webhooks/mp`
(`payMp.routes.ts:54`), así que **la puerta está conectada**.

> **Consecuencia para el remedio:** ② no es «falta escribir en la pantalla». Es que **la pantalla
> no es la fuente de verdad y no debe serlo** — ya hay una puerta de escritura correcta. Pedirle a
> la pantalla que escriba duplicaría, en el camino del dinero, una lógica que ya existe y funciona.

**El riesgo que SÍ queda vivo en ②, y que no es el que el ticket describe:** si `MP_WEBHOOK_SECRET`
no está configurado, el webhook rechaza **todo** (fail-closed, `:60-62`) y entonces **nadie** marca
el cobro. La pantalla seguiría diciendo «aprobado» y la base seguiría en `pending`. **Si MP está
configurado hoy en Railway no se puede ver desde aquí** (`env.ts:72-73` sólo declara el valor por
defecto `''`) — segundo hueco declarado.

**① y ② no se mezclan:** ① es *afirmar sin saber* y se arregla en la pantalla; ② es *que la
escritura dependa de un webhook que puede estar dormido* y se arregla mirando su configuración,
no la pantalla.

---

## LOS REMEDIOS · lo que cuesta cada uno

### (a) Retirar la pantalla mientras MP esté dormido
- **A favor:** cero código nuevo, cero mentira, y borra la clase entera de defecto.
- **Cuesta:** rompe `tests/scrum90-pay-bank-mp-token.test.mjs:88-89`, que hoy pide
  `/pay/mp/:token/result?status=approved` y **exige 200** (está gateado tras `QA_DB_TEST=1`, así
  que no saldría en una tanda normal: se descubriría en staging).
- **Riesgo:** apoya en «MP está dormido», que es exactamente lo que **no he podido medir**. Si algún
  integrador externo lo usa, se le rompe el retorno del checkout sin aviso.

### (b) Consultar a MP antes de afirmar, y escribir por la puerta de `/webhooks/psp`
- **A favor:** es la única que hace la pantalla *verdadera* aunque el webhook falle.
- **Cuesta:** lo más caro, y en el camino del dinero. Duplica lo que el webhook ya hace bien; exige
  idempotencia (el webhook se protege con `charge.status !== 'paid'`, `:101`) o habrá doble
  escritura y **doble factura** con `AUTO_INVOICE_ON_PAID`. Necesita el `accessToken` del merchant
  en una ruta pública.
- **Veredicto:** mucho gasto y mucho riesgo para un camino que hoy **nadie recorre**.

### (c) Dejarla pero que no afirme
- ⚠️ **Es MICROCOPY, y es del fundador (regla 30). NO redacto el texto**, ni lo insinúo.
- **Cuesta:** poco código, pero necesita firma, y no cierra ② en absoluto.

### (d) 🔴 Una cuarta que el encargo no lista, y que mide mejor la relación coste/riesgo

**La pantalla ya tiene la verdad delante y la tira.** Hace `findUnique` del charge en `:84` y usa
`charge.concept`, `charge.amount`, `charge.currency`… **pero no `charge.status`**, que es la columna
que el webhook escribe. Afirmar según el estado de **nuestra propia base** en vez de según la query
no exige preguntar a MP, no duplica escritura y no inventa estados.

- **A favor:** elimina la mentira de ① sin tocar el camino de escritura. Barato. Y usa exactamente
  el mecanismo que ya existe (`payMp.routes.ts:26` YA hace esto en la otra ruta: si el charge está
  `paid`, redirige a `?status=approved`).
- **Cuesta:** sigue siendo código en el camino del dinero, y el caso «pagado pero el webhook aún no
  ha llegado» pasaría a verse como pendiente — que es **la verdad**, pero es un cambio de lo que ve
  el usuario, así que el texto para ese caso volvería a ser microcopy del fundador.

### RECOMENDACIÓN

**(a) ahora, (d) si y sólo si se decide despertar Mercado Pago.**

El motivo no es que (d) sea peor, es que **el coste se mide contra el uso**, y el uso medido es
cero: (d) escribe código nuevo en el camino del dinero para arreglar una pantalla que ningún camino
del producto alcanza. (a) borra el problema sin escribir una línea. Si MP se despierta algún día,
(d) es el arreglo correcto y (b) sigue sin compensar, porque el webhook ya hace su trabajo.

🔴 **Y (a) no se ejecuta sin GO:** retirar una pantalla es algo NUEVO que llega al usuario, y
además se apoya en el hueco que no pude medir. **Antes de retirarla hay que responder una pregunta
que no es de código: ¿hay integradores externos pidiendo cobros con `method_preference:'mp'`?**

---

## LOS CONTROLES QUE EXIGIRÁ EL ARREGLO (escritos, no implementados)

🔴 **ROJO REAL** — una URL con `status=approved` fabricada a mano **NO** debe producir una pantalla
que afirme que se pagó. Hoy este control **falla**: está medido arriba, con token inventado y sin
base. Con el remedio (a) el control se cumple por 404; con (d), porque la página lee
`charge.status`.

✅ **VERDE QUE DECIDE** — un pago verdaderamente aprobado sigue llegando a `paid`. **Arreglar la
mentira no puede romper el éxito.** Su sitio natural es el webhook, que es quien escribe: un charge
`pending` + un evento `payment` aprobado y firmado tiene que acabar en `paid` con su `method` y su
conciliación. Ese camino **no lo toca ninguno de los remedios**, y por eso el control debe correr
igualmente: sirve para demostrar que no se rompió.

🔴 **SUELO** — si la sonda no encuentra la ruta `/pay/mp`, **aborta CIEGO** (salida 2), nunca verde.
Ya está puesto en la sonda de arriba: un 404 en la petición de arranque corta antes de medir nada.
Sin ese suelo, retirar la ruta haría pasar el control por la razón equivocada — y el control diría
«arreglado» tanto si se arregló como si se borró el fichero entero.

### Por qué NO he añadido ese test al árbol, aunque ③ me lo permitía

El control del ROJO REAL **está en rojo hoy**, porque el defecto existe y no se ha arreglado.
Meterlo en `tests/` dejaría **`main` en rojo** a la espera de una decisión del fundador, y esta casa
ya midió lo que eso vale:

> *Un test que falla a propósito entrando en `main` habría sido peor que el problema que se venía a
> resolver.* — canon de la S5, del control end-to-end de SCRUM-834.

La alternativa —escribirlo en verde, afirmando lo que la pantalla hace hoy— sería peor: convertiría
la mentira en comportamiento fijado por un test. **El control se escribe en el mismo PR que el
arreglo, y nace en rojo el día que hay algo que lo ponga verde.** Mientras tanto queda aquí, entero
y repetible.

---

## 🔴 Mis errores, esta tanda

1. **Di por bueno un control positivo que no discriminaba.** Busqué `paymp_url`, `paycard_url` y
   `paybank_url` en `integrations/` y `messaging/` y salieron **las tres a cero**. Escribí la
   comparación como si fuera un control, cuando un control que da lo mismo sobre el caso vivo y el
   muerto no prueba nada — es la tautología con forma de prueba de la que avisa A3. Lo rehíce por
   los enlaces construidos y entonces separó: 6 contra 0. **La primera versión habría sostenido el
   mismo veredicto con evidencia falsa**, que es la peor manera de acertar.
2. **Asumí el shape de un import y la sonda reventó.** `dist/…/payMp.routes.js` es CommonJS y el
   router vive en `.default`; monté `_mod` directamente y express tiró
   `argument handler must be a function`. Sin daño —se cayó ruidosamente en vez de medir mal—, y de
   ahí salió el suelo explícito `typeof payMpRouter !== 'function'` → CIEGO.
3. **Escribí un fichero dentro de `dist/` para poder correr la sonda.** Era la única forma de que
   `express` resolviera, y `dist/` es artefacto ignorado, pero es exactamente el patrón que
   SCRUM-808 censó como peligroso: si el proceso muere a mitad, se queda dentro. Lo retiré y lo
   comprobé (`git status` = 0), pero lo correcto habría sido pensar antes dónde vive un instrumento.

---

## Lo NO tocado

`src/` **entero** — este PR no lleva una sola línea de código · la pantalla `/pay/mp` sigue igual
(retirarla es GO del fundador) · ningún texto de usuario: **no he redactado microcopy** ni para la
opción (c) ni para (d) (regla 30) · `tests/` — ningún control añadido, por lo explicado arriba ·
`prisma/schema.prisma` · el webhook de MP · `tests/scrum90-pay-bank-mp-token.test.mjs`, que hoy
depende del comportamiento actual y **se ha reportado, no modificado** · Jira (SCRUM-924 sigue
*En curso*) · el rojo de `scrum858b` (`wmic`), que es SCRUM-922 de Luis.

---

## SCRUM-924b · Construido: opción (d), leer `charge.status` en vez de la query string

*22-sep-2026 · J2 (jv-j2) · rama `scrum-923-924-cobro-no-verificado`*

**Medido contra:** `origin/main` = `f319add31e4e414ab9e9a70e10bc179dc13996c9` · 2026-09-22T08:19:27Z

Sobre la medición de arriba (924/924b anteriores): **decisión** (d), no (a) — no exige el GO del
fundador que (a) necesitaba, y cierra la misma mentira. Cero texto nuevo: el badge y los mensajes
de `statusMap` no cambian, sólo de DÓNDE sale la clave que los elige.

### Rojo primero

`tests/scrum924-pay-mp-no-inventa-estado.test.mjs`, corrido contra el `payMp.routes.ts` sin tocar
(mismo patrón de dobles que `scrum910-la-transferencia-que-no-mira.test.mjs`: doblado
`dist/core/db/prisma.js`, montada la ruta real):

    ✖ SCRUM-924 · ① cobro `pending` + `?status=approved` NO pinta «aprobado»
      → sí lo pinta hoy (falla como se esperaba)
    ✖ SCRUM-924 · ② token que no existe → 404, no una página con huecos
      → devuelve 200 hoy (falla como se esperaba)
    ✖ SCRUM-924 · ③ CONTROL: un cobro `paid` de verdad sigue pintando «aprobado» (con o sin query)
      → sin query, hoy pinta «pendiente» (el default), no «aprobado» (falla, y de paso confirma
        que el bug no es sólo "confía en la URL": SIN query también inventa un estado)
    3 fail · 0 pass

### El arreglo

`payMp.routes.ts` — `GET /pay/mp/:token/result`:

- Se lee el `Charge` por `receiptToken` (igual que la ruta hermana `GET /pay/mp/:token`, la del
  paso anterior).
- Si no existe → `404` con `documentNotFoundHtml()`, igual que esa hermana. Antes: `200` con la
  página vacía de huecos, cualquiera que fuera el token.
- `status` sale de un mapa fijo `charge.status → texto del badge`
  (`{paid:'approved', failed:'rejected', expired:'expired', pending:'pending'}`), **nunca** de
  `req.query.status`. El `try { … } catch {}` que envolvía la consulta y seguía pintando con la
  query si fallaba, retirado: ahora un fallo de BD es un 500 real, no una página mintiendo.

### Verde + control positivo

    ✔ SCRUM-924 · ① cobro `pending` + `?status=approved` NO pinta «aprobado»
    ✔ SCRUM-924 · ② token que no existe → 404, no una página con huecos
    ✔ SCRUM-924 · ③ CONTROL: un cobro `paid` de verdad sigue pintando «aprobado» (con o sin query)
    3 pass · 0 fail

El control ③ es el que hace el verde no-tautológico: un cobro `paid` de verdad sigue diciendo
«aprobado» tanto sin query como con `?status=rejected` en la URL — si el arreglo hubiera dejado
algún camino leyendo la query, ese segundo caso habría caído.

**Verificado que no rompe `tests/scrum90-pay-bank-mp-token.test.mjs:88-91`** (gateado
`QA_DB_TEST=1`, no corrible en esta máquina sin Postgres — leído, no ejecutado): sólo comprueba
`HTTP 200` y que el importe aparece (`'30.00'`/`'30,00'`); ninguna de las dos cosas cambia con este
arreglo, porque el importe sigue viniendo de `charge.amount` sin condición y un token válido sigue
dando 200.

### Un error propio, esta tanda

El primer test usaba `fetch` (undici) para las peticiones, el mismo patrón que
`scrum910-la-transferencia-que-no-mira.test.mjs`. En la primera pasada (rojo) el proceso abortó al
cerrar — **`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`**, ya documentado en
SCRUM-556/SCRUM-100 como una carrera de libuv en Windows bajo `--test-force-exit`: los tres
subtests habían corrido y fallado con el motivo correcto, pero el fichero se habría marcado como
fallido igual encima de eso. Lo cambié a `node:http` con `agent:false` (el remedio ya probado en
`scrum100-webhooks-fail-closed.test.mjs`) antes de darlo por bueno — no lo dejé pasar como "un
crash raro del entorno" sin mirar si ya estaba explicado.

### Lo NO tocado en esta tanda

`src/modules/billing/app/routes/payMp.routes.ts` — nada fuera de la ruta `/mp/:token/result` (la
ruta `/mp/:token` que crea la preferencia, sin diff) · el copy del badge/mensajes de `statusMap`
(mismos textos, regla 30 no aplica: no hay texto nuevo) · `docs/master/SCRUM-923.md` (aparte) ·
publicar el PR — queda EN BORRADOR, auto-merge desarmado, a la espera del GO de Javier.
**Producción y staging: no tocados, ni para mirar.**
