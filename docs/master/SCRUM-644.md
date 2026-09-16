# SCRUM-644 · El trinquete del mensaje crudo

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** cierra la puerta que 641 dejó abierta
**Medido contra:** `origin/main` = `5091091c973d631f22c3ceb15fdd091aebeed389` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-644-trinquete-mensaje-crudo`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> El ancla se ha **medido** con `git rev-parse`, no expandido a ojo: la última vez la inventé.

---

## EL ENTREGABLE ES EL TRINQUETE, no los dos ficheros

SCRUM-641 arregló `productsView.js`. **Nada vigilaba que una vista nueva volviera a pintar
`e.message`**, y ésa es la familia de defecto de la casa: el dinero (seis copias), el contador de
scripts (cuatro conflictos), el vocabulario de códigos (dos capas). Se arregla una copia y no se
cierra la puerta.

### El control que decide el ticket

Se escribió a propósito una vista nueva que pinta `e.message`. **La tanda cayó, nombrando fichero
y línea:**

```
🔴 SE PINTA UN `.message` DEL SERVIDOR SIN TRADUCIR.
  zzPruebaDelTrinquete.js: 1 sitios y el techo es 0
      public/dashboard/js/zzPruebaDelTrinquete.js:7  setAlert(…)  setAlert('error', e.message || 'Error haciendo algo.')
```

El fichero de prueba se retiró; `git status` lo confirma.

### Cómo está hecho, y las dos listas a mano

Se deriva del **AST**, no de un `grep`: un censo por texto se caza en su propio comentario y no
distingue un `.message` **pintado** de uno **leído para decidir**.

🔴 **`PINTORES` y `TRADUCTORES` se escriben a mano y no se heredan de nadie** (criterio de
SCRUM-645). Si el censo dedujera los pintores del código, un caso nuevo entraría solo: se daría por
bueno sin que nadie lo decidiera, o quedaría fuera del censo sin que nadie se enterara. **La
duplicación es el precio**, y hay un test que prohíbe que este censo importe del código que vigila.

### El censo heredado: 57 sitios en 16 ficheros

Techo por fichero, que **sólo puede bajar** —y bajar se anota en el mismo commit—. Un fichero que
no esté en la tabla tiene techo **cero**. No se arreglan aquí: `jobDetailView` (11) y
`quotesDetailView` (9) son de otros carriles y `products` lo lleva S1 en CAT-01.

## 1 · `providersView.js` — el otro fichero con el camino completo

Mismo criterio que 641, sin inventar uno nuevo. Los **seis** sitios que pintaban pasan por
`mensajeDeErrorProveedor`; quedan **cero** `.message` crudos.

* `name_duplicate` → **marcador** + palabra distintiva. Texto nuevo, sin firmar (regla 30).
* `provider_in_use` → **su texto EXACTO**, que ya existía en este fichero y ya se enseñaba. Se
  **mudó** al mapa, no se reescribió: marcarlo obligaría al fundador a refirmar lo que ya firmó.
* Todo lo demás cae al **respaldo en castellano** que cada llamada ya traía, y el identificador
  sale por `console.warn` — donde lo ve quien puede mapearlo, no quien intenta cobrar.
* **No en `api.js`**: zona sin marcador por decisión (SCRUM-405). No se repitió el intento.

**ANTES / DESPUÉS**, ejecutando el traductor de verdad con un `window` de mentira:
`new Error(data?.error)` sigue dando `name_duplicate`; el traductor lo convierte en el marcador y
**el identificador ya no llega a pantalla**.

## 2 · `invoiceDetailView.js` (:523, :650) — **su camino NO llega a pantalla**

Medido: los dos crean `new Error(d.error || 'error')`, pero sus `catch` pintan **texto fijo** —
`'Error al enviar el recordatorio.'` y `'Error al regenerar el PDF.'`. El identificador **no se ve**.
**No se han tocado**, como pedía el encargo.

> El fichero sí tiene **4 sitios** en el censo heredado, por otras vías (`:317`, `:392`, `:501`,
> `:574`). Quedan declarados con su techo, no arreglados: no es este ticket.

## 3 · El marcador, declarado en SCRUM-402

`providersView.js` entra con **1**. Y la lección de SCRUM-575 queda escrita en la propia entrada:
este censo cuenta el **literal**, que está escrito una sola vez, así que si el siguiente ticket
añade otro código mapeado reutilizando la constante **el número no se moverá**. Quien añada uno le
pone **su** constante, para que el fundador pueda firmar uno sin firmar los dos.

## 4 · Control negativo: lo que NO se ha roto

`POST /load-catalog` y `POST /import` **siguen tragándose el P2002**. Es idempotencia deliberada de
ONBOARD-2, y hay un test que lo pincha: si empezaran a devolver 409, eso no sería un arreglo — sería
romper una decisión. Las rutas **singulares** sí lo traducen, y esa distinción es lo que hace que lo
otro no sea un descuido.

## 5 · Un defecto propio, cazado por el suelo

El detector daba **1** sobre un sitio YA traducido: `hayCrudo` empezaba por los **hijos** del
argumento, así que cuando el argumento **era** la llamada al traductor nunca pasaba por la poda y el
`.message` de dentro contaba como crudo. Con ese fallo el censo daba **70** sitios en vez de 57, y
los dos ficheros arreglados **seguían apareciendo**. Lo dijo el control negativo del suelo, no una
lectura.

## 6 · Números

* **Suite: 4.300 tests · 4.221 verdes · 0 rojos · 79 saltados.** `guards:entrada`: 21/21.
* Tests nuevos: `tests/scrum644-trinquete-mensaje-crudo.test.mjs`, **13**.
* Censo nuevo: `tests/_censo-mensaje-crudo.mjs`, 66 ficheros mirados.

## 7 · Lo que no se ha tocado

`api.js`, el `@@unique` y el esquema (SCRUM-631), products y el catálogo (S1, CAT-01),
`pendientesFacturar` y el semáforo (S2), y el calentamiento del navegador (SCRUM-626, esperando los
tiempos de `npm ci`).
