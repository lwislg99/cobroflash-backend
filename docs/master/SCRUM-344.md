# SCRUM-344 · cerrar un Trabajo con saldo pendiente AVISA de lo que mata, en sección propia

**Fecha:** 5-ago-2026 · **Carril:** B (producto / UI de Trabajos) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `74c6270f7f8ede9faedc8aa81c7951ee4d1e4a58` · 2026-08-05T05:31:31+01:00

**Tanda:** 1421 tests, 1354 pass, 0 fail, 67 skipped

## El defecto

`cerrado` es el único estado terminal de la FSM del Trabajo (`job.service.ts:27` — `cerrado: []`), y
cerrar **mata la vía de cobro**: `POST /:id/collect-rest` exige `status === 'terminado'`
(`jobs.routes.ts:552`). El botón se ofrecía suelto en el renglón de acciones, como IGUAL de «Cobrar
el resto», **sin mirar un solo número de dinero**.

Censo AST sobre los bytes de `origin/main`: **un cierre, `jobsView.js:231`, dentro de `jobCard`, con
una única guarda — `j.status === 'terminado'`**. Cero condiciones de dinero. Y «terminado y sin
cobrar» es el camino POR DEFECTO, no el caso raro.

## La decisión, y por qué (del fundador; aquí solo se ejecuta)

1. **Se AVISA, no se impide.** Cerrar con saldo puede ser legítimo —cobraste por fuera, o lo das por
   perdido—. Impedirlo obligaría a marcar pagado lo que no se pagó para poder cerrar, y ensuciar el
   dato de cobro es peor que el problema que resuelve.
2. **El aviso dice la CONSECUENCIA REAL**, no «es irreversible» a secas: que después no se podrá
   cobrar el resto desde el producto. Ese es el hecho que hoy no sabe nadie.
3. **Sección propia con su explicación, no escondido en el `⋮`.** Es la excepción escrita en la
   regla 5. Si el riesgo es el clic accidental, se esconde; si es no entender lo que se hace, se
   explica. Aquí es lo segundo — **esconder no es lo mismo que proteger**.
4. **No se abre reapertura.** Que `cerrado` sea terminal es otra decisión y toca la FSM entera.

## Lo que se midió

**QUÉ MATA CERRAR, derivado y no deducido del nombre.** Los únicos sitios de `src/` que cambian de
conducta según `job.status` son la propia FSM y `jobs.routes.ts:552` (`collect-rest`). En el front,
`expensesView.js:39` deja de ofrecer el Trabajo para vincular gastos. **Las facturas YA EMITIDAS no
se ven afectadas**: marcar pagada, recordar y el enlace de pago no miran el estado del Trabajo en
ningún sitio. Cerrar NO las mata.

**LOS DOS «PENDIENTES» QUE PARECEN EL MISMO Y NO LO SON**, que es la medición que decide el ticket:

* ① `totalAceptado − totalCobrado` — **lo que te deben**. Es lo que pinta la barra («Cobrado X de
  Y», `api.js:246`). Incluye facturas emitidas y sin pagar.
* ② `remaining.amount` — **lo que falta por facturar**: exactamente lo que emitiría «Cobrar el
  resto» (`jobs.routes.ts:129-130`) y exactamente lo que ya enseña el botón de al lado
  (`jobsView.js:211`, mismo campo y mismo `fmtMoneyEs`).

**El aviso usa ②, y no ① como parecía.** Cerrar solo mata ②; el trozo de ① ya facturado se sigue
cobrando después de cerrar. Avisar con ① diría «vas a perder 1.000 €» cuando 600 de esos 1.000
siguen cobrables — **avisar de más también es avisar mal**. El número que se enseña es, por
construcción, el mismo que el del botón: sale del mismo campo, no de un segundo cálculo.

**EL CASO DEGENERADO, y por qué el disparador NO puede ser `estadoCobro`.** `estadoCobroFor`
(`job.service.ts:212-218`) exige `aceptado > 0` para poder decir 'Pagado'. Con `totalAceptado` nulo o
0 **nunca** lo dice: se queda en 'Pendiente' si no hay nada cobrado y en 'Parcial' en cuanto se cobra
algo, en ambos casos para siempre. O sea que 'Pendiente' significa a la vez «te deben todo» y «aquí
no hay importe contra el que cobrar», que son cosas opuestas. Usar `remaining` esquiva la trampa por
construcción: sin presupuesto es `null` y con total 0 su importe es 0 — en los dos casos no se avisa,
que es lo correcto.

*(Matiz sobre el enunciado del ticket: «'Pendiente' para siempre» vale cuando `cobrado <= 0`; con
algo cobrado se queda en 'Parcial' para siempre. La propiedad que importa es la misma y es más
fuerte: con `aceptado <= 0` el semáforo **nunca** puede llegar a 'Pagado'.)*

## Verificado en rojo

**EL ROJO SOBRE EL DEFECTO REAL, SIN INYECTAR NADA.** Se puso en su sitio el
`public/dashboard/js/jobsView.js` de `origin/main` —los bytes que corren hoy en producción— y se
corrió el guard **sin tocarlo**: **5 de 13 en rojo**, y los tres que importan son el de la sección
propia, el del aviso y el suelo. El censo sobre esos bytes da el defecto exacto:
`{linea: 231, funcion: 'jobCard', guardas: ["j.status === 'terminado'"]}`.

Ese rojo **no se deja dentro de la suite a propósito**: en cuanto esto entre en `main`, esos bytes
dejan de ser los de `main` y el test se volvería mentira. Lo que queda dentro son **cuatro
inyecciones**, que sí son estables, y cada una rompe UNA pieza y comprueba que su test la caza:
quitar la confirmación · sacar el cierre de la sección · colar una frase escrita a mano en la vista ·
colar un rótulo plausible en `CIERRE_TEXTOS`.

**DOS COSAS QUE DESTAPÓ EL PROPIO ROJO** y que estaban mal en el guard, no en el código:

* `contieneReturn` entraba en funciones anidadas, así que le atribuía al cierre de L231 una guarda
  que no lo guarda (el `return` del handler de «Agendar»). El error iba del lado **permisivo** —más
  guardas = más fácil que alguna mencione lo que se exige—, que es el lado en el que un guard se
  vuelve decorativo sin que nadie lo note.
* El suelo mezclaba «el escáner ve los cierres» con «la sección tiene textos». Sobre el código viejo
  eso gritaba «ESCÁNER CIEGO» cuando lo cierto era «la sección aún no existe». Separados: el suelo
  general mira lo que debe verse siempre, y el «≥3 textos» vive dentro del test de microcopy, que es
  donde un 0 haría pasar el test en vacío.

**DOS GUARDS EXISTENTES CAZARON EL FICHERO NUEVO, y los dos tenían razón:**

* `dashboard-colision-declaraciones` — `MICROCOPY_PENDIENTE` ya lo declara `invoiceActionsRegistry.js`
  en el nivel superior. Redeclararlo es **`SyntaxError` en parseo**: el fichero entero no se ejecuta
  y la pantalla de Trabajos desaparece sin 500 ni log. Se reutiliza el global existente.
* `scrum274-shell-alineado` — el script nuevo faltaba en el `SHELL` de `public/sw.js`.

**EL ROJO DEL GUARD DE MICROCOPY, sobre el módulo real y no sobre una copia en memoria:** cambiado
UN carácter en `jobsCierreTrabajo.js` (`reabrir.` → `reabrir,`), cae `las cinco ranuras dicen
EXACTAMENTE el texto aprobado` — **1 de 15** — y el mensaje señala la ranura y las dos versiones.
Restaurado, 15/15. La inyección equivalente vive en la suite, y comprueba además que la comparación
**no depende del importe**: la misma frase con otra cifra sigue siendo la misma frase aprobada.

**EN EL NAVEGADOR, no solo en el AST** (harness aislado, clic real en los tres botones): **1
confirmación y 2 PATCH**. La tarjeta que avisaba, contestando «no», no mandó nada; las dos sin saldo
pasaron de un clic. Las dos caras, medidas. Botón a **44 px** en las tres (`btn-sm` solo llega a 30),
y a 390 px con importes de cinco cifras `scrollWidth === clientWidth`: no desborda.

## La microcopy, y el guard que la sustituye (regla 30)

**APROBADA por el fundador el 5-ago-2026**, cinco ranuras. `titulo` y `boton` van SEPARADAS —con una
sola, el encabezado y el botón decían lo mismo y la sección parecía repetirse; eso salió de mirar la
captura AB6, no de la especificación—. El importe va **dentro de la frase**: un número flotando al
lado de un aviso obliga al usuario a relacionarlos él.

> **titulo** · Cerrar el trabajo
> **boton** · Cerrar trabajo *(el que ya existía; no es microcopy nueva)*
> **explicacion** · Cerrar da el trabajo por acabado. No se puede reabrir.
> **avisoSaldo** · Quedan {IMPORTE} que todavía no has cobrado. Si cierras el trabajo, el botón
> «Cobrar el resto» desaparece y ya no podrás cobrarlos desde YaQu. Puedes cerrarlo igualmente: por
> ejemplo, si ya lo cobraste por otra vía o lo das por perdido.
> **confirmar** · Quedan {IMPORTE} sin cobrar. Al cerrar el trabajo ya no podrás cobrarlos desde
> YaQu. ¿Cerrar de todas formas?

Tres decisiones del texto, con su porqué: dice **lo que se pierde y dónde** en vez de «no se puede
deshacer», que es cierto y no informa. La última frase **convierte el aviso en información**: nombra
los dos motivos legítimos para cerrar con saldo, y sin ella el texto sonaría a regañina sobre una
acción que es perfectamente válida. Y **«desde YaQu»** deja claro que el dinero no desaparece —
desaparece la vía.

**EL GUARD DEL MARCADOR NO SE BORRA: SE SUSTITUYE POR UNO MÁS FUERTE.** Mientras no había texto
aprobado, el guard exigía `[PENDIENTE microcopy oficial]` en cada ranura, y eso solo impedía
INVENTAR. En cuanto hay texto aprobado esa comprobación deja de poder decir nada, y lo que hace falta
es impedir **cambiarlo**: ahora las cinco ranuras se comparan carácter a carácter contra la copia
canónica del test. Es lo que la regla 30 quiere decir y hasta ahora solo aproximaba — el texto lo
aprueba el fundador, también cuando se toca después. El guard ESTRUCTURAL («la sección no escribe ni
una palabra suelta; todo sale de `CIERRE_TEXTOS`») **no se toca**: es la mitad que no caduca, y es la
que impide esquivar la tabla escribiendo la frase directamente en la vista.

**Y UN GUARD NUEVO: el texto NO nombra el documento fiscal** (ni «factura», ni «justificante», ni
«recibo»). Un merchant ES sin `INVOICING_ES_ENABLED` recibe un justificante (Parte M) y este copy lo
lee él. ⚠️ **No se puede delegar en el trinquete de SCRUM-299: excluye `public/dashboard/` a
propósito** (`scrum299-copy-factura-publico.test.mjs:128`), así que un verde de `npm test` no habría
probado nada. Las frases se pasaron por `promesasDeFactura` directamente ANTES de aprobarlas, y el
guard nuevo lleva su control positivo para no ser ciego a lo que vigila.

## Lo que NO cubre

* **No se abre reapertura** ni se toca la FSM ni `canTransition` (decisión 4).
* **No se avisa cuando lo pendiente ya está facturado y sin pagar.** Es deliberado: ahí cerrar no
  mata ningún cobro, la factura sigue viva. Si se decide que también merece aviso, es otra decisión y
  cambia una línea de `avisoCierreTrabajo`.
* **La matriz de dispositivos reales** (Android gama media / iPhone / tablet, V0-5) es humana y por
  bloque. Las capturas son de un navegador de escritorio redimensionado. Se declara como hueco.
* **No se ejecuta la vista en la suite**: no hay banco de DOM y montarlo sería dependencia nueva
  (regla 36). Lo que corre en `npm test` es la regla pura y el AST de la vista; el navegador se
  ejercitó a mano y quedó en las capturas.

## Ficheros

* `public/dashboard/js/jobsCierreTrabajo.js` (**nuevo**) — la regla y las cinco ranuras de texto.
  Fuente única: la vista pinta desde aquí y el guard verifica contra aquí.
* `public/dashboard/js/jobsView.js` — el cierre sale del renglón de acciones y pasa a
  `jobCierreSection`, al pie de la tarjeta.
* `public/dashboard/index.html` · `public/sw.js` — alta del script (HTML y `SHELL`, mismo orden).
* `tests/_censo-cierre-trabajo.mjs` (**nuevo**) — censo AST de los cierres, sus guardas y sus textos.
* `tests/scrum344-cierre-con-saldo.test.mjs` (**nuevo**, 15 tests, sin gate).
* `docs/capturas/scrum-344/` — antes/después, 390 px con importes grandes, y el hueco declarado.
