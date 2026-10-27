# SCRUM-1495 · El título de la vista es de la ficha que está montada, no de la última respuesta que llega

**Medido contra:** `origin/main` = `73ce872cbcb6c914355830fd6b358e30aa066c77` · 2026-10-07T07:30:00Z
A9: sin fallo que generalice — una desviación del diseño apuntado en el ticket, declarada abajo («Desviación»)

**Skill UI:** no cargada · no toca marcado, clases, estilos, tokens ni texto: añade UNA condición a la línea que ya corregía el título de la vista. Un fichero de `public/dashboard/js` (`quotesDetailView.js`).

7-oct-2026 · **S2** (`s2-7octb`) · rama `scrum-1495-el-titulo-es-de-la-ficha-montada`. Lo abrió S2 el
6-oct (decisión del orquestador en SCRUM-1482 c.18498: «el hallazgo del título cruzado, en ticket
aparte»).

## Qué pasaba

Se abre la ficha del presupuesto A y, antes de que llegue su respuesta, la del B. Cuando la respuesta
de A llega tarde, la ficha de A —que ya no está en pantalla— corregía el título de la vista a SU
número: «Presupuesto #5» arriba, sobre la ficha del #4. También si la carga de B fallaba.

La causa: `quotesDetailView.js` corregía el título si éste EMPEZABA por «Presupuesto #». Eso dice que
el título parece de un presupuesto, no de cuál.

## Qué cambia

Una condición AL LADO de la regex: la ficha corrige el título sólo si su nodo (`page`) sigue colgando
del hueco en el que se pintó (`page.parentNode === container`). Toda vista del panel se pinta en el
mismo hueco (`#view-container`) vaciándolo, así que una ficha que ya no cuelga de él no es la que
está en pantalla.

**No cambia:** la regex, que sigue ahí y sigue siendo la que casa con el título provisional del router
(`app.js`); ningún caso de `tests/scrum832-atras-vuelve-a-la-lista.test.mjs`; ningún texto.

## Desviación del diseño apuntado en el ticket, declarada

El ticket apuntaba «sólo si su propio nodo sigue EN EL DOCUMENTO» (`isConnected`), y decía que no era
un diseño cerrado. Aquí se mira si sigue EN SU HUECO. En el panel las dos dan lo mismo (medido en
navegador, abajo). Se eligió ésta porque el banco de vistas (`tests/_banco-vistas.mjs`) tiene
`parentNode` y NO tiene `isConnected`: con `isConnected` el banco daría `undefined`, el título no se
corregiría nunca en ningún test y habría que enseñarle esa API al banco, que no es de este carril.
Diferencia real entre las dos: si algún día una ficha se pintara en un hueco que luego se saca ENTERO
del documento sin vaciarlo, esta condición seguiría dando «montada». Hoy ningún camino del panel hace
eso (`app.js` usa siempre el mismo `#view-container`).

## Verificado, ejecutando

- `tests/scrum1495-el-titulo-es-de-la-ficha-montada.test.mjs`, 6 casos, la ficha de verdad en el banco
  con las dos respuestas sueltas a mano en el orden que pide cada caso. **Con el `quotesDetailView.js`
  de `origin/main`: caen 3 de 6** (los tres cruces: B carga y A llega tarde; A llega tarde antes que B;
  B falla y A llega tarde) y pasan los tres controles. **Con la rama: 6 de 6.**
- En yaqu.app, build `73ce872c`, cuenta QA 46, sólo GET (`sondas-s2/id-ficha.mjs`; A = id 206 / nº 5,
  B = id 205 / nº 4; la sonda retrasa 2,5 s la respuesta de A):

  | Fila | Producción hoy (título · cabecera) | Con los ficheros de la rama servidos por la sonda |
  |---|---|---|
  | E5 · abre A lenta y luego B, que carga | 🔴 «Presupuesto #5» · «Presupuesto #4» | «Presupuesto #4» · «Presupuesto #4» |
  | E4 · abre A lenta y luego B, que falla | 🔴 «Presupuesto #5» · «Presupuesto» | «Presupuesto #205» · «Presupuesto» |
  | E1 · A sola, cargada (control) | «Presupuesto #5» · «Presupuesto #5» | igual |
  | E3 · se va a Inicio mientras A carga (control) | «Inicio» | igual |

  La columna de producción es el control positivo: la misma sonda, con el código de antes, falla.
- Vecinos: los 47 ficheros de `tests/` que nombran `quotesDetailView` o `renderQuoteDetailView`, o que
  miran este registro (456 casos). `scrum832` entero, intacto y en verde.

## Lo que queda igual de mal, y de quién es

- **E4, con la rama: el título dice «Presupuesto #205»**, el id de la tabla de B. No lleva nada de A,
  que es lo que pedía este ticket; que enseñe el id cuando la carga falla es **SCRUM-1482** (su mitad
  del router, parada en el caso 7 de `scrum832`).
- La ficha que llega tarde **se sigue pintando entera en un nodo que ya no está en pantalla**. No se
  ve y no toca el título; no se ha medido si hace algo más fuera de su nodo.

## Lo que NO se ha podido mirar

- Con qué frecuencia le pasa a alguien con una red normal: el cruce lo fuerza la sonda.
- Móvil y otro navegador. Las otras fichas (Trabajo, factura, albarán, cliente, parte): no miradas.
- Nada desplegado al escribir esto.
