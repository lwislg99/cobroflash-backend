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
