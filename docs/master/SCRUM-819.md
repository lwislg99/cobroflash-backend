# SCRUM-819 · Navegar por el menú deja rastro — y eran dos defectos

**Medido contra:** `origin/main` = `441c185c443910d70392143fee4c815d5a46b722` · 2026-09-07T18:11:08+02:00
**Rama:** `scrum-819-el-menu-deja-rastro`

> Lo encontró la sesión 5 con una sonda que la casa no tenía. Aquí se arregla, se le da a la casa
> esa sonda como guard, y se contesta si el banco de vistas puede aprender a hacer esa pregunta.

---

## 1 · Lo medido, antes de tocar nada

Pulsando **los 17 destinos del menú en un navegador de verdad** (`guard:rastro-del-menu`):

| | antes | después |
|---|---|---|
| hash coherente con el destino | **0 / 17** | **17 / 17** |
| entradas de historial en 17 clics | **0** | **17** |
| «atrás» desde informes | **se queda en informes** con el hash en otra cosa | **→ productos → clientes** |
| control positivo · por `renderAppView` | 17/17 coherentes | 17/17 |
| control negativo · hash inventado | — | vista intacta, **167 nodos**, nada en blanco |

**SUELO:** el guard sale por ciego si encuentra menos de 17 destinos. Son 17 exactos, contados en
`index.html`.

## 2 · 🔴 Eran DOS defectos, y arreglar uno solo dejaba el botón de atrás igual de roto

### ① El menú no pasaba por el envoltorio

`app.js` tenía `btn.addEventListener('click', () => renderView(btn.dataset.view))`. `renderView`
**pinta la vista y no toca la URL**. El único sitio que la escribe es `window.renderAppView`, y el
menú se lo saltaba. De ahí el 0/17.

### ② El envoltorio usaba `replaceState`, que no apila

```js
try { history.replaceState(null, '', '#' + view); } catch (_e) {}
```

`replaceState` **no crea entrada de historial**. Medido: incluso navegando por el envoltorio —el
control positivo de la sesión 5, que da 17/17 coherentes— los 17 clics dejaban **0 entradas**. Con
el arreglo de ① solo, la URL habría quedado bien y «atrás» habría seguido sacando de la aplicación.

**Ahora `pushState`, pero no para todo:**

* sólo para las vistas de `HASH_VIEWS` — las que el hash **sabe restaurar**. Las de DETALLE no
  están ahí a propósito (necesitan un id que el hash no lleva, ya lo decía la nota del código), y
  apilarlas daría un «atrás» que **cambia la URL y no la pantalla**: la incoherencia de hoy, del
  revés;
* y no se apila navegar a donde ya estás: pulsar dos veces el mismo botón no puede obligar a dar
  dos veces atrás.

## 3 · 🔴 ¿Puede el banco aprender a hacer esta pregunta?

**La mitad sí. La que importa, no — y no es cuestión de esfuerzo.**

Medido sobre el contexto que monta `cargarDashboard`:

| | |
|---|---|
| `location` | **existe** (objeto) |
| `history` | **NO EXISTE** |
| `dispatchEvent` | **NO EXISTE** |
| `.nav-item[data-view]` en su DOM | **0** — carga los SCRIPTS del índice, no su marcado |

**Lo que SÍ puede aprender:** dándole el marcado del menú, `dispatchEvent` y un `location` **pasivo
que sólo escriba el producto**, un guard podría preguntar *«tras pulsar, ¿escribió el producto la
URL?»*. Ahí el banco pone el escenario y **la afirmación sigue siendo sobre el producto**. Hoy no
puede porque **navega poniendo el hash él mismo**: hash y vista coinciden por construcción, así que
la pregunta ya viene contestada por el instrumento.

**Lo que NO puede, y es donde vivía el daño:**

* **F5.** No hay recarga porque no hay página: el banco no puede volver a arrancar la aplicación
  desde una URL.
* **El botón de atrás.** `history.back()` en un banco es **la implementación que el banco haya
  hecho de la semántica que se quiere medir**. Un autor que creyera que `replaceState` apila lo
  habría escrito así, y el guard habría pasado sobre el código roto — que es exactamente el defecto
  de hoy, sobreviviendo dentro del instrumento que debía cazarlo.

> 🔒 **Un banco puede simular el escenario; no puede simular la propiedad que está midiendo.**
> «¿Escribe el producto la URL?» es del producto. «¿Sirve el botón de atrás?» es del navegador, y
> ahí sólo vale un navegador.

Por eso la sonda queda como **guard de navegador** (`guard:rastro-del-menu`, que entra solo en
`guards:visuales` por llamarse `guard:*`) y la red barata que sí corre en cada tanda fija **las dos
formas por AST**. Y hay un test que **cae el día que el banco gane `history` o el menú** — para que
alguien relea esto entonces, no para prohibirlo.

## 4 · Verificación

**El rojo, con los tres motivos nombrados:** sobre el `app.js` de antes, el guard sale con **exit 1**
diciendo las tres cosas —incoherencia 17/17, 0 entradas, «atrás» no vuelve—; sobre el arreglado,
**exit 0**. Y el test barato cae en sus dos casos con el fichero viejo.

⚠️ **Y el guard barato me cazó a mí primero:** mi ventana de 400 caracteres desde el manejador se
comía el `renderView(window.appState.view || 'home')` **del arranque**, que es legítimo —ahí no hay
menú que haya pulsado nadie— y salía rojo contra código correcto. Se acota al `forEach`. Es la misma
familia que SCRUM-710: una ventana fija es un anclaje por posición.

## 5 · Números

**BUILD exit 0** · suite y `guards:entrada` al pie del informe.

## ⛔ No tocado

Ningún rótulo · `renderView` (sigue siendo el que pinta) · `HASH_VIEWS` · las vistas de detalle ·
`src/` · `prisma/schema.prisma` · el banco de vistas, que se **describe** y no se cambia.
