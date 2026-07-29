# SCRUM-224 · ¿Llega un hotfix al usuario? — lo que el service worker hace de verdad

> Medido el **29-jul-2026** leyendo el código, no de memoria. Sirve para responder sin volver a
> discutirlo: **«¿esto que acabo de desplegar lo está viendo ya el profesional?»**

## Lo primero, porque cambia el planteamiento del ticket

**La premisa «el service worker sigue sirviendo el JS viejo» NO se sostiene contra el código de
hoy.** `sw.js` es **network-first** desde SCRUM-45 ([sw.js:70-82](../../public/sw.js#L70-L82)):
pide a la red primero, devuelve lo que llega y con ello refresca la caché; **solo cae a caché si
la red falla**. El propio fichero documenta que el cache-first *era* el bug
([sw.js:2-5](../../public/sw.js#L2-L5)).

**Y tampoco se puede cerrar el ticket como «ya resuelto».** El 29-jul pasó de verdad: con el
fichero corregido en el servidor, el navegador seguía ejecutando el viejo. Hay dos afirmaciones
en conflicto —el código dice una cosa, el campo dice otra— y **la que no se puede resolver
leyendo código es la del campo**: hace falta saber qué SW estaba activo en ESE navegador y si la
petición salió `200`, `304` o `(from ServiceWorker)`. Eso no lo tengo.

Lo que sigue separa **lo que el código garantiza** de **lo que no**, para que la próxima vez la
pregunta se resuelva mirando el sitio correcto.

## Lo que el código SÍ garantiza

| Pieza | Dónde | Qué garantiza |
|---|---|---|
| Estáticos network-first | [sw.js:70-82](../../public/sw.js#L70-L82) | Una **recarga** con red trae el fichero nuevo. La caché es solo respaldo offline |
| `skipWaiting()` en install | [sw.js:45](../../public/sw.js#L45) | Un SW nuevo **no espera** a que se cierren pestañas |
| `clients.claim()` en activate | [sw.js:53](../../public/sw.js#L53) | Toma el control de las páginas ya abiertas |
| Purga de cachés viejas | [sw.js:51-53](../../public/sw.js#L51) | Al activar, borra toda caché ≠ `yaqu-v4` |
| `/version` fuera del SW | [sw.js:63](../../public/sw.js#L63) | El poll de versión **siempre** habla con el servidor |
| Estáticos con revalidación | [app.ts:139](../../src/app.ts#L139) | `express.static` por defecto → `max-age=0` + ETag: el navegador revalida, no sirve viejo en silencio |
| Aviso con acción | [app.js:408-432](../../public/dashboard/js/app.js#L408) | Toast **persistente con botón «Recargar»**, no un log |

**Traducción:** para un usuario con red y con el SW de SCRUM-45 activo, **recargar basta**. Eso
sigue siendo cierto.

## Lo que el código NO garantiza — y aquí está el hueco real

### 1 · La app abierta no se recarga sola

El SW no puede hacer que una pestaña ya cargada vuelva a pedir su JS. Eso lo hace el aviso de
versión… **y el aviso tiene una carrera que salta justo en un hotfix.**

`checkAppVersion` fija la línea base con la **primera lectura buena** de `/version`
([app.js:405](../../public/dashboard/js/app.js#L405)). Si esa primera lectura **falla** —y el
momento más probable de que falle es **un deploy en vuelo**, o sea exactamente cuando sale un
hotfix— `appBuildId` se queda a `null`, y la línea base la fija la siguiente lectura buena, que
**ya trae el BUILD_ID nuevo**. A partir de ahí `v === appBuildId` para siempre:

> **El aviso no sale nunca, y el usuario se queda con el JS viejo sin que nada se lo diga.**

**Corregido a medias en este ticket, y digo cuánto:** mientras no hay línea base se reintenta
cada **5 s** en vez de cada 90 ([app.js:437-442](../../public/dashboard/js/app.js#L437)), así que
la ventana pasa de minuto y medio a segundos. **No lo cierra del todo**: la página sigue sin
saber con qué build la sirvieron.

**El cierre completo, propuesto y NO hecho:** sellar el `BUILD_ID` dentro del HTML servido (una
ruta que renderice `index.html` con el build inyectado, en vez de servirlo estático). Entonces la
línea base es un dato, no una inferencia, y la carrera desaparece. Es cambio de superficie
pública → tu OK.

### 2 · El aviso se enseña UNA vez

`versionToastShown = true` ([app.js:408](../../public/dashboard/js/app.js#L408)) y no vuelve a
aparecer en esa sesión de página. Si el usuario lo ignora, no hay segundo intento.

### 3 · Sin red, se sirve la caché

Correcto y deseado, pero significa que un usuario offline **está viendo código viejo por
diseño**. Con el flag fiscal encendido eso deja de ser inocuo.

## Cómo se responde la pregunta la próxima vez

Si alguien vuelve a ver un fichero viejo, **estos tres datos lo cierran en un minuto** — y los
tiene que sacar quien está delante del navegador:

1. **DevTools → Application → Service Workers**: ¿qué SW está *activated*? ¿hay uno *waiting*?
2. **DevTools → Network**, recargando: la petición del `.js` — ¿`200`, `304`, o `(from ServiceWorker)`?
3. **`fetch('/version').then(r=>r.json())`** en la consola vs. lo que muestra el toast.

Con eso se distingue **SW viejo** de **caché HTTP** de **página que nunca recargó**, que son tres
causas distintas con tres arreglos distintos. Sin eso, se discute.

## El martillo, y cuándo hace falta

Lo que se hizo el 29-jul (Unregister + Clear site data + cerrar todas las pestañas) **funciona
siempre**, pero es diagnóstico, no producto: **un merchant no va a hacer eso**. Si vuelve a hacer
falta, no es «ya está resuelto»: es que hay una cuarta causa que no está en esta tabla, y
entonces este documento se queda corto y hay que ampliarlo con lo medido.
