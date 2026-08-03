# SCRUM-274 · HUELLA DE CONTENIDO en los estáticos, sin build y sin bundler

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **Zona roja:** toca `src/app.ts`

**Medido contra:** `origin/main` = `bebf93ad35846b38526b5fa61e16934a06ffc5bd` · 2026-08-03T12:38:24+02:00

## El defecto, y su precio

Los 31 `<script>` del dashboard se referenciaban por su nombre pelado (`./js/api.js`), así que
**no había forma de invalidar una copia cacheada**: el fichero nuevo se llama igual que el viejo.
Por eso SCRUM-231 tuvo que dejarlos en `max-age=0` — correcto, y con un coste que se pagaba
entero en **cada** despliegue: el `ETag` de `express.static` es **tamaño + mtime**, o sea que un
deploy lo cambia aunque el contenido sea idéntico, y el navegador se rebaja los **33 ficheros,
~858 KB** sin comprimir. Quien lo paga es un profesional con la cobertura de un sótano.

## La decisión: por qué `?v=` y no ninguna de las tres vías obvias

Las tres opciones que se plantearon —**bundler**, **paso de build que renombre**, **generar los
nombres al desplegar**— quedaron descartadas antes de escribir una línea:

- Bundler y paso de build chocan con la **regla dura 4** del máster: *«Frontend vanilla (sin
  React/Tailwind/bundler/build)»*. Serían cambio de máster, no un ticket.
- Generar los nombres al desplegar saca la verdad del repo — **el defecto que acababa de cerrar
  SCRUM-231**, donde la política de caché vivía en un panel invisible desde el código.

Lo que apareció al medir es que **el punto de transformación ya existía y ya estaba memoizado**:
`dashboardHtmlSellado` (`app.ts`) lee el HTML del disco UNA vez y le sustituye el sello de build
de SCRUM-224b. Sellar ahí las referencias no añade un fichero al deploy ni un milisegundo por
petición. Es el cambio más barato que resuelve, y no toca la regla 4.

**Y que la query sirva de clave de caché está MEDIDO, no supuesto** (contra `yaqu.app`, con
Cloudflare delante): dos `?v=` distintos dan dos `MISS` —dos entradas distintas— y repetir el
primero da `REVALIDATED`. Sin esa medición, todo el diseño sería una creencia sobre un CDN ajeno.

## Cómo apunta el HTML sin que nadie mantenga nada

**Las 31 referencias se quedan exactamente como están en el fichero fuente.** El sellador recorre
el HTML servido y reescribe los `src`/`href` que resuelven a un fichero local. Nadie mantiene una
lista, nadie tiene que acordarse. Es la diferencia con las listas a mano que este proyecto lleva
la semana desmontando (SCRUM-172, 187, 199, 211, 225): si hubiera 31 referencias que actualizar,
un día no se actualizan.

Medido sobre el HTML real: **39 referencias · 3 externas · 36 locales · 36 selladas · 0 sin
resolver**. Y **ningún JS carga otro JS por su cuenta** (cero `import()` dinámicos), así que
reescribir el HTML cubre el 100 % de la superficie.

## `immutable` es una promesa comprobada, no una etiqueta

`setHeaders` no se conforma con «trae `?v=` algo»: **compara contra la huella real del fichero**.
Si no cuadra, no pone nada y manda el `max-age=0` de `express.static`.

Eso hace que **el modo de fallo sea «vuelve a como estaba»**, nunca «sirve contenido viejo un
año». Y cubre el caso de desarrollo: el HTML está memoizado, así que editar un `.js` deja la
huella vieja en la página — pero la del fichero ya es otra, no cuadra, y se cae a revalidar.

**Medido levantando un Express con la misma configuración** (no la app: su `.env` apunta a
producción):

| Caso | `Cache-Control` |
|---|---|
| HTML del dashboard | `no-store` |
| `api.js` sin query | `public, max-age=0` |
| `api.js` con huella **correcta** | `public, max-age=31536000, immutable` |
| `api.js` con huella **equivocada** | `public, max-age=0` |

## Service worker

`caches.match(event.request, { ignoreSearch: true })` — una línea, con su porqué escrito al lado
para que nadie la quite por parecer laxa. Sin ella el fallback offline **deja de existir**: el
`SHELL` se precachea con rutas peladas y la query entra en la clave de la Cache API igual que en
la de Cloudflare, así que un `caches.match` de la URL con huella no casaría nunca.

Es seguro **ahí y solo ahí**: es el camino de offline, al que solo se llega cuando la red ya
falló. Servir una versión anterior es lo que se quiere en ese caso — la alternativa no es «servir
la nueva», es no servir nada.

## Lo que NO entra

`index.html` y `/version` siguen `no-store`, sin excepción. La huella protege **lo que cuelga**
del HTML, no el HTML: si el punto de entrada se cacheara, el usuario quedaría apuntando a
ficheros viejos para siempre, y encima con URLs marcadas `immutable`. Sería convertir el problema
en permanente.

Las 3 referencias externas (Google Fonts) quedan fuera **por ser absolutas, no por una allowlist
de dominios**. La propiedad «apunta fuera de este servidor» la tiene la propia URL y no hay que
mantenerla; una lista de dominios envejecería igual que la lista que este ticket elimina.

## Verificado en rojo — y el primer intento fue el caso equivocado

**El rojo que NO valió, y queda escrito porque es la lección:** el primer intento fue añadir un
`<script>` nuevo sin huella al HTML. **Salió verde**, y con razón: el sellador se la puso solo.
«Alguien escribe un script sin huella» no es un estado que pueda existir mientras el mecanismo
funcione — el caso caía FUERA del mecanismo que el guard vigila (`ERRORES_ASESOR.md` #12, otra
vez). El guard no vigila el fichero fuente: vigila que **el sellador siga funcionando**.

Los tres rojos buenos, cada uno rompiendo un mecanismo distinto, revertidos y con el verde
comprobado después:

1. **`sellarReferencias` devuelve el HTML intacto** → cae «HAY UN ESTÁTICO SIN HUELLA».
2. **Referencia a un fichero que no existe** → cae «EL DASHBOARD APUNTA A UN FICHERO QUE NO
   EXISTE», nombrándola. Un `src` roto era invisible hasta que alguien abría la consola del
   navegador; ahora se cae en `npm test`.
3. **Extractor cegado** (los 31 `<script>` a comillas simples) → cae el SUELO: *«veo 5
   referencias locales y debería haber al menos 34»*. Sin ese suelo, el test 1 habría sido
   **cierto sobre un conjunto vacío** — un verde peor que un rojo.

**Suite ungated: 1102 tests, 0 fallos.**

## Hallazgo que NO se arregla aquí

El `SHELL` de `public/sw.js` son **31 rutas escritas a mano**, con un comentario que dice
*«alineado con los `<script src>` reales»* y **nada que lo ate**. Es un defecto latente anterior a
este ticket. Con `ignoreSearch` deja de morder hoy; se reporta para que el fundador decida si es
ticket.
