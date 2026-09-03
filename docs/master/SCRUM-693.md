# SCRUM-693 · El filtro de comentarios de `scrum578` — y la pregunta que hace cada guard

**Fecha:** 2-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `bdce57dc9c0eb6604ec7786cee2d2421fad8d554` · 2026-09-02T21:37:39+01:00

**Tanda:** 4764 tests, 4681 pass, 0 fail, 83 skipped (los 83 declaran su motivo) — medida DESPUES del ultimo cambio, entrada incluida, y repetida tras mezclar main (antes daba 4741/4658/0).

---

## La víctima no es un profesional: es la siguiente sesión

`scrum578` prohíbe la cadena del rótulo viejo del teléfono en `customersView.js`, y hace bien —
aquel rótulo pedía un formato que el sistema no aplicaba. Pero **su filtro saltaba las líneas `//`
y no los bloques `/* */`**. Consecuencia: **documentar por qué se retiró ese texto hacía caer el
guard**. Me pasó al cerrar SCRUM-575, con un JSDoc que citaba la cadena justo para que nadie la
reintrodujera.

Y el daño no es el rojo, que se ve y se arregla: es que **empuja a escribir comentarios vagos**
—«aquel texto», «el rótulo antiguo»— exactamente donde hace falta precisión. Un guard que cobra un
impuesto sobre la claridad del código se acaba pagando con código peor documentado.

> Es la familia de siempre: el instrumento dice medir **«este texto no se PINTA en la pantalla»** y
> en realidad mide **«este texto no APARECE en el fichero»**. Son dos preguntas distintas, y la
> segunda incluye la documentación.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: **este carril no tiene pantalla**. Lo que hay es un guard,
`tests/scrum578-formulario-duplicados.test.mjs:105`, y su filtro de tres líneas:

```js
fuenteBruta.split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('//'))
  .map((l) => l.replace(/\s*\/\/.*$/, ''))
  .join('\n')
```

**MECANISMO — existía, y en el sitio correcto.** `scrum402` ya resolvió esta misma pregunta con
**AST**, y lo dejó escrito: *«los comentarios no son nodos de literal, así que quedan fuera por
CONSTRUCCIÓN, no por una lista de excepciones»*. Su `marcadoresEnLiterales` es el motor del que
sale `literalesDe`. **No se ha inventado un criterio nuevo: se ha reusado el que la casa ya tenía.**

---

## Lo construido · `tests/_solo-codigo.mjs`

Dos funciones, porque son **dos preguntas** y mezclarlas es el defecto original:

| función | contesta |
|---|---|
| `soloCodigo(fuente)` | el fuente con los comentarios **en blanco** — para las comprobaciones ESTRUCTURALES |
| `literalesDe(fuente)` / `algunLiteralContiene(...)` | los textos que **se pintan** — para las prohibiciones de microcopy |

### Por qué el SCANNER de TypeScript y no un regex

Un regex ingenuo falla **en los dos sentidos**, y los dos casos existen de verdad:

| caso | qué le pasa a un regex |
|---|---|
| `const u = "http://ejemplo.com";` | corta en el `//` de la URL y **se come código real** → el guard deja de ver lo que vigila. **Produce VERDES** |
| `/* antes ponía "el texto" aquí */` | el filtro por líneas lo conserva → el guard **salta por su propia documentación** |

El scanner tokeniza de verdad, así que las dos cosas quedan bien **por construcción**. Cero
dependencias nuevas (regla 36): `typescript` ya está en el árbol y lo usan quince guards.

### ⚠️ Y no encoge el texto

Los comentarios se sustituyen por **espacios**, conservando los saltos de línea. No es un capricho:
`scrum578` hace `slice(indexOf('function a'), indexOf('function b'))` en cinco sitios. Si el filtro
acortara el texto, esos índices apuntarían a otro lado y el guard mediría **un bloque que no es el
suyo** — un falso verde silencioso. Hay un caso que lo fija (misma longitud, mismas líneas).

---

## 🔴 El control que decide: no cambiar un falso positivo por un guard muerto

Va el primero a propósito. Si tras afinar el filtro la cadena prohibida **ya no saltara nunca**, se
habría cambiado un falso positivo —que se ve y molesta— por un **guard muerto**, que da verde para
siempre y no lo nota nadie.

**Probado sobre el fichero REAL, en los dos sentidos**, con mutación y post-condición:

| se muta `customersView.js` | resultado |
|---|---|
| se añade un **JSDoc** que cita la cadena prohibida | ✅ **`scrum578` NO cae** — el arreglo funciona donde dolía |
| se pone la cadena en un **literal de código** | 🔴 **`scrum578` SIGUE cayendo** (y mi propio control negativo también) |

El fichero se restauró y **no entra en el PR**: `customersView.js` tiene dos ramas en vuelo.

### Los casos que rompen un regex, probados en los dos sentidos

`tests/scrum693-filtro-de-comentarios.test.mjs`, 10 casos: bloque `/** */`, línea `//`, **URL con
`//` dentro de una cadena**, **cadena dentro de un comentario**, el mixto (código y comentario en
la misma línea), y el suelo de que no encoge. Más «mencionar no es hacer»: se comprueba que
`scrum578` **importa y llama** al filtro nuevo, y que el viejo **ya no está** — dos filtros para lo
mismo con uno roto es peor que uno.

**Control negativo:** la prohibición **no se ha relajado**. La cadena sigue vetada en el código de
la vista y el veto sigue escrito en `scrum578`.

---

## El censo que pedía el alcance: 14 filtros a mano, y ninguno es robusto

Medido sobre `tests/`. Y con un aviso: **mi primer censo automático se equivocó** y lo verifiqué a
mano — clasificaba `scrum324-cadena-hasta-el-libro` como completo y está a medias. Un censo sin
verificar es otra medición inventada.

**A medias (sólo `//`) y midiendo sobre ficheros `.js`, donde SÍ hay bloques:**
`scrum302-duplicar` · `scrum324-aviso-simplificado-ui` · `scrum324-cadena-hasta-el-libro` ·
`scrum519-un-solo-criterio-de-cobro` · `scrum574-mismo-cliente-tras-migracion` ·
`scrum574-switch-forma-juridica` · `_censo-configuracion`

**Parcial** — filtra `//` y `*` pero no `/*`, así que la línea de apertura de un bloque sobrevive:
`scrum625-formato-importe-pdf`

**Completos por líneas** (`//` + `*` + `/*`): `scrum577-nombre-para-documento` ·
`scrum593b-superficie-texto-del-documento` · `scrum636-sitio-unico-dinero`

**Sobre otros formatos** (prisma / package.json), donde el riesgo es otro:
`scrum205-sql-a-mano-contra-schema` · `scrum297-fuentes-selladas` · `scrum548-peaje-package-json`

> 🔴 **Ni siquiera los «completos» son robustos:** filtran por líneas, así que siguen fallando con
> una URL que lleve `//` dentro de una cadena y con un comentario de fin de línea pegado a código.
> **El del scanner es el primero que no falla en ninguno de los dos.** No se tocan aquí (regla 9):
> quedan como hallazgos, con la herramienta ya escrita para quien los cierre.

---

## Los huecos que declaro

1. **Sólo se ha cambiado el consumidor de `scrum578`.** Los otros trece siguen como estaban; están
   listados arriba, uno por línea, y el helper existe para cuando se decidan.
2. **El helper no distingue JSX ni TypeScript con decoradores**: se usa `ScriptKind.JS` para las
   vistas y el scanner por defecto para el resto. En este árbol las vistas son JS vanilla, así que
   no se ha ejercitado con otra cosa.
3. **`literalesDe` no resuelve interpolaciones**: de `` `Hola ${x}` `` devuelve los trozos
   literales, no el texto final. Para una prohibición de microcopy basta, pero quien busque un
   texto compuesto en tiempo de ejecución no lo encontrará aquí.
4. **No he medido el coste en tiempo** del scanner frente al regex sobre la tanda completa.

## Ficheros

`tests/_solo-codigo.mjs` (**nuevo**) · `tests/scrum693-filtro-de-comentarios.test.mjs` (**nuevo**) ·
`tests/scrum578-formulario-duplicados.test.mjs` (usa el filtro nuevo) · esta entrada.

**No se ha tocado:** `public/dashboard/js/customersView.js` —hay dos ramas en vuelo sobre él; sólo
se mutó en memoria para probar los rojos y se restauró— · los otros trece guards con el filtro a
medias · `prisma/schema.prisma` · ninguna dependencia nueva.

## Estado del arbol

* `origin/main` MERGEADO DENTRO de la rama —no rebase, nunca `--force`— sin conflicto.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES).

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* Los trece filtros de comentarios listados arriba siguen a mano y ninguno usa tokenizador: el helper ya existe para cerrarlos cuando el fundador lo decida.
* `scrum625-formato-importe-pdf` filtra `//` y `*` pero no `/*`, así que la línea que ABRE un bloque sobrevive a su filtro.
* El JSDoc que documentaba el filtro roto de `scrum578` contenía él mismo la cadena prohibida — sobrevivía a su propio filtro por ser un bloque, y era la prueba del defecto escrita al lado del defecto.
