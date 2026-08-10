# SCRUM-432 · B1 · incremento 3 — `Plantillas` deja de ser menú y pasa a pestaña

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9ed7f26c763a349c8ad0e776e6533f491d606003` · 2026-08-10T17:09:59+01:00
**Tanda:** 2637 tests · 2563 pass · **0 fail** · 74 gateados · `npm test` exit **0**
(re-corrida entera tras arreglar el rojo de CI de SCRUM-433, que es el último cambio)

> Con esto **el bloque B queda cerrado salvo la entrada `Cobros`**, que es de B4 (SCRUM-285) y entra
> con su pantalla.

## PASO 0 — medido antes de tocar nada

**ENTRADA: un solo camino, y era la barra.** `index.html:85` (`data-view="templates"`) →
`app.js:256` `case 'templates'` → `renderTemplatesView`. Barrido sobre `public/dashboard/js/`:
**ningún otro fichero navega a `templates`**. Retirar la entrada sin poner antes la pestaña dejaba
la vista sin ningún camino — por eso SCRUM-420 la dejó fuera, y por eso aquí las dos mitades van en
el mismo commit.

**MECANISMO: las pestañas ya existen en la casa, y se reutilizan.** No hay que inventar nada
(regla 4). El control segmentado de la casa es `btn-sm` + `btn-secondary` (activa) / `btn-ghost`
(resto), 44 px de alto, con `role="tablist"` y `aria-selected`. Lo usan el filtro de Trabajos
(`jobsView.js:59`) y los diez submenús de Configuración (`settingsView.js`, SCRUM-284, que ya lo
declaró como *«mismo control segmentado que el filtro de Trabajos. Cero componentes nuevos»*).
**Escribir un segundo mecanismo de pestañas sería tener dos formas de lo mismo en el mismo
producto.**

## Lo que se construye, y en qué orden

`public/dashboard/js/quotesTabs.js` — la tira `Historial · Plantillas`, pintada por **las dos**
vistas. Y **solo entonces**, en el mismo commit, la retirada de la entrada de la barra.

### Por qué la pestaña NAVEGA en vez de esconder y enseñar

Podría haber fundido las dos pantallas en una y alternar `display`. No se hace, por tres motivos
medidos:

* **las dos vistas ya existen enteras**, con su carga y su estado propios: fundirlas es rehacerlas,
  y el encargo dice que el historial no se toca;
* **el enlace directo sigue vivo**: `#templates` está en `HASH_VIEWS` (`app.js`), así que un
  marcador que el profesional tuviera guardado **no se rompe** con este cambio. Hay test;
* **el router es quien pinta el título** de la pantalla, así que no hay dos sitios decidiendo en
  cuál estás.

Y una línea que no es cosmética: `setActiveMenu` mapea `templates → quotes-list`. Sin ella, estando
en Plantillas **la barra no marcaría ninguna sección** y el profesional no sabría dónde está.

## El test: se mide CARGANDO la pantalla, no leyendo el fuente

Aquí se cobra el banco de SCRUM-417. Medido antes de escribir el test: **las dos vistas implicadas
pintan en el banco** (`renderQuotesListView` con `{}`, `renderTemplatesView` con `[]`), así que la
pestaña se comprueba **en el árbol que la pantalla pinta de verdad** — no en una expresión sobre el
fuente. El positivo dice literalmente lo que importa: *`Plantillas` no está en la barra **y** sí es
alcanzable desde la pestaña*.

Y se comprueba en las **dos** vistas: sin la tira en Plantillas, entrar sería un callejón —se llega
y no se puede volver—. Más que la activa esté marcada en cada una: si las dos se pintaran igual, la
tira diría dónde puedes ir pero no dónde estás.

### 🔴 Corrección a SCRUM-417: el hueco era real y su CAUSA estaba mal escrita

SCRUM-417 declaró como hueco que *«el banco sirve `{}` a `apiRequest`»* y que por eso 5 de 12 vistas
no pintaban. **El hueco existía; el motivo no era ése.** `api.js` define su propio `apiRequest` de
nivel superior, así que al cargarse **PISA** el del banco: lo que las vistas llamaban era el de
verdad, contra un `fetch` que devolvía `{}` pasara lo que pasara.

Servir el fixture por **`fetch`** —que es lo que se ha hecho— no solo arregla eso: hace el banco más
fiel, porque ejercita `apiRequest` **entero** (sus errores tipados, su `res.json()`, su trato del
204) en vez de saltárselo. Medido después del cambio: `renderTemplatesView` y `renderTeamView` pasan
a pintar. **El hueco encoge y no desaparece:** quedan vistas que fallan porque el mini-DOM no
resuelve ids de marcado anidado, y eso sigue siendo del banco, no del código.

> Es la cuarta vez en dos días que este banco «encuentra» un defecto que era suyo. Se anota con las
> otras tres: **un banco infiel no mide de menos, mide otra cosa.**

## Verificado en rojo — tres inyecciones, comprobadas EN DISCO

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se quita la pestaña `Plantillas` | 🔴 «`Plantillas` NO está en la barra y **TAMPOCO en la pestaña**: la vista se ha quedado sin ningún camino. Un profesional que guarde plantillas ya no puede volver a ellas» — y cae también el de composición de SCRUM-420 |
| **R2** | el detector de pestañas se ciega | 🔴 «**ESCÁNER CIEGO: solo veo 0 pestañas** (esperaba ≥2)» |
| **R3** | `Plantillas` vuelve a la barra | 🔴 «ha vuelto a la barra … dos caminos es el desorden que B1 arregla» + «**SOBRAN** en la barra entradas que el diseño no lista» |

Las tres abortan si el reemplazo no llega al fichero (forma de la casa desde SCRUM-420). **R1 es el
que pedía el encargo** y cae por los dos lados: el de composición y el que carga la pantalla.

## 🔴 EL ROJO DE CI, Y ERAN DOS COSAS DISTINTAS CON LA MISMA CARA

SCRUM-433 entró en `main` mientras esto se construía, y su guard puso la rama en rojo por **dos**
aserciones. Parecían la misma —«el test de otra sesión choca con el mío»— y no lo eran. La primera
era **de fondo, y yo tenía la culpa**.

### ① El camino que puse era invisible para la casa entera

```
🔴 HAY VISTAS A LAS QUE NO LLEGA NADA: templates
```

`vistasQueAlguienAbre` busca `renderAppView('<vista>')` **con literal**, y las ~40 navegaciones del
dashboard se escriben así. Yo había puesto `renderAppView(p.vista)` desde el bucle de la tira: más
corto, y parecía más limpio. Resultado: **retiré la entrada de la barra y a cambio puse un camino
que ningún censo de la casa puede ver.** El guard tenía razón por su propia regla, y la pantalla
habría quedado marcada como huérfana para siempre.

**No se arregla ampliando el censo ajeno** para que entienda despachos dinámicos: eso lo obligaría a
aceptar cualquier variable y dejaría de distinguir un camino real de uno inventado. Se arregla donde
estaba la excepción — cada pestaña abre su destino con su literal, en un `abrir()` que se llama de
verdad. Sigue siendo una tira dirigida por datos; lo que cambia es que su navegación es auditable.

> **Un camino que ningún censo puede ver es medio camino.** Y esto no lo habría cazado ningún test
> mío: lo cazó el guard de otra sesión, midiendo desde fuera.

### ② La premisa: el estado anterior convertido en requisito

```
🔴 PREMISA: hoy `Plantillas` sigue en la barra
```

Ésa **era correcta cuando se escribió**: anclaba una SIMULACIÓN a un estado real, para que simular la
retirada simulara algo. Hecho el movimiento, esa línea pasó a exigir que el trabajo **no** estuviera
hecho. Es el tercer caso del mismo género en dos días, después de `scrum296` y del ① de `scrum420`.

**No se borra: se re-apunta al invariante que protegía**, que no era «está en la barra» sino
**«`Plantillas` tiene exactamente UN camino»**. La mitad (a) —bien hecho— deja de ser simulación
porque ya es el árbol de hoy; la (b) —quitar la pestaña sin devolver la entrada— sigue siendo el
contrafactual, y ésa no se puede comprobar de otra forma. El motivo queda escrito en el propio
fichero, junto a la aserción.

**Rojo por el mecanismo, sobre lo que la aserción protege AHORA** (tres, comprobadas en disco):

| # | qué se rompe | qué sale |
|---|---|---|
| **Ra** | se vuelve al despacho dinámico | 🔴 «HAY VISTAS A LAS QUE NO LLEGA NADA: templates» **y** «PREMISA: nadie abre `templates` con `renderAppView('templates')`» |
| **Rb** | `Plantillas` vuelve a la barra | 🔴 «PREMISA: ha vuelto a la barra … si vuelve a tener DOS caminos, este test está midiendo otro mundo» |
| **Rc** | `sinCamino` deja de marcar nunca | 🔴 «sin la pestaña … este guard no lo nota. Entonces no vigila lo que dice vigilar» |

> ⚠️ **Y un error de proceso propio, que va escrito porque costó rehacer trabajo:** deshice una
> inyección con `git checkout -- <fichero>` sobre un fichero que **también tenía mi arreglo sin
> commitear**, y me llevé el arreglo por delante. Es exactamente para lo que existe la regla de la
> casa de **commitear en verde ANTES de inyectar** — que esta vez me había saltado.

## Lo que este ticket cambia del guard de SCRUM-420, y por qué no es relajarlo

Su test ① exigía `templates` **en la barra**, y tenía razón mientras la pestaña no existía.
Mantenerlo ahora sería **fijar el estado anterior como requisito**: el test caería el día que
alguien hace el trabajo bien — exactamente lo que ya corrigió `scrum296` ayer. Se da la vuelta y
sigue exigiendo lo mismo de siempre contra el camino de hoy: que **haya uno**, y solo uno.

`templates` se muda de `ANADIDAS_DECLARADAS` a `VISTAS_SIN_ENTRADA`, **con su ticket**, y hay un
test que impide que esté en las dos listas a la vez: *una de las dos estaría mintiendo*.

Y un arreglo pequeño de usabilidad del propio guard: la comprobación pasa de `assert.match` a
`assert.ok`, porque un `match` que falla imprime **el fichero entero** en `actual` y entierra el
mensaje, que es lo único que quien lo lea necesita.

## Microcopy (regla 30)

`Historial` y `Plantillas` salen **literales** del diseño §B1 (`Historial · Plantillas`): aprobados
por eso, mismo criterio que los rótulos de SCRUM-420. **Cero texto nuevo, cero marcadores** — hay
test de las dos cosas.

## Lo que NO cubre

* **`Cobros` sigue sin estar.** Es B4 (SCRUM-285) y entra con su pantalla.
* **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano). La tira reutiliza un control ya
  medido y lleva sus 44 px, pero **no está verificada en dispositivo**.
* **El banco no ve CSS ni layout**: dice que la tira se monta y con qué rótulos, no cómo se ve.
* **No se pulsa la pestaña.** Que el clic navegue lo sostiene `renderAppView`, que es el mismo
  camino que usa el resto del dashboard; el banco no dispara eventos.
* **Las vistas que el banco aún no pinta** siguen fuera: el hueco de SCRUM-417 encoge, no se cierra.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · ningún `.env` · **el historial de presupuestos**
(hay test de que sigue pintando, sin ids sin resolver, con su contador y con la tira ANTES de la
tarjeta) · `templatesView.js` más allá de la línea que pinta la tira.

## Ficheros

* `public/dashboard/js/quotesTabs.js` (nuevo) — la tira, reutilizando el control de la casa.
* `public/dashboard/js/quotesListView.js` · `templatesView.js` — una línea cada uno: la pintan.
* `public/dashboard/index.html` — la entrada de barra se retira; el script nuevo se declara.
* `public/sw.js` — el script nuevo, en el SHELL (el guard de SCRUM-274 lo exige en los dos sentidos).
* `public/dashboard/js/app.js` — `setActiveMenu`: `templates → quotes-list`.
* `tests/_banco-vistas.mjs` — el fixture pasa a servirse por `fetch`.
* `tests/_barra-lateral.mjs` — `templates` pasa de añadida a vista sin entrada, con su ticket.
* `tests/scrum432-plantillas-pestana.test.mjs` (nuevo, 8) — suelo, positivo, microcopy, no-regresión.
* `tests/scrum420-barra-lateral.test.mjs` — el guard se da la vuelta, sin dejar de exigir un camino.

---

# SCRUM-432 · apéndice: el injerto de la sesión 4, y lo que resultó no hacer falta

**Medido contra:** `origin/main` = `ddfa8ac567954090274f24ae09cc3d1fc43ca0eb` · 2026-08-10T19:08:02+02:00
**Rama:** `scrum-432-plantillas-pestana`

## De dónde sale este apéndice

La sesión 4 construyó **el mismo ticket en paralelo**, sin haber comprobado antes
`git ls-remote --heads origin` con el número — que es la regla de la casa **precisamente porque han
pasado cuatro duplicados**. El push salió rechazado por non-fast-forward, no se forzó nada, y la
rama duplicada se aparcó aparte y luego se retiró.

**Gana esta implementación**, y en el punto que más pesa: la sesión 4 construyó un componente
`.tabs` nuevo, y aquí **no se construyó ninguno** — se reutiliza el control segmentado que ya usan
el filtro de Trabajos y los diez submenús de Configuración. Escribir un segundo mecanismo de
pestañas habría sido tener dos formas de lo mismo en el producto.

## Los dos injertos: MEDIDOS, y los dos ya estaban

| injerto | veredicto |
|---|---|
| **① la traducción del menú activo** (`templates` → `quotes-list`) | **ya estaba**, con su test |
| **② el falso positivo del censo de SCRUM-433** | **no ocurre**: los 7 tests en verde sobre esta implementación |

Lo del ② merece quedar escrito porque las dos sesiones **tropezaron con la misma piedra y por
separado**. El comentario de `quotesTabs.js` lo dice: *«la primera versión hacía
`renderAppView(p.vista)` desde el bucle —más corto, y parecía más limpio— … el censo de SCRUM-433
lee justo eso»*. Se resolvió con literales dentro de cada `abrir`.

> **Y ahí está el hallazgo, que NO se arregla aquí (regla 9): el censo de SCRUM-433 solo reconoce
> `renderAppView('literal')`.** No es que dé un falso positivo hoy — es que **dos implementaciones
> independientes tuvieron que renunciar a su forma natural para que no lo diera**. Un guard que
> obliga a escribir el código de otra manera está cobrando un peaje, y el día que alguien navegue
> desde un bucle tendrá un rojo sin motivo. El arreglo es **resolución de un salto**, como se hizo
> en SCRUM-245. **Merece ticket.**

## Lo único que se añade: ⑤ las dos mitades de «¿dónde estoy?», en el mismo test

Estaban comprobadas, pero **en tests distintos**: uno mira la pestaña activa y otro la traducción de
la barra. Separadas pueden divergir sin que caiga nada, y el producto marcando la pestaña con la
barra apagada **no da error: solo desorienta**, que es peor de detectar.

Verificado en rojo por `$?`, las dos mitades por separado:

- se quita el marcado de la pestaña activa → cae: *«la tira no la marca como activa: dice a dónde
  puedes ir, no dónde estás»*;
- se rompe la traducción del menú → cae: *«la pestaña se marca pero la BARRA se queda apagada»*.

*(Y un rojo que no salió a la primera: la primera inyección cambió `btn-secondary` **en un
comentario** en vez de en el código. Caso mal elegido, no guard de sobra — la primera hipótesis de
la casa, otra vez.)*

## Un aviso de entorno

A mitad de la verificación el cliente de Prisma compartido volvió a quedarse **de otro schema**
(`node_modules` va por junction entre los cuatro worktrees, SCRUM-429). Regenerado con el binario
local. No afecta a lo entregado, pero conviene saber que sigue pasando.

Ficheros de este apéndice: `tests/scrum432-plantillas-pestana.test.mjs` (un test añadido) ·
`docs/master/SCRUM-432.md`.
