# SCRUM-998 — Qué encuentra HOY un profesional foral (PV/Navarra) al que no le vamos a vender

**Medido contra:** `origin/main` = `4b3c0e479948e36f83f49ad896d11318c7143b82` · 2026-09-21T15:14:15Z

J3 (`jv-j3`), primera sesión, sin traspaso. Encargo de Javier vía `jv-orquestador`
(`cobroflash-backend-50`), 21-sep-2026, literal de Javier citado en el encargo: **«Sí, de momento no
vendemos para estas regiones, déjalo por escrito»** — País Vasco y Navarra.

**Este documento SOLO MIDE (PASO 0, A2).** No construye, no añade texto, no bloquea el alta y no
toca `prisma/schema.prisma` — son los tres límites explícitos del encargo. Las cuatro preguntas del
encargo, en orden.

## 0 · Cómo se midió

- Lectura sobre los ficheros de `origin/main` (nunca el árbol de trabajo local, que puede ir
  commits por detrás — trampa de `00-normas-comunes.md` A1), dentro del worktree propio
  `cobroflash-jv3` (rama `scrum-998-bloqueo-foral-medicion`), creado a petición del orquestador
  tras encontrar el árbol compartido con cuatro sesiones a la vez.
- Búsqueda por `git grep` de palabra foral/territorio en TODO `src/` y `public/` (censo, no
  muestreo), con control del patrón "un prefijo no es un nombre" (`00-normas-comunes.md` A3):
  la primera pasada con `araba` como substring casaba dentro de `declaraba`/`disparaba`/etc. —
  descartado a mano, comprobado línea por línea, cero coincidencias reales.
- Lectura completa de los flujos de alta (`register.html`, `onboardingView.js`), del modelo de
  datos (`prisma/schema.prisma`, modelos `Merchant` y `Customer`), del gate de emisión
  (`emission.service.ts`) y del checklist de "lista para cobrar" (`settingsView.js`).
- Comandos exactos, reproducibles desde la raíz del repo sobre `origin/main`:
  ```
  git grep -n "<input\|<select" public/register.html
  git grep -n -i -E "\bforal\b|ticketbai|bizkaia|gipuzkoa|\baraba\b|\bnavarra\b" -- src public
  git grep -n -i "provincia|postal|region|comunidad" -- public/register.html public/dashboard/js/onboardingView.js
  git grep -n "billingProvince|billingPostalCode" -- prisma/schema.prisma
  git grep -n "createField(\"Dirección fiscal\"" -- public/dashboard/js/settingsView.js
  git grep -n "fiscalReady" -- public/dashboard/js/settingsView.js
  ```
- Población de la primera búsqueda (censo de `foral`/territorio): **2 carpetas recorridas enteras
  (`src/`, `public/`), 0 coincidencias reales** (tras descartar el falso positivo del prefijo). No
  es una muestra: es `git grep` sobre el árbol completo de esas dos carpetas.

## 1 · ¿El alta pregunta la región, la provincia o el código postal? — **NO**

**El registro (`public/register.html`) pide tres campos y nada más:**
```
28:  <input type="text" id="name" .../>       Nombre de tu negocio
32:  <input type="email" id="email" .../>     Tu email
36:  <select id="country"> MX/CO/ES/AR/PE/CL  País
```
Ni provincia, ni código postal, ni comunidad autónoma. La única granularidad geográfica es el
**país** (6 opciones, ninguna infra-nacional).

**El onboarding posterior (`public/dashboard/js/onboardingView.js`) tampoco la pide**: nombre del
negocio, oficio (7 opciones), país (mismas 6), WhatsApp, y —en un paso posterior— el número de la
última factura del año en curso. Cero campos de dirección, provincia o CP.

**Servidor: lo que de verdad se guarda al crear la cuenta** (`src/modules/auth/domain/auth.service.ts:341-353`,
`prisma.merchant.create`): `name`, `email`, `country`, `status`, `plan`, `planExpiresAt`,
`referralCode`, `referredBy`, `acquisitionSource`. Ninguna dirección.

**Tampoco existe más adelante, en los datos fiscales de Configuración** (donde sí se pide algo
parecido a una dirección): `settingsView.js:279` — `createField("Dirección fiscal", "address", ...)`
es un ÚNICO campo de texto libre. `prisma/schema.prisma` confirma que `Merchant.address` es
`String?` sin estructura (una sola columna, sin provincia/CP/ciudad separados). Lo único
"geográfico" estructurado en todo el modelo `Merchant` es `country String` (obligatorio, a nivel
país) — no hay `province`, `postalCode` ni `city` en `Merchant`. (Sí existen `billingProvince` y
`billingPostalCode`, pero son del modelo `Customer` — la dirección de facturación del CLIENTE del
merchant para el documento, SCRUM-579 — no del merchant mismo, y no las lee ningún gate fiscal del
merchant.)

**Conclusión de la pregunta 1, y es la respuesta más directa al ticket:** YaQu no tiene, en ningún
punto del recorrido de alta ni de configuración, un dato con la granularidad necesaria (provincia,
CP, o "¿es usted foral?") para saber si un merchant es de País Vasco o Navarra. Con un único campo
`address` de texto libre y sin validar, **no hay forma programática de derivarlo hoy**, ni aunque
alguien lo quisiera consultar a mano fila por fila con fiabilidad.

## 2 · ¿Dónde distingue YaQu hoy a un merchant foral? — **EN NINGÚN SITIO**

Censo por `git grep`, insensible a mayúsculas, sobre `src/` y `public/` enteros:

```
foral | ticketbai | bizkaia | gipuzkoa | araba | navarra
```

**0 coincidencias reales** (la primera pasada con el patrón `araba` sin límites de palabra casaba
por sustring dentro de `declaraba`, `disparaba`, etc. — el patrón "un prefijo no es un nombre" de
`00-normas-comunes.md` A3/A10; con `\b` de por medio, cero). Ninguna palabra de la familia
"foral"/Euskadi/Navarra/TicketBAI aparece en NINGÚN fichero de servidor ni de pantalla.

**El gate que hoy bloquea la facturación española es genérico por PAÍS, no por territorio**
(`src/modules/invoicing/domain/emission.service.ts:36-41`, `getEmissionMode`):
```ts
export function getEmissionMode(m: MerchantLike): EmissionMode {
  const country = (m.country ?? '').trim().toUpperCase();
  if (country && country !== 'ES') return 'fiscal';
  if (isDemoMerchant(m)) return 'demo';
  return isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }) ? 'fiscal' : 'receipt';
}
```
Solo mira `country` (ES/no-ES), si es el merchant demo, y el flag `INVOICING_ES_ENABLED`
(`src/core/flags.ts:16`, hoy `false` por defecto). No hay ninguna tercera rama para PV/Navarra.

**Lo que dice el máster sobre esto es una DECISIÓN, no una construcción:**
- Regla 33 (`docs/YAQU_MASTER.md:248`): *"Onboarding bloquea facturación ES a domicilios forales
  (PV/Navarra) con aviso digno; TicketBAI = cajón F3."*
- B2.6, checklist regulatorio (`docs/YAQU_MASTER.md:105`): *"Gate foral: domicilio fiscal en País
  Vasco/Navarra → facturación ES off + aviso TicketBAI (regla 33)."* Está en una lista de
  bloqueantes junto a SIF-1 y Connect — es un requisito escrito, sin ticket de construcción
  asociado y sin ✅.
- TicketBAI en sí está en el cajón F3 (`docs/YAQU_MASTER.md:1717`): *"TicketBAI foral | Cajón F3 |
  ≥25 solicitudes forales"* — y hoy, sin forma de contar merchants forales (pregunta 1), ese
  contador de 25 solicitudes no tiene de dónde salir.

Es decir: **la regla 33 está DECLARADA en el máster desde antes de hoy, y no tiene ningún mecanismo
que la cumpla.** No es que el gate falle silenciosamente: no existe ninguna línea de código que lo
intente.

## 3 · ¿Qué ve exactamente ese merchant hoy? — el texto literal

Como no hay ninguna rama foral, un profesional de Bilbao ve **exactamente lo mismo que cualquier
profesional español**, sin ningún aviso adicional sobre su territorio ni sobre TicketBAI:

**a) El checklist de "Tu cuenta, lista para cobrar"** (`settingsView.js:1249,1284-1287`), fila
"Datos fiscales" (depende solo de `legalName && taxId && address`, nada geográfico):
- Si le faltan datos: **"Sin ellos, el documento tras el pago es un justificante de cobro"**
- Si los tiene completos (aunque su `address` diga "Bilbao"): **"Completos — listos para facturar
  cuando toque"** — el checklist le dice que está LISTO, sin distinguir que TicketBAI no existe
  para él.

**b) Si de verdad genera un documento tras el cobro**, con `INVOICING_ES_ENABLED` en OFF (estado
real hoy, `src/core/flags.ts:16`), `getEmissionMode` devuelve `'receipt'` y el documento es un
**justificante**, no una factura (`invoiceDetailView.js:90-94,138`):
```
headTitle.textContent = 'Justificante de cobro';
headSub.textContent   = 'Detalle y acciones del justificante.';
badge.textContent     = 'JUSTIFICANTE';
```
Ningún texto menciona su territorio, ni TicketBAI, ni que su caso es distinto al de un profesional
de Madrid.

**⚠️ Hallazgo colateral, medido al responder esta pregunta, y que NO es de mi carril (J1/SIF-1,
regla 9 — se reporta, no se arregla):** el máster amplió la regla 24 el 18-sep (SCRUM-612): con el
interruptor en OFF, YaQu no debería emitir NINGÚN documento (ni siquiera el justificante) ni cobrar
por YaQu de ningún tipo (`docs/YAQU_MASTER.md:980`). Pero **el código de `getEmissionMode` y del
flujo de justificante no ha cambiado desde el V0-0 original** (`git log --oneline -- 
src/modules/invoicing/domain/emission.service.ts` → último commit `2aef59b6`, anterior a SCRUM-612).
Los tres PR de SCRUM-825 mergeados hasta hoy (#1171, #1182, #1193) **son solo documentación y SQL de
borrado** (`git show --stat` de cada merge: únicamente `docs/master/SCRUM-825.md` y dos `.sql`), sin
tocar ni una línea de `src/`. El propio máster lo marca: **V0-0 sigue en 🟡** (`docs/YAQU_MASTER.md:959`)
y dice explícitamente *"Lo ejecuta SCRUM-825; hasta que esté en `main`, V0-0 vuelve a 🟡"*. Es
territorio de J1 (`jv-j1`, ya trabajando SCRUM-955); lo dejo apuntado porque es la respuesta exacta
a "qué ve el merchant hoy", no porque vaya a tocarlo.

**c) Nada en el bot de WhatsApp, en la landing ni en `docs/microcopy/` menciona lo foral**: mismo
censo de la sección 2 repetido sobre `docs/microcopy/` → 0 coincidencias; el catálogo de avisos del
semáforo fiscal (`public/dashboard/js/semaforoFiscal.js`, `AVISOS`) tiene 5 avisos con `avisoId`
(`ROJO_SIN_LINEAS`, `ROJO_ANULADA`, `ROJO_MESES_DISTINTOS`, `AMBAR_PLAZO_VENCIDO`,
`AMBAR_CLIENTE_SIN_NIF`) y ninguno es sobre territorio.

## 4 · SUELO — lo que NO miré

- **No consulté la base de datos de staging ni de producción** para ver si algún merchant real
  tiene ya una dirección en País Vasco o Navarra: no hace falta para responder "qué hace el
  código", y tocar esas bases pide turno y no está autorizado para esta tarea (STOP de datos).
- **No revisé Jira más allá de lo que ya traía el encargo** (SCRUM-335, 328, 332, 334): no abrí un
  censo nuevo de tickets con "foral"/"TicketBAI"/"Bizkaia" en el texto. Si existe alguno, esta
  medición no lo vería — es una búsqueda en código y en el máster, no en Jira.
- **No revisé la landing pública completa palabra por palabra** (`public/index.html`, `precios.html`)
  buscando alguna mención suelta de "toda España" o similar que pudiera leerse como promesa
  implícita al foral: solo hice el censo de palabras foral/TicketBAI (sección 2), que ahí también
  dio 0. Una afirmación tipo "cobra desde cualquier lugar de España" sin la palabra "foral" no la
  cazaría este censo — lo dejo dicho como límite del instrumento, no como verde.
- **No comprobé el flujo del bot de WhatsApp en ejecución** (solo el código fuente de
  `whatsappBot/` por `git grep`): no lo arranqué contra un merchant real para ver si en algún punto
  pregunta domicilio. El censo por código es consistente con que no lo hace, pero no es lo mismo
  que verlo correr.

## 5 · Respuesta directa a la pregunta del ticket

**El riesgo que Javier quería confirmar o descartar SE CONFIRMA.** Un electricista de Bilbao puede
darse de alta, completar el onboarding, montar su catálogo, mandar presupuestos, y su checklist de
Configuración le dirá "Completos — listos para facturar cuando toque" en cuanto rellene nombre
legal + NIF + una dirección de texto libre — sin que YaQu, en ningún momento, sepa ni le diga que
su territorio no tiene TicketBAI construido. Se entera, si acaso, en el mismo punto que CUALQUIER
profesional español hoy: el gate genérico de la regla 24 (interruptor `INVOICING_ES_ENABLED` en
OFF), que no menciona su región y que ya bloquea a todo merchant ES real, foral o no. No hay un
aviso "digno" específico (regla 33) porque no hay ningún mecanismo que distinga su caso del de
cualquier otro.

Esto **no es un fallo técnico**: es exactamente el "peor sitio" que Javier señaló en el encargo — la
decisión de no vender ahí vive hoy solo en el máster, nunca llega al profesional.

---

# SCRUM-998b · J6 confirma el PASO 0 por su cuenta, corriendo, no leyendo el anexo de arriba

**Medido contra:** `origin/main` = `9ba9ac75559c1cd027e49839338c9e01b1e59b36` · 2026-09-22T08:09:08Z

**Puesto:** J6 · calidad y seguridad (equipo de Javier) · **Rama:** `scrum-998b-j6-confirma-paso0`
**Gate:** LECTURA. Cero líneas de `src/`, `public/`, `prisma/` o del máster tocadas.

> El ticket asigna el PASO 0 a J6, no a J3 (dueña de la construcción posterior). El anexo de arriba
> ya lo midió J3 en su primera sesión, el 21-sep. Este anexo es la comprobación independiente que
> pide el encargo: cada resultado se ha vuelto a correr con mis propios comandos, sin partir de las
> citas de J3, y solo después se ha comparado. Coincide en las cuatro preguntas — no hay ninguna
> discrepancia que reportar.

## 1 · ¿Pregunta región/provincia/CP? — confirmado NO

```
git show origin/main:public/dashboard/js/onboardingView.js | grep -niE "provincia|postal|region|c[oó]digo postal|Pa[ií]s Vasco|Navarra|foral"
```
0 coincidencias. Los únicos campos del wizard (leídos línea a línea, `onboardingView.js:115-134`):
"Nombre de tu negocio", "Tu oficio" (selector de 7 gremios), "País" (selector de 6 países: España,
México, Colombia, Argentina, Perú, Chile — sin nivel infra-nacional) y "Tu WhatsApp". `register.html`
no se volvió a leer (ya lo citó J3 con línea exacta); lo que sí repetí es el modelo de datos:

```
git show origin/main:prisma/schema.prisma | grep -n "province\|postalCode\|region"
```
Solo aparecen `billingProvince`/`billingPostalCode` en `Customer` (dirección de facturación del
CLIENTE del merchant, SCRUM-579) y ninguno en `Merchant`. `Merchant` solo tiene `country String`
(obligatorio, a nivel país) y `address String?` (texto libre, sin estructura). Control positivo: la
misma búsqueda SÍ encuentra `billingProvince`/`billingPostalCode` en `Customer` — el patrón no está
ciego, es que `Merchant` de verdad no los tiene.

## 2 · ¿Distingue YaQu a un merchant foral en algún sitio? — confirmado NO

```
git show origin/main:src/modules/invoicing/domain/emission.service.ts | sed -n '36,41p'
```
`getEmissionMode` solo mira `country` (ES/no-ES), `isDemoMerchant` y el flag `INVOICING_ES_ENABLED`.
Ninguna tercera rama. Censo propio, repetido sobre `src/` completo (no solo el fichero de emisión):

```
git grep -n -iE "\bforal\b|ticketbai|bizkaia|gipuzkoa|\baraba\b|\bnavarra\b" origin/main -- src public
```
0 coincidencias reales (repetí también con `\b` para no repetir el falso positivo de sustring que ya
cazó J3 con `araba`). Regla 33 del máster (`docs/YAQU_MASTER.md` L248, "Onboarding bloquea
facturación ES a domicilios forales... con aviso digno") sigue sin ningún mecanismo que la aplique:
0 líneas de código la implementan.

## 3 · ¿Qué ve el merchant hoy? — texto literal, verificado hoy 22-sep

```
git show origin/main:src/core/flags.ts | grep -n "INVOICING_ES_ENABLED"
git show origin/main:public/dashboard/js/invoiceDetailView.js | grep -n "Justificante de cobro\|JUSTIFICANTE"
git show origin/main:public/dashboard/js/settingsView.js | grep -n "Se emiten justificantes\|Nuevo justificante"
```
`INVOICING_ES_ENABLED` sigue `false` por defecto (`core/flags.ts:16`). El texto que ve CUALQUIER
merchant ES real (foral o no) al generar el documento sigue siendo el de `receipt`/justificante,
verbatim: `headTitle.textContent = 'Justificante de cobro'` (`invoiceDetailView.js:93`),
`badge.textContent = 'JUSTIFICANTE'` (`:138`), y en Ajustes `receipt: 'Se emiten justificantes de
cobro'` (`settingsView.js:39`). Confirmo lo que ya apuntó J3 como hallazgo colateral: la enmienda de
la regla 24 (SCRUM-612, "con OFF, ni documento ni cobro por YaQu") **ya está en el máster y en
`CLAUDE.md`** (fusionada hoy mismo por esta misma sesión vía `scrum-612c-enmienda-master`, ver
commit `fb59270d`), **pero el código de `emission.service.ts` sigue devolviendo `'receipt'`**, no
bloqueando. Ningún texto, ni el de hoy ni el que llegue cuando SCRUM-825 ejecute el cambio de código,
menciona el territorio: un merchant de Bilbao ve exactamente lo mismo que uno de Madrid en los dos
casos.

## 4 · SUELO — lo que esta sonda no pudo mirar

- Igual que J3: sin turno de staging/producción autorizado para esta tarea, no se consultó ninguna
  base — no hace falta para "qué dice el código", que es lo que pide la pregunta.
- No repetí el censo de `docs/microcopy/` ni de la landing pública palabra por palabra: J3 ya lo hizo
  y dio 0; no tenía motivo para dudar de esa parte y repetirla entera no habría añadido nada que la
  pregunta 2/3 no cubriera ya desde `src/`.
- No arranqué el bot de WhatsApp en ejecución, solo su código fuente — mismo límite que declaró J3.

## Veredicto de J6 (PASO 0)

**CONFIRMADO, con verificación independiente.** Las cuatro respuestas de J3 se sostienen corriendo mis
propios comandos sobre `origin/main` de hoy: (1) el alta no pregunta región/provincia/CP y no hay
forma programática de saber quién es foral; (2) ningún fichero de `src/`/`public/` distingue un
merchant foral; (3) el texto que ve hoy cualquier merchant ES real, foral o no, es el genérico de
`receipt`/justificante — sin mención a su territorio, y desactualizado además respecto a la regla 24
ya enmendada (eso es de J1/SCRUM-825, se reporta, no se toca); (4) el suelo de ambas mediciones es el
mismo y está declarado. No hay ninguna construcción que autorizar desde este PASO 0: ni texto nuevo,
ni bloqueo de alta, ni `prisma/schema.prisma`.

## Lo no tocado

`src/`, `public/`, `prisma/`, `docs/YAQU_MASTER.md`, `CLAUDE.md`: ni una línea. Solo `git show`/`Read`/
`Grep` sobre `origin/main`. Ninguna base de datos, ninguna ejecución que module comportamiento.
