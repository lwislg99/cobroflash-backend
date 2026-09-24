# SCRUM-1029 · Cinco superficies del alta y la cuenta prometen cobrar por YaQu a un ES con la facturación OFF (regla 24) — y el guard SCRUM-299 no las ve

**Medido contra:** `origin/main` = `beef7b362ed44a7bb431ab4f145879f11abd0c24` · 2026-09-21T16:41:27Z

**Puesto:** J3 · Alta y crecimiento (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1029-cobro-tras-regla24`
**Gate:** LECTURA. Cero líneas de `src/`, `public/`, `prisma/` o del máster tocadas. Encargo nacido de
SCRUM-612c §6 («con esto firmado, en España esa función no existe hasta SIF-1; es de S2/S4») aplicado
al TRAMO de J3: alta, prueba, suscripción y configuración.

> ⛔ Este expediente **no decide nada**: no toca el camino de emisión, `prisma/schema.prisma`, ningún
> texto en producción, ni el guard `SCRUM-299`. Mide, clasifica y propone literal — que firma un jefe.

---

## 0 · La regla que cambió hoy, tal como quedó escrita (SCRUM-612c, PR #1593, mergeado 14:55:34Z)

`docs/YAQU_MASTER.md`, regla 24 (Parte I, texto vigente en `origin/main` de esta medición):

> «Con el interruptor en OFF, YaQu no emite ningún documento para ese merchant —ni factura, ni
> justificante, ni ningún otro documento de cobro— y no cobra por YaQu a sus clientes: ni enlace de
> pago, ni señal al aceptar el presupuesto, ni recordatorios de pago, ni «marcar como cobrada», ni
> aviso de pago al cliente, ni la pantalla de Cobros, ni la página pública del recibo. Presupuestos,
> firma, albaranes y partes siguen igual. El profesional cobra por fuera de YaQu hasta que exista la
> factura.»

Afecta a **todo merchant ES real** (`INVOICING_ES_ENABLED` es `false` por defecto,
`src/core/flags.ts:16`); el merchant DEMO queda fuera (P-1 de SCRUM-612, `emission.service.ts:39`
decide el modo `demo` una línea antes de leer el interruptor, `:40`).

SCRUM-612c §5 lo deja escrito: *«No toca código […] hoy el justificante y el cobro funcionan
exactamente como hasta ahora. Lo que cambia hoy es lo que el máster MANDA, no lo que el producto
HACE.»* Este expediente mide contra el **MANDATO** de hoy, no contra si `SCRUM-825` (la ejecución en
código) ya aterrizó — no ha aterrizado.

## 1 · Encargo y método

Recorrer alta→prueba→suscripción→configuración buscando todo lo que **prepare, prometa o pida datos
PARA COBRAR**; decir si hoy es verdad para un ES con el interruptor OFF; distinguir **FALSO**
(promete algo que no pasará) / **INÚTIL-hoy** (pide un dato que no se usa todavía) / **SIGUE BIEN**.
No decido quitar nada, no propongo tocar ningún guard ajeno, no toco texto sin firma.

Cada hallazgo está verificado leyendo el fichero **completo** (no solo grep) y, donde hay un
instrumento del propio repo que aplica, corriéndolo — no solo leído.

**Control de línea base:** antes de citar una sola línea, comprobado que mi árbol (13 commits detrás
de `origin/main` al arrancar la sesión) no divergía en ninguno de los ficheros que iba a citar:

```
git diff --stat HEAD origin/main -- \
  public/dashboard/js/settingsView.js public/dashboard/js/settingsSubmenus.js \
  public/dashboard/js/onboardingView.js public/dashboard/js/tutorial.js \
  public/dashboard/js/plansView.js src/modules/messaging/domain/lifecycle.service.ts \
  src/modules/messaging/domain/weeklyDigest.service.ts src/modules/billing/domain/viasDeCobro.ts \
  src/app.ts tests/scrum299-copy-factura-publico.test.mjs tests/_copy-publico.mjs src/core/flags.ts
```

Salida: **vacía** (0 diferencias, `rc=0`). Las líneas citadas abajo son válidas contra `origin/main`.

## 2 · El censo — 5 superficies, ninguna condiciona por país ni por flag

**Confirmado por lectura completa de cada fichero: 0 referencias a `country`, `INVOICING_ES_ENABLED`
ni ningún flag fiscal en ninguna de las 5.**

### A) `public/dashboard/js/settingsView.js:1224-1339` — `renderReadinessCard`, «Tu cuenta, lista para cobrar»

Se pinta para TODO merchant (`m.slug !== undefined`), llamada sin condición en `:147`. El veredicto lo
da `viasDeCobro()` (`src/modules/billing/domain/viasDeCobro.ts`, fichero entero — 96 líneas — sin
ninguna referencia a `INVOICING_ES_ENABLED`), alimentado desde `src/app.ts:692-707`, que tampoco lo
consulta (solo mira `iban`, `bizumPhone`, `whatsappPhone`, `connectStatus` y el flag
`BIZUM_MANUAL_ENABLED`).

| línea | texto | veredicto |
|---|---|---|
| `:1260-1273` | fila «Cobro por transferencia o Bizum» → con IBAN puesto: **«IBAN configurado»** en verde | **FALSO** — regla 24: «ni enlace de pago, ni señal al aceptar el presupuesto, ni recordatorios de pago» |
| `:1274-1282` | fila «Cobros con tarjeta» → con Connect activo: **«Stripe activo — tus clientes pueden pagar con tarjeta»** | **FALSO**, mismo motivo |
| `:1287` | `koText` de «Datos fiscales»: **«Sin ellos, el documento tras el pago es un justificante de cobro»** | **FALSO** — con OFF no hay NINGÚN documento tras el pago (regla 24: «ni justificante, ni ningún otro documento»), y tampoco hay «el pago» |
| `:1294` | cabecera «Tu cuenta, lista para cobrar» + contador «N de 4 en verde» | el marco entero asume que cobrar es alcanzable ya |

El `okText` de «Datos fiscales» («Completos — listos para facturar cuando toque») es defendible: habla
en futuro y no promete un documento ahora.

### B) `public/dashboard/js/onboardingView.js:167-271` — asistente de alta, Paso 2 («¿Ya has facturado en {año}?»)

Mostrado a TODO merchant sin condición (el único uso de `state.country`, fijado en el Paso 1, es
prefijar un `<select>`; no condiciona nada aguas abajo — confirmado leyendo las 464 líneas enteras del
fichero). La vista previa en vivo (`:191-197`) dice literalmente:

> «Tu primera factura con YaQu será: **2026-CF-042**» · «Compruébalo bien: cuando emitas esa factura,
> este número ya no se puede cambiar.»

y guarda la serie vía `POST /admin/onboarding/serie` (`:257-270`). **FALSO** en la promesa del
documento («tu primera factura con YaQu será…» — con OFF no se emite ninguna). El DATO de continuidad
de serie en sí es **INÚTIL-hoy** (no se consume mientras el interruptor siga OFF), pero **no propongo
quitarlo** — puede seguir teniendo sentido tenerlo listo para cuando SIF-1 esté (mi encargo dice
explícitamente que esto no lo decido yo: «pedir el IBAN antes puede seguir teniendo sentido»).

### C) `public/dashboard/js/tutorial.js:179-186` — `TUTORIAL_GUIDE`, «Guía de inicio rápido»

Entrada **«¿Cómo funciona el cobro?»**:

> «Al crear el presupuesto eliges las condiciones de pago. Cuando el cliente acepta y firma, **se
> genera la factura**. El cliente **paga con tarjeta o transferencia desde el enlace**.»

**FALSO explícito y literal**: describe el flujo exacto que la regla 24 prohíbe. 0 condicionamiento
por país/flag en las 348 líneas del fichero (confirmado por lectura completa y grep de control).

### D) `public/dashboard/js/plansView.js:99-109, :152` — pantalla del plan Pro (la SUSCRIPCIÓN, mía por `dos-equipos.md` §3.1)

Lista de features vendidas con el plan de pago (`:102-103`):

> «Cobro integrado: el cliente paga desde el móvil» · «Recordatorios automáticos de cobro»

Nota de comisión (`:152`): «+ 0,9 % solo cuando cobras con tarjeta · Bizum y transferencia, gratis».
**FALSO**: se vende como parte de lo que el merchant PAGA en la suscripción, sin condición por país (0
referencias a `country` en las 266 líneas del fichero). No es la regla 25 (P-7 de SCRUM-612c, «no
tocamos» — el PRECIO de la suscripción a YaQu); es el CONTENIDO de lo que se promete a cambio de ese
precio.

### E) `src/modules/messaging/domain/lifecycle.service.ts` — emails de ciclo de vida al MERCHANT

| línea | función | texto | veredicto |
|---|---|---|---|
| `:131` | `sendWelcomeEmail` | «Bienvenido a YaQu. A partir de ahora vas a cotizar por WhatsApp, **cobrar antes de empezar** y olvidarte del papeleo.» | **FALSO** |
| `:155` | `sendFirstPaymentEmail` (al activar Pro) | «**Las facturas se generan solas al cobrar.**» | **FALSO** |
| `:243` | email día 12 (aviso de trial) | «tus cobros, tus clientes y tus datos siguen ahí» — SIN prometer documento | **SIGUE BIEN** — ya corregido |

El comentario que acompaña la línea `:243` (`:236-239`) cita explícitamente el trinquete de SCRUM-299
y las reglas 24/26: *«el trinquete de SCRUM-299 (Parte M) lo caza como PROMESA —el documento post-pago
es justificante hasta SIF-1 (reglas 24/26)—. "El resto del panel sigue funcionando" ya lo cubre entero
sin prometer nada.»* **El patrón correcto ya existe en el propio fichero** — solo falta aplicarlo a
`sendWelcomeEmail` y `sendFirstPaymentEmail`.

## 3 · El guard que debería cazar esto no las ve — medido corriendo el instrumento real, no leído

`tests/_copy-publico.mjs` (SCRUM-299) censa el copy que llega al CLIENTE FINAL: `public/**` salvo
`public/dashboard/**` (`:140`, exclusión por frontera de carpeta) + `src/modules/messaging/**`
(`:150`) + `src/integrations/whatsapp.ts`. Corrí su propia `recolectarCopyPublico()` y
`promesasDeFactura()` contra el árbol real:

```
POBLACIÓN ficheros censados: 27
lifecycle.service.ts en censo? true
ficheros de public/dashboard/ en censo (deberían ser 0): 0
promesas detectadas HOY en lifecycle.service.ts (censo real): 0 []
CONTROL POSITIVO (frase canónica del propio guard, «Aquí tienes tu factura…»): 1
```

Script exacto (guardado en `docs/master/evidencias/SCRUM-1029/probar-censo-299.mjs`, §4):
reproducible sin tocar nada del repo.

**Dos huecos distintos, verificados por separado:**

1. **`public/dashboard/**` está excluido A PROPÓSITO** (comentario `:25-26` de `_copy-publico.mjs`:
   *"es la app del PRO, no material público-cliente"*). Ese diseño protege al CLIENTE FINAL de que le
   prometan «factura»; no protege al PROFESIONAL de que YaQu le prometa a ÉL que va a poder cobrar. La
   regla 24 (nueva) constriñe la promesa hecha al profesional igual que la hecha al cliente final — el
   guard no fue diseñado para esa segunda población, y por eso A/B/C/D (arriba) quedan completamente
   fuera de su alcance por diseño de carpeta, no por accidente.
2. **Dentro de lo que SÍ censa** (`lifecycle.service.ts`, que cae en `src/modules/messaging/**`), los
   5 patrones de `PATRONES_PROMESA` solo cazan la palabra «factura» pegada a una señal de entrega
   (posesivo tu/su, verbo recibir, «aquí tienes», «te enviamos», documento numerado). «Cobrar antes de
   empezar» y «las facturas se generan solas al cobrar» no encajan en NINGUNO de los 5 — confirmado
   ejecutando `promesasDeFactura()` contra las dos frases exactas: **0 coincidencias**, con el control
   positivo de la propia frase canónica del guard cayendo en 1 (el instrumento SÍ funciona; no es un
   fallo de mi lectura).

No toco el guard (no es mi ficha; retocarlo es de quien lo mantiene) ni el texto (STOP, firma un
jefe): lo reporto.

## 4 · Evidencia ejecutable

Script usado para §3, reproducible tal cual desde la raíz del repo (necesita `origin/main` en el
árbol):

```js
// docs/master/evidencias/SCRUM-1029/probar-censo-299.mjs
import { recolectarCopyPublico, promesasDeFactura } from '../../../../tests/_copy-publico.mjs';

const raiz = process.cwd();
const corpus = recolectarCopyPublico(raiz);
console.log('POBLACIÓN ficheros censados:', corpus.length);

const objetivo = corpus.find((c) => c.rel === 'src/modules/messaging/domain/lifecycle.service.ts');
console.log('lifecycle.service.ts en censo?', !!objetivo);

const dashboardEntro = corpus.filter((c) => c.rel.startsWith('public/dashboard/'));
console.log('ficheros de public/dashboard/ en censo (deberían ser 0):', dashboardEntro.length);

if (objetivo) {
  const p = promesasDeFactura(objetivo.texto);
  console.log('promesas detectadas HOY en lifecycle.service.ts (censo real):', p.length, JSON.stringify(p));
}

const control = promesasDeFactura('Aquí tienes tu factura. Págala cuando quieras');
console.log('CONTROL POSITIVO (debe ser 1):', control.length);

const casosSueltos = [
  'Bienvenido a YaQu. A partir de ahora vas a cotizar por WhatsApp, cobrar antes de empezar y olvidarte del papeleo.',
  'Las facturas se generan solas al cobrar.',
];
for (const c of casosSueltos) {
  console.log(JSON.stringify(c), '->', promesasDeFactura(c).length, 'coincidencias');
}
```

Salida real, ejecutada el 21-sep-2026 desde `cobroflash-jv3` contra `origin/main` de esta medición:

```
POBLACIÓN ficheros censados: 27
lifecycle.service.ts en censo? true
ficheros de public/dashboard/ en censo (deberían ser 0): 0
promesas detectadas HOY en lifecycle.service.ts (censo real): 0 []
CONTROL POSITIVO (debe ser 1): 1
"Bienvenido a YaQu. A partir de ahora vas a cotizar por WhatsApp, cobrar antes de empezar y olvidarte del papeleo." -> 0 coincidencias
"Las facturas se generan solas al cobrar." -> 0 coincidencias
```

## 5 · Clasificación resumida

**FALSO** (promete algo que con OFF no pasará): A (las 3 filas + cabecera), B (solo la frase de la
vista previa, no el dato en sí), C (entera), D (features + nota de comisión), E (`sendWelcomeEmail` y
`sendFirstPaymentEmail`).

**INÚTIL-hoy** (pide/prepara un dato que no se consume mientras OFF, pero no lo decido yo si sobra):
la pregunta de continuidad de serie en B; los campos IBAN/Bizum y el botón de activar Connect en la
pestaña «Cobros» (`settingsSubmenus.js`, tab `cobro` — J2, no la abro a fondo, solo la señalo porque el
checklist de A enlaza ahí).

**SIGUE BIEN**: Pasos 1/3/4 del asistente de alta (sin mención de cobro); `weeklyDigest.service.ts` —
ya gateado correctamente por `modoEmision` para el bloque «Firmado y sin facturar» (SCRUM-974,
`:98-107`), y el resto son informes de hechos pasados (Cobrado, Facturas emitidas, Pendiente de
cobro), no promesas; el email del día 12 en `lifecycle.service.ts` (ya corregido, es el patrón a
replicar); `register.html` y `login.html` (0 menciones de cobro, confirmado por grep + lectura); el
panel `modoEmision` en Cumplimiento (dice la verdad sobre el código de HOY, aunque quedará desfasado
en cuanto `SCRUM-825` aterrice — no es mío, J1 ya tiene SCRUM-955 abierto sobre el mapa completo).

## 6 · Propuesta — LITERAL, PENDIENTE de firma de un jefe (reglas 30/39). No se aplica desde este PR.

Mismo patrón que ya usa el email del día 12 (aprobado, §2·E): describir lo que SIGUE existiendo
(presupuesto, firma, cobro pactado «por fuera») sin prometer documento ni enlace de pago por YaQu,
condicionado por país + `INVOICING_ES_ENABLED` (o por `modoEmision`, que ya es la fuente de verdad de
J1 y que `weeklyDigest.service.ts:102-105` ya consulta):

- **C (tutorial):** *"Al crear el presupuesto eliges las condiciones de pago. Cuando el cliente acepta
  y firma, queda registrado como pactado. [ES + OFF: Cobras por fuera de YaQu hasta que actives la
  facturación.] [resto de países / ON: recibirás la factura y el enlace de pago.]"* —
  `[PENDIENTE microcopy oficial]`
- **A (checklist):** condicionar las 2 filas de cobro + el `koText` de «Datos fiscales» a
  `modoEmision`, igual que ya hace `weeklyDigest.service.ts`.
- **D (plan):** retirar o condicionar «Cobro integrado» / «Recordatorios automáticos de cobro» / la
  nota de 0,9 % para el segmento ES+OFF.
- **E (emails):** aplicar el mismo patrón del día 12 a `sendWelcomeEmail` y `sendFirstPaymentEmail`.

Ningún literal de esta sección se aplica desde este expediente — quedan marcados
`[PENDIENTE microcopy oficial]` hasta que un jefe firme (regla 39).

## 7 · Cruces con Jira por CONTENIDO (no por número)

- **SCRUM-1025** (area-j3, Tareas por hacer, sin firma): mismo checklist de A, defecto DISTINTO — el
  «Completar →» de WhatsApp culpa al teléfono del merchant cuando bloquea el del cliente. No se
  solapa.
- **SCRUM-1016** (area-j4, En curso): misma familia de hallazgo, en `public/index.html` y
  `public/precios.html` (landing/precios públicos) — superficie DISTINTA (logueado vs. público).
  Cruzado para que J4 y J3 no dupliquen.
- **SCRUM-974** (Finalizada): el patrón de gating correcto (por `modoEmision`) ya existe en
  `weeklyDigest.service.ts` — la propuesta de §6 lo reutiliza, no inventa uno nuevo.
- **SCRUM-955** (área-j1, En curso, rama sin empujar): mapa completo de lo que falta para SIF-1; no
  leído (rama de otra sesión, no es mi ficha).
- **SCRUM-519 / SCRUM-894 / SCRUM-904** (Finalizadas): historial de por qué existe `viasDeCobro()` y
  por qué las filas del checklist navegan a su pestaña — confirman que A ya se retocó varias veces por
  OTROS motivos, nunca por regla 24 (no existía hasta hoy).

## 8 · Lo que NO miré (declarado, no un cero silencioso)

- `homeView.js` (S2) tiene un checklist paralelo «Configura cómo cobras» (mencionado en el comentario
  de `viasDeCobro.ts:11`) que probablemente comparte el mismo defecto (mismo `viasDeCobro()`). No es mi
  fichero — lo señalo, no lo censo a fondo.
- No corrí el checklist en navegador (sin GO de despliegue ni turno de staging compartido en esta
  tanda): la evidencia es de código + el instrumento real del guard, no de captura de pantalla.
- No propongo tocar `tests/_copy-publico.mjs` ni `tests/scrum299-copy-factura-publico.test.mjs`: no
  son mi ficha.

## 9 · Error propio (A9)

Mi primer barrido de `onboardingView.js` usó una lista de palabras clave
(`cobr|IBAN|Bizum|tarjeta|Stripe|Connect|…`) que **no incluía «factura»**, y dio 0 coincidencias —
habría dejado fuera del censo la promesa de B si no hubiera leído el fichero completo por instrucción
explícita del encargo («los pasos del asistente»). Las palabras clave por sí solas no eran una
población fiable; la lectura completa sí.

## 10 · Ticket

Jira **SCRUM-1029** (`equipo-javier`, `area-j3`), En curso, asignado a Javier. El censo y la propuesta
de arriba están también en su descripción.

## 11 · Construcción del GATEADO (22-sep-2026, jv-j3, segunda pasada) — sin tocar copy fiscal

**Medido contra:** `origin/main` = `1f92f5733359880115b3f76824d38db25bef56e0` · 2026-09-22T08:33:54Z ·
**Rama:** `scrum-1025-1029-checklist-modoemision`

Encargo del orquestador: condicionar las 5 superficies censadas ayer por el modo de emisión, reusando
el patrón YA aprobado de `weeklyDigest.service.ts` (SCRUM-974) — **ocultar, no redactar**. El texto
sustituto que vería el profesional en su lugar es fiscal y lo firma Javier; no se escribe en este PR.
Durante la construcción de E apareció una 6ª (§11.1, «F»): mismo defecto, mismo fichero, decisión del
orquestador de sumarla aquí en vez de abrir ticket propio.

**Mecanismo reusado, no reinventado:** en el navegador, `window.appModoEmision` (`app.js:51-52`,
derivado de `modoEmisionVisible()`/`getEmissionMode`, ya consumido por `settingsView.js:201` y
`albaranAccion.js:66` — no hay una segunda fuente). En el servidor, `getEmissionMode(merchant)` de
`emission.service.ts`, igual que `weeklyDigest.service.ts:113`.

| superficie | qué se ocultó | qué queda igual |
|---|---|---|
| A · `settingsView.js` `renderReadinessCard` | la tarjeta «Tu cuenta, lista para cobrar» **entera**, si `appModoEmision === 'receipt'` | nada se pinta — no hay fila con texto a medias |
| B · `onboardingView.js` Paso 2 | solo el bloque de vista previa («Tu primera factura con YaQu será…», `#ob-serie-previa`) | la pregunta de continuidad de serie y el guardado (`POST /admin/onboarding/serie`) siguen funcionando, para cuando SIF-1 llegue |
| C · `tutorial.js` `TUTORIAL_GUIDE` | la entrada «¿Cómo funciona el cobro?» (marcada `soloSiCobra: true`, filtrada en `openHelpGuide`) | las otras 2 entradas de la guía |
| D · `plansView.js` features del plan Pro | «Cobro integrado…» y «Recordatorios automáticos de cobro» | las otras 5 features |
| E · `lifecycle.service.ts` | la frase de `sendWelcomeEmail` («…cobrar antes de empezar…») y el ítem de `sendFirstPaymentEmail` («Las facturas se generan solas al cobrar.») | el resto de cada email; se añadió `country`+`flags` al `select` de Prisma para poder leer el modo |
| F · `lifecycle.service.ts` `wrap()` (pie compartido) | la cláusula «· Cotiza por WhatsApp y cobra antes de empezar» del pie, en los **7** emails que usan `wrap()` (bienvenida, primer pago, día 3/7/12/15, inactivo) | «YaQu · yaqu.app» sigue saliendo en los 7; el resto de cada cuerpo no cambia |

**Control positivo:** `node --check` en los 4 `.js` de `public/dashboard/`, `npm run build` (tsc) sin
errores, `npm run guards:entrada` → 11 guards · 95/95 tests en verde sobre este árbol.

### 11.1 · Superficie F — el censo de ayer se quedó CORTO, no es un detalle

`lifecycle.service.ts:61` (numeración de la medición de ayer) — el pie `wrap()`, compartido por
**TODOS** los emails del ciclo de vida (bienvenida, día 3/7/12/15/inactivo, primer pago, 7 en total),
llevaba la tagline fija:

> «YaQu · Cotiza por WhatsApp y cobra antes de empezar»

Es el **mismo defecto** que E (misma regla 24, mismo barrido, mismo fichero — no víctima distinta ni
bloquea otra cosa: no es ticket aparte, decisión del orquestador), pero la superficie real es **mayor**
de lo que decía el censo de ayer: no son 2 emails con promesa de cobro, son **7**, porque el pie lo
comparten todos.

**Cómo se gateó, sin tocar los 5 emails que NO tenían nada que ver:** `wrap()` pasa a exigir un
tercer parámetro `puedeCobrar: boolean` **sin valor por defecto** — a propósito, para que TypeScript
obligue a decidirlo en cada una de las 7 llamadas en vez de dejar que una llamada olvidada cuele el
`undefined` de siempre. `npm run build` en verde confirma que las 7 lo pasan.

**Control positivo de que los 5 emails NO afectados (día 3/7/12/15, inactivo) siguen enteros:**
reconstruido el bloque del pie de `wrap()` en un script suelto y comparado byte a byte —

```
puedeCobrar=true IGUAL AL ORIGINAL: true
puedeCobrar=false SIGUE TENIENDO yaqu.app: true
puedeCobrar=false NO tiene la promesa: true
```

Con `puedeCobrar=true` (el caso de todo merchant no-ES o ES con el flag ON — o sea, los 5 emails
que no se tocaron hasta hoy, para los que `getEmissionMode` sigue dando `!== 'receipt'`) la salida es
**idéntica byte a byte** a la de antes de este cambio: ningún email de los no censados se cae ni sale
con el pie roto. Con `puedeCobrar=false` solo desaparece la cláusula de cobro; «YaQu · yaqu.app»
sigue ahí. El diff real (`git diff`) confirma además que los CUERPOS de día 3/7/12/15/inactivo no
cambiaron ni una letra: solo se añadió el argumento a su llamada a `wrap()`.

### 11.2 · Lo que sigue PENDIENTE — no se construye sin firma (regla 39)

El texto sustituto de la §6 original (arriba) sigue sin escribirse. Este PR únicamente hace que las
6 superficies (A-F) **dejen de mentir** (no muestran nada donde antes prometían cobro/documento); no
dice nada en su lugar. Cuando Javier firme el copy —del lote de SCRUM-534 o aparte—, la siguiente
rama solo tiene que rellenar los huecos que aquí quedan vacíos, sin tocar el mecanismo de gateo.

## 12 · Superficie G (22-sep-2026, jv-j1) — `puertaSerie.js`, la SÉPTIMA de la familia

**Medido contra:** `origin/main` = `9b9e7f5995e2210fe6e7d5dc5223b9453ba3770a` · 2026-09-22T09:23:12Z ·
**Rama:** `scrum-puerta-serie-modo-emision`

Encontrada por J6 al hacer el barrido previo a un guard nuevo (censo de ayer decía 5, la
construcción de §11 destapó la 6ª —el pie compartido de los emails, §11.1— y ésta es la 7ª): igual
que B (§2), pero en `public/dashboard/js/puertaSerie.js:98` — la «puerta de última oportunidad»
(SCRUM-D1/SCRUM-313) que se pinta en Configuración a quien ya pasó el alta y no contestó la
numeración. Sin condicionar por `appModoEmision`, `INVOICING_ES_ENABLED` ni ningún flag (confirmado:
0 referencias antes del arreglo). Víctima hoy: cualquier merchant ES con la facturación en OFF que
entre a Configuración ve prometida una factura que la regla 24 no permite emitir.

**Mismo mecanismo reusado de B, sin inventar variante:** dentro de `refrescarPrevia`, justo después
de `error.style.display = 'none';` y antes del resto del cálculo:

```js
if (window.appModoEmision === 'receipt') { previa.style.display = 'none'; return; }
```

Se oculta SOLO el bloque `#ps-previa` («Tu primera factura con YaQu será…»); la pregunta «¿Ya has
facturado en {año}?», el guardado de la serie (`POST /admin/onboarding/serie`) y el bloqueo del
campo por serie ya emitida siguen funcionando igual, para cuando SIF-1 llegue — igual que en B. No
se ha tocado ni una palabra del microcopy (fiscal, lo firma Javier; regla 39): solo se oculta.

**Rojo primero → verde después**, en `tests/scrumD1-puerta-serie.test.mjs`
(`SCRUM-1029 (superficie G) · en modo receipt se oculta "Tu primera factura con YaQu será…"`):
antes del arreglo, el test caía porque el bloque de `refrescarPrevia` no contenía el guard; con el
arreglo, pasa.

**Control positivo** (mismo test, mismas líneas): el bloque de `refrescarPrevia` sigue conteniendo
`apiRequest(` y `previa.style.display = 'block'` — a un merchant que SÍ factura le sigue saliendo la
vista previa real pedida al servidor. Sin este control, ocultar el bloque ENTERO sin condición habría
pasado igual el assert del guard.

**Verificación adicional** (mismo patrón que §11): `node --check` sobre `puertaSerie.js`, `npm run
build` (tsc) sin errores, `npm run guards:entrada` → 11 guards · 95/95 en verde sobre este árbol.

No se ha tocado `prisma/schema.prisma`, ningún flag, ni el camino de emisión.
