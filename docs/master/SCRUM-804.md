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
