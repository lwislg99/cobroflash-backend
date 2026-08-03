# Política de caché de YaQu — qué cabecera emite cada recurso, y quién manda

> **SCRUM-231.** Este documento existe porque la política vivía **en un panel invisible desde el
> código**. La cabecera que servía el JS del dashboard no salía de ningún fichero del repo, así
> que quien fuera a arreglarla la buscaría en `app.ts` y no la encontraría. Arreglar el valor sin
> arreglar eso dejaba el ticket a medias: el siguiente cambio de caché volvería a ser invisible.
>
> Derivado de `docs/YAQU_MASTER.md` (regla 35). Runbook de incidencias: `docs/RUNBOOKS.md`.

---

## La regla, en una línea

**El ORIGEN decide la caché. Cloudflare la RESPETA y no la reescribe.**

Todo lo que se quiera cambiar sobre caché se cambia en el repo. Si algún día una cabecera
observada no coincide con lo que dice este documento, **el sospechoso número uno es un ajuste de
Cloudflare que ha vuelto a pisar al origen** — no el código.

---

## Qué emite cada recurso, y por qué

| Recurso | Cabecera | Quién la pone | Por qué |
|---|---|---|---|
| `/dashboard/` y `/dashboard/index.html` | `no-store` | `src/app.ts` (explícito) | El HTML es el índice de los 31 `<script>`. Si se cachea, el navegador ni se entera de que hay JS nuevo. |
| `/version` | `no-store` | `src/app.ts` (explícito) | Es la señal de «hay versión nueva» que sondea el dashboard. Cachearla es cegar el aviso. |
| Páginas de cobro (`/pay/*`, `/recibo/*`) | `no-store, must-revalidate` | sus routers | Importes y estados de pago. Una versión vieja aquí es dinero mal mostrado. |
| Adjuntos de solicitudes | `private, max-age=86400` | `attachments.routes.ts` | `private` a propósito: son de un merchant, no de una caché compartida. |
| **JS, CSS e imágenes de `public/`** | **`public, max-age=0`** | `express.static` (su default) | **El punto de este ticket.** Ver abajo. |
| `/sw.js` | `public, max-age=0` | `express.static` | Hoy el `register` usa `updateViaCache:'imports'` y salta la caché HTTP para el script raíz, así que no es la causa activa — pero basta un `'all'` para convertirlo en un fallo permanente. Que revalide no depende de esa suerte. |

---

## Por qué los estáticos van a `max-age=0` y no a un año

**Porque no hay fingerprint en el nombre del fichero.** Los 31 `<script>` de
`public/dashboard/index.html` son `./js/api.js`, `./js/homeView.js`… sin hash y sin `?v=`
(medido, no supuesto). Sin fingerprint **no existe forma de invalidar** una copia cacheada salvo
esperar a que caduque: el nombre del fichero nuevo es idéntico al del viejo.

Con `max-age=0` el navegador revalida en cada carga y el `ETag` de `express.static` hace que la
respuesta normal sea un **304** barato. Es correcto y es lo que toca **mientras no haya
fingerprint**.

**El día que exista fingerprint (`app.a1b2c3.js`), esta tabla cambia:** esos ficheros pasan a
`max-age=31536000, immutable`, que es la respuesta buena. Es un cambio de build, no de cabecera →
**SCRUM-274**. Cuando entre, este documento se actualiza en el mismo PR.

> ⚠️ **Coste conocido de `max-age=0`, para que nadie lo descubra con sorpresa:** son hasta 31
> peticiones condicionales por carga del dashboard. Baratas (304 sin cuerpo), pero no gratis. Y
> el `ETag` de `express.static` se calcula con **tamaño + mtime**, así que **cada deploy lo cambia
> aunque el fichero sea idéntico**: la primera carga tras desplegar se baja todo entero de todas
> formas. Es correcto, y es otro argumento para SCRUM-274.

---

## Cloudflare: qué tiene que estar puesto

`yaqu.app` va detrás de Cloudflare, delante de Railway (medido: `Server: cloudflare`, `CF-RAY`,
`cf-cache-status`, y por debajo `x-railway-edge`).

**Ajuste requerido — Caching → Configuration → Browser Cache TTL = «Respect Existing Headers».**

Si en su lugar hay un valor fijo, Cloudflare **pisa** el `Cache-Control` del origen en todo lo que
cachea. Su default es **4 horas = 14400 s**, que es exactamente el valor que se observó en
producción y el origen de SCRUM-231.

**Lo mismo vale para cualquier Cache Rule o Page Rule** que fije Browser TTL sobre `/dashboard/*`
o sobre extensiones estáticas: si aparece una, gana ella y este documento deja de describir la
realidad.

### Cómo se comprueba, y es lo único que vale como evidencia

No sirve mirar el panel: hay que **comparar el MISMO fichero por los dos caminos**. Si coinciden,
Cloudflare está respetando el origen.

```bash
# 1) ORIGEN, sin Cloudflare por delante
curl -sSI https://cobroflash-backend-production.up.railway.app/dashboard/js/api.js | grep -i cache-control
# 2) El dominio real, con Cloudflare
curl -sSI https://yaqu.app/dashboard/js/api.js | grep -i cache-control
```

**Contraste que confirma desde el otro lado:** lo que el origen marca `no-store` (`/dashboard/`,
`/version`) tiene que llegar **intacto** y con `cf-cache-status: DYNAMIC`; lo que Cloudflare sí
cachea sale con `EXPIRED`/`HIT`. Si un recurso `no-store` apareciera reescrito, el problema es más
gordo que el de este ticket.

**Medición que originó SCRUM-231 (2-ago-2026), para tener el «antes» escrito:**

| Camino | `Cache-Control` |
|---|---|
| Origen `…up.railway.app/dashboard/js/api.js` | `public, max-age=0` |
| `yaqu.app/dashboard/js/api.js` | `public, max-age=14400` ← Cloudflare reescribía |

---

## Por qué esto no es afinar rendimiento

Durante hasta 4 horas tras un despliegue, un profesional con la pestaña abierta podía ejecutar
**lógica de cliente antigua contra un backend nuevo**, sin ninguna señal de que eso estuviera
pasando. Con facturación y VeriFactu de por medio, «desplegado» y «en uso» no son lo mismo.

Y se comía el arreglo de **SCRUM-224**: el service worker pasó a network-first, pero llama a
`fetch(event.request)` **sin opción `cache`**, o sea con el modo por defecto, que consulta la
caché HTTP. Con una entrada fresca de 4 h, ese `fetch` se resuelve desde disco y **la red no se
toca** — el network-first no llega a ejercitarse. *(Interacción DEDUCIDA del comportamiento por
defecto de `fetch`, no observada en un navegador: ver la nota en SCRUM-224.)*

---

## No hay guard automático de esto, y es deliberado

Un test que compruebe la cabecera **en producción** necesitaría red desde CI, y su rojo dependería
de un panel que este repo no controla: sería un check que se pone rojo por algo que nadie puede
arreglar desde un PR, y esos se acaban desactivando.

Lo que sí está atado es **la mitad que vive aquí**: `express.static` sin `maxAge` emite
`max-age=0`, y eso es código revisable. La mitad de Cloudflare se comprueba **a mano con los dos
`curl` de arriba**, y toca hacerlo después de cualquier cambio en el panel de caché.
