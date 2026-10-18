# SCRUM-231 · CACHE-EDGE-1: la cabecera que no salía del repo era de Cloudflare

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** sin gate (documentación); el arreglo del valor
es acción del fundador en el panel de Cloudflare, no del repositorio

## El defecto

Producción servía los JS del dashboard con `Cache-Control: public, max-age=14400` — cuatro horas.
Sin fingerprint en el nombre del fichero, eso significa que **un arreglo urgente del front tarda
hasta 4 h en llegarle a un profesional que ya tiene la página abierta**, y sin ninguna señal de
que esté pasando. Con facturación y VeriFactu de por medio, «desplegado» y «en uso» no son lo
mismo.

Y lo que convertía esto en ticket propio: **esa cabecera no salía de ningún fichero del repo**.
`src/app.ts:186` es `app.use(express.static(publicDir))` sin opciones, cuyo default es
`max-age=0`. Quien fuera a arreglarlo lo buscaría en `app.ts` y perdería una hora.

## Cómo se identificó al culpable, que es la parte reutilizable

**Comparando el MISMO fichero por los DOS caminos**, en vez de razonar cuál de los tres
candidatos (Cloudflare / Railway / Express) era más probable:

| Camino | `Cache-Control` | `Server` |
|---|---|---|
| Origen `cobroflash-backend-production.up.railway.app/dashboard/js/api.js` | `public, max-age=0` | `railway-hikari` |
| `yaqu.app/dashboard/js/api.js` | `public, max-age=14400` | `cloudflare` |

Express emite exactamente su default y **Railway lo pasa intacto**. La reescritura ocurre en
Cloudflare. Los otros dos candidatos quedan descartados **por medición**, no por descarte lógico.

**Confirmado desde el otro lado con el patrón por tipo de recurso**, que es lo que convierte esto
en una causa y no en un candidato con buena pinta: lo que Express marca `no-store` (`/dashboard/`,
`/dashboard/index.html`, `/version`) llega **intacto** y sale `cf-cache-status: DYNAMIC`; lo que
Cloudflare cachea (`.js`, `.css`, `/sw.js`) sale reescrito a `14400` y `EXPIRED`. Es el
comportamiento de **Browser Cache TTL**, cuyo valor por defecto son 4 h = **14400 s clavados**.

## Por qué la respuesta es «revalidar» y no «cachear más»

**No hay fingerprint.** Los 31 `<script>` del dashboard son `./js/api.js`, `./js/homeView.js`…
sin hash y sin `?v=` (medido). Sin fingerprint **no existe forma de invalidar** una copia
cacheada: el fichero nuevo se llama igual que el viejo. Con fingerprint la respuesta sería la
contraria — cachear un año. Eso es cambio de build y tiene su ticket: **SCRUM-274**.

## Hallazgo: esto neutralizaba el arreglo de SCRUM-224

El service worker pasó a network-first en SCRUM-224, pero llama a `fetch(event.request)` **sin
opción `cache`** (`public/sw.js`), o sea con el modo por defecto, que **consulta la caché HTTP**.
Con una entrada fresca de 4 h, ese `fetch` se resuelve desde disco y la red no se toca: el
network-first no llega a ejercitarse.

> ⚠️ **Esta interacción está DEDUCIDA del comportamiento por defecto de `fetch`, no observada en
> un navegador.** Lo medido son las cabeceras y el código del SW. Se comprueba abriendo el
> dashboard con DevTools y mirando si la petición sale como *(disk cache)*. Queda anotado igual
> en SCRUM-224.

## Qué entrega este ticket, y qué no

**Entrega `docs/CACHE_POLICY.md`**: qué `Cache-Control` emite cada tipo de recurso, por qué, y
que **Cloudflare debe RESPETARLO**. Más el runbook **R19** con los dos `curl` de comprobación.

Eso es la mitad que faltaba: el valor lo cambia el fundador en el panel (Browser Cache TTL →
«Respect Existing Headers»), pero **arreglar el valor sin dejar la política escrita habría dejado
el ticket a medias** — el siguiente cambio de caché volvería a ser invisible desde el código.

**No entrega guard automático, y es deliberado.** Un test que compruebe la cabecera en producción
necesitaría red desde CI y su rojo dependería de un panel que este repo no controla: un check que
se pone rojo por algo que nadie puede arreglar desde un PR se acaba desactivando. La mitad que sí
vive aquí (`express.static` sin `maxAge`) es código revisable; la de Cloudflare se comprueba a
mano con los dos `curl`, y toca hacerlo tras cualquier cambio en el panel.

## Dato que conviene no olvidar

El `ETag` de `express.static` se calcula con **tamaño + mtime**, así que **cada deploy lo cambia
aunque el fichero sea idéntico**: tras desplegar, la primera carga se baja todo entero de todas
formas. `max-age=0` no ahorra tanto como parece, y es otro argumento para SCRUM-274.

## Cierre

El ticket **no se cierra con el clic en Cloudflare**, sino con la comprobación posterior: los dos
`curl` de `docs/CACHE_POLICY.md` tienen que devolver **lo mismo** por los dos caminos.

## SCRUM-231b · las descargas del panel salían sin `Cache-Control`

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:32:44Z (punta; hora de GitHub al escribir: 17:52:22Z)
A9: comprobación → `tests/scrum231b-exports-sin-cache-compartida.test.mjs`

Carril S1 (`exports.routes.ts` es contenedor de S1) · árbol `s1-231b` · rama `scrum-231b-exports-sin-cache-compartida`.
Encargo y autorización del orquestador (`cobroflash-backend-f3`), 18-oct-2026 ~17:45Z, tras una medida de S2 en
producción. El número de ticket lo decide el orquestador; esto va aquí porque es la regla de SCRUM-231 —**el origen
decide la caché**— aplicada a un sitio que la tabla de `docs/CACHE_POLICY.md` no cubría.

### Qué faltaba

Las respuestas de `/admin/exports/*` (los seis CSV del panel, `fees.csv`, `verifactu.xml`, `datos.zip`,
`datos.zip/info` y `portabilidad.zip`) salían del origen **sin `Cache-Control`**; los dos `.zip`, con `no-store` a
secas. Son datos de UN merchant —`customers.csv` lleva datos personales— y sus URL terminan en extensiones que
Cloudflare cachea por defecto. S2 midió en producción que esas respuestas quedaban en la caché del borde. Las sondas
de esa medida se quedan FUERA del repositorio, a propósito (el repo es público).

### Qué cambia

- `src/modules/exports/app/routes/exports.routes.ts`: un `router.use` al principio que pone
  `Cache-Control: private, no-store` en TODA respuesta del router, incluidas las de error y la ruta que se añada
  mañana. Los dos `.zip`, que lo reescribían a `no-store`, pasan a `private, no-store` (si no, pisaban al router).
- `docs/CACHE_POLICY.md`: la fila que faltaba.
- **La otra mitad NO es de este repo:** una regla de Cloudflare que no cachee `/admin/*`. La pide el orquestador
  al fundador. Las dos juntas lo cierran por los dos lados; ésta no espera a aquélla.

### Verificado, ejecutando

- **Rojo primero:** el test sobre `dist/` de la punta, SIN el arreglo: cae, con 9 de las 11 rutas sin cabecera
  y los dos `.zip` con `no-store` sin `private`. **Con el arreglo: 8 de 8.**
- El test lee las rutas del `stack` del router en `dist/`, no de una lista escrita a mano. Suelo: las seis CSV del
  panel están en esa lista y responden 200 como propietario, así que la cabecera se mide en la respuesta de la
  ruta y no en un 401.
- Los 30 ficheros de `tests/` que leen `exports.routes` o `/admin/exports`: **192 pasan, 0 fallan, 6 saltados**
  (gateados, con su motivo).
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147` (cliente de Prisma viejo; sin `prisma generate`).

### Lo que NO se ha medido

- **En yaqu.app, tras el despliegue:** que la cabecera llega al navegador y que el borde deja de guardar copia.
  Se mira cuando entre en `main`.
- **El resto de `/admin/*`:** barrido de las rutas del servidor que terminan en una extensión que Cloudflare
  cachea por defecto. Sólo salen éstas y los dos CSV de `librosAeat` (`expedidas.csv`, `recibidas.csv`), que ya
  llevan `no-store` (fiscal: no se tocan). Las rutas sin extensión Cloudflare no las cachea por defecto; si llevan
  cabecera o no, NO se ha mirado. La regla de Cloudflare sobre `/admin/*` es la que cubre eso.
