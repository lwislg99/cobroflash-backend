# SCRUM-360 · H5 fase 1 — saber cuántos tienen la app instalada

**Medido contra:** `origin/main` = `e171c752f61231bec77dc2c22ecc7f82167d964c` · 2026-08-10T19:46:55+01:00

**10-ago-2026** · sesión 1 · **UI vanilla (regla 4)** · sin gate, corre en `npm test`

Un profesional en iPhone firma un albarán sin cobertura un viernes, no abre la aplicación en una
semana, y **iOS borra el origen entero** —service worker, caché e IndexedDB— llevándose la firma
pendiente. No se entera él, y no nos enteramos nosotros.

🔴 **Y la mitigación no es código: las aplicaciones añadidas a la pantalla de inicio están EXENTAS
de ese borrado.** Una pestaña normal, no. Así que la protección real es que la aplicación esté
instalada — y hoy no sabemos en cuántos lo está.

## PASO 0

* **`docs/master/SCRUM-360.md` no existía en `main`** (censo de SCRUM-388: `NADA`, tres fuentes).
* **La premisa sigue siendo cierta.** Medido: el dato **no se registra en ninguna parte**. La única
  aparición de `display-mode`/`navigator.standalone` en todo `public/` era `voiceInput.js:20-21`, y
  en `src/` no hay **ni una**.
* **ENTRADA: no hay pantalla.** El dato lo produce el navegador al cargar el dashboard; no se llega
  a él por una ruta.
* **MECANISMO:** existía la detección (`isStandalonePWA()`, H0), encerrada en la IIFE de
  `voiceInput.js` y sin publicar. No había que construirla: había que **sacarla y darle sitio**.

## ① La detección, en un solo sitio

`entornoDeLaApp()` en `public/dashboard/js/api.js`, publicada en `window`.

**Vive ahí y no en un fichero nuevo, por dos motivos medidos:** `api.js` es el **primer** script del
dashboard —así que la función existe antes que cualquier vista— y **ya está en el precache del
service worker** (`sw.js:23`). Un fichero nuevo habría que añadirlo a ese precache, y **el service
worker no se toca en esta fase**.

🔴 **La copia NO se conserva.** `voiceInput` ahora sólo lee. Sacar algo a un sitio compartido y
dejarse el original dentro es exactamente el defecto que SCRUM-436 y SCRUM-447 acaban de cerrar con
los formateadores de euros, así que hay un test que **cuenta sobre el árbol** que la detección
aparece en un único fichero — y que ignora los comentarios, porque mencionar no es hacer.

### Tres estados, no dos

| estado | significa |
|---|---|
| `instalada` | se pudo evaluar y la respuesta es sí |
| `pestana` | se pudo evaluar y la respuesta es no |
| **`desconocido`** | **no se pudo evaluar** |

**«No está instalada» y «no supe mirar» son lo contrario:** el primero dice que hay riesgo de
perder una firma, el segundo no dice nada. Un booleano los colapsa y produce un recuento tranquilo
y falso — parecería que sabemos que N están en pestaña cuando no pudimos preguntárselo a nadie.

Las **dos vías** hacen falta: `display-mode: standalone` es el estándar, y `navigator.standalone`
es **la única que responde en Safari de iPhone** — el caso peor de H0 y justo el aparato que sufre
el borrado.

## ② 🔴 Registrar el dato — PARADO: hace falta una columna, y es tuya

Se midió dónde cabría con lo que hay hoy. **No cabe en nada existente**, y no se inventa un sitio
para que quepa:

| sitio evaluado | por qué NO |
|---|---|
| `AuditLog.meta` (Json) | Es el registro **fiscal y de derechos RGPD**: `factura_anulada`, `datos_exportados`, `cambio_flag`… Su `AuditAction` es una **unión cerrada** y su propio código dice que *«un registro de auditoría no se reescribe»*. Una carga de dashboard no es un hecho auditable, y escribir una fila por visita contaminaría un registro con retención legal. |
| `Event.payload` (Json) | Atado a `chargeId`: es el diario de un **cobro**, no de una sesión. |
| `LegalAcceptance.userAgent` | Registro de aceptación legal, se escribe **una vez** y no es telemetría de sesión. |
| `AuthSession` | Es el sitio conceptualmente correcto —una fila por sesión, que es la granularidad del riesgo— pero **no tiene ningún campo libre**: `id`, `merchantId`, `teamMemberId`, `token`, `type`, `expiresAt`, `usedAt`, `createdAt`. |

### La propuesta, para que decidas

```prisma
model AuthSession {
  // …
  instaladaPwa  Boolean?  @map("instalada_pwa")
}
```

* **`Boolean?` y no `Boolean`**: `null` = **desconocido**, que es el tercer estado y el que no se
  puede perder. Un `Boolean` con default `false` reintroduciría exactamente la mentira que la
  función evita.
* **En `AuthSession` y no en `Merchant`**: el riesgo es **por dispositivo**, no por profesional. Uno
  que use el iPhone instalado y el portátil en pestaña tiene el riesgo sólo en uno de los dos, y en
  `Merchant` ese matiz se pierde al pisarse.
* **Es aditiva y anulable**, así que no rompe filas existentes.

**No se ha tocado `prisma/schema.prisma`.** Y sin columna no se ha construido tubería: un endpoint
que reciba el dato y no lo guarde es una tubería a ninguna parte.

## Verificado en rojo — con post-condición de que la mutación llegó al disco

| inyección | lo que dijo |
|---|---|
| se quita **la vía de Safari** | *«un iPhone con la app instalada se está contando como pestaña: `navigator.standalone` es la única vía que responde en Safari, y sin ella el recuento sale al revés justo donde importa»* |
| **el suelo**: «no se pudo evaluar» pasa a `pestana` | *«SE ESTÁ REGISTRANDO «pestaña» SIN HABER PODIDO MIRAR… Confundirlos da un recuento tranquilo y falso, que es peor que no tener recuento»* |
| **la copia vuelve** a `voiceInput` | *«la detección aparece en 2 ficheros: api.js, voiceInput.js. Dos detecciones del mismo hecho derivan en silencio»* |

Con su control positivo por separado —las dos vías, cada una sola— y el **negativo**: sacar la
función de la IIFE **no cambia la entrada de voz**; el caso «no se pudo evaluar» sigue dando
`false`, así que el dictado no se apaga sin motivo.

## El hueco declarado

🔴 **Nada de esto se ha probado en un iPhone real.** El borrado de origen a los 7 días **sigue sin
medirse y no se estima** (AB6, hueco humano). Lo que esta fase entrega es la capacidad de
distinguir los tres estados, no la prueba de que iOS se comporte como está documentado.

Y el dato **todavía no se recoge**: hasta que exista la columna, `entornoDeLaApp()` se puede llamar
pero nadie la llama. **Mencionar no es hacer**, y aquí la superficie que la consuma es la fase 2.

## Lo que NO se ha tocado

El service worker · la cola (no existe) · `prisma/schema.prisma` · el camino de emisión · el aviso
de instalación, que es fase 2 y necesita microcopy aprobada.

## Ficheros

* `public/dashboard/js/api.js` — `entornoDeLaApp()` y sus tres constantes.
* `public/dashboard/js/voiceInput.js` — pasa a delegar; la copia se retira.
* `tests/scrum360-entorno-instalada.test.mjs` (nuevo, 8 tests, sin gate).

---

# SCRUM-360 · H5 **fase 2** — guardar el entorno

**Medido contra:** `origin/main` = `e928472efd9acd2d377f5b6f44a5cda39ed69745` · 2026-08-10T23:54:31+01:00
**Tanda:** 2940 tests · 2866 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

**11-ago-2026** · Cierra lo que la fase 1 dejó parado: la columna ya existe (SCRUM-449, aplicada en
las tres bases y en el esquema) y `entornoDeLaApp()` ya estaba construida **y sin llamar**.

## PASO 0

* **`docs/master/SCRUM-360.md` SÍ existía en `main`** — es la entrada de arriba. **Documenta la
  fase 1 y dice explícitamente que la 2 está parada** («sin columna no se ha construido tubería»),
  así que no documenta lo que este encargo pide y no había que parar.
* **La premisa se sostiene, medida sobre `origin/main`:** `entornoDeLaApp` aparece en dos ficheros
  —`api.js`, que la define, y `voiceInput.js`, que la lee para el micrófono— y **nadie la manda a
  ninguna parte**. La columna está en el esquema (`instaladaPwa Boolean?`).
* **ENTRADA:** no había. Se crea `POST /admin/entorno`.

## 🔴 EL AVISO QUE VA ANTES DE QUE EXISTA EL DATO

`AuthSession` tiene `expiresAt` y `usedAt`: **se crea una fila por login** y caducan. Un profesional
que entra diez veces desde el mismo iPhone instalado deja **diez filas**, y el modelo **no tiene
ningún identificador de dispositivo** que diga que son el mismo teléfono.

> **El número que sale de aquí es «qué proporción de SESIONES se abren desde una app instalada». NO
> es «cuántos profesionales la tienen instalada». Quien entra mucho pesa más.** Para lo segundo hay
> que agregar por `merchantId`, y es otra consulta y otro número.

Si alguien publica el segundo número habiendo contado el primero, habremos hecho exactamente lo que
este dato venía a evitar.

## Cómo se eligió el camino — midiendo, no eligiendo

La otra opción era colgarlo de `/admin/me`, que **ya se pide en cada arranque** y saldría gratis en
número de peticiones. Se descarta por dos motivos, y el segundo decide:

1. Es un **GET**, y esto **escribe**.
2. 🔴 **`/admin/me` es la puerta de arranque y su fallo echa al profesional a `/login.html`** —
   medido en `app.js:6-7`: `catch { window.location.href = '/login.html'; return; }`. Una escritura
   de **telemetría** no puede tener la capacidad de cerrarle la sesión a nadie. Acoplar lo
   prescindible a lo imprescindible siempre se paga en la dirección mala.

**Coste aceptado y dicho:** una superficie más que mantener y una petición más por arranque. Va
suelta, sin `await`, y si falla la app ni se entera.

`requireAuth` pasa a exponer **`req.sessionId`**: la fila ya está cargada ahí, así que no cuesta
ninguna consulta, y sin ella habría que resolver la cookie por segunda vez.

## Las dos decisiones del fundador, convertidas en mecanismo

**① «El último entorno visto», y se escribe solo cuando CAMBIA.** Ni al crear la sesión —mentiría en
cuanto el profesional instale la app a mitad, **e instalar es justo la mitigación que queremos ver
ocurrir**— ni en cada visita, que sería una escritura por visita sobre una tabla caliente. Hay test
de las dos direcciones del cambio (`pestana`→`instalada` y al revés) y **test de que con el mismo
valor NO se escribe**: sin él, «solo cuando cambia» es un comentario y no un mecanismo.

**La comparación es del SERVIDOR contra lo guardado, no del cliente:** el navegador no sabe qué hay
en la fila, y hacérselo recordar en `localStorage` sería otra clave que purgar (SCRUM-457) y que
además mentiría en cuanto alguien cierre sesión en ese móvil.

**② `null` no se suma nunca a `false`.** `desconocido` se guarda **`null`**. Y el colapso puede
volver por la puerta de atrás de un operador: la comparación usa **`??` y no `||`**, con su test —
con `||`, un `false` guardado se leería como `null` y «pestaña» sobre «pestaña» se escribiría en cada
visita.

## Verificado

**10 tests.** **Cuatro rojos por el MECANISMO**, con post-condición en disco:

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | `desconocido` se guarda `false` | 🔴 «**SE ESTÁ CONTANDO UN «NO LO SÉ» COMO UN «NO»**… ese valor caerá del lado de «pestaña» y habremos fabricado el número tranquilo que este dato venía a impedir» |
| **R2** | se escribe siempre, no solo al cambiar | 🔴 ««instalada» sobre un `true` ya guardado dice ESCRITO» |
| **R3** | la fila no se actualiza nunca | 🔴 ««instalada»: no hay escritura» — es la decisión del fundador convertida en guard |
| **R4** | `||` en vez de `??` | 🔴 ««pestana» sobre un `false` ya guardado dice ESCRITO» |

**Control positivo:** los **tres** estados llegan a la fila como lo que son —`true`, `false`,
**`null`**— y con el `id` de la sesión correcta. **Control negativo:** con el mismo valor ya
guardado **no se escribe**, y la unión es **cerrada** (`'INSTALADA'`, `'standalone'`, `''`, `null`,
`true` se rechazan) — normalizar un valor desconocido a `desconocido` guardaría un `null` que
**parece medido y no lo es**. **Suelos, por separado:** la unión tiene que tener tres estados · la
fila tiene que haberse **leído** antes de afirmar que no se escribió · el escáner del servidor tiene
que encontrar `src/`.

**Y el camino ENTERO, no medio:** hay test de que el navegador **llama** al envío en el arranque, de
que usa `window.entornoDeLaApp()` —la de la fase 1, no una copia nueva— y de que la llamada va
**suelta, sin `await`**: telemetría que retrasa el arranque es telemetría que un día impide arrancar.
Y un guard de que **no ha nacido detección de entorno en el servidor**, que no tiene navegador al que
preguntar.

### Dos guards de la casa cayeron encima, y los dos pedían una decisión escrita

* **SCRUM-55** (toda ruta `/admin` declara rol): **no** se pone admin-only. Escribe el entorno de
  **la propia sesión** —el id sale de la cookie de quien llama—, así que no es una capacidad de
  administración; y dejarlo admin-only **dejaría sin medir justo a los técnicos**, que son los que
  más van a obra y por tanto los que más riesgo tienen. Va a `TECNICO_ALLOWED` con su motivo.
* **SCRUM-243** (lecturas sin comprobación de merchant): declarada, en la **misma categoría** que
  `auth.service` — «se busca por su propio identificador de sesión, no por merchant». El id **no
  viene del cliente**, así que no hay otra fila alcanzable; filtrar además por merchant no añadiría
  seguridad y **sugeriría que el id es un parámetro de entrada**, que es la lectura equivocada.

## Lo que NO cubre

* 🔴 **Nadie cuenta el dato todavía.** Esta fase lo **recoge**; contarlo y publicarlo es otra
  conversación — y cuando llegue, con el aviso de arriba delante.
* **No se ha probado en un iPhone real.** El borrado de origen a los 7 días **sigue sin medirse**, y
  no se estima. Lo que hay es la capacidad de distinguir los tres estados.
* **Las filas viejas se quedan en `null`**, indistinguibles de «no se pudo saber». No hay backfill
  posible: nadie le preguntó nunca a esos navegadores. Quien cuente tendrá que separar «`null` de
  sesión antigua» de «`null` medido», y **hoy no hay forma de distinguirlos** — el único
  discriminador aproximado es `createdAt` anterior a esta entrega.
* **El texto que le pide al profesional que INSTALE la app** —que deja de ser una sugerencia y pasa
  a ser condición para que el offline funcione— es la fase siguiente y necesita microcopy aprobada.
* **`navigator.storage.persist()` y la cuota**: fase siguiente.

## Ficheros (fase 2)

* `src/modules/auth/domain/entornoApp.service.ts` (nuevo) — la conversión pura y la escritura
  solo-si-cambia.
* `src/modules/auth/app/routes/entornoAdmin.routes.ts` (nuevo) · `src/app.ts` — `POST /admin/entorno`.
* `src/core/http/authMiddleware.ts` · `src/types/express.d.ts` — `req.sessionId`.
* `src/core/http/adminRouteDeclarations.ts` — la ruta, en `TECNICO_ALLOWED` con motivo.
* `public/dashboard/js/app.js` — `enviarEntornoDeLaApp()`, suelto, en el arranque.
* `tests/scrum360-entorno-guardado.test.mjs` (nuevo, 10) · `tests/scrum243-…` — la lectura declarada.
