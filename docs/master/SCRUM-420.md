# SCRUM-420 · B1 · incremento 2 — la barra lateral por ciclo de venta

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `74dbd20ab9308ff9cf980a1cdf29bf8d19e3adc6` · 2026-08-10T16:45:36+02:00
**Tanda:** 2545 tests · 2471 pass · **0 fail** · 74 gateados · `npm test` exit **0**

## El defecto, y por qué llevaba semanas invisible

`public/dashboard/index.html` era **literalmente el «lo que hay hoy» del diseño**: `Principal ·
Catálogo · Finanzas · Cuenta`. Cero de los cuatro movimientos que pide `docs/diseno/bloque-b.md`
§B1, y sin la entrada `Cobros`.

El hueco **estaba declarado** —`docs/master/SCRUM-284.md:416`, *«la sidebar (incremento 2) y la
pestaña de Plantillas (incremento 3) no se tocan»*— pero **SCRUM-284 está Finalizada**. Y de ahí
sale la regla que este ticket convierte en guard:

> **Un hueco anotado en un ticket cerrado es un hueco perdido.** No está en ninguna lista, no lo
> arrastra ningún informe, y solo reaparece si alguien vuelve a contrastar el diseño a mano — que
> es exactamente lo que pasó (SCRUM-411, 2ª entrega). Los cuatro hijos de B salían `ENTERO`.

## Lo que se construye

La barra del diseño, con sus cuatro grupos y su orden. Los tres primeros van **sin rótulo de
grupo** («son el trabajo del día y no necesitan que nadie los clasifique»):

```
(sin rótulo)   Inicio · Solicitudes · Trabajos
VENTA          Presupuestos (Historial · Crear nuevo) · Plantillas · Albaranes · Facturas
NEGOCIO        Clientes · Productos · Proveedores · Gastos · Informes · Libro de registro
CUENTA         Equipo · Planes · Configuración
```

**Configuración NO se rehace.** Sus diez submenús son la mitad de B1 que sí se entregó y es
alcanzable; se quedan como están. Lo único que se les añade es el enlace de abajo.

### Las cuatro decisiones del asesor, y por qué cada una

| # | decisión | motivo |
|---|---|---|
| ① | **`Cobros` FUERA de esta entrega** | su pantalla es B4 y **no existe** — no hay vista `cobros` en el router. La entrada la añade B4 (**SCRUM-285**, ABIERTA) en el mismo commit que su pantalla: el menú crece cuando existe el destino. El rótulo queda aprobado desde ya para que B4 no tenga que pedirlo. |
| ② | **`Plantillas` se queda**, en VENTA detrás de Presupuestos | el diseño la saca a pestaña dentro de Presupuestos, pero la pestaña no existe: retirarla hoy dejaría `templates` **inalcanzable**, que es romper el test positivo por el otro lado. Las dos mitades van juntas en **SCRUM-432**. |
| ③ | **`Descargar datos` SALE**, y su enlace entra en Configuración › Tus datos | lo pide el diseño y **lo declaraba el propio código**: el motivo del hueco `datos` decía *«la página YA EXISTE (SCRUM-244) y NO se rehace: aquí solo cambiará de dónde se enlaza, y eso es el incremento de la sidebar»*. |
| ④ | **`Libro de registro` → NEGOCIO**, sin marcador | VENTA es el ciclo (Presupuestos → Albaranes → Facturas → Cobros) y un libro registro no es un paso del ciclo: es un registro del negocio, y vive con Informes. |

**⚠️ Sobre ④, y va escrito porque importa:** el asesor aprobó «Libro de registro» como **rótulo de
NAVEGACIÓN, no como copy de VeriFactu**. Todo lo que se pinta DENTRO de esa pantalla sigue bajo la
regla 26 y sale del guion H2. El guard de SCRUM-296 se ha ajustado para sostener **las dos** cosas
a la vez (abajo).

### ③ es una sola entrega, no dos

Sacar `Descargar datos` de la barra y poner su enlace en `Tus datos` **van en el mismo commit**, y
no por orden: el sentido ④ del trinquete bidireccional de SCRUM-284 cae si se separan —`datos`
deja de estar vacío y sigue declarado como hueco—. Ese guard tiene razón; **no se relaja, se
satisface**: `renderDescargarDatosCard` se declara en `ASIGNACION_SUPERFICIE` y `datos` sale de
`VACIOS_DECLARADOS` a la vez.

**Y una corrección del asesor que queda escrita porque cambia el alcance:** su instrucción decía
«no toques los submenús de Configuración». Al medir salió que ③ **es** tocar uno. La corrigió él:
la instrucción quería proteger las diez pantallas construidas de que alguien las rehiciera, no
prohibir el enlace que B1 había declarado como propio de este incremento.

## 🔴 El guard: ENUMERA contra el diseño, y declara qué falta Y qué sobra

`tests/_barra-lateral.mjs` deriva **tres poblaciones, ninguna escrita a mano**:

1. **lo que el diseño propone** → del bloque cercado de `docs/diseno/bloque-b.md` §B1;
2. **lo que la barra tiene** → recorriendo el `<nav class="sidebar-nav">` en orden, así que el grupo
   de cada entrada sale de dónde está y no de una tabla;
3. **lo que el router conoce** → de los `case` de `renderView` en `app.js`, que es la única fuente
   que dice si una pantalla EXISTE.

**Contar no vale, y eso lo enseñó un caso real de ayer.** El contraste del bloque G dio los
**nueve** bloques que pedía la maqueta y aun así uno no era el que el diseño pedía: `NOTAS
INTERNAS` no estaba y `FACTURAS` sí (SCRUM-411, 3ª entrega). La cuenta cuadraba y la composición
no. Por eso aquí salen `faltan` y `sobran` **con nombre**.

La única pieza escrita a mano es el cruce rótulo → vista (`Solicitudes` → `quote-requests`): eso no
lo puede derivar nadie. Y está protegida de volverse una lista blanca: **si una entrada del diseño
no está en el cruce, el test no la ignora — sale como no traducible y falla.**

### Las ausencias y las excepciones llevan TICKET, no solo motivo

Es la lección del ticket vuelta mecanismo. `AUSENCIAS_CONOCIDAS` exige un `SCRUM-<n>`:
**una ausencia sin ticket abierto no es una ausencia declarada, es una que todavía no se ha
notado.** Hoy: `Cobros` → SCRUM-285. Y en `VISTAS_SIN_ENTRADA`, `operarios` → **SCRUM-433** («una
excepción sin ticket deja de ser excepción y pasa a ser el comportamiento») y `export` → este
ticket.

Y el mecanismo **no se fija a sí mismo**: el día que exista la vista `cobros`, el test cae pidiendo
que se ponga la entrada y se retire la declaración. Una buena noticia no puede romper la suite en
silencio, pero sí tiene que obligar a reflejarla.

## Verificado en rojo — seis inyecciones, todas comprobadas EN DISCO

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se quita la entrada `Gastos` | 🔴 «FALTAN … · «Gastos» (grupo NEGOCIO)» + cae también ③ por la vista huérfana |
| **R2** | el escáner deja de ver los rótulos de grupo | 🔴 «solo 0 rótulos de grupo: el recorrido no está viendo las secciones» |
| **R2b** | el escáner deja de ver las entradas | 🔴 «ESCÁNER CIEGO: solo veo 0 entradas de navegación (esperaba ≥12)» |
| **R3** | una entrada apunta a `cobros` (no existe) | 🔴 «hay entradas que apuntan a una pantalla que NO EXISTE … «Gastos» → data-view="cobros"» |
| **R4** | se añade `Operarios` sin declararla | 🔴 «SOBRAN … «Operarios» → operarios (grupo Negocio)» |
| **R5** | `datos` vuelve a `VACIOS_DECLARADOS` | 🔴 el sentido ④ de SCRUM-284 cae nombrando `datos`, y con él el test ④ de aquí |

> ⚠️ **R2 salió VERDE al primer intento y no era un guard de sobra: era el caso mal elegido.** La
> cadena que iba a sustituir no casaba, así que **la inyección no llegó a aplicarse** y el fichero
> seguía intacto. Se rehízo comprobando en disco que el reemplazo había ocurrido —y abortando si
> no— antes de correr nada. *Un rojo que no se aplica se lee igual que un guard que no hace falta.*
>
> Y por eso R2 tiene un hermano **R2b**: la primera versión solo cegaba los grupos, así que el
> suelo de **entradas** (`≥12`) no se llegó a probar. Un suelo que nadie ha visto caer no es un
> suelo.

## Lo que este ticket cambia de un guard ajeno, y por qué no es relajarlo

**`tests/_censo-superficies-configuracion.mjs` · `revisarSuperficies`.** Daba por colocada la
superficie que estuviera en `SUPERFICIES_PENDIENTES` —o sea, la que tiene una **propuesta**
escrita—. Funcionaba porque las cuatro que había estaban las cuatro **sin decidir**.

`renderDescargarDatosCard` es **la primera superficie DECIDIDA**: está asignada a `datos` en el
mapa que usa la pantalla, y aun así salía «sin sitio». El guard le habría pedido declararse
pendiente, o sea **escribirle una duda a algo que ya está decidido**. Ahora tiene sitio quien esté
**asignada** o **pendiente**, y sigue sin tenerlo quien no esté en ninguna de las dos. No se
relaja: se le enseña la otra mitad de la pregunta.

**`tests/scrum296-pantalla-libro.test.mjs`.** Exigía que la entrada del menú llevase el marcador, y
tenía razón mientras nadie la hubiera aprobado. Mantenerlo tras la aprobación habría sido **fijar
el estado anterior como requisito**: un test que cae el día que alguien hace el trabajo bien. Ahora
exige el texto aprobado en la barra **y** que el título de la pantalla siga pasando por `rotulo()`
—o sea, con marcador—, que es la distinción exacta que hizo el asesor.

## Microcopy (regla 30)

Aprobados por el asesor el 10-ago-2026, sobre la tabla que se le entregó antes de construir: las
once entradas y los tres rótulos de grupo **salen literales del diseño**, más «Libro de registro»
(④) y «Cobros» (①, para cuando toque). Mismo trato que los diez submenús del 5-ago: no es
redacción nueva, es dejar de usar el marcador.

**Lo único que va con MARCADOR es el texto del botón** de la tarjeta nueva: el verbo de «ir a» sí
es redacción nueva y no se rellena por cuenta propia. El título de la tarjeta dice `Descargar
datos`, que es el rótulo que ya llevaba la entrada de la barra y el mismo `<h2>` que abre la propia
vista (`exportView.js:34`).

## Lo que NO cubre

* **`Cobros` no está**, y es la mitad visible del diseño que falta. Es SCRUM-285.
* **`Plantillas` sigue en la barra** contra el diseño. Es SCRUM-432.
* **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano). El cambio es de orden y de
  agrupación, sin componentes nuevos, y el botón nuevo lleva sus 44 px — pero **no está verificado
  en dispositivo**.
* **La vista no se ejecuta en `npm test`**: no hay banco de DOM y montarlo sería dependencia nueva
  (regla 36). Lo que corre es el marcado y el router; la barra se ejercitó en el navegador.
* **El escáner lee HTML con expresiones, no con un AST.** No hay parser de HTML en el proyecto y
  traerlo sería dependencia nueva. El límite es real, y por eso los suelos existen y se probaron en
  rojo por separado.
* **`Tus datos` sigue sin contenido propio**: portabilidad y borrar cuenta no están en la pantalla.
  El panel ya no está vacío; no está lleno.

## Ficheros

* `public/dashboard/index.html` — la barra.
* `public/dashboard/js/settingsView.js` — `renderDescargarDatosCard` y su colocación.
* `public/dashboard/js/settingsSubmenus.js` — la superficie en el mapa; `datos` sale de los vacíos.
* `tests/_barra-lateral.mjs` (nuevo) — las tres poblaciones derivadas y las declaraciones.
* `tests/scrum420-barra-lateral.test.mjs` (nuevo, 14) — suelos, positivo, enumeración y rojos.
* `tests/_censo-superficies-configuracion.mjs` — «tener sitio» son dos cosas.
* `tests/scrum284-dos-poblaciones.test.mjs` — le pasa el mapa de decididas.
* `tests/scrum296-pantalla-libro.test.mjs` — el rótulo aprobado, y lo de dentro sigue marcado.
