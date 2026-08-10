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
