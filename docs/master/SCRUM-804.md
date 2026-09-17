# SCRUM-804 · El tablero contra el árbol: 51 de los 165 abiertos ya están construidos y vigilados

**Fecha:** 7-sep-2026 · **Carril:** proceso · censo · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `349350c8a7a34f24e9263aba1ca2af36e3cb4a91` · 2026-09-07T02:48:35+01:00
**Árbol:** mi rama no lleva ni un commit sobre `origin/main` al medir, así que **el censo es contra
main por construcción**: no hay delta que declarar.

> 🛑 **ESTE TICKET NO CIERRA NADA.** Es una medición. Ni un ticket transicionado, ni un estado
> tocado en Jira. Lo que sigue es la lista para que el fundador decida, no una lista de cerrados.

---

## Antes de escribir una línea: ¿sirve `censo-tablero-vs-arbol.mjs`?

**Sirve para la mitad, y no sirve justo para la que pedía el encargo.** Concreto:

| | |
|---|---|
| ✅ **Sirve** | Su motor `tests/_censo-tickets.mjs` (SCRUM-388) responde POR TICKET desde tres fuentes del árbol —commits que lo nombran, entrada de máster, ramas— y ya sabe devolver `NO_MEDIBLE` cuando un número está compartido. Eso lo he **usado**, no reescrito: `numeroDeRama` y `numeroDeEntrada` salen de él. |
| 🔴 **No sirve** | **Su población nace del ÁRBOL, no del tablero.** `poblacionDe()` deriva los números de las ramas, las entradas y los commits. Un ticket abierto que nadie ha tocado **no existe** para ese censo: no puede salir NO HECHO porque no llega a entrar. Y la pregunta de este encargo empieza justo al revés — «de estos 165 abiertos, ¿cuáles?». |
| 🔴 **No sirve** | Sus veredictos responden **«¿qué rastro dejó este número?»**. El encargo pide otra cosa: **«¿está el comportamiento en main Y hay guard que lo vigila?»**, con el nombre del test que caería. El rastro no contesta eso — y la regla 23 dice por qué: un commit con el número puesto no es trabajo hecho. |

Por eso lo nuevo es una **capa encima**, no un sustituto: `scripts/censo-abiertos-vs-guards.mjs`.
Y baja al repositorio en vez de quedarse en el scratchpad, que es exactamente el defecto que
nombra [SCRUM-753](SCRUM-753.md).

---

## La población: 165, y coincide con el tablero

Dos consultas JQL paginadas (`project = SCRUM AND statusCategory != Done`), unidas y deduplicadas:

```
ABIERTOS RECOGIDOS : 165   (el tablero dice 165)   ·   hasNextPage: false
por TIPO   : Tarea 114 · Error 44 · Epic 7
por ESTADO : Tareas por hacer 90 · Acción del fundador 27 · En curso 26 · En revisión 22
rango      : SCRUM-16 … SCRUM-809
```

### 🔴 Corrección al control positivo del encargo

El encargo manda declarar HECHO a **793, 794, 796, 769, 749, 758, 801 y 806**. Medido en Jira:

**793, 794, 796 y 769 NO están entre los 165**: los cuatro tienen estado *Finalizada* y resolución
*Listo*. Salieron de la población por la puerta buena. No los he metido a la fuerza para que el
control cuadrara — el control aplicable a esta población es de **cuatro**, no de ocho, y los cuatro
que quedan (749, 758, 801, 806) **salen HECHO**. Los negativos (807, 809) están abiertos y salen
**NO HECHO**. Los seis pasan.

---

## Obligación 1 · el criterio, y por qué no es «existe el fichero»

La trampa que el encargo nombra es real y la he medido: **`tests/scrum727-constancia-del-vigia.test.mjs`
existe, está verde, y vigila el vigía del despliegue** — mientras el ticket SCRUM-727 habla de que
«la lista de Trabajos es un desastre». Mismo número, otro sujeto. Contar ficheros da ese HECHO.

Un ticket es **HECHO** si cumple una de estas dos, y además el trabajo **aterrizó** (rama
enteramente dentro de main, o entrada de máster suya):

- **E1 · mutación declarada.** El arnés `meta:mutaciones` **nombra** el test que cae si se
  deshace. Es la prueba más fuerte que hay en la casa. **16 tickets.**
- **E2 · el guard está vivo en la tanda.** Un test suyo **pasa sin saltar** y **asevera sobre
  código de producto** (por AST: imports a `dist/`/`src/`, o rutas de producto armadas y leídas).
  No es existencia: **si el comportamiento aseverado no estuviera en main, ese test estaría rojo**,
  y la tanda tiene 0 fallos. **35 tickets más.**

Los 16 de E1 cumplen **también** E2 (16 de 16), así que las dos evidencias concuerdan donde se solapan.

### El punto ciego que casi me cuesta el control positivo

La primera versión del detector sólo miraba literales pegados al lector, y dio **NO HECHO al
SCRUM-806**, que es control positivo. El fallo era mío, no del 806: la casa no escribe
`readFileSync('src/x.ts')`, arma la ruta antes y lee la **variable** —

```js
const PORTAL = path.join(RAIZ, 'src/modules/system/app/routes/customerPortal.routes.ts');
const sf = (f) => ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), …);
```

Con el armador dentro, los candidatos pasaron de **45 a 54**, y el cubo «tiene fichero con el
número pero ningún guard vivo» bajó de 25 a 13. El freno va con él: un `path.join` a `src/` **no
cuenta si el fichero no lee nada**, o mencionar una ruta sería prueba (el error del `'dist'` suelto
de SCRUM-763). Las tres cosas están declaradas como mutaciones del guard nuevo.

### Dos discriminadores que probé y TIRÉ

No los escondo, porque el que se quedara habría inflado la cifra:

| discriminador | por qué lo tiré |
|---|---|
| **Enlace por commits** — «el guard vigila un fichero que los commits del ticket tocaron» | **Contaminado**: el commit que añade el guard toca su propio sujeto. Aprobaba a los sospechosos (727, 328, 242) y **tumbaba al 758, que es control positivo**. |
| **Parecido título-de-Jira ↔ título-de-entrada** (containment ponderado por IDF) | Mata verdaderos: 765 (0,16), 623 (0,15), 359 (0,17), 555, 561 son paráfrasis legítimas, y el 758 se queda en 0,19. Para cazar al 727 se llevaba por delante a seis. |

**No hay discriminador mecánico barato** que distinga «el guard vigila el sujeto del ticket» de
«un guard lleva el número del ticket» a escala de 165. Lo digo en vez de elegir el que favorece.

Lo que **sí** es sólido, y es lo que apliqué:

- **La entrada se autodeclara.** Dos entradas dicen en su cabecera que no construyeron nada
  —SCRUM-328 «cero construcción», SCRUM-242 «Entregable: **MEDICIÓN, no código**»—. Filtro
  textual, 2 aciertos, 0 falsos positivos, ningún control tocado.
- **Un caso verificado a mano.** Leí las **14** entradas con menor acuerdo título↔entrada, que es
  donde asomaría la patología. Trece eran paráfrasis del mismo sujeto. Una no: **SCRUM-727**, cuya
  entrada de máster se titula «el vigía deja constancia de cada ejecución». Número reutilizado
  para otro trabajo. Retirado del HECHO.

**54 mecánicos − 2 autodeclarados − 1 verificado = 51.**

---

## Obligación 3 · las tres cifras

| veredicto | tickets |
|---|---|
| **HECHO** — está en main y hay guard que lo vigila | **51** |
| **NO HECHO** — no está | **106** |
| **NO MEDIBLE** — no describe nada comprobable por el árbol | **8** |
| **SUMA** | **165 = la población. Suman.** |

**NO MEDIBLE son 8** y sólo 8, por regla estricta: las **7 épicas** (276, 280, 281, 307, 571, 572,
573 — todas «BLOQUE X») más **SCRUM-658**, que es el bloque B del sprint Tecnosel y no es épica.
Probé a ensanchar el cubo con «el título no nombra ningún artefacto de código» y **lo descarté
midiéndolo**: daba 123 de 165, con el 665, el 756, el 758, el 801 y el 807 dentro. El título es
prosa, no señal.

### 🔴 El titular: 25 de los 51 hechos siguen en «Tareas por hacer»

| estado en el tablero | de los 51 HECHO |
|---|---|
| Tareas por hacer | **25** |
| En revisión | 14 |
| En curso | 8 |
| Acción del fundador | 4 |

Veinticinco tickets construidos, con guard vivo y en verde, esperando en la cola como si nadie los
hubiera tocado. Eso es lo que [SCRUM-738](SCRUM-738.md) dijo que pasaba, ahora con la lista.

---

## Obligación 2 · la lista de HECHOS, ordenada

Con su prueba: el guard, el fichero de producto que asevera (y la línea), y el test que caería si
el comportamiento se deshiciera. **·arnés** marca los 16 con mutación declarada, donde el nombre
del test que cae **no es una inferencia mía: lo nombra el arnés y se ha visto caer**.

| # | estado en el tablero | prueba: guard · qué asevera · test que caería |
|---|---|---|
| **195** | Tareas por hacer | `scrum195-lectura-serializacion.test.mjs` · `../dist/modules/quotes/domain/billingPlan.js`:26 · «🔴 con el ORIGINAL ya cobrado entero y un ADICIONAL pendie» |
| **331** | Acción del fundador | `scrum331-heroe.test.mjs` · `../scripts/_cifras-heroe.mjs`:19 · «SCRUM-331 · 🔴 SUELO: si el extractor no lee el héroe, se » |
| **333** | Acción del fundador | `scrum333-tarjetas-gremio.test.mjs` · `../scripts/_gremios-landing.mjs`:19 · «SCRUM-333 · 🔴 SUELO: sin catálogos, el derivador se decla» |
| **359** | Tareas por hacer | `scrum359-tres-relojes.test.mjs` · `../dist/modules/jobs/domain/ventanaDeFirma.js`:24 · «SCRUM-359 · SUELO: el módulo se carga y contrasta un caso » |
| **514** | En curso | `scrum514-leeme-multilinea.test.mjs` · `../dist/modules/exports/domain/portabilidadCompleta.js`:29 · «SCRUM-514 · SUELO: el LÉEME se carga y tiene contenido» |
| **555** | En revisión | `scrum555-lo-que-el-censo-no-ve.test.mjs` · `../scripts/censo-anclas-bloque-f.mjs`:27 · «SUELO · el parser encuentra texto, y la pila de etiquetas » |
| **557** | En revisión | `scrum557-alcance-por-identidad.test.mjs` · `../scripts/censo-anclas-bloque-f.mjs`:24 · «SCRUM-557 · 🔴 RETIRAR EL MARCADOR DE APROBACIÓN NO SACA L» |
| **561** | En revisión | `scrum561-citar-fuera-del-esquema.test.mjs` · `../scripts/_citar-fuera-del-censo.mjs`:21 · «SUELO · hay nodos fuera del esquema, y las tres secciones » |
| **568** | En revisión | `scrum568-promesa-con-mecanismo.test.mjs` · `../scripts/censo-anclas-bloque-f.mjs`:25 · «SUELO · hay afirmaciones condicionadas a un flag, y son nu» |
| **570** | En revisión | `scrum570-cr-en-disco.test.mjs` · `../scripts/censo-cr-en-disco.mjs`:21 · «SCRUM-570 · el contador ve los CR, y sabe decir cero» |
| **577** | Tareas por hacer | `scrum577-nombre-para-documento.test.mjs` · `../dist/core/documentos/nombreParaDocumento.js`:24 · «SCRUM-577 · SUELO: la función responde y DISTINGUE los dos» |
| **582** | Tareas por hacer | `scrum582-seleccion-multiple-clientes.test.mjs` · `public/dashboard/js/customersView.js`:27 · «SCRUM-582 · 🔴 SELECCIONAR TODO selecciona LO FILTRADO, no» |
| **589** | Tareas por hacer | `scrum589-nombre-por-documento.test.mjs` · `../dist/core/documentos/nombreParaDocumento.js`:33 · «SCRUM-589 · la elección invierte la PREFERENCIA, no el res» |
| **591** | Tareas por hacer | `scrum591-alta-desde-el-documento.test.mjs` · `public/dashboard/js`:29 · «SCRUM-591 · 🔴 SUELO: el censo VE los selectores de client» |
| **608** **·arnés** | Tareas por hacer | `scrum608-tipo-de-documento-en-la-cabecera.test.mjs` · `../scripts/meta-guard-mutaciones.mjs`:47 · «SCRUM-608 · SUELO: leo de verdad la primera línea de un PD» |
| **622** | Tareas por hacer | `scrum622-desconocido-no-es-verde.test.mjs` · `../dist/modules/jobs/domain/pendientesFacturar.service.js`:237 · «SCRUM-622 · SUELO: `api.js` carga y publica la decisión de» |
| **623** | Tareas por hacer | `scrum623-desglose-por-tipo.test.mjs` · `../dist/lib/pdf.js`:34 · «SCRUM-623 · SUELO: el instrumento lee un PDF de verdad» |
| **631** **·arnés** | En curso | `scrum631-la-unicidad-tiene-vigilante.test.mjs` · `../dist/core/db/unicidadNombreProducto.js`:42 · «SCRUM-631 · POSITIVO: el índice TOTAL de hoy cuenta como g» |
| **636** | Tareas por hacer | `scrum636-sitio-unico-dinero.test.mjs` · `../dist/core/utils/utils.js`:41 · «SCRUM-636 · SUELO: el sitio único y su consumidor responde» |
| **639** | Tareas por hacer | `scrum639-vocabulario-sale-de-la-puerta.test.mjs` · `../scripts/guards-visuales.mjs`:30 · «SCRUM-639 · DIRECCIÓN A · midió y encontró defectos → sale» |
| **642** | Tareas por hacer | `scrum642-tramos-del-arranque.test.mjs` · `../scripts/_navegador.mjs`:25 · «SCRUM-642 · 🔴 SUELO: con el doble, el arranque llega hast» |
| **645** | Tareas por hacer | `scrum645-la-puerta-no-tira-los-tramos.test.mjs` · `../scripts/guards-visuales.mjs`:23 · «SCRUM-645 · 🔴 SUELO: la puerta entiende la marca que el g» |
| **646** | Tareas por hacer | `scrum646-cortafuegos-defaultvat.test.mjs` · `src/core/i18n/locales.ts`:171 · «SCRUM-646 · SUELO: el detector VE, y no lo confunde un com» |
| **647** | Tareas por hacer | `scrum647-presupuesto-tambien-neutral.test.mjs` · `../dist/lib/pdf.js`:43 · «SCRUM-647 · SUELO: leo un PDF de presupuesto de verdad» |
| **648** | En curso | `scrum648-verde-que-no-sabe.test.mjs` · `../dist/modules/jobs/domain/pendientesFacturar.service.js`:32 · «SCRUM-648 · ✅ los límites ilegibles ya NO salen verde — de» |
| **654** | Acción del fundador | `scrum654-dictado-sin-conexion.test.mjs` · `public/dashboard/js/voiceInput.js`:38 · «SCRUM-654 · SUELO: el fichero se EJECUTA y expone su super» |
| **659** | Tareas por hacer | `scrum659-lector-de-lineas-del-pdf.test.mjs` · `../dist/lib/pdf.js`:118 · «SCRUM-659 · 🔴 CON salto dice DOS líneas · SIN salto dice » |
| **660** | Tareas por hacer | `scrum660-iva-defecto-del-documento.test.mjs` · `../public/dashboard/js/tiposDeIva.js`:205 · «SCRUM-660 · SUELO: la pantalla pinta y el escáner ve selec» |
| **661** | Tareas por hacer | `scrum661-el-coste-no-llega-al-papel.test.mjs` · `../dist/core/validation/schemas.js`:42 · «SCRUM-661 · SUELO: el lector VE líneas de un PDF de verdad» |
| **664** | Tareas por hacer | `scrum664-el-compilador-como-censo.test.mjs` · `src/modules/products/app/routes/products.routes.ts`:36 · «SCRUM-664 · 🔴 EL CASO QUE DECIDE: el compilador ve las TR» |
| **667** | Tareas por hacer | `scrum667-marcador-visible.test.mjs` · `../scripts/censo-marcadores.mjs`:39 · «SCRUM-667 · 🔴 SUELO: el censo LEE el árbol antes de dar u» |
| **676** | Tareas por hacer | `scrum676-hojas-del-indice.test.mjs` · `public/dashboard/index.html`:34 · «SCRUM-676 · el índice declara DOS hojas locales, y son las» |
| **687** | Tareas por hacer | `scrum687-constancia-del-alter.test.mjs` · `../dist/core/db/constanciaDelAlter.js`:22 · «SCRUM-687 · ✅ POSITIVO: una que existe y una inventada → d» |
| **690** | Tareas por hacer | `scrum690-contraste-segmented.test.mjs` · `public/tokens.css`:76 · «SCRUM-690 · 🔴 CONTROL POSITIVO: el medidor de contraste d» |
| **693** | Tareas por hacer | `scrum693-filtro-de-comentarios.test.mjs` · `public/dashboard/js/customersView.js`:257 · «SCRUM-693 · SUELO: el filtro CONSERVA el código y QUITA lo» |
| **716** | En revisión | `scrum716-vigia-no-dice-al-dia-sin-mirar.test.mjs` · `../scripts/_vigilante-de-despliegue.mjs`:27 · «SCRUM-716 · 🔴 SUELO: el enumerado ve más de un camino» |
| **738** **·arnés** | En curso | `scrum738-el-tablero-contra-el-arbol.test.mjs` · `../scripts/censo-tablero-vs-arbol.mjs`:29 · «SCRUM-738 · 🔴 «72» NO casa con 720, 727 ni 1727 — se comp» |
| **749** **·arnés** | En revisión | `scrum749-la-primitiva-que-normaliza.test.mjs` · `../dist/core/zonaDelMerchant.js`:32 · «SCRUM-749 · 🔴 un día que NO EXISTE se RECHAZA, no se norm» |
| **753** **·arnés** | En revisión | `scrum753-censo-de-alcanzabilidad.test.mjs` · `../scripts/meta-guard-mutaciones.mjs`:32 · «SCRUM-753 · los TRES estados, cada caso reproducido en el » |
| **756** **·arnés** | Tareas por hacer | `scrum756-el-rechazo-se-ve.test.mjs` · `public/dashboard/js`:46 · «SCRUM-756 · SUELO: el dashboard monta y el formulario comp» |
| **758** **·arnés** | En curso | `scrum758-cabecera-no-miente.test.mjs` · `../scripts/meta-guard-mutaciones.mjs`:218 · «SCRUM-758 · SUELO: el guard VE entradas, y sabe cuántas pu» |
| **763** **·arnés** | En revisión | `scrum763-restaurar-el-arbol.test.mjs` · `../scripts/frontera-dist.mjs`:38 · «SCRUM-763 · sólo se compila lo que se compila» |
| **765** **·arnés** | En curso | `scrum765-la-puerta-y-el-suelo.test.mjs` · `../scripts/_puerta-de-entrada.mjs`:35 · «SCRUM-765 · la puerta ABRE en todas las formas de invocaci» |
| **771** **·arnés** | En curso | `scrum771-el-emisor-no-valida-el-tipo.test.mjs` · `../dist/core/validation/tiposIvaEmitibles.js`:44 · «SCRUM-771 · CENSO: toda boca que emite comprueba el tipo d» |
| **775** **·arnés** | En revisión | `scrum775-suelo-que-no-dispara.test.mjs` · `../scripts/_censo-suelos.mjs`:44 · «SCRUM-775 · 🔴 el banco reproduce el encogimiento, y el su» |
| **777** **·arnés** | En revisión | `scrum777-el-modal-escondido-no-mata-la-n.test.mjs` · `public/dashboard/js`:34 · «SCRUM-777 · 🔴 abrir y CERRAR la ficha de cliente NO deja » |
| **781** **·arnés** | En revisión | `scrum781-concurrencia-de-la-factura.test.mjs` · `../dist/modules/invoicing/domain/invoicing.service.js`:58 · «SCRUM-781 · SUELO: la dispersión se calcula, y DISTINGUE m» |
| **783** **·arnés** | En revisión | `scrum783-seleccion-sobrevive-navegacion.test.mjs` · `../scripts/meta-guard-mutaciones.mjs`:28 · «SCRUM-783 · 🔴 EL QUE DECIDE: marcar tres, ver una ficha y» |
| **785** **·arnés** | En curso | `scrum785-productos-y-proveedores-descuelgan.test.mjs` · `public/dashboard/js`:35 · «SCRUM-785 · 🔴 Productos: tras EDITAR y cerrar NO queda un» |
| **801** **·arnés** | Acción del fundador | `scrum801-el-respaldo-de-la-n.test.mjs` · `../scripts/censo-respaldo-de-la-n.mjs`:29 · «SCRUM-801 · SUELO: el censo VE la población y los destinos» |
| **806** | En revisión | `scrum806-el-pdf-del-portal.test.mjs` · `src/modules/system/app/routes/customerPortal.routes.ts`:40 · «SCRUM-806 · SUELO + ✅ CONTROL POSITIVO: el extractor SÍ ve» |

---

## Obligación 4 · los grupos que hablan de lo mismo

Nombrados, **sin plegar**: la decisión de fundir o no fundir es del fundador, no mía.

| grupo | tickets | qué comparten |
|---|---|---|
| **G1 · El PDF de una factura EMITIDA se rehace con los datos de hoy (regla 29)** | **665**, **762**, **729** | 665 es la unión («el código *y* los datos»); 762 mide el mecanismo (fs efímero de Railway, `existsSync` que falla siempre); 729 es la mitad de los datos del cliente en vivo. Uno de los tres sobra, o los dos hijos cuelgan del padre. |
| **G2 · El trinquete vigila el NOMBRE, no el VALOR** | **664**, **706** | El propio título del 706 empieza «El agujero ① de SCRUM-664». Mismo defecto, medido dos veces. |
| **G3 · «Válido hasta» por defecto** | **630**, **722** | 630: suma 30×24 h en vez de 30 días. 722: el defecto y el atajo de 30 días dan días distintos. Mismo módulo, misma primitiva de fechas — y **misma familia que el SCRUM-749** ya cerrado en árbol. |
| **G4 · Razón social vs nombre comercial** | **577**, **589**, **779** | 577 (CONT-04) y 589 (CONT-18) son el mismo campo; ambos salen **HECHO** contra `dist/core/documentos/nombreParaDocumento.js`. 779 es la preferencia por merchant, que necesita columna nueva y **espera firma**. |
| **G5 · El semáforo dice VERDE lo que no sabe leer** | **622**, **648** | Dos puertas al mismo defecto de la casa: *un valor por defecto plausible es peor que un valor imposible*. Los dos salen HECHO, y los dos vigilan `pendientesFacturar.service`. |
| **G6 · `objetivo-tactil` no mide el dashboard** | **711**, **782** | 711: el guard corre FUERA de la tanda. 782: hace `goto('/')` y sólo mide la landing. Dos cegueras del mismo guard; el arreglo es uno. |

**Y tres parejas que NO son duplicados, aunque el detector las junte** — las nombro para que nadie
las funda por error: **582 + 783** (una es la funcionalidad de selección múltiple, la otra un bug
dentro de ella), **16 + 142** (FISCAL-1 y su continuación 1b, bloqueada por dictamen) y
**571 + 572** (bloques hermanos del lote Holded, no el mismo bloque).

---

## Las ramas, no sólo main (el caso del 512)

`git ls-remote --heads origin` completo: **536 ramas**, **385 con número de ticket**. Cruzadas con
los 165 y con `merge-base --is-ancestor` contra `origin/main`:

| | |
|---|---|
| abiertos con rama **enteramente dentro de main** | **75** |
| abiertos con rama **sin mergear** (alguien trabajando) | **15** |
| abiertos con entrada de máster suya | **80** |
| abiertos con entrada **titulada para otro** | **0** |

Los 75 con rama dentro de main son trabajo entregado que el tablero no sabe que tiene. No todos
son HECHO —entregar no es vigilar—, pero ninguno debería estar en «Tareas por hacer» sin mirarlo.

---

## LA TANDA

| | |
|---|---|
| `npm test` | **5755 tests · 5653 pass · 0 fail · 102 skipped** · exit 0 |
| `guards:entrada` | 4 guards, 21 tests, verde |
| `frontera:dist` | 270 corresponden · 0 no · 0 sin `dist` |
| las 3 mutaciones nuevas | las tres **caen**, **nombran su propio test**, y el fichero vuelve **byte a byte** |
| censo del arnés | 39 guards · **107 declaraciones** (suelos 20 / 54) |

Y **tres rojos legítimos por el camino**, todos de guards de la casa cazándome a mí — que es la
única prueba de que no son decoración: declaraciones incompletas (745/757), `new URL().pathname`
(730) y ancla sin hora (267). Los tres están en los huecos o corregidos en el propio guard.

---

## HUECOS DECLARADOS

1. **El criterio E2 es mecánico y puede aprobar un guard que vigile otro sujeto.** El 727 lo
   demuestra y está retirado, pero **la misma patología puede quedar en los otros 50** y ningún
   test barato la encuentra: los dos que probé fallan sus controles (arriba). Lo que hay es la
   lista con su prueba, fichero y línea, para que se pueda comprobar a mano ticket a ticket.
2. **Sólo leí las 14 entradas de menor acuerdo.** No las 51. Es un muestreo dirigido al sitio donde
   la patología asoma, no un censo exhaustivo, y como tal se declara.
3. **La tanda por fichero salió del reporter de eventos, no del TAP.** Medido el 7-sep: con 300+
   ficheros en una invocación, el reporter `tap` de node emite **5.749 subtests planos y CERO
   líneas `# Subtest: tests/…`**. Un parser sobre TAP habría inventado la atribución. Queda escrito
   en `scripts/censo-abiertos-vs-guards.mjs` para que nadie lo vuelva a intentar.
4. **Los suelos del arnés están muy por debajo del censo real**: `SUELO_GUARDS = 20` y
   `SUELO_DECLARACIONES = 54` contra **39 guards y 107 declaraciones** medidos hoy. Aguantan, pero
   absorberían la pérdida de 53 declaraciones sin decir nada. **No lo toco** —es mecanismo
   compartido y otras ramas lo alimentan (regla 37)— y lo dejo apuntado como hallazgo.
5. **Y un guard de la casa me cazó a mí, que es la prueba de que sirve.** Declaré las tres
   mutaciones con `fichero: FUENTE` —una constante— y `lecturaDeDeclaraciones` sólo lee **literales
   de cadena**: las tres salieron INCOMPLETAS y la tanda se puso roja con
   `scrum804…: faltan fichero` ×3. Eso es exactamente el agujero que [SCRUM-757](SCRUM-757.md)
   cerró: antes una declaración coja **desaparecía en silencio** y el recuento bajaba de N a N−1
   sin que nada lo dijera. Corregido a literal en las tres, y el motivo queda escrito en el guard.
6. **No corrí `meta:mutaciones` entero contra este árbol.** Los 16 de E1 cumplen también E2, así
   que no cambiaría ni una cifra; el arnés se ejercitó sobre las 3 mutaciones nuevas, que caen,
   nombran su test y restauran byte a byte.


---

# APÉNDICE · 8-sep-2026 · La dimensión que le faltaba al censo: EN MAIN, EN RAMA VIVA, SIN RASTRO

**Fecha:** 8-sep-2026 · **Carril:** instrumentos / tablero · **Medido contra:** `origin/main` =
`52f19747e842c8379457cdcb5601ea79c17ff638`

> ⛔ Esto NO cierra ningún ticket y no toca el tablero. Entrega la lista y la cifra; cerrar es del
> asesor.

---

## 0 · Obligación 0, cumplida y con su contraste

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-804(-|$)"
  77fbf0b7…  refs/heads/scrum-804-el-tablero-contra-el-arbol
git merge-base --is-ancestor 77fbf0b7 origin/main   →  MERGEADA — sigue   (0 commits pendientes)
```

Y el contraste que el propio encargo pedía: un `grep 804` suelto sobre la salida de `ls-remote`
devuelve **2** líneas; la consulta anclada, **1**. La de más casa dentro de un SHA.

## 1 · 🔴 EL ROJO: el censo no es que no viera la rama viva — la presentaba como trabajo en `main`

Provocado antes de escribir una línea, llamando a `censarTicket` sobre el árbol vivo:

```
SCRUM-819   ENTERO   fuentes: ramas   scrum-819-el-menu-deja-rastro, …-al-dia
SCRUM-816   ENTERO   fuentes: ramas   scrum-816-lista-de-trabajos
SCRUM-820   ENTERO   fuentes: ramas   scrum-820-estados-en-castellano, …-al-dia
SCRUM-821   ENTERO   fuentes: ramas   scrum-821-la-lista-que-decide-que-se-mira
SCRUM-716   PARCIAL  fuentes: commits+docs/master+ramas
```

`ENTERO` es el veredicto más fuerte de ese censo, y sus filas se imprimen bajo el titular
**«PROPUESTA · tienen trabajo suyo en `main`»**. Ninguno de esos cuatro tiene una línea en `main`.

> El defecto no era una ausencia: era una **afirmación falsa**. Y es justo el falso positivo que la
> cabecera del propio censo llama el más caro — el que propone cerrar algo que nadie ha mergeado.

## 2 · ⛔ Lo que NO se ha escrito, porque ya existía

Buscar antes de escribir cambió el ticket entero. La regla que decide esto **ya vive en la casa**:

| pieza | de dónde | qué aporta |
| --- | --- | --- |
| `alcanzabilidadDe` | `_censo-alcanzabilidad.mjs` (SCRUM-753) | dentro/fuera a granel: 0,30 s vs 52,6 s rama a rama |
| `agruparRamas` | `_censo-reparto.mjs` (SCRUM-387) | agrupa por ticket sin confundir `scrum-2` con `…-rebasada-2`, y trata el `null` como INDETERMINADA |
| `instantanea` | `_censo-alcanzabilidad.mjs` (SCRUM-753) | congela el sha: la pregunta deja de ser móvil |
| `adelantoDe` | `_censo-alcanzabilidad.mjs` (SCRUM-753) | commits fuera de `main` = el TAMAÑO del trabajo vivo |

**El censo de alcanzabilidad ya contestaba la pregunta, y bien.** Corrido sobre los cinco
controles antes de tocar nada: 816/819/820/821 → **FUERA**, 716 → **DENTRO**. Lo que faltaba no era
el mecanismo: era que **el censo del tablero lo consultara**. Escribir aquí una segunda copia de
cualquiera de esas cuatro reglas habría sido el error que este mismo ticket se documentó en su
PASO 0 — «la misma regla implementada dos veces es cómo una de las dos se queda atrás».

Lo nuevo es **una pieza de costura**, `scripts/_rastro-del-ticket.mjs`, y el cableado en el CLI.

## 3 · Los tres veredictos (y el cuarto que no se pliega)

`EN MAIN` · `EN RAMA VIVA` · `SIN RASTRO`, y `INDETERMINADO` para la rama cuyo objeto no está en
local — que no contesta ni «dentro» ni «fuera» (provocado y medido en SCRUM-753). Plegarlo a
cualquiera de los tres sería inventarse una medición. Hoy son **0**.

**Basta UNA rama viva** para que el ticket salga `EN RAMA VIVA`: 819 y 820 tienen su original y su
`-al-dia`, y llamarlos EN MAIN por la que entrara sería el mismo falso positivo con otra cara.

En el CLI, el filtro que quita el falso positivo es exacto y **no retira a nadie por tener una rama
viva**: sólo al que tiene `ramas` como **única** fuente Y ninguna mergeada. SCRUM-600, 597 y 595
tienen trabajo en `main` *y* rama viva, y siguen siendo propuesta legítima.

## 4 · 🔴 LAS CIFRAS, medidas — y son DOS, no una

**Son dos preguntas distintas y mezclarlas sería exactamente el tipo de imprecisión que este
ticket persigue.** Cada una con su sha, porque `main` se movió TRES veces mientras se medía.

### ① Tickets a los que el censo llamaba «trabajo en `main`» sin tenerlo

Los que tienen `ramas` como **única** fuente y ninguna mergeada. Es el conjunto exacto del falso
positivo, y el que el CLI ya imprime aparte:

    → 14 ticket(s), sobre 89 ramas vivas de 558 remotas   (origin/main = 5c9e579f)

### ② Tickets ABIERTOS en el tablero con rama viva sin mergear — la cifra que pedía el encargo

Es más ancha: incluye a los que sí tienen trabajo en `main` **y además** una rama sin mergear.

| medición | sha de `main` | abiertos con rama viva |
| --- | --- | --- |
| primera pasada | `52f19747` | **17** |
| tras entrar 819, 820 y 600 | `5c9e579f` | **14** |

Los 14 de la última medición: 821, 816, 813, 809, 754, 729, 637, 632, 630, 626, 614, 597, 595, 576.

> 🔴 **LA CIFRA CADUCÓ MIENTRAS SE ESCRIBÍA, Y ESO ES EL DATO.** Entre las dos pasadas entraron
> **SCRUM-819 y SCRUM-820** (PR #1161 y #1162) y SCRUM-600. Un número sin su sha no es una
> medición: es una foto que nadie sabe de cuándo. Por eso las dos van con el suyo.

### La foto de Jira llegaba hasta el 818

Cruzando con `docs/verificacion/asuntos-jira.tsv` (tomada el 7-sep) salían **14** en la primera
pasada, no 17. La diferencia eran **819, 820 y 821**: la foto llega hasta SCRUM-818, así que **los
tres tickets que originaron este encargo caen fuera de ella**. Una foto con fecha es honesta; ésta
además estaba caducada justo donde importaba. La cifra buena se sacó contra **Jira en vivo**.

### Población

558 ramas remotas · **464 en `main`** · **94 vivas** · 0 indeterminadas (primera pasada).
De 525 tickets derivables: 332 DENTRO · **71 FUERA** · 122 NO MEDIBLE → tras los merges, 68 FUERA.

⚠️ `scrum-600-un-solo-front-documento` salía con **`+0`**: rama viva que no adelanta a `main` ni
un commit. No es trabajo pendiente — es residuo. El tamaño es lo único que lo distingue de sus
hermanas, y por eso la cifra va SIEMPRE con él.

## 5 · Verificación

- ✅ **CONTROL POSITIVO ENUMERADO** — 819, 816, 820 y 821 salen `EN RAMA VIVA`, las cuatro, con sha
  de 40 hex, adelanto > 0 y fecha. En el guard va la lista a mano a propósito: un control derivado
  del propio instrumento no caza que el instrumento deje de ver una familia entera.
- ✅ **CONTROL NEGATIVO** — SCRUM-716 (`scrum-716-el-verde-ciego`, mergeada) sale `EN MAIN`, con
  todas sus ramas `en-main` y adelanto 0. Es lo que separa «existe el nombre» de «hay trabajo».
- ✅ **SIN RASTRO es un veredicto**: un número sin rama lo devuelve, y no se confunde con EN MAIN.
- ⛔ **POR IDENTIDAD** — sobre el árbol vivo, SCRUM-2 no recoge `…-rebasada-2` ni
  `codeowners-zona-roja-v2`, y el discriminador se ejercita sobre los tres casos conocidos.
- 🔴 **SUELO** — cero ramas vivas **no** se lee como «está todo mergeado»: se declara sospechoso,
  porque es indistinguible de un clasificador que contesta «dentro» a todo. Se exige además
  `enMain > 0`: un instrumento que sólo sabe decir «viva» tampoco ha clasificado nada. Y el suelo
  se ejercita **sin árbol**, con las cuatro formas, para que su silencio sobre el árbol bueno
  signifique algo.

## 6 · Límites declarados

- **Este censo no lee Jira**, y sigue sin leerlo: la cifra de arriba la produjo esta sesión
  cruzando a mano. El CLI dice de qué mitad responde y de cuál no, en vez de fingir que sabe.
- **`SIN RASTRO` no es «no hay trabajo»**: una rama mergeada Y BORRADA deja el ticket sin rama y su
  trabajo dentro (medido en SCRUM-637 con `scrum-653-dos-firmas`). Por eso el dato se lee junto a
  las otras dos fuentes, nunca solo.
- **El import cierra un ciclo** (`censo-tablero-vs-arbol` → `_rastro-del-ticket` →
  `_censo-alcanzabilidad` → `censo-tablero-vs-arbol`). Es benigno —todas son declaraciones de
  función y ninguna se usa en la evaluación del módulo— y está **comprobado ejecutándolo**, no
  razonado. Queda declarado aquí porque la alternativa era una cuarta copia de `numeroDeRama`.
- **En la tanda se mide con `traer: false`**: contra el último `fetch`, no contra el remoto en
  vivo. El CLI sí trae.

## 7 · Lo que NO se ha tocado

`_censo-alcanzabilidad.mjs` · `_censo-reparto.mjs` · `_censo-tickets.mjs` (el motor) · ninguna rama
ajena · el tablero · ningún ticket cerrado. Sólo `ls-remote` y `merge-base`, lectura.


---

# APÉNDICE · 8-sep-2026 · SCRUM-804b · El caso INVERSO: trabajo vivo sobre tickets CERRADOS

**Ancla:** `origin/main` = `15b42968cff2dffdeb1e4ec6ab6ed733b3908ce1`, congelado a las
**2026-09-08T05:51:28Z**. Todo lo de abajo se mide contra ese objeto.
**Tablero:** Jira **en vivo**, no la foto versionada (que llega hasta SCRUM-818).

> ⛔ No se ha borrado ninguna rama, no se ha cerrado ni reabierto nada en Jira. Sólo `ls-remote`,
> `merge-base`, `log` y lectura de Jira.

## Población

554 ramas remotas · **468 en `main`** · **86 vivas** · 0 indeterminadas.
De las 86 vivas, 81 llevan número de ticket → **64 tickets**, de los cuales **54 están CERRADOS**.

**69 ramas vivas cuelgan de esos 54 tickets cerrados.**

## 🔴 El corte (a)/(b) que pedía el encargo — y por qué sale degenerado

| | |
| --- | --- |
| **(a)** rama viva con **0** commits por delante | **0** |
| **(b)** rama viva **CON** commits por delante | **69**, sobre 54 tickets |

**(a) es cero POR CONSTRUCCIÓN, y conviene decirlo antes de que parezca un hallazgo.** Una rama
con 0 commits por delante de `main` es, por definición, alcanzable desde `main` — o sea, el
clasificador la llama `en-main` y no `viva`. El «residuo que se borra y ya» **no vive en la lista
de vivas: son las 468 refs `en-main`**, que es donde hay que ir a limpiar.

Y no es una deducción de sobremesa: se midió. **Cero ramas vivas con `+0`** en toda la población,
que es justo la coherencia que el árbitro del guard exige (`viva` ⟹ adelanto ≥ 1).

## ⚠️ Lo que este censo NO puede afirmar, y sin esto la lista se lee mal

`merge-base --is-ancestor` mide **ASCENDENCIA, no CONTENIDO**. Una rama mergeada por *squash* o
reescrita por *rebase* mete su contenido en `main` con SHAs distintos: por ascendencia sigue
«viva», y su trabajo está dentro. Así que **de estas 69 no se puede decir «hay 69 trabajos
perdidos»** — se puede decir que hay 69 puntas de rama que `main` no alcanza.

Tres señales, medidas, que separan el grano:

| señal | ramas |
| --- | --- |
| llevan el sufijo `-rebasada` / `-rebasada-N` (la convención de re-empuje de la casa) | **12** |
| su ticket tiene **además** otra rama YA EN `main` → el trabajo entró plausiblemente por ella | **35** |
| 🔴 su ticket **no tiene NINGUNA rama en `main`** | **34**, sobre **30 tickets** |

**Los 30 del último grupo son la lista corta**, y son éstos:

`37 · 38 · 161 · 166 · 172 · 198 · 215 · 216 · 222 · 223 · 224 · 234 · 240 · 253 · 255 · 268 ·
270 · 275 · 309 · 312 · 329 · 340 · 381 · 390 · 397 · 412 · 440 · 566 · 606 · 683`

Aun así, «sin rama hermana en `main`» **tampoco prueba** que el trabajo falte: pudo entrar por un
commit directo o por un PR cuya rama se borró (medido en SCRUM-637 con `scrum-653-dos-firmas`).
**Lo que zanjaría la pregunta es una comparación por CONTENIDO** —`git cherry` / patch-id, que
marca los commits cuya versión equivalente ya está en `main`—. No se ha corrido: queda fuera de
las herramientas que este encargo autorizaba, y es el paso siguiente natural.

## La tabla — 69 ramas, 54 tickets cerrados, la más antigua primero

Reparto por mes del último commit: **julio 15 · agosto 44 · septiembre 10**.
Las cinco con más trabajo fuera: SCRUM-205 (+7) · SCRUM-300 (+7) · SCRUM-368 (+6) ·
SCRUM-475 (+6) · SCRUM-37 (+5).

*(La tabla completa, con ticket, título, rama, `+main`, fecha y autor, se entregó en el parte de
la sesión; se resume aquí por los cortes que la hacen accionable.)*

## Lo que esto sugiere hacer, sin hacerlo

1. **Las 468 refs `en-main`** son el residuo de verdad: se borran sin pensar. `ls-remote` dice que
   más de cuatro de cada cinco ramas del remoto ya están dentro.
2. **Los 30 tickets sin hermana en `main`** merecen una pasada por contenido antes de tocar nada.
3. **Nada de esto cierra ni reabre un ticket.** El tablero lo lleva el asesor.


---

# APÉNDICE · 8-sep-2026 · SCRUM-804b (2ª parte) · La comparación por CONTENIDO

**Ancla:** `origin/main` = `24f8cb4dcfd1dba2c9d9d857880952639273f214`, congelada a las
**2026-09-08T06:02:00Z**. Jira **en vivo**.

Sobre las **34 ramas de los 30 tickets CERRADOS** que la primera parte dejó como lista corta —los
que no tenían ninguna rama en `main`—, autorizado `git cherry` / `patch-id`.

---

## 🔴 LA CORRECCIÓN DE MÉTODO, que es lo que más vale de este encargo

### Lección 1 · `git cherry` contesta otra pregunta

> **`git cherry` contesta «¿está este parche exacto en `main`?», no «¿está este trabajo en
> `main`?».** Un rebase conserva el trabajo y destruye el patch-id.

Al rebasar sobre un `main` que se ha movido, el contexto del diff cambia; con el contexto cambia
el patch-id; y con el patch-id cambiado `cherry` marca `+` un commit cuyo trabajo está dentro.

**Un recuento de `+` a pelo habría dado 30 falsas alarmas, cuatro de ellas fiscales.**

### Lección 2 · Cómo se cazó: CONTROL DE RESPUESTA CONOCIDA

No se cazó razonando: se cazó porque **una de las respuestas se sabía de antemano**.

`git cherry` marcó `+` el commit *«SCRUM-234: cerrojo en la reserva de serie + censo de las dos
formas correctas»*. Y ese cerrojo **está en `main`**, en
`src/modules/invoicing/domain/invoiceNumber.service.ts:427`:

```
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
```

Es el cerrojo **sobre el que se construyó SCRUM-814 ese mismo día**. El instrumento decía que
faltaba algo que la sesión había leído y usado horas antes. Sin esa respuesta conocida, el `+`
habría pasado por hallazgo.

> Un instrumento nuevo se estrena contra un caso cuya respuesta ya se sabe. Si no hay ninguno,
> no se sabe si mide.

### 📌 Y consta, con fecha

**El asesor autorizó `git cherry` como decisivo el 8-sep-2026, y se equivocó.** Queda escrito aquí
a petición suya: la autorización era razonable y era falsa, y lo que la corrigió fue medir, no
discutir. La misma forma que ya arregló el corte (a)/(b) de la primera parte.

### Lo que SÍ contestó la pregunta

Tres señales, y ninguna sola decide:

| señal | qué aporta |
| --- | --- |
| `censarTicket` (SCRUM-388) | commits de `main` cuyo **asunto NOMBRA** el ticket |
| merges de `main` que nombran una rama suya | **por dónde entró** el trabajo |
| lectura del **contenido** (ficheros y mecanismo) | el árbitro final |

---

## El resultado: 28 TODO DENTRO · 2 PARCIAL · 0 NADA DENTRO

**Ningún ticket cerrado perdió su trabajo.** Los cuatro fiscales que se pidieron primero:

| Ticket | `cherry` | Veredicto | Entró por |
| --- | --- | --- | --- |
| SCRUM-215 · Factura a particular = rechazo | 3 `+` / 2 `−` | ✅ TODO DENTRO | PR #314, `scrum-215-rebasada` |
| SCRUM-216 · R1 sin TipoRectificativa | 2 `+` / 0 `−` | ✅ TODO DENTRO | PR #351, `scrum-216-consolidar-rebasada` |
| SCRUM-222 · Deriva de esquema en producción | 3 `+` / 0 `−` | ✅ TODO DENTRO | PR #788/#789, `scrum-222-deriva-al-dia` |
| SCRUM-234 · Carrera de numeración | 1 `+` / 2 `−` | ✅ TODO DENTRO | PR #362, `scrum-234-carrera-numeracion-medida` |

**Las tres ramas por las que entraron están BORRADAS del remoto.** Ésa es la razón de que la
primera parte los viera «sin hermana en `main`»: la rama que entró se borró y sobrevivió la
original superada. Es el caso que SCRUM-637 dejó declarado con `scrum-653-dos-firmas`, ahora
medido cuatro veces más.

**Sobre SCRUM-215 en concreto:** su trabajo está en `main` —16 menciones de `Destinatario` en
`verifactu.service.ts`, más `tests/scrum215-sin-destinatario.test.mjs` y
`public/dashboard/js/tipoDestinatarioPendiente.js`—. ⚠️ Por tanto **el defecto de SCRUM-729 (el NIF
del destinatario no viaja al PDF) NO se explica por «215 se cerró sobre nada»**: es otro hueco, y
sigue abierto.

## Los dos PARCIAL

**🔴 SCRUM-340 · el arreglo entró; su guard y su evidencia, no.**
`founding.ts` de `main` tiene el arreglo y es correcto
(`PLAZA_OCUPADA = { plan: 'founding', subscriptionStatus: 'active' }`). Pero **no están en `main`**:

- `tests/scrum340-contador-plazas-reales.test.mjs`
- `docs/master/SCRUM-340.md`

Un arreglo sin trinquete. Es el hallazgo accionable del barrido.

**SCRUM-38 · trabajo dentro, rama vieja superviviente.** Sus tres ficheros clave
(`scripts/seed-staging.mjs`, `.mcp.json`, `docs/QA/SUITE_REGRESION.md`) existen en `main`; el diff
contra la rama es sobre todo `main` habiendo evolucionado desde el 12-jul. Sin entrada de máster
propia. **No requiere acción de código**; su rama queda anotada como candidata a borrado — que lo
decide y lo ejecuta el asesor, no esta sesión.

## Suelo

`git cherry` **nunca** devolvió cero líneas sobre una rama con commits no-merge por delante, y las
cuentas cuadran ticket a ticket: `cherry` == commits sin merges (`rev-list --count --no-merges`).
No hubo ceguera.

⛔ Ninguna rama borrada. Ningún ticket cerrado ni reabierto.

---

# APÉNDICE · 8-sep-2026 (tarde) · Los suelos que sobreviven al auto-borrado de ramas

**Fecha:** 8-sep-2026 · **Carril:** proceso · censo · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `da5ac06ac169fca5d3692a63b10b01a6aed7d3d6` · 2026-09-08T10:33:34Z
**Fichero tocado:** `tests/scrum804-la-rama-viva.test.mjs` (y esta entrada). Nada más.

> 🛑 **ESTE APÉNDICE NO CIERRA NADA** ni toca el instrumento. `scripts/_rastro-del-ticket.mjs` y
> `scripts/censo-tablero-vs-arbol.mjs` quedan **exactamente como estaban**: acertaban.

## 0 · El síntoma que llegó, y la hipótesis que hubo que matar

Llegó como «CI ve 100 ramas y en local se ven 553; sus suelos caen por población corta», con la
hipótesis de que el censo pedía las ramas a la API de GitHub sin paginar —100 es el tamaño de
página por defecto—. **Se paró y se midió antes de arreglar nada.** Murió por dos sitios:

| medición | resultado |
| --- | --- |
| `grep -rn "api.github.com\|gh api\|octokit\|GITHUB_TOKEN" scripts/ tests/ package.json` | **0 resultados.** El censo lee `git for-each-ref refs/remotes/origin/` — [censo-tablero-vs-arbol.mjs:78](../../scripts/censo-tablero-vs-arbol.mjs#L78), [_rastro-del-ticket.mjs:150](../../scripts/_rastro-del-ticket.mjs#L150), [_censo-alcanzabilidad.mjs:185](../../scripts/_censo-alcanzabilidad.mjs#L185). Un tamaño de página no trunca lo que nunca se pide por red |
| `git ls-remote --heads origin \| wc -l`, dos veces con 20 min de diferencia | **102**, luego **105**. Un truncamiento por paginación da 100 clavado siempre; esto es una cuenta real que se mueve |

**El sentido era el contrario: CI tenía razón y el local estaba rancio.** `for-each-ref` lee refs
locales, que conservan las ramas borradas hasta que alguien poda; CI clona en limpio
(`actions/checkout@v4` + `fetch-depth: 0`) y por eso veía el remoto de verdad. Y los 26 worktrees
de esta máquina **comparten un único almacén de refs**: dos sesiones que miden «por separado» leen
el mismo almacén, así que los 553 eran una medición, no dos.

## 1 · La causa real: el auto-borrado de ramas al mergear

Activado ese mismo día. `_censo-alcanzabilidad.mjs:179` dejó escrito que el 6-sep `ls-remote` daba
**491**; el 8-sep daba **105**. Se llevó ~390 ramas mergeadas. Las refs dentro de `main` pasaron de
**464** (cifra que este mismo fichero escribió esa mañana) a **15**.

Tres controles de `tests/scrum804-la-rama-viva.test.mjs` cayeron. **Ninguno por un defecto:**

| control | qué exigía | por qué cayó |
| --- | --- | --- |
| positivo enumerado | «SCRUM-821 tiene rama en el remoto con su número» | se mergeó y **su rama se borró** |
| árbitro | `interrogadas.length >= 5` entre 819, 816, 820, 821, 716 | quedaban **4** (821 y 716 sin rama) |
| negativo | `soloMergeadas.length > 10`, con «había 464 ramas dentro de `main` al escribir esto» | quedaban **9**. Esa cifra se escribió esa mañana: **caducó en horas** |

`SCRUM-821 → SIN RASTRO` es hoy la respuesta **correcta**. Y el instrumento **ya lo tenía escrito**:
[_rastro-del-ticket.mjs:295](../../scripts/_rastro-del-ticket.mjs#L295) dice literal que «una rama
mergeada Y BORRADA deja el ticket sin rama y su trabajo dentro de `main`». El módulo lo sabía; el
test afirmaba lo contrario.

## 2 · 🔴 Por qué cambiar lo que el guard EXIGE no viola la regla 41

La regla 41 —«guard en rojo → se arregla el código, nunca el guard»— **presupone que lo que el
guard exige sigue siendo cierto.** Aquí la premisa dejó de serlo.

> **Un guard que exige que existan ramas ya borradas no protege nada: AFIRMA UN HECHO FALSO.
> Cambiar lo que exige NO es relajarlo cuando lo que exigía ha dejado de existir.**

La distinción que separa esto de una relajación: no se ha bajado ningún umbral para que pase. Se
han **retirado los umbrales** y se han sustituido por igualdades contra lo que `git` contesta en la
misma pasada. El guard de hoy es más estricto que el de ayer, no menos: el `> 100` no cazaba que
el censo perdiera ramas concretas mientras el total siguiera cómodo; la igualdad sí.

## 3 · El anclaje nuevo: `git log --merges`, que el auto-borrado no puede tocar

Un merge de PR deja rastro **permanente** en `main`: el commit de merge y su segundo padre siguen
siendo alcanzables aunque la rama desaparezca el mismo día. Hoy son **1.055 merges con nombre de
rama y número de ticket**, y esa población **sólo puede crecer**.

| control | antes | ahora |
| --- | --- | --- |
| SUELO | `resumen.total > 100` («había 558»), `enMain > 0`, `vivas > 0` | **igualdad** con `for-each-ref`, `--merged` y `--no-merged` en la misma pasada. Sin cifras |
| POSITIVO | `LOS_CUATRO = [819, 816, 820, 821]` | **no nombra a nadie**: re-deriva la agrupación con git en crudo y exige que el censo no **pierda** ni **invente** ninguna rama |
| ÁRBITRO | 5 tickets enumerados, `>= 5` ramas | población de `git log --merges` + **respuesta conocida** (el segundo padre de un merge está dentro de `main` por construcción) + coherencia sobre **las 104 ramas**, no sobre 5 |
| NEGATIVO | `soloMergeadas.length > 10` | igualdad de conjuntos contra `--merged`, más un sujeto de la historia de merges para cuando no quede ninguna ref mergeada |

El árbitro va **a granel con un solo `git rev-list`** (1.660 merges sin 1.660 procesos) y contrasta
ese atajo contra `merge-base --is-ancestor` en los dos sentidos, para que no se crea a sí mismo.

**El positivo enumerado no se ha debilitado al dejar de nombrar tickets: se ha ensanchado.** Antes
comprobaba que se vieran 4 tickets; ahora comprueba que no se pierda **ninguna** de las 99 ramas
con forma canónica, que es el modo de fallo que la enumeración quería cazar.

## 4 · 🔴 El control que evita la sexta vez: el guard se vigila a sí mismo

Los tres que cayeron tenían la misma forma —`> 100`, `>= 5`, `> 10`—: tres cifras escritas a mano,
las tres **bien medidas el día que se escribieron**, las tres caducadas por un cambio de política
que ninguna podía prever. «No escribas umbrales a mano» como comentario es un recordatorio, y los
recordatorios se incumplen.

El último test recorre **su propia fuente con AST** y cae si encuentra cualquier comparación
relacional contra un literal numérico distinto de `0`. El `0` es la única excepción y está
justificada: `x.length > 0` no afirma una magnitud del árbol, dice «hay población o estoy ciego».

**AST y no `grep`**, por la razón de siempre: un guard de texto se caza a sí mismo en el párrafo
que explica la prohibición — ese párrafo lleva un `> 100` escrito.

**Su rojo, ejecutado:** inyectado `historia.length > 0` → `> 10`, la tanda cae con

```
🔴 UMBRAL ESCRITO A MANO en este fichero:
   · scrum804-la-rama-viva.test.mjs:238 · historia.length > 10
```

Restaurado byte a byte y verificado por `sha256`
(`5ff45eddfea9e8f6bd910828d7cafaca599934db88f664ab4f99061940a640d9` antes y después).

**Y cazó un caso mío antes que el inyectado:** `partes.length < 3` en el parseo de `git log`. Es una
constante de formato, no un umbral del árbol — pero **no se le puso excepción**: una lista de
excepciones es deuda. Se reescribió el parseo para no necesitar el número.

## 5 · ⚠️ Hallazgo de otro carril: `scrum637:164` está en la misma cuenta atrás

Medido de paso, **no arreglado** (regla 9: hallazgo de otro carril se reporta):

| dónde | qué exige | hoy | veredicto |
| --- | --- | --- | --- |
| [scrum637-la-rama-que-nadie-mira.test.mjs:164](../../tests/scrum637-la-rama-que-nadie-mira.test.mjs#L164) | `dentro.length > 10` — ramas **dentro de `main`** | **14** | 🔴 **MISMA FORMA Y MISMA POBLACIÓN.** Cuenta justo lo que el auto-borrado destruye. Margen: **4 ramas**. Cae en los próximos merges |
| [scrum775-suelo-que-no-dispara.test.mjs:264](../../tests/scrum775-suelo-que-no-dispara.test.mjs#L264) | `real.conectados.length > 10` y `real.guards > 20` | verde | ⚠️ misma **forma** (magnitud escrita a mano), **población distinta**: cuenta guards del árbol, que sólo crecen. No está en cuenta atrás |

La distinción importa: lo que pone a `scrum637` en peligro no es tener un número escrito, es tener
un número escrito **sobre una población que una política del repositorio está vaciando**.

## 6 · Verificación

- **9/9 en verde**, `# skipped 0`. Los 8 controles reescritos pasan sobre el árbol vivo.
- **El rojo del control nuevo, ejecutado y pegado** (§4), con restauración verificada por `sha256`.
- **Tanda completa en verde**: los 3 rojos que frenaban los PR quedan en 0.
- ⛔ No se ha podado el almacén de refs: es **compartido por los 26 worktrees**, y podar aquí se lo
  poda a las otras cinco sesiones. Sólo `git fetch origin main`.

## 7 · Lo que NO se ha tocado

`scripts/_rastro-del-ticket.mjs`, `scripts/censo-tablero-vs-arbol.mjs`, `scripts/_censo-reparto.mjs`
y `scripts/_censo-alcanzabilidad.mjs` quedan intactos: el defecto no estaba en ellos. Ninguna rama
borrada, ningún ticket cerrado ni reabierto, ninguna dependencia nueva.

---

# APÉNDICE · 15-sep-2026 · SCRUM-804c · El barrido de cierre: los 112 abiertos de hoy, en tres clases

**Medido contra:** `origin/main` = `07ccd16c92e37350e785526232d03b7f0c637684` · 2026-09-09T16:03:28+00:00
**Rama:** `scrum-804c-barrido-de-cierre` · **Carril:** proceso · censo · **Gate:** sin gate

> ⛔ **ESTE APÉNDICE NO CIERRA NADA Y NO TOCA EL TABLERO.** Ni una transición, ni un comentario en
> Jira. Entrega la tabla para que el fundador decida con ella delante.

---

## 0 · Obligación 0, y su contraste

```
git fetch origin --prune
git ls-remote --heads origin | wc -l   ->  120   <- la poblacion de ramas
git ls-remote origin refs/heads/main   ->  07ccd16c92e37350e785526232d03b7f0c637684
git rev-parse origin/main              ->  07ccd16c92e37350e785526232d03b7f0c637684   (concuerdan)
```

Y el contraste que importa, porque sin él todo lo de abajo se mide contra un árbol que no existe:
**el worktree desde el que se arrancó iba 145 commits por detrás de `origin/main`**, y su copia de
`docs/master/` tenía **470** ficheros contra **481** en `main` — este mismo fichero, **617 líneas
contra 751**. Anexar allí habría **borrado en silencio el apéndice del 8-sep**. Por eso todo lo que
sigue se mide y se escribe sobre un árbol limpio en `origin/main`, y nada sobre el árbol de arranque.

## 1 · La población: 163, 165 y 112 son tres números buenos de tres días distintos

| número | de dónde sale | cuándo |
|---|---|---|
| **163** | el TÍTULO de SCRUM-804, escrito a mano | creado el **6-sep-2026 23:47** |
| **165** | la medición de la cabecera de esta entrada | **7-sep-2026** |
| **112** | `totalCount` de Jira en vivo, misma JQL | **15-sep-2026** |

La JQL es la misma en los tres casos (`project = SCRUM AND statusCategory != Done`), así que
**ninguno es erróneo: el tablero se movió**. El bueno para trabajar hoy es **112**, por la razón que
ya escribió este ticket el 8-sep: *un número sin su fecha no es una medición, es una foto que nadie
sabe de cuándo*. Por estado, hoy: **Tareas por hacer 54 · En curso 29 · Acción del fundador 18 · En
revisión 11 = 112**. Rango `SCRUM-16 … SCRUM-848` (el 7-sep llegaba al 809). Épicas abiertas: **6**.

## 2 · ⛔ Lo que NO he escrito, porque ya existía

El encargo describía un censo que **este ticket ya construyó**. Reusado tal cual, sin tocar una línea:

| pieza | qué aportó al barrido |
|---|---|
| `scripts/censo-tablero-vs-arbol.mjs --json` | los 498 tickets derivables del árbol, con sus commits, entrada y ramas |
| `scripts/_rastro-del-ticket.mjs` (SCRUM-804) | la dimensión `EN MAIN` / `EN RAMA VIVA` / `SIN RASTRO` |
| `tests/_censo-tickets.mjs` (SCRUM-388) | el motor y su suelo |
| `tests/scrum835-credenciales-en-el-historial.test.mjs` | corrido aparte, ver §6 |

Corrido sobre `origin/main` = `07ccd16c`: **`fiable: true` · `ramasFiables: true` · `suelo: []` ·
`sueloRamaViva: []`** · 498 tickets censados · 481 entradas de máster · 121 ramas traídas.

## 3 · 🔴 Lo que este apéndice AÑADE: el corte (a)/(b), que el instrumento declara que NO sabe hacer

El límite está escrito en el apéndice del 8-sep de este mismo fichero, y es exacto:

> **`SIN RASTRO` no es «no hay trabajo»**: una rama mergeada Y BORRADA deja el ticket sin rama y su
> trabajo dentro.

Medido hoy: **SCRUM-16 sale `rastro: SIN RASTRO`** y tiene seis commits suyos en `main` desde agosto.
O sea que el veredicto de ramas, leído solo, **confunde «nunca se empujó» con «se mergeó y la
borraron»** — que es justo el defecto que el encargo manda separar.

El discriminador que lo parte es el **commit de merge**, que el autoborrado no puede tocar (la misma
ancla que eligió el apéndice del 8-sep por la tarde para los suelos):

- **(b) hubo rama y se mergeó** → existe en `origin/main` un `Merge pull request #N from
  lwislg99/scrum-<n>-…` que **nombra** una rama de ese ticket. El nombre sobrevive al borrado porque
  vive en el asunto del commit, no en la ref.
- **(a) nunca se empujó** → ni rama viva, ni merge que la nombre, ni commit de autoría suyo.

| causa | tickets |
|---|---|
| **(b) hubo rama, se mergeó, ya no está** | **51** |
| **(a) nunca se empujó** | **51** |
| tiene rama hoy en el remoto | **10** |
| **suma** | **112** |

⚠️ **Y una precisión que el encargo pedía y el dato no sostiene entera:** el autoborrado lleva activo
desde el 8-sep, pero **la mayoría de esos 51 se mergearon mucho antes** (SCRUM-16 por el PR #579, el
10-ago). Sus ramas no las quitó el autoborrado. Lo que las quitó se ve en la cifra: el 8-sep este
ticket midió **558 ramas remotas**; hoy hay **120**. Han desaparecido ~438 en una semana, y eso es una
limpieza, no una serie de merges. **(b) aquí significa «hubo rama y su trabajo entró», no «lo borró el
autoborrado».** Distinguir quién la borró exige el registro de eventos de GitHub, que no es árbol.

## 4 · ⚠️ El instrumento lee `refs/remotes/`, y hoy es fiable SÓLO porque se prunó antes

`_rastro-del-ticket.mjs` resuelve las ramas con `for-each-ref refs/remotes/origin/`, que son refs
**locales** y conservan ramas ya borradas hasta que alguien poda. Comprobado antes de creerle nada:

```
git ls-remote --heads origin            -> 120
git for-each-ref refs/remotes/origin/   -> 121   (las 120 + refs/remotes/origin/HEAD)
sobrantes reales                        -> 0
```

Están en sync **porque la obligación 0 prunó**. Su `traer: true` hace `fetch` **sin `--prune`**: en un
árbol sin podar ese censo daría por vivas ramas que ya no existen. No es un defecto que arreglar aquí
—hallazgo de otro carril, regla 37— pero sí una precondición que hay que cumplir antes de leerlo.

## 5 · El criterio de cada clase

| clase | exige |
|---|---|
| 🟢 **CERRABLE** | commit de autoría suyo en `origin/main` (con SHA) **+** entrada en `docs/master/` **+** ninguna rama viva sin mergear **+** la entrada **no** se autodeclara sin construcción |
| 🟡 **DUDOSO** | hay rastro y algo no cuadra. Cada fila dice **qué** |
| 🔴 **VIVO** | no hay trabajo suyo en `main`: o no se empujó nunca, o vive en una rama sin mergear |

**Autoría, no mención.** La referencia tiene que ir en la CABECERA del asunto —`SCRUM-729 (paso 6):`,
`docs(SCRUM-331):`, `feat(SCRUM-333):`— y no después de los dos puntos. Sin esa distinción,
`SCRUM-710c: el trinquete era un cepo` contaba como trabajo del 331 por nombrarlo de pasada.

🔴 **Y la entrada de máster no basta, porque algunas declaran que no construyeron nada.** Aplicado el
filtro textual que este ticket midió el 7-sep, salieron **8 candidatos**. **Los leí los ocho**: seis lo
dicen de verdad y salen de 🟢 — **16, 280, 307, 322, 323, 328**. Dos eran **falsos positivos**, y los
retiré a mano en vez de dejar que el filtro decidiera:

| retirado | por qué NO es «no construí» |
|---|---|
| **SCRUM-634** | su «cero código» habla de los commits **ajenos** #883 y #885, no de su propio trabajo |
| **SCRUM-827** | su «sólo LEE» es la fórmula de la **regla 38** (no modifica el camino fiscal) |

## 6 · Verificación

- ✅ **CONTROL POSITIVO DE (b)** — `SCRUM-848`: su merge `07ccd16c` es la punta de `main` y su rama
  `scrum-848-tactil-ficha-trabajo` **no** está en el remoto. Sale (b), que es lo correcto.
- ✅ **CONTROL POSITIVO DE (a)** — `SCRUM-729`: un ticket sin rama, sin merge que la nombre y sin commit
  de autoría sale (a) y **no** se pliega a (b).
- ✅ **CONTROL DE TOKEN** — `scrum-16` **no** recoge `scrum-161`, `scrum-166` ni `scrum-172`: el número
  se compara con delimitador, nunca como subcadena. Ejercitado sobre los tres.
- ✅ **DOS SONDAS INDEPENDIENTES, Y CONCUERDAN.** El censo da `119 ramas / 17 en main / 102 vivas`; la
  medición directa con `merge-base --is-ancestor` sobre la salida de `ls-remote` da `120 / 18 / 102`. La
  de diferencia es **`main` misma**, que una cuenta como rama y el otro excluye. **Las 102 vivas coinciden.**
- ✅ **CRUCE DE VEREDICTOS** — de los 112, **53 están en la población del censo**, y en los 53
  coincidimos: **0 discrepancias**. Los otros 59 faltan por el límite que el propio censo declara: *su
  población nace del ÁRBOL*, y un ticket que nadie tocó no llega a entrar.
- ✅ **LOS 35 🔴 DE CAUSA (a), CONFIRMADOS POR LA SEGUNDA SONDA**: los 35 están **ausentes** del censo,
  que deriva su población de ramas + entradas + commits. Cero rastro por dos caminos distintos.
- ⚠️ **Los 4 que el censo llama `ENTERO` y aquí salen 🔴** (707, 809, 813, 829) **no son una
  discrepancia**: su `fuentes` es `[ramas]` y su `rastro` es `EN RAMA VIVA`. Es el falso positivo que el
  apéndice del 8-sep documentó y que su propia dimensión nueva ya corrige. La clase concuerda con
  `rastro`, no con el `veredicto` crudo.
- ✅ **SCRUM-835, corrido aparte porque lo pidió el encargo**:
  `tests/scrum835-credenciales-en-el-historial.test.mjs` sobre `07ccd16c` →
  **5/5 pass · 0 fail · 0 skipped · exit 0**. **9.920 blobs alcanzables · 387 binarios · 0 saltados por
  tamaño · 0 hallazgos.** Su control positivo **sembrado** —comitear una credencial sintética, borrarla
  al commit siguiente y comprobar que el barrido la sigue viendo— pasa. Y la población barrida es
  **superconjunto de la de CI**: `rev-list --objects --all` alcanza también las refs de los ~26
  worktrees. **Cero credenciales en el historial, y el cero está respaldado.**

## 7 · 🟢 CERRABLE — **40**

Trabajo suyo en `main` **con SHA de 40**, entrada de máster, y ninguna rama viva sin mergear.

| ticket | estado en el tablero | SHA del commit de autoría | fecha | entrada |
|---|---|---|---|---|
| SCRUM-273 | Tareas por hacer | `1809690725b20043308b65ff771d89db259f1f9a` | 2026-08-20 | `docs/master/SCRUM-273.md` |
| SCRUM-331 | Acción del fundador | `08ff895abf8c9afd0687d1e4b206a0ac09e965c9` | 2026-08-20 | `docs/master/SCRUM-331.md` |
| SCRUM-333 | Acción del fundador | `a7198cf771a22221ff1b901cd0137be35be85ad2` | 2026-08-20 | `docs/master/SCRUM-333.md` |
| SCRUM-512 | Acción del fundador | `c79bb4a7fde5bc2446abeb650286485d7af85ec3` | 2026-09-07 | `docs/master/SCRUM-512.md` |
| SCRUM-567 | En revisión | `b3220e3f506a534f2702e80ec9a23fa5381fc849` | 2026-08-20 | `docs/master/SCRUM-567.md` |
| SCRUM-568 | En revisión | `8554293e1d2027d158ee1e9bf30fe3d44dabcd79` | 2026-08-20 | `docs/master/SCRUM-568.md` |
| SCRUM-600 | En curso | `a72d4b777562743c7490fdd5681a5a1f2bc64ee7` | 2026-09-08 | `docs/master/SCRUM-600.md` |
| SCRUM-613 | Acción del fundador | `2bcd39981275255f224657876b55e224acb3b4ae` | 2026-08-24 | `docs/master/SCRUM-613.md` |
| SCRUM-626 | Tareas por hacer | `e5ef45a4024ac831e0e0169a244299ac375dc911` | 2026-09-08 | `docs/master/SCRUM-626.md` |
| SCRUM-632 | Tareas por hacer | `2b6d0a24bc904ef8e7177bfef3b57bcaea0d4104` | 2026-09-08 | `docs/master/SCRUM-632.md` |
| SCRUM-634 | Tareas por hacer | `aea68989cc33efbecd7088379d404e64aaf0013e` | 2026-09-01 | `docs/master/SCRUM-634.md` |
| SCRUM-637 | En curso | `efd4618dac9d6f0c20ac58af006f1fdc1707add3` | 2026-09-08 | `docs/master/SCRUM-637.md` |
| SCRUM-638 | Tareas por hacer | `cfdd74694012f11ff6d84264b0b25d91940d75dc` | 2026-09-01 | `docs/master/SCRUM-638.md` |
| SCRUM-644 | Tareas por hacer | `19ea5a4052340cbe9598451c9ede91f2c1a07170` | 2026-09-02 | `docs/master/SCRUM-644.md` |
| SCRUM-654 | Acción del fundador | `36d685ff8cc2e551bbcfbff95fc18d42fcc48c0f` | 2026-09-02 | `docs/master/SCRUM-654.md` |
| SCRUM-674 | En curso | `96e36cb8050fa4494681897f3abef54cab6858dd` | 2026-09-02 | `docs/master/SCRUM-674.md` |
| SCRUM-694 | Tareas por hacer | `c71635ce15066fba817a7f2f19ea9637ba7f0e9d` | 2026-09-02 | `docs/master/SCRUM-694.md` |
| SCRUM-726 | En curso | `8f6e0f08831440e24ad36e973271dcfab4169905` | 2026-09-04 | `docs/master/SCRUM-726.md` |
| SCRUM-762 | En revisión | `09ce900808ab774affddb88cb261635738f91708` | 2026-09-07 | `docs/master/SCRUM-762.md` |
| SCRUM-764 | En curso | `17144978c8859ad79b4d1e419f929e0e6a81c40b` | 2026-09-07 | `docs/master/SCRUM-764.md` |
| SCRUM-766 | En curso | `bb78ade7119ec4dd1177acd2153c30a47d9810e5` | 2026-09-08 | `docs/master/SCRUM-766.md` |
| SCRUM-780 | En revisión | `100735c75f0a3a0ef982b2375bbab27b82392167` | 2026-09-07 | `docs/master/SCRUM-780.md` |
| SCRUM-782 | En revisión | `1eda1a6ea3af4ada3eb8fb2770a039b082967e30` | 2026-09-06 | `docs/master/SCRUM-782.md` |
| SCRUM-787 | En curso | `d61f3feafdc6fbc014385fb86cf14390dc05974f` | 2026-09-06 | `docs/master/SCRUM-787.md` |
| SCRUM-788 | En revisión | `dfe37cc2fb7c64a3dbfb78710526715e07abba15` | 2026-09-06 | `docs/master/SCRUM-788.md` |
| SCRUM-790 | En revisión | `10225d66de530356885e362f4d173b7158052e96` | 2026-09-06 | `docs/master/SCRUM-790.md` |
| SCRUM-801 | En curso | `ac2d17abae0eb233f7abee1ed970d6cbebe19351` | 2026-09-07 | `docs/master/SCRUM-801.md` |
| SCRUM-804 | En curso | `a93b29eebbce82c2899d8773258afd4d6c83e4c8` | 2026-09-08 | `docs/master/SCRUM-804.md` |
| SCRUM-805 | En revisión | `b39f3fde32d13e60bb1d2686239979b89c93b131` | 2026-09-07 | `docs/master/SCRUM-805.md` |
| SCRUM-811 | En curso | `c34292577f5b52c83036db843a06118cbfeae6c3` | 2026-09-07 | `docs/master/SCRUM-811.md` |
| SCRUM-815 | Acción del fundador | `36f06e093863ddc890529b96a1ae2f25b718807e` | 2026-09-08 | `docs/master/SCRUM-815.md` |
| SCRUM-816 | En curso | `8981866ebb9ca906b992849a95f77438b9552c76` | 2026-09-08 | `docs/master/SCRUM-816.md` |
| SCRUM-824 | Tareas por hacer | `2d821e57a6f16cb235cd080fd79301818ba454df` | 2026-09-08 | `docs/master/SCRUM-824.md` |
| SCRUM-825 | Tareas por hacer | `6bf6ddbf48e479cb157a605bb72daced852a74bd` | 2026-09-08 | `docs/master/SCRUM-825.md` |
| SCRUM-827 | Tareas por hacer | `a6eddd6f6e6b976b7478f5e5f65b9f83f63d8fba` | 2026-09-08 | `docs/master/SCRUM-827.md` |
| SCRUM-828 | Tareas por hacer | `626ab5e237d44deccf11c701e3792805118d6aee` | 2026-09-08 | `docs/master/SCRUM-828.md` |
| SCRUM-831 | En curso | `db60de753120dd03ae11fae3d789df9857d6fea0` | 2026-09-09 | `docs/master/SCRUM-831.md` |
| SCRUM-840 | En curso | `9fe0a3e1212449197ddf894441407be05c6fb42e` | 2026-09-09 | `docs/master/SCRUM-840.md` |
| SCRUM-844 | En curso | `0754a55e9fa3a91d9e280854414ce6b5762ebb8a` | 2026-09-09 | `docs/master/SCRUM-844.md` |
| SCRUM-845 | En curso | `02cd8e41e5a8d3e2cf377d7be524af7c13f6bdcb` | 2026-09-09 | `docs/master/SCRUM-845.md` |

## 8 · 🟡 DUDOSO — **33**

Hay rastro y algo no cuadra. La columna de la derecha dice **qué**.

| ticket | estado | SHA (si lo hay) | qué NO cuadra |
|---|---|---|---|
| SCRUM-16 | Tareas por hacer | `c09fc07a7659ac35645bc33a05a402c788edfc23` | la ENTRADA se autodeclara sin construcción («MEDICIÓN, NO CONSTRUCCI»): hay informe, no producto |
| SCRUM-20 | Tareas por hacer | `3b927132d6f952e5b74bb92b0dadfa62932371e6` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-41 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-142 | Acción del fundador | — | sólo lo NOMBRAN commits de otros tickets (4); ningún trabajo propio |
| SCRUM-276 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-280 | Tareas por hacer | `69dd7b036d8a01a56aa84386ea20a31ef26c5b91` | la ENTRADA se autodeclara sin construcción («cero construcci»): hay informe, no producto |
| SCRUM-307 | Tareas por hacer | `44840ce6b848246655243b8dc82972986c877c13` | la ENTRADA se autodeclara sin construcción («esta tarea **solo lee»): hay informe, no producto |
| SCRUM-322 | Tareas por hacer | `f35dc4627d1011fa3035b2eb37596d615ec906e3` | la ENTRADA se autodeclara sin construcción («Cero construcci»): hay informe, no producto |
| SCRUM-323 | Tareas por hacer | `0c42404bcc0aafcddb417441f5c0534127a2a53f` | la ENTRADA se autodeclara sin construcción («Cero construcci»): hay informe, no producto |
| SCRUM-326 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-328 | En curso | `80c24c3789972ccfbf9947c7dfc58a4504daa311` | la ENTRADA se autodeclara sin construcción («cero construcci»): hay informe, no producto |
| SCRUM-332 | Acción del fundador | `143866cb05dbabaf44ebc950aa9fa21ac43090f5` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-334 | Acción del fundador | `4c4b8c59785b472f6ada786d1b98f973fc481019` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-340 | Tareas por hacer | `a4fd8efe007ccad9fc9803d3e8eb3daee0ae0dcc` | trabajo en main Y ADEMÁS rama viva sin mergear (scrum-340-contador-plazas-reales): falta algo por entrar |
| SCRUM-523 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-525 | En curso | `6245478d1b225f284391ff23128186f77254b7b5` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-527 | Tareas por hacer | `94934a4024119313837312323af6c0fd7aed577f` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-534 | Acción del fundador | — | sólo lo NOMBRAN commits de otros tickets (2); ningún trabajo propio |
| SCRUM-547 | En curso | `36386d4d590df47aa22c97f15fb8e101a0abe7ce` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-628 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (5); ningún trabajo propio |
| SCRUM-663 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (2); ningún trabajo propio |
| SCRUM-665 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (2); ningún trabajo propio |
| SCRUM-711 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (2); ningún trabajo propio |
| SCRUM-736 | En curso | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-774 | Acción del fundador | — | sólo lo NOMBRAN commits de otros tickets (2); ningún trabajo propio |
| SCRUM-786 | En curso | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-823 | En curso | `20f3a2f551e8a36f26f4a7a3755e91eafbb8672a` | trabajo en main Y ADEMÁS rama viva sin mergear (scrum-823-la-escalera-mira-el-estado): falta algo por entrar |
| SCRUM-826 | Tareas por hacer | — | sólo lo NOMBRAN commits de otros tickets (1); ningún trabajo propio |
| SCRUM-836 | En curso | `2a2bff77a5c8c08053451dddac410a138f990d35` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-837 | En curso | `0e8364e294cd62317bf0e5033da69c384dd99f73` | trabajo en main Y ADEMÁS rama viva sin mergear (scrum-837-decisiones-encerradas): falta algo por entrar |
| SCRUM-839 | Tareas por hacer | `d2990977dd9801ddd6810cf91b5bbdd74f0359dd` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-846 | En revision | `322a2a47304b0a5862926334575869e95290ac2d` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |
| SCRUM-848 | En curso | `404c0f59e6e6df63eed8d5022b40d25489661e4a` | trabajo en main pero SIN entrada en docs/master: no cumple el listón de 🟢 |

## 9 · 🔴 VIVO — **39**

Sigue habiendo trabajo pendiente de verdad. **Ninguno es (b)**, y no puede serlo: (b) significa que su
trabajo entró en `main`, y eso lo sacaría de esta clase por construcción.

| ticket | estado | causa | detalle |
|---|---|---|---|
| SCRUM-18 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-19 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-143 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-281 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-335 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-505 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-511 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-524 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-529 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-530 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-532 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-540 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-554 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-572 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-573 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-612 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-618 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-635 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-649 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-657 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-658 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-669 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-675 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-678 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-688 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-691 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-707 | Tareas por hacer | **rama viva sin mergear** | `scrum-707-estado-no-contemplado` · **+3 commits** sobre main · 2026-09-08 · `e9f66075179639c7bb4fd72c7443e2fbed2dfef7` |
| SCRUM-732 | En curso | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-735 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-752 | Tareas por hacer | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-773 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-779 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-789 | Acción del fundador | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-809 | En revisión | **rama viva sin mergear** | `scrum-809-el-paywall-del-reves` · **+4 commits** sobre main · 2026-09-07 · `4cc758b6c715062f2368a31eabaeafadc5f39d5d` |
| SCRUM-812 | En curso | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-813 | En revisión | **rama viva sin mergear** | `scrum-813-el-trinquete-de-zona-horaria` · **+9 commits** sobre main · 2026-09-08 · `2b317011fef4bf059d9261aaf1d0733e5998f5d8` |
| SCRUM-829 | En curso | **rama viva sin mergear** | `scrum-829-una-sola-regla-rama-ticket` · **+6 commits** sobre main · 2026-09-09 · `faebb1e67003867674c58594a70170a7c57617e5` |
| SCRUM-841 | En curso | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |
| SCRUM-843 | En curso | **(a) nunca se empujó** | ni rama, ni merge que la nombre, ni commit de autoría; **ausente** del censo del árbol |

## 10 · Límites declarados

1. **🟢 quiere decir «el trabajo aterrizó y está registrado», NO «el ticket está resuelto».** Un commit
   de autoría más una entrada no demuestran que se hiciera *todo* lo que el ticket pide. Los 🟢 son
   **candidatos a mirar**, no una orden de transición — y esa decisión es del fundador, no del censo.
2. **No he aplicado el criterio E1/E2** —mutación declarada, o guard vivo que asevera sobre producto—
   que esta misma entrada estrenó el 7-sep y que es **más fuerte** que el de aquí. Exige una tanda
   completa atribuida por fichero, y no cabía en esta tanda. **Con él, algunos 🟢 bajarían a 🟡.**
3. **El filtro de «cero construcción» lo leí sólo donde disparó** (8 de 49 candidatos). No he leído las
   41 entradas que no disparó, así que **no puedo afirmar que no haya más**. Es el hueco nº 2 del 7-sep,
   sin cerrar.
4. **La patología del SCRUM-727 sigue viva**: una entrada puede llevar el número de un ticket y hablar
   de otro asunto. No hay discriminador mecánico barato — este ticket ya probó dos y los tiró.
5. **(b) no distingue quién borró la rama.** Ver §3.
6. **Mi propio error, declarado:** el primer detector de autoría exigía que el asunto EMPEZARA por
   `SCRUM-N`, y esta casa escribe `docs(SCRUM-331):` y `feat(SCRUM-333):`. Daba **cero commits de
   autoría** a tickets que sí los tenían, y lo cazó un control sobre cuatro casos conocidos, no la
   lectura del resultado. El resultado se leía perfectamente creíble.

## 11 · Lo que NO se ha tocado

Jira (ni una transición, ni un comentario) · ninguna rama ajena · ningún `git stash` ·
`prisma/schema.prisma` · `src/` · los instrumentos del censo · ningún guard. Sólo `fetch`, `ls-remote`,
`merge-base`, `log` y `for-each-ref`: lectura. El único fichero escrito es éste.

---

# APÉNDICE · 15-sep-2026 · SCRUM-804d · Los tres filtros sobre los 40 🟢 — y sobreviven 5

**Medido contra:** `origin/main` = `7bae70d0e15c18326b19cb75d23b5d47b5110402` · 2026-09-15T08:03:37Z
**Rama:** `scrum-804d-criterio-e1-e2` · **Mezclado `main`** hasta `319bbd9928b6e828e9af213d51240f3aa8aace1b` antes de empujar · **Carril:** proceso · censo · **Gate:** sin gate

> ⛔ **NO TOCA EL TABLERO Y NO TOCA `src/`.** Cierra los dos huecos que 804c declaró abiertos
> —E1/E2 sin aplicar, y el filtro de «cero construcción» leído sólo donde disparó— y añade el
> tercero, que es el que de verdad decide: **lo construido contra lo que el ticket PROMETE.**

---

## 0 · El titular

| filtro | qué exige | sobreviven |
|---|---|---|
| ① 804c | trabajo en `main` con sha + entrada de máster + ninguna rama viva | **40** |
| ② E1/E2 | mutación declarada, **o** guard vivo que asevera sobre producto y pasa sin saltar | **19** |
| ③ **la promesa** | lo construido cubre lo que el ticket prometió, y **ningún hueco propio sigue abierto** | **19** |
| **los tres a la vez** | | **5** |

**Los cinco: `626 · 632 · 764 · 766 · 845`.**

> 🔒 El tercer filtro es el que cambia el resultado, y ninguno de los otros dos lo ve: **un guard
> vivo demuestra que hay guard, no que cubra lo prometido.** SCRUM-694 tiene 24 tests en verde y
> migró **9 de 56**; sus tests pasan porque sólo miran los nueve.

## 1 · Los tres filtros, y de dónde sale cada medición

| | qué exige | instrumento |
|---|---|---|
| **E1** | el arnés **NOMBRA** el test que cae si se deshace | `censoDeDeclaraciones()` de `meta-guard-mutaciones.mjs` (SCRUM-745), por AST |
| **E2** | un test suyo **asevera sobre producto** y **pasa sin saltar** | `aseveraSobreProducto()` + `parteDeLaTanda()` de `censo-abiertos-vs-guards.mjs` (SCRUM-804) |
| **promesa** | el texto del ticket en Jira contra los huecos que su propia entrada declara | lectura, ticket a ticket |

Censo E1 de hoy: **55 guards · 167 declaraciones · 0 ilegibles**, suelo OK (20/54), en modo
`--solo-censo`: **ni una mutación ejecutada**, ni un fichero del árbol tocado.

## 2 · 🔴 La tanda: cuatro formas de invocarla, tres daban cifras falsas

| intento | decía | de verdad miró |
|---|---|---|
| `node --test … tests/*.test.mjs` | **exit 126** (el compuesto reportaba 0) | *Argument list too long*: 781 rutas no caben |
| `node --test … tests/` | 1 «test» llamado `tests` | **1** fichero de 781 |
| `node --test … "tests/*.test.mjs"` | 99 pass · 0 fail | **15** de 781 — esta versión no expande el glob |
| descubrimiento por defecto | **2.681 pass · 0 fail** | **355** de 781 |
| **troceado en lotes de 100** | ver abajo | **726** de 781 |

> 🔒 **Un «2.681 en verde» es igual de creíble mirando 355 ficheros que mirando 781.** Lo único que
> los separa es preguntarle al instrumento cuántos ficheros ha visto, y por eso ese control va
> DELANTE del veredicto. Leer el resultado no habría cazado ninguno de los tres.

**La tanda que sostiene E2:** `726` ficheros · **7665 pass sin saltar · 0 fail · 112 skipped**.

⚠️ **Hueco declarado: 55 ficheros no llegaron a emitir eventos**, todos del rango `scrum003…scrum320` —los
gateados por base—: en un árbol sin `.env` se quedan esperando una conexión que no existe.
**Ninguno de los 55 pertenece a ninguno de los 40**, así que la cobertura sobre los tickets que
se juzgan aquí es completa; sobre la suite entera, no. Queda dicho en vez de redondear.

⚠️ **Y la tanda va TROCEADA**, no en una invocación como `npm test`. Para E2 —«¿pasa este test sin
saltar?»— da igual; para un defecto de interferencia entre ficheros (el que midió SCRUM-824) no.
No es la tanda oficial y no se presenta como tal.

⚠️ **Un susto, declarado:** el descubrimiento por defecto arrastró `scripts/test-staging-gated.mjs`,
que TOMA EL TURNO de staging. **No llegó**: el árbol aislado nace sin `.env`, así que
`DATABASE_URL_TESTS` estaba ausente y murió antes de conectarse. Comprobado con `git status` vacío.

## 3 · El filtro de «cero construcción», leído en las 49 — acertó cero y falló doce

804c declaró el hueco: *«lo leí sólo donde disparó, 8 de 49»*. **Leídas las 49.** Sobre los 40 🟢:

| | |
|---|---|
| entradas de 🟢 que SÍ se autodeclaran medición | **12** |
| de ésas, que el filtro automático vio | **0** |
| 🟢 que el filtro señaló | **2** (634 y 827) — **los dos falsos positivos** ya retirados |

No dicen «cero construcción». Dicen **«ESTE TICKET MIDE. NO CONSTRUYE»** (762), **«Esto MIDE. La
decisión es del fundador»** (811), **«no entra código, no entra test»** (613), **«NO arregla ni un
botón»** (787). Doce formas distintas. **Un filtro con esa hoja de servicios no es un censo: es una
muestra**, y queda dicho aquí para que nadie lo vuelva a usar como si lo fuera.

## 4 · LOS CUATRO PRIORITARIOS

| ticket | ② E1/E2 | ③ promesa | veredicto |
|---|---|---|---|
| **SCRUM-694** | ❌ ningún test suyo asevera sobre producto | ❌ | 🟡 **NO cerrable** |
| **SCRUM-824** | ✅ `scrum824b-el-sha-que-parecia-un-numero.test.mjs` → `../scripts/_ritmo-de-despliegue.mjs:33` | ❌ | 🟡 **NO cerrable** |
| **SCRUM-844** | ✅ `scrum844-sellar-dentro-de-transaccion.test.mjs` → `../dist/modules/invoicing/domain/verifactu.service.js:51` | ❌ | 🟡 **NO cerrable** |
| **SCRUM-845** | ✅ `scrum845-la-lista-pregunta-lo-que-el-servidor-contesta.test.mjs` → `public/dashboard/js/invoiceAccion.js:38` | ✅ | 🟢 **CERRABLE** |

Los tres que caen, con el motivo exacto:

- **SCRUM-694** — Migro 9 de 56 y su entrada dice «No se migraron los 47 restantes». Y mientras se escribia esto entro SCRUM-694b en `main` (PR #1244): migra NUEVE MAS y deja el trinquete en 42 — con la misma frase al final, «No se migraron los 42 restantes». La promesa sigue sin cubrirse; sus tests pasan porque solo miran los migrados.
- **SCRUM-824** — 🔴 El `SCRUM-824` que esta en main es OTRO SUJETO: la entrada se titula «El vigia que no deja pasar» y dice «No se toca el vigia». El titulo del ticket es el rojo intermitente por ficheros temporales dentro de tests/. Patologia del SCRUM-727, confirmada.
- **SCRUM-844** — «El resto de la lista (puestos 3 a 6): sin escribir, a la espera de la medicion del CI». La promesa eran los 31 puntos; hay dos puestos.

**Las dos sesiones que midieron su propio ticket tenían razón**, y el criterio de aquí llega a lo
mismo por otro camino: 694 por su «no se migraron los 47 restantes», y 824 porque la entrada que
hay en `main` **habla de otro sujeto** que el título del ticket. Es la patología del SCRUM-727 que
el propio 804 declaró como hueco nº 1 el 7-sep — **ahora con un caso confirmado y con nombre.**

## 5 · 🟢 A · PASAN LOS TRES FILTROS — **5**

| ticket | estado en el tablero | la prueba viva | por qué la promesa está cubierta |
|---|---|---|---|
| **SCRUM-626** | Tareas por hacer | `scrum626-calentar-el-navegador.test.mjs` → `../scripts/_navegador.mjs:23` | El porque quedo contestado con el dato del fundador (8-sep): `guard:contraste` arranca en 32,5 s contra un tope de 30.000 ms. Y la mitigacion esta construida y vigilada. |
| **SCRUM-632** | Tareas por hacer | `scrum632-la-descripcion-de-la-linea.test.mjs` → `public/dashboard/js/quotesView.js:30` | Las dos salidas que necesitaban texto salen con `[PENDIENTE microcopy oficial]` y la subida del censo declarada — que es literalmente lo que el ticket ordenaba hacer. |
| **SCRUM-764** | En curso | **E1** `scrum764-margen-negativo.test.mjs(6)` | El margen negativo se ve, con seis mutaciones declaradas que lo tumban. El unico punto abierto (`margenCatalogo.js` → `reportsView.js`) quedo RESUELTO el 7-sep. |
| **SCRUM-766** | En curso | **E1** `scrum766-el-grep-que-cuenta-lineas.test.mjs(2)` | El instrumento pasa a AFIRMAR POR PLATAFORMA. Lo que no se hizo —ni skip ni retirar el aviso— va razonado, no pendiente. |
| **SCRUM-845** | En curso | `scrum845-la-lista-pregunta-lo-que-el-servidor-contesta.test.mjs` → `public/dashboard/js/invoiceAccion.js:38` | El defecto era de la pantalla y la pantalla queda arreglada; el servidor ya filtraba y se comprobo. No hay hueco propio abierto. |

## 6 · 🟡 B · Promesa cubierta, pero E1/E2 **no puede verlos** — **9**

**No es que estén mal.** E2 llama «producto» a `src|dist|public|scripts|docs|prisma`, así que un
guard que vigila **otros guards** (lee `tests/`) no cuenta, y un guard que corre **fuera de la
tanda** (navegador) tampoco. Son decisión tuya: el trabajo está y la promesa también, lo que falta
es que algo de la tanda lo sujete.

| ticket | estado | por qué E1/E2 no lo ve | promesa |
|---|---|---|---|
| SCRUM-273 | Tareas por hacer | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | Sus tres exclusiones (no migrar el historico, no impedir editar, no validar contenido) las declara FUERA DE ALCANCE el propio ticket en Jira. Exclusio |
| SCRUM-567 | En revisión | no existe ningún `tests/scrum567*` | El defecto era el censo contando literales HTML; se cambio a AST y el tope baja de 29 a 23. Los 7 nuevos se dejan sin arreglar A PROPOSITO, y la ficha |
| SCRUM-644 | Tareas por hacer | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | El trinquete entra y las dos rutas que siguen tragandose el P2002 son idempotencia deliberada de ONBOARD-2, con test que lo pincha. |
| SCRUM-726 | En curso | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | Entra `pendientesDeFirma()`, los seis registros reales cuentan y devuelve cero pendientes. El mecanismo que faltaba esta puesto. |
| SCRUM-782 | En revisión | no existe ningún `tests/scrum782*` | Toca `styles.css` (`.casilla-seleccion::before`, inset -16px), `customersView.js`, el medidor y el guard: arregla la casilla Y amplia el guard a la se |
| SCRUM-816 | En curso | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | La segunda vuelta entra entera: la tabla, la accion por fila y el chip de cobro. «Lo que NO se ha tocado» es una lista de no-tocar deliberados, no de  |
| SCRUM-827 | Tareas por hacer | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | Cierra un limite que los propios guards tenian declarado por escrito con fichero y linea: el trinquete pasa a vigilar el VALOR. |
| SCRUM-828 | Tareas por hacer | no existe ningún `tests/scrum828*` | Su unico hueco («el mensaje no puede leer Settings») esta declarado como corto A PROPOSITO: lo que pide es volver a medir, no ampliar la lista de memo |
| SCRUM-831 | En curso | sus tests vigilan instrumentos o documentos, no `src/`/`public/` | Ademas de las acciones de la fila, cierra los dos huecos que destapo: el contexto a medias de `jobDetailView` y los datos que no viajaban a la lista. |

## 7 · 🔴 C · La promesa NO está cubierta — **14**

**Éstos NO se cierran.** Cada uno declara, con sus palabras, un hueco propio que sigue abierto.

| ticket | estado | ② E1/E2 | qué falta, según su propia entrada |
|---|---|---|---|
| SCRUM-331 | Acción del fundador | ✅ | El heroe entra `hidden` y con `data-microcopy=PENDIENTE_FUNDADOR`: el texto no esta firmado, asi que la promesa no esta viva. Y el CLS de la primera pantalla queda por encima de 0,1, aislado. |
| SCRUM-333 | Acción del fundador | ✅ | Tres huecos declarados por la entrada: «Talleres no existe» (vertical VETADO, exige cambio de master), las seis van al MISMO destino, y las seis siguen en `draft_pendiente_validacion`. |
| SCRUM-512 | Acción del fundador | — | La entrada se titula «(mitad independiente)». La mitad que promete el ticket —que el contador no vaya hacia atras— cuelga de SCRUM-340, que sigue con rama viva sin mergear. |
| SCRUM-568 | En revisión | ✅ | El propio ticket deja sin marcar «Esto tiene que aparecer en la lista de comprobacion del lanzamiento, no solo en el repo». Sin eso el mecanismo dira «0 de 9» el dia del go y nadie lo habra mirado. |
| SCRUM-600 | En curso | ✅ | «No hecho, con su motivo: la unificacion (bloqueo A) · el vencimiento (bloqueos A y B) · los ganchos del punto 5». La unificacion ES la promesa del ticket. |
| SCRUM-634 | Tareas por hacer | — | «Lo que NO cubre — huecos DECLARADOS»: el reflejo va en un solo sentido, `n.name` sigue valiendo `''`, y `value`/`checked` quedan fuera. La promesa decia CUALQUIER atributo. |
| SCRUM-637 | En curso | ✅ | «El punto 1 completo —que la rama se publique en Jira— sigue sin resolverse: se ha cerrado la mitad barata». |
| SCRUM-674 | En curso | — | El orden de la casa es ① decision → ② ALTER en las TRES bases → ③ PR. La entrada declara que lo que espera son «las cinco columnas y partes_trabajo»: el ALTER no esta aplicado. |
| SCRUM-694 | Tareas por hacer | — | Migro 9 de 56 y su entrada dice «No se migraron los 47 restantes». Y mientras se escribia esto entro SCRUM-694b en `main` (PR #1244): migra NUEVE MAS y deja el trinquete en 42 — con la misma frase al final, «No se migraron los 42 restantes». La promesa sigue sin cubrirse; sus tests pasan porque solo miran los migrados. |
| SCRUM-780 | En revisión | ✅ | Es una DECISION DEL FUNDADOR sin tomar («¿se adopta F260001?»), y ademas destapa un hueco nuevo que queda abierto: `huecosDeLaSerie` compone sin fecha y reportara todas las `F26…` como ajenas. |
| SCRUM-801 | En curso | ✅ | «11 de las 21 no estan medidas» en la pregunta central, y la ruta completa con sesion sigue sin ejercitarse. |
| SCRUM-805 | En revisión | ✅ | Su propia seccion «Verificacion pendiente»: 0 presupuestos firmados en dev, «la poblacion real no esta medida y hace falta el dato de produccion». Y el carril es DECISION DEL FUNDADOR. |
| SCRUM-824 | Tareas por hacer | ✅ | 🔴 El `SCRUM-824` que esta en main es OTRO SUJETO: la entrada se titula «El vigia que no deja pasar» y dice «No se toca el vigia». El titulo del ticket es el rojo intermitente por ficheros temporales dentro de tests/. Patologia de |
| SCRUM-844 | En curso | ✅ | «El resto de la lista (puestos 3 a 6): sin escribir, a la espera de la medicion del CI». La promesa eran los 31 puntos; hay dos puestos. |

> 🔴 **Nueve de estos catorce PASAN E1/E2.** Ésa es la medida exacta de lo que el criterio del
> 7-sep no alcanzaba: tienen guard vivo y verde, y no cubren lo que prometieron.

## 8 · ⬜ D · Medición declarada — E1/E2 no aplica — **12**

Su encargo ERA un informe. No construyeron comportamiento, así que no hay guard posible y el
criterio no puede opinar. **Se cierran —o no— leyendo si el informe contesta lo que se pidió**, y
eso es tuyo, no del árbol. Van aparte a propósito: mezclarlos con los de la clase C sería llamar
«no hecho» a un trabajo entregado.

| ticket | estado | lo que declara su entrada |
|---|---|---|
| SCRUM-613 | Acción del fundador | «Gate: sin gate — no entra codigo, no entra test». Cinco mediciones que desbloquean un lote. |
| SCRUM-638 | Tareas por hacer | «Gate: medicion — NO se ha arreglado nada». Averigua de quien es el rojo; no lo arregla. |
| SCRUM-654 | Acción del fundador | «PASO 0 de medicion: ¿sirve lo que ya hay?» — y el propio ticket esta BLOQUEADO por la regla 36. |
| SCRUM-762 | En revisión | «ESTE TICKET MIDE. NO CONSTRUYE.» literal en su cabecera. |
| SCRUM-787 | En curso | «Esta entrada NO arregla ni un boton. Trae el numero; la decision es del fundador.» |
| SCRUM-788 | En revisión | «Este ticket MIDE.» No cambia ningun veredicto del arnes. |
| SCRUM-790 | En revisión | «Documentacion e instrumentacion... el unico cambio de codigo es el texto de dos comentarios de package.json.» |
| SCRUM-804 | En curso | «ESTE TICKET NO CIERRA NADA. Es una medicion.» literal en su cabecera. |
| SCRUM-811 | En curso | «Esto MIDE. La decision es del fundador.» No se toca una linea de CSS. |
| SCRUM-815 | Acción del fundador | «Esto es medir, no arreglar.» PASO 0 sobre el webhook de Stripe. |
| SCRUM-825 | Tareas por hacer | «Gate: medicion, cero rotulos cambiados». Propone una tabla; la firma el fundador. |
| SCRUM-840 | En curso | Censo de que se puede romper sin que caiga ningun test. La entrega es la lista. |

## 9 · Límites declarados

1. **El filtro ③ es JUICIO, no medición.** Lo he leído ticket a ticket y cada fila lleva su cita,
   pero no hay instrumento detrás: donde una entrada dice «lo que NO se ha hecho» he tenido que
   decidir si eso era **exclusión prometida** (273, 567, 644) o **hueco abierto** (694, 844). Esa
   frontera la he puesto yo y se puede discutir fila a fila — para eso va la cita.
2. **La patología del 727 sigue sin instrumento.** La cacé en 824 leyendo, no midiendo. Puede
   quedar en otros.
3. **55 ficheros de la tanda sin eventos** (§2). Ninguno de los 40, pero la suite no está entera.
4. **E2 no ve el trabajo sobre instrumentos** (§6), y son 9 de los 40.
5. **Mi propio error, otra vez:** di por bueno un `2.681 pass · 0 fail` que había mirado **355
   ficheros de 781**. No lo cazó leer el resultado —era creíble— sino exigirle al instrumento que
   dijera cuántos ficheros había visto. Es la tercera vez en este ticket que el control de
   cobertura caza lo que la cifra escondía.

## 10 · Lo que NO se ha tocado

Jira · `src/` · `prisma/schema.prisma` · ninguna mutación ejecutada · ningún guard · ninguna rama
ajena · staging. El único fichero escrito es éste.

---

# APÉNDICE · 15-sep-2026 · SCRUM-804e · Las listas para transicionar, y quién queda sin vigilancia

**Medido contra:** `origin/main` = `78215b9ff35a1456f832c47db0ac81bc425ff415` · 2026-09-15T10:30:00+02:00
**Rama:** `scrum-804e-la-lista-sin-vigilancia` · **Carril:** proceso · censo · **Gate:** sin gate

> ⛔ **NO TOCA JIRA.** Las transiciones las hace el fundador con estas listas delante.

**Decisión del fundador (15-sep-2026):** el grupo **B se cierra** —promesa cubierta basta; E1/E2
mide si algo de la tanda lo sujeta, y eso es **deseable, no la definición de «hecho»**— y del
grupo **D se cierran los que pasen ① y ③**, porque E1/E2 no les aplica.

---

## 1 · GRUPO B — se cierran los 9

Promesa cubierta (filtro ③) y trabajo en `main` con sha y entrada (filtro ①).

| clave | estado hoy | por qué la promesa está cubierta |
|---|---|---|
| **SCRUM-273** | Tareas por hacer | Sus tres exclusiones (no migrar el historico, no impedir editar, no validar contenido) las declara FUERA DE ALCANCE el propio ticket en Jira. Exclusion prometida, no hueco. |
| **SCRUM-567** | En revisión | El defecto era el censo contando literales HTML; se cambio a AST y el tope baja de 29 a 23. Los 7 nuevos se dejan sin arreglar A PROPOSITO, y la ficha lo prohibia expresamente. |
| **SCRUM-644** | Tareas por hacer | El trinquete entra y las dos rutas que siguen tragandose el P2002 son idempotencia deliberada de ONBOARD-2, con test que lo pincha. |
| **SCRUM-726** | En curso | Entra `pendientesDeFirma()`, los seis registros reales cuentan y devuelve cero pendientes. El mecanismo que faltaba esta puesto. |
| **SCRUM-782** | En revisión | Toca `styles.css` (`.casilla-seleccion::before`, inset -16px), `customersView.js`, el medidor y el guard: arregla la casilla Y amplia el guard a la segunda superficie. |
| **SCRUM-816** | En curso | La segunda vuelta entra entera: la tabla, la accion por fila y el chip de cobro. «Lo que NO se ha tocado» es una lista de no-tocar deliberados, no de pendientes. |
| **SCRUM-827** | Tareas por hacer | Cierra un limite que los propios guards tenian declarado por escrito con fichero y linea: el trinquete pasa a vigilar el VALOR. |
| **SCRUM-828** | Tareas por hacer | Su unico hueco («el mensaje no puede leer Settings») esta declarado como corto A PROPOSITO: lo que pide es volver a medir, no ampliar la lista de memoria. |
| **SCRUM-831** | En curso | Ademas de las acciones de la fila, cierra los dos huecos que destapo: el contexto a medias de `jobDetailView` y los datos que no viajaban a la lista. |

## 2 · GRUPO D — de los 12, pasan ① y ③ **cinco**

① lo pasan los doce: todos tienen trabajo en `main` con sha y entrada de máster. El que decide es ③.

### ✅ Pasan ① y ③ — **se cierran**

| clave | estado hoy | qué entregó |
|---|---|---|
| **SCRUM-638** | Tareas por hacer | Su entrada tiene **«LA RESPUESTA, EN UNA LÍNEA»**: el guard pasa en local en las tres configuraciones y sólo cae en el runner, así que **se une a SCRUM-626 en vez de duplicarlo**. Contestado. |
| **SCRUM-762** | En revisión | Entrega los siete apartados, incluidas **«Las tres salidas, escritas como tales»** y el coste medido. El único hueco (`ensureQuotePdf`) queda fuera por declaración: el presupuesto no está bajo la regla 29, y aun así lo cubre su §⑤. |
| **SCRUM-788** | En revisión | Contesta el número que decide y clasifica los 33. Los **2 INDETERMINADOS** van declarados y **sin repartir al montón mayoritario**, que es residuo dicho, no promesa incumplida. |
| **SCRUM-790** | En revisión | Mide la dispersión real y corrige el texto que ya no describía la máquina. El guard que no se añadió va **propuesto con su dato**, y es más de lo que el ticket pedía. |
| **SCRUM-840** | En curso | Entrega **«LA LISTA · lo que se rompe sin que caiga nadie, ordenado por lo que pasa si se rompe»**, con 500 de 500 puntos y 31/31 ficheros, más dos hallazgos que no se le pedían. |

### ❌ NO pasan ③ — **no se cierran**, con la cita

| clave | estado hoy | la cita que lo impide |
|---|---|---|
| SCRUM-613 | Acción del fundador | Su entrada: **«PRODUCCIÓN NO SE HA MEDIDO, y no por olvido: en este árbol no hay credencial de producción»** — y el ticket prometía cinco mediciones. |
| SCRUM-654 | Acción del fundador | Es un **PASO 0** de un ticket cuya promesa es la función («Rellenar el parte por voz»), y el propio título dice **BLOQUEADO por la regla 36**. Cuatro decisiones son del fundador y los límites del plan gratuito van como **NO MEDIDO**. |
| SCRUM-787 | En curso | Su entrada: **«Ocho vistas sin medir por falta de fixture. Es el hueco más grande: el 76 es un SUELO, no el total del panel»** — contra una promesa que decía «la aplicación entera». |
| SCRUM-804 | En curso | Sus **tres huecos declarados**, entre ellos **«Sólo leí las 14 entradas de menor acuerdo. No las 51»**. Y sigue recibiendo apéndices — éste es el cuarto. |
| SCRUM-811 | En curso | Su §3: **«lo que NO se pudo medir (8 vistas), declarado»**, y lo dice con todas las letras: **«Una vista que no se pudo montar no es una vista sin defectos»**. |
| SCRUM-815 | Acción del fundador | El ticket promete que el webhook **falla por los dos lados**; su entrada abre con **«⛔ Aquí no hay arreglo»**: es el paso ① del orden decisión → ALTER → PR. |
| SCRUM-825 | Tareas por hacer | Su propia sección: **«🔴 Y sigue pendiente lo del NIF, que ahora pesa más»**. |

## 3 · 🔴 LA LISTA QUE CONDICIONA EL CIERRE DE B: qué sujeta a cada uno de los 14

La pregunta no es «¿tiene un test con su número?» —eso no mide nada— sino: **¿algún test de la
suite asevera sobre los ficheros de producto que ese ticket cambió, y pasa?** Los ficheros salen
de sus commits de autoría en `main`; lo que asevera cada test, del AST de SCRUM-804; y «pasa» de
la tanda del apéndice 804d.

**Ninguno de los 14 queda sin nada.** Pero hay dos niveles, y la diferencia importa:

| nivel | qué significa | tickets |
|---|---|---|
| **① fuerte** | un test **suyo** asevera sobre producto y pasa | 626 · 632 · 764 · 766 · 845 |
| **② por fichero** | ningún test con su número lo hace, pero **otros tests de la casa** aseveran sobre los ficheros que tocó y pasan | 273 · 567 · 644 · 726 · 782 · 816 · 827 · 828 · 831 |
| **③ nada** | ningún test asevera sobre ninguno de sus ficheros | **(ninguno)** |

| ticket | nivel | ficheros de producto que tocó | tests que los aseveran y pasan |
|---|---|---|---|
| SCRUM-273 | ② | 8 | 15 — p. ej. `scrum235-cliente-por-columnas.test.mjs` |
| SCRUM-567 | ② | 1 | 1 — p. ej. `scrum553-etiquetas-pegadas.test.mjs` |
| SCRUM-626 | **①** | 4 | 11 — p. ej. `scrum452-pdf-lo-que-se-sello.test.mjs` |
| SCRUM-632 | **①** | 2 | 30 — p. ej. `scrum195-loop-adicional.test.mjs` |
| SCRUM-644 | ② | 16 | 44 — p. ej. `dashboard-colision-declaraciones.test.mjs` |
| SCRUM-726 | ② | 11 | 59 — p. ej. `albaran.test.mjs` |
| SCRUM-764 | **①** | 4 | 23 — p. ej. `scrum228-desglose-empleado-suma.test.mjs` |
| SCRUM-766 | **①** | 2 | 2 — p. ej. `scrum570-cr-en-disco.test.mjs` |
| SCRUM-782 | ② | 5 | 25 — p. ej. `scrum285-pantalla-cobros.test.mjs` |
| SCRUM-816 | ② | 19 | 45 — p. ej. `dashboard-colision-declaraciones.test.mjs` |
| SCRUM-827 | ② | 1 | 9 — p. ej. `scrum285-pantalla-cobros.test.mjs` |
| SCRUM-828 | ② | 0 | — |
| SCRUM-831 | ② | 12 | 41 — p. ej. `dashboard-colision-declaraciones.test.mjs` |
| SCRUM-845 | **①** | 5 | 23 — p. ej. `dashboard-colision-declaraciones.test.mjs` |

### 🔴 Y LO QUE PASA SI REGRESIONAN — la frase, sin adornos

> **Un ticket del nivel ② está sujeto POR FICHERO, no por comportamiento.** Si alguien borra o
> rompe de forma gruesa uno de los ficheros que tocó, la tanda cae y alguien se entera. **Pero si
> alguien deshace exactamente su cambio dejando el fichero en pie, la tanda sigue VERDE y nadie se
> entera** — porque el test que pasa por ahí está mirando otra cosa. Nueve de los catorce que se
> cierran hoy están en esa situación, y se cierran igual porque el fundador ha decidido que la
> promesa cumplida basta. Queda escrito para que el día que uno de los nueve reaparezca, **no se
> busque el defecto en el código: se busque aquí.**

## 4 · ⚠️ El caso 828, que estuvo a punto de salir «sin nada» y era falso

El instrumento le dio **0 ficheros de producto**. Falso: su código está en `main` como
`2cbb16bd2…` —`.github/workflows/pr-automatico.yml`, 115 líneas— y lo vigila
`tests/pr-automatico-el-mensaje-del-automerge.test.mjs`, **10 pass · 0 skip · 0 fail** en la tanda.

No lo vio porque **ni el commit ni el test llevan el número**: la entrega se hizo en la rama
`automerge-el-mensaje-que-manda-a-mirar-donde-no-es` cuando el ticket todavía no tenía número, y su
propia entrada lo dice. Es el reverso exacto de la patología del SCRUM-727: allí el número estaba
y el sujeto era otro; aquí el sujeto está y el número no aparece por ningún lado.

> 🔒 **Un censo por número no puede ver el trabajo que no lleva número.** Se arregla mirando, no
> ensanchando el patrón.

## 5 · Límites declarados

1. **El nivel ② es cobertura por FICHERO, no por comportamiento.** Ver la frase del §3. Es más
   débil que E1/E2 y se presenta como tal.
2. **El juicio ③ sobre los 12 de D es lectura, no medición**, igual que en 804d. Cada fila lleva
   su cita para que se pueda discutir.
3. **La tanda que sostiene esto es la de 804d**: troceada en lotes de 100 y con **55 ficheros sin
   eventos**, ninguno de los 40. No es la tanda oficial.
4. **🔴 Y mi propio error, el tercero de este ticket:** la primera pasada de este censo dio
   **«SIN NADA: los catorce»**, y era falso — el `--format` de git estaba mal y la lista de
   ficheros salía VACÍA para todos. El control positivo del detector de aserciones pasaba, así que
   el instrumento parecía sano: **el control estaba en la mitad equivocada.** Lo cazó que el
   resultado fuera demasiado redondo, y se arregló poniéndole suelo a la OTRA mitad — cero
   ficheros tocados es `NO MEDIBLE`, nunca «sin vigilancia».

## 6 · Lo que NO se ha tocado

Jira · `src/` · `prisma/schema.prisma` · ningún guard · ninguna rama ajena · staging.
El único fichero escrito es éste.

---

# APÉNDICE · Fase b — el barrido de la regla 42

*17-sep-2026 · rama `scrum-804b-el-barrido-de-la-42`*

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:39:35+01:00

⛔ **MIDE. No cierra ningún ticket, no toca Jira, no renombra ni borra ninguna rama.**

## ① El censo — `27 DENTRO · 3 FUERA · 29 NO DECIDIBLE`

```
población: 59 tickets mirados · 59 clasificados · 27 DENTRO · 3 FUERA · 29 NO DECIDIBLE
           (lado malo) · leídas 150 ramas remotas, 2999 ficheros de main y 564 entradas
           de registro (la convención empieza en SCRUM-192)
```

**FUERA · 3 — y son los únicos que el censo puede PROBAR que están fuera:**

| ticket | evidencia positiva |
| --- | --- |
| SCRUM-813 | rama viva sin mergear `scrum-813-el-trinquete-de-zona-horaria` |
| SCRUM-864 | rama viva sin mergear `scrum-864b-a19-y-la-vuelta-del-tope` |
| SCRUM-880 | rama viva sin mergear `scrum-880c-el-desempate-y-los-milisegundos` |

**DENTRO · 25 de la lista** — 280 · 307 · 322 · 323 · 328 · 331 · 332 · 333 · 334 · 512 · 523 ·
534 · 554 · 568 · 635 · 654 · 665 · 688 · 811 · 825 · 863 · 878 · 903 · 910 · 16. Casi todos con
entrada en `main` **y sus artefactos presentes** (328 → 30/30 · 825 → 35/37 · 665 → 25/25).

### 🔴 Y aquí es donde este censo casi miente: la primera versión daba 32 FUERA

Los **32 con el mismo motivo**: *«sin rama, sin entrada y sin ficheros propios»*. Eso no es un
veredicto — es **«no he encontrado marca»**. El encargo lo avisaba con estas palabras:

> *«Un commit que lleva el número no prueba que el trabajo esté; y un trabajo sin número puede
> estar entero.»*

**Mandar esos 32 a `FUERA` habría hecho reabrir trabajo ya hecho.**

Y había una razón **de construcción** que el primer criterio no podía ver: **las entradas de
`docs/master/` empiezan en SCRUM-192** (sólo existe una por debajo, derivado del árbol y no
escrito a mano). Los tickets anteriores — 41, 142, 143, 16, 18, 19, 20 — **no PUDIERON tener
entrada**: se les exigía una regla que no existía cuando se hicieron.

**Corregido:** `FUERA` exige **evidencia positiva de ausencia** — una rama viva sin mergear, que es
lo único que este censo puede probar de ese lado. Todo lo demás es `NO DECIDIBLE`, del lado malo,
con el motivo separado porque cada uno se acciona distinto:

| motivo | nº | qué hacer con ellos |
| --- | --- | --- |
| commits de `main` lo nombran pero ningún artefacto comprobable | 6 | 41 · 142 · 276 · 326 · 774 · 786 · 20 — mirar el ticket en Jira y decidir a mano |
| anterior a la convención de `docs/master/` | 3 | 143 · 18 · 19 — el censo no puede ayudar aquí |
| el censo no ve NADA | 20 | ni rama, ni entrada, ni ficheros, ni commits |

## ② El suelo y los controles

| control | resultado |
| --- | --- |
| ✅ POSITIVO · SCRUM-866 y SCRUM-881 (cerrados y mergeados) | **DENTRO** los dos |
| 🔴 NEGATIVO · SCRUM-880 (rama empujada hoy, sin mergear) | **FUERA**, y se comprueba que sale por el motivo correcto y no por casualidad |
| 🔴 SUELO · 0 en DENTRO | aborta **CIEGO** |
| 🔴 EXTRA · un ticket inventado (999999) | **NO DECIDIBLE**, nunca FUERA — el defecto de la primera versión, atado para que no vuelva |

## ③ Las ramas sin slug — **una, no tres**

De **150 ramas vivas**, 93 tienen forma de ticket. Incumplen `scrum-<n>-<slug>` **3**, pero son
**tres cosas distintas y sólo una rompe el barrido**:

| rama | qué le pasa | ¿la alcanza el barrido? |
| --- | --- | --- |
| `scrum-904` | **sin slug** | 🔴 **no** |
| `scrum-421-registro-presupuesto-INCOMPLETO` | slug en MAYÚSCULAS | sí |
| `scrum-474-fase2-INCOMPLETO` | slug en MAYÚSCULAS | sí |

Y una cuarta forma fuera de esa cuenta: **`scrum-paso0-dinero`, sin número**.

### Quién mide sobre esta población: **27 instrumentos**, no 8

10 scripts (`censo-alcanzabilidad`, `censo-reparto`, `censo-tablero-vs-arbol`,
`enlace-ticket-rama`, `ramas-borrables`, `_barrido-de-credenciales`, `_rastro-del-ticket`…),
14 tests (267, 387, 716b, 716c, 723, 753, 775, 804, 824b, 829b, 839e, 853, 899, 900) y 3 bancos.
**Con eso encima, no se ha renombrado ni borrado nada** (A12).

### ¿Puede el barrido tolerar las dos formas sin perder precisión?

**Sí para «número sin slug». No para «sin número». Y la diferencia no es de grado:**

* **El barrido necesita EL NÚMERO, no el slug.** `^scrum-(\d+)([a-z])?(-|$)` reconoce `scrum-904`
  sin ninguna ambigüedad, y sigue sin casar `scrum-41` dentro de `scrum-410`. Está atado con un
  test en `tests/scrum804b-el-barrido-de-la-42.test.mjs`. **Tolerarlo es gratis.**
* **`scrum-paso0-dinero` no tiene ticket al que mapear.** Tolerar eso no es relajar una forma: es
  **inventar la asociación**. Ahí sí se pierde precisión, y es la puerta que no hay que abrir.

> La regla `scrum-<n>-<slug>` junta dos exigencias de peso muy distinto: **el número lo leen las
> máquinas y es la que aguanta; el slug es para las personas.** Un barrido que pierde una rama por
> no llevar slug está fallando por una propiedad que no tiene nada que ver con lo que mide.

**Reportado y no arreglado**: ampliar el criterio de SCRUM-804 es de su carril, y el encargo pedía
la medición y el juicio, no el cambio.

## Lo NO tocado

Jira · ningún ticket cerrado · ninguna rama renombrada ni borrada · el criterio de SCRUM-804 sin
ampliar · producción y staging sin tocar.
# APÉNDICE · Fase d — lo que cada ticket PROMETÍA, y qué desbloquea a los no decidibles

*17-sep-2026 · rama `scrum-804d-lo-que-prometia`*

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:56:04+01:00

⛔ **MIDE. No cierra tickets, no toca Jira, no renombra ni borra ninguna rama.**
⛔ **El bloque ① (arreglar el barrido) fue RETIRADO por el fundador** — lo lleva la S3 de Luis. Lo
hecho antes de la retirada queda en un commit de `scrum-804c-el-barrido-alcanza-la-rama`,
**sin empujar**, para no poner una segunda rama sobre el mismo fichero.

## ② ¿Está hecho lo que cada ticket PROMETÍA?

> «¿Está el trabajo en `main`?» y «¿está hecho lo que el ticket prometía?» **no son la misma
> pregunta**, y sólo la segunda cierra un ticket.

**Población: 25 mirados · 25 clasificados.**

🔴 **DE DÓNDE SALE LA PROMESA, Y ES LA LIMITACIÓN QUE MANDA:** se lee de la **entrada de registro
del propio ticket en `main`**, no de Jira — el conector de Atlassian está desconectado en esta
sesión. Donde la entrada sólo registra una MEDICIÓN, no puedo saber si el enunciado original pedía
construir. **Esos van a `NO SÉ` y son tuyos**, no míos.

### 🔴 PARCIAL · 13 — y cada uno lo declara ÉL MISMO

| ticket | qué falta, en sus propias palabras |
| --- | --- |
| **SCRUM-307** | su propio título: *«SUELO DISPARADO: no he podido leer los tres tickets»* |
| **SCRUM-328** | dos secciones `## 5 · LO QUE NO SE HA HECHO` · *«sigue sin haber una frase aprobada»* |
| **SCRUM-523** | el título: *«qué exige, qué hay y qué falta»* |
| **SCRUM-534** | *«`docs/VERIFACTU_EVIDENCIAS.md` sigue sin existir»* · **las 10 frases sin corregir** |
| **SCRUM-568** | el título: *«hoy 0 de 9»* · `## ⑩ Lo que NO se ha hecho` · una rama *«todavía no fusionada»* |
| **SCRUM-635** | el título: *«MEDIDO Y PARADO: sigue bloqueado por su propia condición»* |
| **SCRUM-665** | *«sigue sin medir»* · **el lector sigue sin llamador** |
| **SCRUM-688** | en el propio código: `crearRevision: '⛔ PENDIENTE DE MICROCOPY (SCRUM-688)'` |
| **SCRUM-825** | el título: *«por qué el renombrado NO se puede hacer así»* · *«la variable sigue sin gobernar la llave»* |
| **SCRUM-863** | **la mudanza sin hacer**; su fase b está declarada y abierta |
| **SCRUM-878** | *«Lo que NO se ha hecho: convertir este censo en trinquete»* |
| **SCRUM-903** | — *(ver CUMPLIDO)* |
| **SCRUM-910** | el título: *«① medido, y el resto PARADO»* · depende de SCRUM-893, que no está en `main` |
| **SCRUM-16** | *«Sigue sin cablearse nada. `git diff` sobre `src/` y `prisma/` está vacío»* |

✅ **Los tres casos que el fundador dio como control —863, 665 y 534— salen los tres PARCIAL.**
Si el criterio los hubiera dado por cumplidos, no estaría midiendo.

### ✅ CUMPLIDO · 6

`280` (CAMINO 1 decidido) · `331` (F4, el héroe) · `333` (F6, tarjeta por gremio) · `512` (el
producto no olvida que alguien pagó; su «diff ②» se declaró **improcedente**, no pendiente) ·
`554` (las dos copias del medidor, y la deuda medida) · `903` (el marcador que se imprime; el banco
por estados está declarado **ticket aparte**, que es alcance y no deuda).

### ⚠️ NO SÉ · 6 — **y son tuyos**

| ticket | por qué no puedo decidirlo |
| --- | --- |
| **332** · **334** | **no tienen entrada en `main`**: entraron al cubo DENTRO por tener ficheros propios. Sin entrada no puedo leer qué prometían |
| **322** · **323** · **654** · **811** | su entrada registra un **PASO 0 de medición** y la medición está hecha. Pero si el enunciado de Jira pedía **construir**, esto es PARCIAL y no CUMPLIDO — y el enunciado no lo puedo leer |

## ③ Los 29 NO DECIDIBLES, por lo que los desbloquea

⚠️ **Corrijo un reparto que di mal en la fase b:** dije «6 con commits · 3 anteriores a la
convención · 20 sin rastro». Recontado uno a uno son **7 · 3 · 19**.

### 🔴 GRUPO A · 7 con commits — **decididos, y sin salir del repo**

Basta mirar **qué ficheros tocaron** esos commits. Todos tocan artefactos reales de `main`:

| ticket | qué tocaron sus commits |
| --- | --- |
| 41 | `docs/BUGS.md` · `docs/YAQU_MASTER.md` |
| 142 | `docs/COMO_FUNCIONA_YAQU.md` · **`docs/master/SCRUM-16.md`** · `package.json` |
| 276 · 326 | `docs/diseno/bloque-a.md` · `bloque-b.md` |
| 774 | `scripts/meta-guard-mutaciones.mjs` · dos tests |
| 786 | `public/dashboard/js/customerDetailView.js` · `scripts/_pagina-panel.mjs` |
| 20 | `public/dashboard/js/api.js` · `quotesDetailView.js` · `verifactu.service.ts` |

**Pasan a DENTRO** para la pregunta ①. **Qué haría falta: nada — ya estaba, y el ciego era mi
instrumento.** Le faltaba una tercera señal: *qué tocaron los commits que nombran el ticket*. Sólo
miraba (a) las rutas citadas por la entrada y (b) ficheros llamados `scrumN`.

> 🔴 **Y SCRUM-142 SÍ TENÍA ENTRADA — bajo el nombre de OTRO ticket.** Vive en
> `docs/master/SCRUM-16.md`, titulada **«SCRUM-16 / 142»**. Mi criterio buscaba `SCRUM-142.md` y no
> podía verla. Es *«un trabajo sin número puede estar entero»* otra vez, un piso más abajo: aquí el
> trabajo tiene número, pero **el de otro**.

### GRUPO B · 3 anteriores a la convención — **tuyos**

`143` · `18` · `19`. Son anteriores a SCRUM-192, así que **no pudieron tener entrada**. No hay nada
en el repositorio que los decida: hace falta **leer el ticket y preguntarle a una persona**.

### GRUPO C · 19 sin rastro de ninguna clase — **tuyos**

`281 · 335 · 524 · 529 · 540 · 572 · 573 · 612 · 657 · 658 · 678 · 732 · 735 · 773 · 779 · 789 ·
812 · 891 · 908`. Ni rama, ni entrada, ni ficheros propios, ni commits que los nombren. **El
repositorio no tiene con qué contestar**, y seguirá sin tenerlo por mucho que se afine el
instrumento: lo que falta no es una señal mejor, es el enunciado.

## Lo NO tocado

Jira · ningún ticket cerrado · ninguna rama renombrada ni borrada (27 instrumentos miden ahí, A12) ·
`scripts/_numero-de-rama.mjs` **devuelto a como está en `main`** en esta rama · `CLAUDE.md` regla 3
sin re-fechar · producción y staging sin tocar.
## SCRUM-804f · Una rama `scrum-<n>` sin slug cerró el check obligatorio de `main`

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T13:52:18Z
**Rama:** `scrum-804f-la-rama-sin-slug` · **Carril:** Sesión 3 (instrumentos) · encargo urgente del orquestador (17-sep 15:45 CEST). Los sufijos 804b–804e ya estaban usados.

### PASO 0 · el rojo, reproducido en local contra los refs de hoy
El CI de `main` (run 35226536503) cayó en «SCRUM-804 · CONTROL POSITIVO DERIVADO: la agrupación no pierde ni inventa ramas». En local, sobre `2be8fe16` con la rama remota `scrum-904` presente (PR #1423), falla exactamente ese test y los otros 8 pasan: `scrum-904 → SCRUM-904`, perdida.

**Causa:** dos reglas para la misma pregunta.
- El test de 804 da la rama por canónica: `/^scrum-(\d+)[a-z]?(?:-|$)/`.
- `numeroDeRama` (`scripts/_numero-de-rama.mjs`), que usa `agruparRamas`, exigía guion: `/^scrum-0*(\d+)[a-z]?-/`.

El guion existía (SCRUM-738) para que `scrum-72` no casara con el principio de `scrum-727-x`. Eso lo garantiza igual el fin de cadena, porque `\d+` es voraz.

**Impacto medido antes de cambiar:** sobre los **831** nombres de rama (remotos y locales) cambia de número **exactamente 1**, `scrum-904` (`null` → 904).

### Rojo, arreglo y tests que cambian
- **Rojo** `e25859347a76334200c304f4f5e0427252fee83c`: `tests/scrum804f-la-rama-sin-slug.test.mjs`. (1) `agruparRamas` con una población fabricada (`scrum-904`, `scrum-905b`), así que no depende de que la rama de Javier siga viva. (2) La identidad: 72 ≠ 727, `scrum-72bb` y `scrum-72.1` sin número, anclada, y un revert sigue sin ticket. (3) POSITIVO sobre los refs de hoy: sólo cambian de número las ramas sin slug.
- **Arreglo** `519a645fc00847c259773c74a67fd1a66b3f7dee`: `numeroDeRama` acepta `(?:-|$)`.
- **`scrum738`:** exigía `null` para `scrum-72` a secas. Era un efecto de la regla, no su motivo. Ahora exige 72, y además `scrum-727` → 727, para que la identidad siga comprobada también sin slug.
- **`scrum723`:** el nuevo guard nombra `main` en su prosa y quita `origin/` a los nombres, así que queda **declarado con su motivo**. No compara contra la referencia móvil: sólo lee nombres.

### Mutantes (con todo comiteado), los 3 muertos
| Mutante | Cae |
|---|---|
| M1 la regla vieja (sólo guion) | 804 ① + 804f (1) y (2) |
| M2 `agruparRamas` **pierde** las ramas `scrum-9xx` | 804 ① + 804f (1) |
| M3 `agruparRamas` **inventa** (cada rama también en n+1) | 804 ② + 804f (1) |

### Verificación
Los 9 ficheros que consumen la regla (reparto, alcanzabilidad, tablero, rastro, 804, 804f, 738, 753, 387), más 723: en verde. `npm test` completo **no** se ha corrido en local, para no quitarle tiempo a un `main` bloqueado y porque la sonda de SCRUM-858 seguía corriendo; lo corre el CI del PR. La comprobación del PR va en un paso aparte.

### Añadido tras los datos de Javier (orquestador, 17-sep 16:25 CEST)
- **Lo que midió Javier:** de 150 ramas vivas, 93 con forma de ticket, y sólo `scrum-904` rompía el barrido. `scrum-421-…-INCOMPLETO` y `scrum-474-…-INCOMPLETO` llevan el slug en mayúsculas, pero el guion tras el número ya las delimitaba y el barrido las alcanza. Su propuesta, `^scrum-(\d+)([a-z])?(-|$)`, es equivalente a la aplicada; Javier retira la suya y renombra `scrum-904` → `scrum-904-completar-lleva-al-campo`.
- **EL LÍMITE, fijado por el orquestador:** una rama **sin número** (`scrum-paso0-dinero`) NO se atribuye a ningún ticket. Queda **declarada** en `sinNumero`, visible y contada en el total, nunca descartada en silencio. Lo fija el nuevo NEGATIVO de `scrum804f` (commit `c48d220183ecc3848bec429b163d8fd8316ac12e`).
- **M4, inventar un número** (`^scrum-\D*0*(\d+)…`, que convierte `scrum-paso0-dinero` en 0): muerto. Caen el NEGATIVO y el POSITIVO sobre los refs de hoy.

### A12 · quién comparte el lector (y quién NO se ha tocado)
El lector cambiado es **uno**, `scripts/_numero-de-rama.mjs`. Sus consumidores, por import y no por nombre:
- `scripts/_censo-reparto.mjs` (`agruparRamas`), y a través de él `scripts/censo-reparto.mjs`, `scripts/_rastro-del-ticket.mjs` (el censo de SCRUM-804) y `scripts/_censo-alcanzabilidad.mjs`;
- `scripts/censo-tablero-vs-arbol.mjs` (`poblacionDe`, que reexporta la regla), y a través de él `_censo-alcanzabilidad`;
- tests: `scrum387`, `scrum738`, `scrum753`, `scrum804`, `scrum804f`, `scrum829b`.

**NO comparte el lector, y NO se ha tocado:** `tests/_entrada-de-la-rama.mjs` (SCRUM-854), que tiene su propio `numeroDeRama` (`/^scrum-(\d+)/i`) y ya aceptaba las ramas sin slug. Tampoco el resto de instrumentos que miden sobre ramas remotas con su propio lector: los de la cuenta de Javier (27) que no aparecen arriba no importan esta regla.
