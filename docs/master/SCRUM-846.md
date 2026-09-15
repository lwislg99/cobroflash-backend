# SCRUM-846 · 19 de 95 instrumentos de medición no tienen un caso conocido delante

**Fecha del expediente:** 15-sep-2026 · **Carril:** instrumentos · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `3b50990f09d0023e7654d14a24a366b7a167a4a5` · 2026-09-15T11:04:12Z
**Sha real del merge que entró sin expediente:** `658976f0a28cd3192c11ddd4040ca934c6a686f7`
(PR #1257, 2026-09-15T10:08:09Z, rama `scrum-846-caso-conocido-por-ast`)
**Rama de esta reconstrucción:** `scrum-846-834-expedientes-reconstruidos`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión de **SCRUM-854**, que midió que este ticket había entrado en `main` sin
> registro. **Todo lo que hay aquí está DERIVADO del árbol y de Jira, y cada afirmación dice de
> dónde sale.** No se ha reconstruido ninguna medición que no se pueda verificar hoy, ni se ha
> inventado un rojo que nadie presenció. Lo que no se pudo saber está en el **§5**, con su nombre.
>
> **El ticket sigue EN CURSO en Jira.** Esto no lo cierra: le pone el registro que le faltaba para
> que el siguiente PR no nazca bloqueado por el guard de SCRUM-854.

---

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Título:** *«🔴 19 de 95 instrumentos de medición NO tienen un caso conocido delante: pueden dar
un cero y nadie sabrá si es real»* · **Tipo:** Error · **Prioridad:** Medium ·
**Estado:** **En curso** · Creado 2026-09-09 por Luis Lara.

El enunciado, citado del ticket:

> «El instrumento de mutación de la Sesión 3 mintió TRES veces sobre sí mismo, y las tres las cazó
> ella. Ninguna la habría cazado un guard. ¿Cuántos otros instrumentos de la casa no tienen nada
> que los vigile?»

Y la regla que lo motiva:

> 🔒 «Un suelo no tiene por qué ser un mecanismo: a veces basta UN caso conocido encima de la mesa.
> **Un cero sin ningún caso conocido delante no se puede juzgar.**»

**Medición original declarada en el ticket** (9-sep-2026, `origin/main` = `19215875`):
137 funciones en **95 módulos** → **76 CON** caso fabricado delante · **19 SIN** ninguno.

**Alcance fijado en el ticket (regla 37):** ⛔ no se abre un ticket por cada instrumento; la lista
vive en el censo y se prioriza por lo que decide cada uno — dinero, camino fiscal y puerta del
robot primero; un censo de clases de botón, el último.

## 2 · Qué entró en `main`, derivado de `git log`

**Tres commits de trabajo**, y sólo uno por una rama propia:

| commit | fecha | entró por | asunto |
|---|---|---|---|
| `322a2a47` | 2026-09-09 | **PR #1238 · rama `scrum-637-verificacion-s5`** | «cuatro instrumentos con un caso conocido delante — y mi censo inflaba la cifra» |
| `a3f8438f` | 2026-09-15 | `186b19a3` (merge de main en `scrum-637-verificacion-s5`) | «mi censo mintió una TERCERA vez hoy, y ésta acusaba de menos» |
| `a476b234` | 2026-09-15 | **PR #1257 · rama `scrum-846-caso-conocido-por-ast`** | «cuarta corrección del censo — la procedencia se resuelve por AST, y la cifra buena es 15» |

### 🔴 Y aquí está el motivo de que nadie lo echara en falta

**Dos de los tres commits entraron dentro de PRs de OTRO ticket** (`scrum-637-verificacion-s5`).
El trabajo de SCRUM-846 viajó dentro de ramas que no llevan su número, así que ni el nombre de la
rama ni el PR delatan que había que escribir `docs/master/SCRUM-846.md`.

> ⚠️ **Esto es un límite del guard de SCRUM-854, y se declara aquí:** aquel guard exige la entrada
> del ticket **de la rama**. Un commit de SCRUM-846 dentro de una rama `scrum-637-*` sigue pasando.
> Cerrarlo obligaría a exigir entrada por **cada** ticket que nombren los commits, y eso no se
> decide en una reconstrucción a posteriori: se mide y se propone aparte.

**Fichero tocado (los tres commits):** `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs`.
El PR #1257 fue `+205 / -24` sobre ese único fichero.

## 3 · Qué dicen los commits (citado, no reinterpretado)

El mensaje de `a476b234` documenta la cuarta corrección. Se cita porque **está en git y se puede
verificar**; no es una medición de esta sesión:

* **El defecto que corrige:** el criterio era de regex sobre el texto y *«mentía hacia los dos
  lados»*. Un `for-of` desestructurado casaba cualquier `for-of` del fichero sin mirar el nombre,
  y todo acceso a propiedad contaba como caso fabricado.
* **El criterio nuevo:** el nombre se resuelve **en su ámbito léxico**, y cada forma es una regla
  con su siembra en el control negativo — *«19 siembras, todas en verde»*.
* **La cifra declarada:** **81 CON / 15 SIN de 96 módulos** (antes `main` decía 83/13), calibrada
  contra 20 veredictos a mano, **20/20**.
* **Límites que el propio commit declara:** sólo se mira el **primer argumento** de cada llamada,
  así que `detector('x.ts', leerDeVerdad())` saldría con caso; y el juicio a mano cubre los 20
  módulos donde los criterios discreparon, **no los 96** — *«donde los dos criterios coinciden,
  pueden equivocarse juntos»*.
* **La calibración no se comiteó**, a propósito: *«una lista cableada caduca»*.

## 4 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

El censo existe y corre hoy sobre `main`. **Esto sí es medición propia**, y se marca como tal
para no confundirla con la del ticket:

```
INSTRUMENTOS censados: 141 funciones en 99 modulos
  CON caso fabricado delante: 84  (77 en la función censada misma, 7 en una hermana …)
  SIN ninguno:                15
SUELO — los tres que YA sé que lo tienen:  ✅ CON tautologiasDe · enPatronPeligroso · censarReferenciaMovil
CONTROL NEGATIVO — sembrado, en los dos sentidos: ✅ un censo que sólo recibe la raíz sale SIN
```

`rc=0`. La población ha crecido de 96 a 99 módulos (esta sesión misma añadió dos), y **los SIN
siguen siendo 15**. El censo trae su suelo y su control negativo dentro y los pasa.

## 5 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

Se nombra en vez de rellenarse. Cada punto es algo que **sólo sabe quien hizo el trabajo**:

1. **Los rojos de las cuatro correcciones.** El commit dice que el censo mintió cuatro veces y que
   las cazó contrastándolo con uno estricto y juzgando a mano. **Esas ejecuciones no están en el
   árbol** y no se reconstruyen: enseñar aquí un rojo que no presencié sería fabricar evidencia.
2. **La calibración de 20 veredictos a mano.** El propio commit dice que **no se comiteó**. No hay
   forma de verificar el «20/20» ni de saber qué 20 módulos eran.
3. **Qué instrumentos de los 15 se han priorizado**, y por cuál se empieza. El ticket fija el
   criterio (dinero, fiscal y puerta del robot primero) pero no consta la decisión tomada.
4. **Las dos primeras correcciones** (las que el ticket llama ① y ②) no tienen commit propio
   localizable en `main` con ese número: el ticket las describe, el árbol no las separa.
5. **Por qué el trabajo viajó en ramas de `scrum-637`.** Puede ser deliberado —mismo carril de
   verificación S5— o accidental. No consta, y la diferencia importa para decidir si el guard de
   SCRUM-854 debería cubrir ese caso.
6. **El estado real del ticket.** Jira dice «En curso»; el árbol no dice qué falta para cerrarlo.

## 6 · Lo NO tocado por esta reconstrucción

No se ha modificado ni una línea de `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs` ni
de ningún otro fichero del ticket. Esto es **sólo el registro que faltaba**.

---

# APÉNDICE · SCRUM-846 (15-sep-2026) · Lo escribe quien hizo el trabajo: los quince, sembrados y vistos caer

**Medido contra:** `origin/main` = `9070f3d780938b6b1f53cf6afbeb55f71221229b` · 2026-09-15T16:15+02:00

**Autor:** Sesión 0 (carril de verificación) · **Rama:** `scrum-846b-siembras-a-los-quince`, abierta desde
`origin/main` = `d9a05138cb61a30916300951a979db84121d8002` con `HEAD..origin/main` = 0 · `prisma generate` rc=0.

> Este apéndice **no corrige** la reconstrucción de arriba: la deja intacta y contesta, desde quien
> hizo el trabajo, lo que su §5 nombró como imposible de saber. Donde su §4 y esto difieren en una
> cifra, es porque miden `main` en momentos distintos; cada uno lleva su ancla.

## A · El cierre

El criterio de cierre lo fijó el orquestador: **el censo, ejecutado en `main`, da 0 sin caso, o sólo
quedan excepciones declaradas con su causa.**

Esta rama da a cada uno de los 15 que quedaban una siembra con una entrada FABRICADA que tiene que
dar SÍ y otra que tiene que dar NO, y el censo pasa a **0 sin caso, sin excepciones declaradas**.
Medido sobre el árbol con `main` traído dentro: 141 funciones en 99 módulos, las 99 con caso. Se comprueba con:

```
node scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs      → SIN ninguno: 0
node scripts/verificacion-s5/romper-los-quince.mjs                → 31 roturas, las 31 tumban su siembra
```

## B · Respuestas al §5, en su mismo orden

**1 · Los rojos de las cuatro correcciones.** No están en el árbol, y la reconstrucción hizo bien en no
inventarlos. Lo que sí está, y se puede ejecutar hoy, es su equivalente: **cada regla que salió de una
corrección tiene una siembra en el control negativo del censo**, en el sentido que la rompería
(«una lectura con ruta literal no lo salva», «un for-of desestructurado AJENO no lo salva»,
«sí lo salva un árbol temporal»…). Son 19 y corren en cada ejecución del censo.

**2 · La calibración de los 20 veredictos a mano.** No se comiteó a propósito —una lista cableada de
módulos caduca el día que uno gana su caso—, pero los 20 veredictos, con su motivo, son éstos:

| módulo | a mano | por qué |
| --- | --- | --- |
| `scripts/censo-guards-gateados.mjs` | SIN | `run({ files, cwd: RAIZ })` son opciones para ejecutar los tests de verdad |
| `scripts/_solape-de-guards.mjs` | CON | `mkdtempSync` con `a.mjs…d.mjs` literales y respuesta sabida |
| `scripts/_texto-fuera-del-censo.mjs` | SIN | `leerLanding(RAIZ)`: la landing de verdad |
| `tests/_censo-copy-vs-flag.mjs` | SIN | `censoCopy(RAIZ, …)` |
| `tests/_censo-emisores-con-fila.mjs` | CON | `ve('await enviarCorreo(…)')`: literal por un envoltorio |
| `tests/_censo-literales-retencion.mjs` | CON | `mkdtempSync` + `cazado.js` / `inocente.js` fabricados |
| `tests/_censo-superficies-configuracion.mjs` | SIN | `fs.readFileSync(VISTA)` |
| `tests/_inventario-detalle-trabajo.mjs` | SIN | el DOM que pinta la vista real |
| `tests/_censo-aviso-vs-bloqueo.mjs` | CON | `mutando(literal, literal)`: cinco promesas inyectadas |
| `tests/_carga-de-pagina.mjs` | CON | `clasesQueUsa(html.replace('</body>', …))`, con arista a `analizarPagina` |
| `tests/_censo-cierre-trabajo.mjs` | CON | `codigoReal.replace(texto, texto inventado)` y el guard tiene que cazarlo |
| `tests/_alcance-desde-entradas.mjs` | CON | `conArbol((raiz) => …)` con `arbolSintetico()` sobre `mkdtempSync` |
| `tests/_censo-marcado-de-cobro.mjs` | CON | `arbolDeMentira({ … })` (PR #1238) |
| `tests/_censo-target-tactil.mjs` | CON | CSS literal (PR #1238) |
| `scripts/frontera-dist.mjs` | CON | `TESTIGO` literal y el fuente mutado |
| `tests/_censo-eol.mjs` | CON | `b('a…')`, `Buffer.from([…])` |
| `scripts/_puerta-de-entrada.mjs` | CON | `puertasFragilesEn('if (…)', 'sintetico.mjs')` |
| `tests/_condiciones-vs-emisor.mjs` | CON | `revisarCondicionesContraEmisor({ [RUTA]: … })` |
| `tests/_censo-new-url.mjs` | SIN | su hermana `parseBDSegura` no tiene arista con el censo |
| `tests/_censo-peticiones-panel.mjs` | SIN | `repartoPorMetodo` consume la salida del árbol real |

Los seis SIN de esa tabla estaban entre los 15, y los seis tienen hoy su siembra.

**3 · Por cuál se empezó.** Por lo que gobierna cada uno, leído en el instrumento y no en su nombre:

| # | instrumento | qué gobierna | siembra |
| --- | --- | --- | --- |
| 1 | `censarLlamadas` (scrum245) | que cada envío de WhatsApp declare su merchant — tenencia | en su propio fichero |
| 2 | `censoCopy` | si un rótulo con «factura» lo elige `INVOICING_ES_ENABLED` — camino fiscal | `scrum846b-siembras-a-los-quince` |
| 3 | `censarEstrechamientos` | líneas de factura rehechas con cuatro claves que pierden lo demás | ídem |
| 4 | `censoDeConexiones` (scrum746) | clientes de base que alcanzan producción sin comprobar el destino | en su propio fichero |
| 5 | `censoNewUrl` | errores de `new URL()` alcanzables, que llevan la cadena de conexión | `scrum846b-siembras-a-los-quince` |
| 6 | `censarPuertasDelPresupuesto` | qué campos lleva cada puerta del PDF del presupuesto | ídem |
| 7 | `clasificarEvento` | que un test saltado no cuente como uno que corrió | ídem |
| 8 | `censarAlmacenamiento` | qué guarda la landing en el navegador y qué enlaces al registro atribuyen | ídem |
| 9 | `medirDetector` | promesas de capacidad en `#comparativa` — caso DIFERENCIAL, el registro de anclas es el real | ídem |
| 10 | `censoDeBodies` | la forma del `body` de cada `apiRequest` | ídem |
| 11 | `censarPeticiones` | los `fetch` que se saltan el plazo de red | ídem |
| 12 | `inventario` | las acciones del detalle del trabajo | ídem |
| 13 | `censarSuperficies` | los bloques de Configuración | ídem |
| 14 | `censarPiesDeModal` | los pies de modal y sus botones | ídem |
| 15 | `censarUsosDeBoton` | variantes de botón sin la base `btn` — lo último | ídem |

Por nombre parecían ir detrás de scrum245 el 746 y los gateados; leídos, el camino fiscal y las líneas
de factura van antes. Dos siembras viven en su propio fichero porque su instrumento está DENTRO de un
`.test.mjs`: importarlo desde otro test volvería a registrar todos sus tests.

**4 · Las correcciones ① y ②.** Ocurrieron el 9-sep **antes del primer commit del censo**: buscar la
palabra «SUELO» dio 149 de 151 (contaba texto) y exigir un literal falló el suelo por un escapado del
shell. No hay commit que las separe porque el censo no existía aún en el árbol.

**5 · Por qué el trabajo viajó en ramas de `scrum-637`.** **No fue deliberado.** Era mi rama larga del
carril de verificación y seguí comiteando en ella. El orquestador lo corrigió el 15-sep con la norma
A17 —un ticket, una rama—, y desde entonces SCRUM-846 va en `scrum-846-caso-conocido-por-ast` (PR #1257)
y en `scrum-846b-siembras-a-los-quince` (ésta). El hueco que el §2 declara en el guard de SCRUM-854
es real y lo destapé yo.

**6 · El estado real.** Con esta rama en `main`, el censo da 0. Jira lo lleva el orquestador, que
decide el cierre.

## C · Visto caer, y dos rojos de guard por el camino

- **Suelo del rompedor:** las 15 siembras, sin romper nada, en verde y con al menos un test cada una.
- **31 roturas** —«dice que sí a todo» y «dice que no a todo» por instrumento, tres en
  almacenamiento—, **y las 31 tumban su siembra**. Cada fichero se restaura y se comprueba byte a byte.
- **Un ancla caducada cuenta como fallo, no se salta.** En la primera corrida el texto que se rompía
  en `scrum245` estaba dos veces —`censarLlamadas` y `censarTexto` repiten la comprobación— y el
  rompedor lo dio en rojo en vez de romper el que no era.
- **La tanda completa dio dos rojos, los dos míos y los dos con razón.** Se arregló el código, no lo
  que exigen los guards:
  - SCRUM-710b cazó un `linea: 2` en una siembra. Todas pasaron a compararse por identidad: fichero,
    motivo del acusado o texto del body.
  - SCRUM-350 cayó sobre el rompedor porque citaba una ruta que lleva en el nombre la clase CSS del
    pie de modal. El rompedor dejó de citar rutas: cada rotura nombra la FUNCIÓN que rompe.
- **Y el nombre solo tampoco identifica.** Al traer main, `censarLlamadas` apareció exportada por dos
  ficheros (`scrum245` y `_censo-emisores-con-fila`). El rompedor no eligió uno: lo dio en rojo
  (IDENTIDAD). Lo que identifica al instrumento es el ENLACE que usa su siembra: el propio test si la
  define, o el único módulo que el test importa y la exporta.

Commit de las siembras: `19291ab63be7100c8c5ab8fa1d58a91dc67a79e6`, comiteado ANTES de inyectar el primer rojo.

## D · Cambios fuera de las siembras, todos aditivos

- `censoDeConexiones` (scrum746) recibe la raíz por parámetro, con la de siempre por defecto.
- `censarMarcadores` y `censarLectores` (PR #1238), lo mismo.

## E · Límites declarados

- **Lo que el censo no mira no sale en su cero.** Su población son las funciones EXPORTADAS con verbo
  de medida en `scripts/` y `tests/`, sin subcarpetas. Un script que mide sin exportar nada —como
  `scripts/censo-estado-no-contemplado.mjs`, que entró durante esta misma tanda— no cuenta ni para
  bien ni para mal.
- El censo sólo mira el PRIMER argumento de cada llamada.
- Donde su criterio laxo y el estricto coinciden, no se ha juzgado a mano.
- Una siembra demuestra que el instrumento VE su caso fabricado; no que su cifra sobre el árbol de
  verdad sea la correcta.
