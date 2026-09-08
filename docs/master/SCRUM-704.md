# SCRUM-704 · El `body` de `apiRequest` no viajaba — y no fallaba nada

**Fecha:** 3-sep-2026 · **Carril:** dashboard (front) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `1f03815295aa3ba26920283f5daec16472d03854` · 2026-09-03T14:10:00+02:00

Salió como hallazgo de otro carril al cerrar la pantalla de asignar (SCRUM-650). Se reportó y no se
tocó; esto es el ticket.

## 1 · El defecto, medido antes de escribir nada

`apiRequest` **no serializa** el `body`, y `fetch` tampoco: a lo que no es un cuerpo válido le
aplica `String(x)`. De un objeto plano eso sale `"[object Object]"`.

```
new Request(url, { body: { direccion: 'Av. Rey Juan Carlos 145' } })  ->  "[object Object]"
con JSON.stringify                                                    ->  {"direccion":"Av. Rey Juan Carlos 145"}
```

Con `Content-Type: application/json`, al servidor le llega algo que no parsea. **El campo no se
guarda y no hay error en ninguna parte.**

Le pasaba a dos: `jobDetailView.js:791` (renombrar el Trabajo) y `:829` (**la dirección de la
obra**, SCRUM-424).

> 🔴 **La dirección de la obra es donde va el técnico.** Si el jefe la corrige y no se guarda, el
> técnico se presenta en la vieja. En una empresa que atiende centros repartidos por la provincia
> eso es un desplazamiento perdido — de los que Tecnosel apunta en el parte como coste real.

## 2 · 🔴 EL CENSO PRIMERO, porque decide cuál es el arreglo

Por AST sobre `public/` (`tests/_censo-body-apirequest.mjs`). `grep "body:"` no distingue un
comentario, ni un `fetch` que no es `apiRequest`, ni si lo que sigue es un objeto o un
`JSON.stringify`: lo que hay que clasificar es la **expresión**, y eso es un nodo.

| | |
| --- | :-: |
| llamadas a `apiRequest` en total | **149** (84 con opciones + 65 GET pelados) |
| de ellas, **con `body`** | **55** |
| · `JSON.stringify(...)` | **52** |
| · objeto plano | **2** |
| · otra (`body ? JSON.stringify(body) : undefined`) | **1** |
| con 2.º argumento **no literal** (punto ciego) | **0** |

Ese último cero importa tanto como el resto: **el censo lo ve todo**, así que los 55 son todos y no
«los que se dejaron ver».

## 3 · Por qué NORMALIZAR y no «serializar siempre»

La convención de la casa es serializar **fuera** — 52 de 55. Un `JSON.stringify` incondicional
dentro de `apiRequest` les metería la cadena **dentro de otra cadena**:

```
mandado: {"tipoOperacion":"TRABAJO_UNICO","nota":"con \"comillas\""}
viaja  : "{\"tipoOperacion\":\"TRABAJO_UNICO\",\"nota\":\"con \\\"comillas\\\"\"}"
```

El servidor recibiría un string donde espera un objeto: **cambiaría un fallo silencioso por otro, y
en 52 sitios en vez de 2**.

Así que sólo se serializa lo que `fetch` no sabe enviar tal cual. Cadenas, `FormData`, `Blob`,
`File`, `URLSearchParams`, `ArrayBuffer` y vistas de buffer pasan intactos **por construcción**, no
por una lista de excepciones que alguien tenga que mantener. Y los tipos se comprueban contra
`globalThis` porque este fichero se evalúa también en contextos sin DOM.

**Se arregla en UN sitio.** Arreglar los dos llamadores deja la puerta abierta al siguiente — y el
siguiente tampoco daría error. `apiRequest` es el único punto por el que pasan todos.

## 4 · 🔴 El rojo mide lo que LLEGA, no que la petición no falle

Hoy la petición **no falla**. Un test que comprobara que `apiRequest` resuelve pasaría igual de
verde con el defecto puesto. Por eso el `fetch` del banco construye el `Request` que construiría el
navegador y **lee su texto**: un doble que guardara `opts.body` mediría el objeto que le pasaron,
no la cadena que sale por el cable — y ahí es donde vive el defecto.

El rojo nombra el campo:

```
🔴 EL CAMPO `titulo` NO LLEGA AL SERVIDOR.
    lo que viaja: "[object Object]"
```

**SUELO:** el censo tiene que ver ≥50 llamadas con `body`. Un barrido a cero no es «no hay
llamadores que manden objeto»: es que no se ha mirado — que es exactamente cómo este defecto pasó
meses sin que nadie lo viera.

## 5 · Los rojos · commit de resguardo `b42adbf7891727a955c84358d61385ceb079e559`

| # | Qué se rompe | Qué cae |
| :-: | --- | --- |
| 1 | se retira la normalización (el defecto de hoy) | 2/9 · el `titulo` **y** la `direccion`, con `"[object Object]"` en el mensaje |
| 2 | se serializa SIEMPRE (el arreglo obvio) | 2/9 · «una cadena pasa TAL CUAL» **y** «un cuerpo binario NO se serializa» |

El rojo 2 es el que demuestra que la decisión del punto 3 no era estética: el arreglo que parece
obvio rompe dos propiedades distintas a la vez.

## 6 · Lo que NO se ha tocado

Los dos llamadores (`jobDetailView.js`) se quedan **como estaban**: mandan objeto y ahora viaja
bien. Cambiarlos sería arreglar el síntoma en dos sitios y dejar el punto único intacto.
Ni el parte y la oficina · ni las revisiones · ni las dos firmas · ni `prisma/schema.prisma`.

## 7 · Hallazgo de otro carril — se reporta, no se arregla

El guard `scripts/_prisma-procedencia-guard.mjs` recomienda en su mensaje **`npx prisma generate`**.
`npx` se baja `prisma@latest` cuando no encuentra el local, que es justo lo que SCRUM-385 dejó
escrito que no se hace. El remedio correcto es `./node_modules/.bin/prisma generate`. El guard
funciona; lo que induce a error es su texto.

---

# SCRUM-704 (segunda medición) · el arreglo YA ESTABA, y el censo tiene un punto ciego

**Medido contra:** `origin/main` = `042180d43eb4475b096ae219eba277c37d81468a` · 2026-09-03T14:40:00+02:00

## 0 · PARA: el ticket está hecho en `main`

El encargo describía el defecto en presente. **No lo está.** Medido antes de tocar nada:

```
git log -S'esCuerpoQueFetchEnvia' origin/main -- public/dashboard/js/api.js
  b42adbf7 · SCRUM-704: el `body` de apiRequest no viajaba…      1 commit
  CONTROL POSITIVO del mismo comando (API_BASE_URL) → 1          ← el comando mide

tests/scrum704-el-cuerpo-llega.test.mjs → 9 tests, 9 pass, exit 0
```

Y **no me fié del fuente**: ejecuté `api.js` en un contexto con `fetch` instrumentado y miré **lo que
sale por el cable**, que es lo que el encargo pedía comprobar.

| lo que se le pasa | lo que SALE |
|---|---|
| `{ title: 'Obra nueva', obra: 'Av. Rey Juan Carlos 145' }` | `{"title":"Obra nueva","obra":"Av. Rey Juan Carlos 145"}` |
| `JSON.stringify({ title: 'Obra nueva' })` | `{"title":"Obra nueva"}` — **intacto**, no escapado dentro de otra cadena |
| sin `body` | **sin `body`** — no aparece un cuerpo vacío |

**La dirección de la obra llega.** El campo que el jefe corrige se guarda.

## 1 · El censo, RECONTADO por mí (no copiado del comentario)

Ejecutado `censoDeBodies` sobre el árbol de hoy:

| | hoy | dice el comentario de `api.js` |
|---|---|---|
| llamadas con `body` | **56** | 55 |
| ya serializan fuera (`JSON.stringify`) | **53** | 52 |
| pasan un objeto plano | **2** | 2 |
| otra forma (variable, `FormData`…) | **1** | 1 |

Los dos objetos siguen en `jobDetailView.js:791` y `:829`, **y eso es correcto**: el arreglo está en
`apiRequest`, no en los llamadores, así que pasan por él y se normalizan.

**Qué funcionaba antes y por qué:** los **53** que ya serializan fuera. Esa es la convención de la
casa, y es la razón por la que el arreglo **normaliza** en vez de serializar siempre: un
`JSON.stringify` incondicional les metería la cadena dentro de otra cadena y el servidor recibiría un
`string` donde espera un objeto — cambiaría un fallo silencioso por otro, y en 53 sitios en vez de 2.

> El número del comentario ha derivado en uno. No se corrige aquí: es una medición fechada que
> justificaba una decisión, y la decisión no cambia con 52 o 53. Es la lección de SCRUM-682 — **un
> recuento en prosa caduca**; el que vale sale de ejecutar el censo.

## 2 · 🔴 Hallazgo: el censo NO VE las llamadas por alias

`censoDeBodies` cuenta llamadas literales a `apiRequest(...)`. La pantalla del parte llama **a
través de un alias** —`var pedir = o.apiRequest || window.apiRequest`, el patrón que permite
inyectar un doble en los tests— y el censo ve **cero** de sus llamadas:

```
llamadas con body en parteDetailView.js, según el censo ....... 0
las que hay de verdad, con body ............................... 3   (líneas 351, 408, 465)
```

**Hoy no hay riesgo**: las tres mandan `JSON.stringify`. Pero el censo que decide «cuál es el arreglo
correcto» no está mirando ese fichero, y el patrón del alias es el que usa toda pantalla que quiera
ser testeable. **Se reporta** (regla 9): tocarlo es del carril de quien construyó el censo.

## 3 · Microcopy APROBADA y aplicada

`No se han podido guardar las líneas — vuelve a intentarlo` — aprobada literal, aplicada en el mismo
acto y registrada con el mecanismo nuevo, un fichero por aprobación en `docs/microcopy/`.

⚠️ Y una cifra que hay que leer bien: el censo de marcadores sigue diciendo **1** para
`parteDetailView.js`, y en ese fichero quedan **26 rótulos** marcados. Las dos son correctas — ese
censo cuenta **literales con la marca** y la pantalla la factoriza en una constante. Los 26 se
**reportan**, no se aprueban.
