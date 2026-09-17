# SCRUM-848 · La ficha de Trabajo se medía con un Trabajo que no existe

**Fecha:** 9-sep-2026 (trabajo) · 15-sep-2026 (esta entrada y el cierre) · **Carril:** instrumentos (guards de la casa) · **Gate:** `npm run guard:objetivo-tactil`, fuera de la tanda

**Medido contra:** `origin/main` = `78215b9ff35a1456f832c47db0ac81bc425ff415` · 2026-09-15T08:54:50Z

**Tanda:** 6502 tests, 6392 pass, 0 fail, 110 skipped — medida DESPUÉS del último cambio.

> ⚠️ Esta entrada se escribe el 15-sep porque el trabajo del 9-sep **entró en `main` sin entrada**
> (PR #1214 → #1240, commit `404c0f59`). Cubre las dos partes: lo que se entregó entonces y lo que
> le faltaba, medido ahora.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: este carril no tiene pantalla. Lo que hay es un guard, y lo
que cambia es **con qué datos monta la pantalla que mide**.

**MECANISMO.** Existía: `tests/_banco-vistas.mjs` monta las vistas del panel sin navegador, y
`scripts/_pagina-panel.mjs` guarda los fixtures COMPARTIDOS entre el guard que vigila y el censo
que cuenta. Aquí no se construye otro.

---

## Parte 1 · Lo que se entregó el 9-sep (commit `404c0f59`) — y está bien

`guard:objetivo-tactil` encontraba **5** objetivos cortos en `renderJobDetailView` donde el censo de
SCRUM-787 midió **6**, y declaraba caducada la excepción `BUTTON.btn-primary`.

🔴 **El guard tenía razón, y el defecto NO estaba en el producto.** El banco montaba esa ficha con
`{}`: un Trabajo **SIN `status`**. El esquema declara `Job.status String @default("pendiente_agendar")`
—no admite nulo—, así que ese objeto **el producto no puede producirlo**. Mientras `jobNextAction`
caía al nivel 5 con cualquier estado, eso pasaba por una pantalla normal; SCRUM-823 le puso la
puerta `JOB_ESTADOS_CON_DOCUMENTOS` —a propósito y bien— y la pantalla medida se quedó sin acción
de héroe.

Se entregaron las tres cosas que el ticket prometía, y `distintosEsperados: 6` y las cinco
excepciones quedaron **intactas**. Verificado el 15-sep: el guard sale **exit 0** y la ficha vuelve
a dar 6, con `BUTTON.btn-primary «+ Nuevo albarán»` a 37,0 px.

**Y el estado elegido EXISTE**, que era lo que había que comprobar y no darlo por hecho:
`en_curso` está en `JOB_STATES = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado']`
(`src/modules/jobs/domain/job.service.ts:9`). No se inventó un estado para pasar.

---

## Parte 2 · 🔴 Lo que diagnosticó MAL, y es lo más importante de esta entrada

SCRUM-848 tituló **«la avería honda»** una segunda cosa: que el banco pasaba la ruta a `fetch`
**pero no a `apiRequest`**, de modo que todo fixture escrito por ruta —`(url) => …`— se llamaba sin
url y caía siempre en su rama por defecto. Cambió esa línea.

**Ese cambio es INERTE para las vistas.** Medido el 15-sep-2026 revirtiéndolo y renderizando
`renderCustomer360View` con un fixture por ruta:

```
CON el arreglo de SCRUM-848 : {"monta":true,"bytes":3062,"llamadas":1,"conUrl":1}
SIN el arreglo (revertido)  : {"monta":true,"bytes":3062,"llamadas":1,"conUrl":1}
```

Mismo html, mismas llamadas, y **el fixture recibe su ruta en los dos casos**.

El motivo llevaba escrito **treinta líneas más arriba en ese mismo fichero** desde SCRUM-432:
`api.js` declara su propio `apiRequest` de nivel superior, así que al cargarse **PISA** el del
banco; lo que las vistas usan es ése, que pide por `fetch` — y a `fetch` el banco **siempre** le
pasó la url. Los fixtures por ruta nunca estuvieron ciegos por ahí.

Lo que de verdad curó la ficha fue el **otro** cambio: darle `datos: TRABAJO_DE_MUESTRA` a la
superficie `/__jobdetail`.

**La línea NO se retira** —es correcta, y `apiRequest(ruta, opciones)` es su firma buena—, pero la
causa falsa sí se corrige donde vive. Una causa equivocada escrita en el código es peor que
ninguna: el siguiente que vea una ficha medirse con datos raros irá a tocar esa línea, no
encontrará nada, y volverá a escribir la misma historia.

### Y una corrección de mi propia medición, por el mismo motivo

Antes de medir esto afirmé dos cosas que resultaron falsas y quedan retiradas: que revertir esa
línea no lo cazaba nadie «y por eso el arreglo estaba desprotegido» (cierto pero **irrelevante**:
no hay nada que cazar), y que con el banco de antes la ficha 360 **no montaba** (eso describía *mi*
perturbación simulada —envolver el fixture para quitarle la url—, **no** el árbol de antes del
9-sep, que sí le pasaba la url por `fetch`).

---

## Parte 3 · Lo que faltaba: nada de esto estaba en la tanda

El diff del 9-sep **no tocó ni un fichero de test**. Y `npm test` es
`build && node --test tests/*.test.mjs`, así que `guard:objetivo-tactil` **no está en la tanda** y
**ningún workflow de `.github/workflows/` lo nombra**: hoy sólo lo ve quien se acuerde de lanzarlo
a mano. Medido: dejar el Trabajo de muestra sin `status`, o con un estado inventado, no lo cazaba
nadie.

**`tests/scrum848b-el-fixture-llega-a-la-pantalla.test.mjs`** — 8 tests, dentro de `npm test`:

1. un fixture escrito **por ruta** recibe la ruta en un render de verdad — y se le pregunta **a la
   pantalla**, no a una función concreta del banco, que es justo el error que llevó al diagnóstico
   falso;
2. y ese fixture **decide** la pantalla: con otro, el resultado cambia (sin esto, recibir la ruta
   no probaría nada);
3. 🔴 el `apiRequest` del banco **no es el camino**: se deriva de que `api.js` declara el suyo, y
   se fija la nota de SCRUM-432 que lo explica;
4. SUELO: los estados del Trabajo se **derivan** de `JOB_STATES` (importado de `dist`), no de una
   copia escrita en el test;
5. 🔴 `TRABAJO_DE_MUESTRA` tiene `status`, y es uno que **existe**;
6. SUELO: el esquema **sigue** declarando `Job.status` con `@default` — si dejara de hacerlo, el
   razonamiento de (5) habría que volver a pensarlo, no borrarlo;
7. la ficha con el fixture real pinta su **CTA de héroe**;
8. 🔴 CONTROL: con el Trabajo **imposible** ese CTA no está — el síntoma exacto de SCRUM-848.

### El rojo del control

Tres mutaciones reales en disco, cada una restaurada **byte a byte** (verificado):

| mutación | tests en rojo |
|---|---|
| el Trabajo de muestra se queda **sin `status`** | **2** — (5) y (7) |
| el Trabajo de muestra con un estado **inventado** | **2** — (5) y (7) |
| `apiRequest` vuelve a llamar al fixture sin la ruta | **0 — y es el resultado CORRECTO**: esa línea es inerte, y (3) es justamente lo que lo fija |

### Un error propio, anotado porque el patrón se repite

El primer intento buscaba el CTA con `html.includes('btn-primary')`. Pasaba — y **mi propio control
lo cazó**: esa misma ficha pinta un `BUTTON.btn-primary.btn-sm «Consolidar seleccionados»` que
contiene la subcadena y que NO desaparece. El selector que importa es el de la clase **desnuda**.
Medido: la ficha pasa de **8** botones a **7**, y el que falta es exactamente
`BUTTON.btn-primary «+ Nuevo albarán»`. Un control que no puede fallar no es un control.

---

## Lo que NO se hizo

- **No se tocó `distintosEsperados`, ni ninguna de las cinco excepciones, ni el fixture, ni el
  guard** (regla 41): el arreglo del 9-sep está bien y esto es el suelo que le faltaba.
- **No se retiró la línea inerte de `apiRequest`**: es correcta y es la firma buena. Lo que se
  corrige es la **causa** que se escribió al lado.
- **No se metió el guard en la tanda.** Necesita navegador y está fuera a propósito (SCRUM-522).
  Lo que entra en la tanda es lo que **sí** se puede comprobar sin él: que el fixture sea un objeto
  que el producto pueda producir y que llegue a la pantalla.
- **No se tocó `prisma/schema.prisma`** (regla 40): se LEE, para comprobar que `Job.status` sigue
  teniendo `@default`.
- **Cero dependencias nuevas** (regla 36), **cero estado o flag nuevo** (regla 27), **cero
  microcopy** (regla 30).
