# SCRUM-519 · Dos pantallas que decían cosas distintas sobre si se puede cobrar

**Fecha:** 19-ago-2026 · **Carril:** configuración de cobro / readiness · **Gate:** el test corre en `npm test`; la medición en navegador va aparte (`npm run guard:vias-de-cobro`)

**Medido contra:** `origin/main` = `69126e235f4c203f27b6d84f15a136f09db645de` · 2026-08-19T08:41:14Z

**Paso 0.** `main` se movió durante el arranque: `f215ca5d` → `69126e23`. `git fetch origin main:main`
**no se pudo hacer**: `main` está *checked out* en `cobroflash-b3`, el worktree de otra sesión, y git
se niega. Se usó `git fetch origin`, que actualiza `origin/main` sin tocar la rama local ajena — se
dice porque el comando del protocolo no es ejecutable con `main` ocupada.

`docs/master/SCRUM-519.md` no existía. `docs/master/SCRUM-515.md` sí, y se leyó entero: su
instrumento (`scripts/guard-aviso-bizum.mjs`) es la base del de este ticket.

**La premisa SIGUE SIENDO CIERTA.** `settingsView.js:990` era exactamente
`const chargeReady = !!(m.iban || m.bizumPhone);`.

**El ancla, recomprobada AL CERRAR: `main` volvió a moverse, a `11636c07`.** Comprobado fichero a
fichero —no supuesto— que nada de lo medido cambió: `settingsView.js`, `homeView.js`,
`avisoBizumSinTelefono.ts`, `payInvoice.routes.ts`, `payBizum.routes.ts`, `app.ts` y
`prisma/schema.prisma` están idénticos entre `69126e23` y `11636c07`.

Lo que **sí** cambió y afecta a esta entrada: `tests/scrum267-ancla-de-medicion.test.mjs`. SCRUM-516
lo endureció para mirar **entrada por entrada** en vez del fichero entero. Se corrió esa versión
nueva contra este árbol: **SCRUM-519.md no aparece entre las acusadas**. Los cuatro rojos que da
—`SCRUM-290#2`, `SCRUM-397#4`, `SCRUM-397#5`, `SCRUM-447#2`— son entradas antiguas que `main`
corrigió en ese mismo commit y que aquí siguen en su versión vieja; no son de este ticket.

## 1 · La búsqueda por contenido encontró una TERCERA pantalla

El ticket hablaba de dos. Son tres, y la que faltaba estaba nombrada desde SCRUM-328 en el
comentario de `avisoBizumSinTelefono.ts:13`:

| dónde | criterio | qué pregunta |
| --- | --- | --- |
| `settingsView.js:990` — tarjeta «Tu cuenta, lista para cobrar» | `!!(m.iban \|\| m.bizumPhone)` | ¿puede cobrar? |
| **`homeView.js:309`** — checklist «Configura cómo cobras» | `!!(merchant.iban \|\| merchant.bizumPhone)` | ¿puede cobrar? |
| `avisoBizumSinTelefono.ts` — aviso «te falta el móvil» | `bizumPhone \|\| whatsappPhone` | ¿puede cobrar por Bizum? |

Y el que tenía razón era el tercero. **`whatsappPhone` SÍ vale como móvil de Bizum** y no es una
opinión: es lo que hace el producto cuando el cliente va a pagar —
`payInvoice.routes.ts:69` (`m?.bizumPhone || m?.whatsappPhone || null`) y
`payBizum.routes.ts:145`. Con solo `whatsappPhone`, el cliente **ve y usa** el botón de Bizum
mientras las dos pantallas de resumen le decían al profesional que no podía cobrar.

## 2 · El censo, medido hoy — y los números del ticket NO se dieron por buenos

`scripts/censo-vias-de-cobro.mjs`, sólo lectura, imprimiendo host y base (nunca credenciales).

**⚠️ PRODUCCIÓN NO ES MEDIBLE DESDE UNA SESIÓN, y es por diseño.** El `.env` de los worktrees
tiene `DATABASE_URL_DEV`, `_STAGING` y `_TESTS`; **ninguna sesión recibe la credencial de
producción**. Los 13 merchants / 7 sin teléfono del 13-ago salieron de allí y no se han podido
reproducir. Por eso el censo se entrega **como script**: para que el número de producción exista,
lo tiene que correr quien sí tiene esa clave.

Lo que sí se midió, el 19-ago-2026:

| base | merchants | sólo IBAN (tarjeta ✅, Bizum bloqueado) | sólo `whatsappPhone` (cobra y no se cuenta) | sin ninguna vía |
| --- | --- | --- | --- | --- |
| `yaqu_dev_javier` (dev) | 5 | 1 | **1** | 3 |
| `railway` (staging) | 8 | 0 | **2** | 6 |
| **total accesible** | **13** | **1** | **3** | **9** |

Las categorías suman el total en las dos (el script aborta si no cuadran). **La discrepancia toca
a alguien: 3 de 13.** No es una limpieza.

## 3 · Qué se construye: UNA función, no un guard sobre tres copias

> Cuando dos cosas tienen que cuadrar, la primera opción no es vigilarlas: es que sólo haya una.
> Un guard sobre una duplicación **acepta la duplicación y la paga dos veces**.

El criterio pasa a existir una vez, en **`src/modules/billing/domain/viasDeCobro.ts`**, y lo sirve
`GET /admin/merchant` en el campo `viasDeCobro`. Las tres pantallas lo **reciben**. Es el mismo
patrón —y el mismo motivo escrito— que `publicProfileEnabled` en ese mismo endpoint («para que
Configuración pinte activa/aún no activa **sin duplicar la lógica**») y que `bizumSinTelefono`.

**El criterio de teléfono se PREGUNTA a `decidirAvisoBizum`, no se reescribe.** Reescribirlo habría
sido crear la cuarta copia dentro del commit que viene a quitar las copias. Se le pregunta con
`flagBizum: true` a propósito, para que la respuesta hable **sólo de los teléfonos**: con el flag
real, un Bizum apagado devuelve `no_aplica` («nada que avisar») y aquí eso se leería como «tiene
teléfono», que es lo contrario. El flag se aplica después y aparte.

**El caso ilegible cae del lado seguro:** `bizum: null` no cuenta como vía. Degradarlo a «sí tiene»
sería el fallo mudo de SCRUM-328 reproducido una pantalla más arriba.

## 4 · 🔵 Lo que NO se decide, y el nombre del campo lo dice

El campo se llama **`cobroManual`**, no `listoParaCobrar`. Es deliberado: `cobroManual` es
exactamente lo que declara la etiqueta ya aprobada de la fila que lo pinta — «Cobro por
transferencia o Bizum» — ni más ni menos.

**Qué significa «listo para cobrar» sigue abierto y es del fundador**: si basta cualquier vía, si
tiene que ser la que el producto usa por defecto, o si Stripe cuenta cuando se active. Las dos
lecturas están contadas en la tabla del §2 y **no se elige entre ellas**. Lo que cambia es que
cuando se decida, se cambia **aquí, en una línea**, y las tres pantallas la siguen.

**Microcopy: no se añade ni una palabra** (regla 30). Los tres textos de la fila son los de
siempre, palabra por palabra; lo que cambia es a qué caso corresponde cada uno — «Bizum
configurado» ahora sale también con solo `whatsappPhone`, que es cuando el cliente ve de verdad el
botón. No es microcopy nueva: es dejar de aplicar mal la que ya estaba aprobada.

## 5 · Verificación

**Línea base de `npm test`**, en el ancla y en worktree materializado hoy: **3.681 · 3.604 pass ·
0 fail · 77 skip**. Al cerrar: **3.689 · 3.612 pass · 0 fail · 77 skip** (+8, los de este ticket).

**Cliente de Prisma:** regenerado desde ESTE worktree con `npm run prisma:generate` y **comprobado
por fecha del artefacto** (6 s de antigüedad) — SCRUM-518 dejó dicho que `npm ci` se lo salta con
un `warn`, así que no basta con lanzarlo: hay que mirar que se hizo.

**Commit en verde previo a la inyección del rojo:** `b7b0fb477e29bc666ba22889610494fcb45a82de`.

### El control positivo, enumerado por caso — las 8 combinaciones en el DOM

```
✔ —    · —          · —               tarjeta:· pendiente  aviso:SÍ  (bizum=false, aviso=falta_telefono)
✔ —    · —          · whatsappPhone   tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
✔ —    · bizumPhone · —               tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
✔ —    · bizumPhone · whatsappPhone   tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
✔ IBAN · —          · —               tarjeta:✅ verde     aviso:SÍ  (bizum=false, aviso=falta_telefono)
✔ IBAN · —          · whatsappPhone   tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
✔ IBAN · bizumPhone · —               tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
✔ IBAN · bizumPhone · whatsappPhone   tarjeta:✅ verde     aviso:no  (bizum=true,  aviso=no_aplica)
```

Fila 5 (`IBAN` sin teléfono): la tarjeta dice ✅ **y el aviso sale**. No es contradicción y por eso
el guard la da por buena — la fila afirma «transferencia **o** Bizum» y la transferencia existe; el
aviso habla sólo de Bizum. Es el caso donde vive la decisión pendiente del §4, no un defecto.

### El rojo, por el mecanismo

Devuelta a `settingsView.js` su línea original (`!!(m.iban || m.bizumPhone)`), los dos
instrumentos caen, y cada uno por lo suyo:

```
🔴 1 DE 8 CASOS: LAS DOS PANTALLAS SE CONTRADICEN.
   [—  ·  —  ·  whatsappPhone]
     · la TARJETA de Configuración («Cobro por transferencia o Bizum») dice: · le falta algo
     · el AVISO del campo «Móvil de Bizum» dice: tiene móvil, SÍ puede cobrar por Bizum
     · el campo que las separa: `whatsappPhone` = +34000000001
```

Nombra **las dos pantallas y el campo que las separa**, y es la reproducción exacta del defecto del
ticket en el DOM. El test de la tanda cae por su lado, acusando a la vista que volvió a calcular.

### El suelo

- **Censo sin conexión** → «NO SUPE MIRAR» y código 1, **visto funcionar** (primera ejecución, sin
  `DATABASE_URL`). Cero filas → «CIEGO, QUE NO ES NADIE AFECTADO». Un cero aquí se leería como
  «esto no toca a nadie» y son 3 de 13.
- **Guard sin la fila o sin la ranura del aviso** → «EL ESCÁNER NO SUPO MIRAR», no «coherentes».
  Dos pantallas que no se han encontrado nunca se contradicen.
- **Detector calibrado en los 8 casos y en las dos direcciones**: al aviso se le quita del DOM (o
  se le inyecta un señuelo) y a la fila se le cambia la marca; si el detector no cambia de
  opinión, el guard se declara ciego en vez de dar verde.
- **El trinquete tiene su propio suelo**: se comprueba que el patrón reconoce las dos líneas
  originales y **no** acusa a la nueva. Un trinquete que no caza el defecto original no vigila nada.

### Por qué dos instrumentos y no uno

| pregunta | instrumento | por qué el otro no puede |
| --- | --- | --- |
| ¿las dos pantallas dicen lo mismo **en la pantalla**? | `npm run guard:vias-de-cobro` (Edge, DOM vivo) | un test que lee el fichero da verde ante el defecto: SCRUM-515 lo midió, 7/7 en verde con el aviso borrado |
| ¿el criterio sigue existiendo **una sola vez**? | `tests/scrum519-…` (en `npm test`) | si las tres pantallas recalcularan y hoy coincidieran por casualidad, el DOM saldría coherente y se separarían mañana |

## 6 · Huecos declarados

1. **El número de producción sigue sin medirse.** 13 merchants entre dev y staging no son los
   merchants reales. El script está listo; la credencial no la tiene ninguna sesión.
2. **La fila 5 (`IBAN` sin teléfono) sigue mostrando ✅ con el aviso debajo.** Es coherente y el
   guard la aprueba, pero es exactamente el caso que el fundador tiene que decidir (§4). Si la
   respuesta fuera «listo = la vía por defecto», esa fila cambia — y cambia en una línea.
3. **`GET /admin/merchant` con perfil reducido (rol técnico) no lleva `viasDeCobro`.** No importa
   hoy —`renderReadinessCard` sale antes con `m.slug === undefined` y el checklist de la Home se
   salta a los no-admin— pero si mañana alguien pinta esas vistas para un técnico, verá el paso
   como pendiente. El código cae del lado seguro (pendiente, no ✅ falso), y queda dicho.

## 7 · Fuera de carril · se reporta, no se arregla (regla 37)

1. `git fetch origin main:main` no es ejecutable cuando otra sesión tiene `main` en su worktree; el protocolo lo pide y git lo rechaza.
2. `homeView.js` y `settingsView.js` repetían el mismo criterio sin que nada lo vigilara, y el comentario de `avisoBizumSinTelefono.ts:13` ya lo nombraba desde SCRUM-328 — el hallazgo estaba escrito y llevaba días sin recogerse.
3. El guard de DOM tarda ~8 s en arrancar Edge y no corre en `npm test`, así que la coherencia de estas pantallas sólo se comprueba si alguien se acuerda de lanzarlo — misma fragilidad que `guard:contraste` y `guard:caja-avisos`.

## 8 · Lo que no se ha tocado

`prisma/schema.prisma`, el camino de emisión y el sellado, ningún guard ajeno (a `scrum328` no se
le ha aflojado nada), el texto de la tarjeta y del aviso, `PLAZA_OCUPADA`, y la decisión de qué es
«listo para cobrar». Los ficheros de conexión temporales del censo se borraron al terminar.
