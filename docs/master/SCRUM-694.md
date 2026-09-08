# SCRUM-694 · Los guards que filtraban comentarios a mano — nueve migrados, y el censo que salió por cuatro

**Fecha:** 2-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `cc67773b8053569988686ad40ecf6d0e97801527` · 2026-09-02T22:19:42Z

**Tanda:** 4812 tests, 4728 pass, 0 fail, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: **este carril no tiene pantalla**. Lo que hay son guards, y
lo que se migra es cómo leen el código que vigilan.

**MECANISMO.** Existía: `tests/_solo-codigo.mjs` (SCRUM-693), y **arreglado en SCRUM-696** — que
salió justamente de intentar esta migración. El trabajo aquí era darle superficie, no rehacerlo.

**LA CLASIFICACIÓN, remedida.** El censo de entrada hablaba de trece. Son **14**: nueve migrables y
cinco que no aplican, y decir cuáles no aplican es parte del trabajo.

| no aplica | por qué |
|---|---|
| `scrum205-sql-a-mano-contra-schema` | lee `prisma/schema.prisma:92` |
| `scrum297-fuentes-selladas` | lee `prisma/schema.prisma` |
| `scrum302-duplicar` | lee `prisma/schema.prisma:35` |
| `_censo-configuracion` | es **puro**: no lee el fichero, recibe el texto del schema y parsea `model Merchant` (quien lo lee es `scrum284-censo-configuracion.test.mjs:21`). Filtra `//` **y `@@`**, que es sintaxis de Prisma |
| `scrum548-peaje-package-json` | **no filtra comentarios**: recorre claves de `package.json` que EMPIEZAN por `//` y las BUSCA. Migrarlo sería romperlo |

El scanner de TypeScript no parsea Prisma, así que en los cuatro primeros no hay nada que migrar.
Los nueve migrables usan `soloCodigo()` y ninguno `literalesDe()`: todos preguntan «¿existe esta
forma en el código?», no «¿este texto se pinta?».

**QUÉ FICHEROS LEE CADA GUARD** — el hueco declarado en SCRUM-696 era que su censo sólo cubre
`src/`, `public/`, `tests/` y `scripts/`. Medido guard a guard: **los nueve leen dentro de esas
cuatro carpetas**, así que ninguno pisa terreno sin medir. `scrum574-switch-forma-juridica` lee
además `public/dashboard/index.html`, pero **sin pasarlo por el filtro** (`leer(INDEX)` directo),
así que tampoco depende del mecanismo.

---

## 🔴 El hallazgo: el censo de entrada se quedó corto por cuatro

Al construir el trinquete hubo que censar el árbol de verdad, y no salen trece candidatos. Medido
el 2-sep-2026 sobre `tests/` y `scripts/`:

| familia | cuántos | qué les pasa |
|---|---|---|
| 🔴 **cortan en CUALQUIER `//`** | **27** | se comen código real en cuanto un literal lleva una URL. Es el fallo que produce **verdes** |
| sólo borran líneas que EMPIEZAN por `//` | 29 | riesgo menor, pero siguen ciegos a los bloques `/* */` |
| **y de esos 56, encogen el texto** | **31** | hacen el `replace` por cadena vacía, así que además descolocan cualquier `slice(indexOf(…))` |
| comparan con `//` pero no cortan | 7 | otra familia — aquí caen los cinco que no aplican |
| usan el mecanismo | 12 | los nueve de aquí, más `scrum578`, `scrum693` y `scrum696` |

Tres ejemplos reales, para que no sea un número:

```js
scrum139-acciones-linea:1    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
scrum313-pantalla-numeracion:52  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
scrum584-selector-de-columnas:202 .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
```

**No se migran aquí** (regla 9): son 47 guards más y este ticket cubre los nueve censados. Lo que
sí entra es el **trinquete**, para que mientras se decide qué hacer con ellos **no puedan crecer**.

---

## Lo que decide: cada guard migrado SIGUE SALTANDO

El riesgo de esta migración no es que falle: es que **apague nueve guards y salga en verde**. Así
que la evidencia principal no es la tanda, es esto — nueve mutaciones **reales, en disco**, sobre
el código de producto que cada guard vigila, cada una con post-condición y restaurada después:

| guard | violación inyectada en CÓDIGO | qué test lo tumba |
|---|---|---|
| `scrum324-aviso-simplificado-ui` | la afirmación fiscal en `expensesView.js` | la afirmación FISCAL NO está encendida |
| `scrum324-cadena-hasta-el-libro` | ídem | la microcopy de la foto es la APROBADA |
| `scrum519-un-solo-criterio-de-cobro` | `iban \|\| bizumPhone` en `homeView.js` | ninguna vista recalcula el criterio |
| `scrum574-mismo-cliente-tras-migracion` | un `.includes(` en su propio fuente | el control NO usa includes() |
| `scrum574-switch-forma-juridica` | derivar `contactKind` de `tipoDestinatario` | contactKind NO se deriva |
| `scrum577-nombre-para-documento` | `nombreParaDocumento(` en el SELLADOR | la QUINTA copia NO se unifica |
| `scrum593b-superficie-texto-del-documento` | un `innerHTML` | el texto NUNCA se concatena en markup |
| `scrum625-formato-importe-pdf` | `toFixed(2)` dentro de `generateQuotePdf` | el PDF ya no formatea con toFixed |
| `scrum636-sitio-unico-dinero` | la copia del formato de dinero en un `.ts` de `src/` | no queda NI UNA copia en `src/` |

**9 de 9 saltan.** Y su control negativo: la **misma cadena** en `//`, `/* */` y `/** */` no tumba
a ninguno — que es el impuesto sobre la claridad que motivó SCRUM-693.

**El caso cruzado, en el sentido caro:** con la violación DETRÁS de un literal con `//` y en la
misma línea, los tres probados (`scrum324`, `scrum625`, `scrum574-switch`) siguen saltando. Con el
filtro viejo ese corte se llevaba la violación por delante y el guard daba verde.

---

## 🔴 Dos mutaciones mal elegidas, y las dos las cazó el propio control

Se anotan porque el error es fácil y el patrón se repite: **una mutación que no reproduce la forma
del defecto no prueba nada, y encima parece que sí.**

1. **`scrum636`**: inyecté la copia del formato en `public/dashboard/js/…`, y su censo recorre
   `src/**/*.ts` **y sólo eso**. El guard no saltó, y por un momento pareció un guard muerto. Era
   la mutación puesta fuera de su alcance.
2. **`scrum593b`** (al probar el trinquete): renombré `innerHTML` a `innerHTML_RENOMBRADO_` para
   «vaciarlo», y el censo siguió verde — con razón: la aguja seguía ahí **como subcadena**.
   Borrarla de verdad sí lo tumba.

---

## Qué se construyó

**`tests/scrum694-los-guards-migrados.test.mjs`** — el censo con suelo, y no repite lo que ya
prueban `scrum693` y `scrum696`. Lo que fija es lo que sólo se puede perder aquí:

- los nueve **importan** el mecanismo — y se mira sobre el código, porque nombrarlo en un
  comentario no es importarlo;
- ninguno se ha quedado **vacío**: cada uno conserva la aguja que le da sentido. Un guard que ya no
  nombra lo que prohíbe no falla nunca, y su verde no significa nada;
- la aguja de cada uno **sobrevive** al filtro en código y **desaparece** en los tres formatos de
  comentario;
- **control de que no es cosmética**: el filtro viejo cegaba las nueve agujas. Si no las cegara,
  migrar no habría arreglado nada;
- **el trinquete**: los 56 que filtran a mano no pueden crecer, y si el censo diera cero, falla.

---

## Lo que NO se hizo

- **No se migraron los 47 restantes.** Están medidos y reportados; migrarlos es otra decisión.
- **No se relajó ninguna prohibición** ni se tocó el código de producto: las nueve mutaciones se
  revirtieron y el worktree quedó limpio, verificado con `git status` después de cada una.
- **Cero dependencias nuevas** (regla 36).
