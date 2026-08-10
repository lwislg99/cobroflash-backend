# SCRUM-411 · Los exports de dominio que un profesional no puede alcanzar

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T20:06:33+02:00
(anclado con `git ls-remote`, no con la ref local)

## El defecto

Un módulo de dominio **sin llamadores pasa todos los tests, entra verde, y desde fuera es
indistinguible de una función entregada**. Su ticket se cierra, y el cableado que falta deja de
estar en ninguna lista. Los cinco casos conocidos se descubrieron **por casualidad, midiendo otra
cosa**.

## 🔴 El hallazgo del ticket: LA ALCANZABILIDAD POR FICHERO MIENTE

La primera versión del censo daba `borradoMerchant.ts` por **vivo**, porque `barridoDemo.ts`
importa de él. Medido: importa **dos constantes** (`ORDEN_BORRADO_MERCHANT`, `COLGADOS_DE_CHARGE`);
**`borrarMerchant` no lo importa nadie** y ninguna ruta lo expone.

**Un módulo vivo por una constante esconde una función muerta.** El veredicto es **por export y
por alcance, nunca por módulo** — y eso lo destapó el control positivo, no mi lectura del código.

Ese caso concreto vive ahora **en la suite**, no en este informe: si el censo vuelve a mentir por
ahí, cae un test que lo nombra.

## Cómo mide

1. Camina el grafo de imports desde **`src/index.ts` y `src/app.ts`** — las entradas del proceso.
   `tests/` **no es entrada**: un módulo llamado solo por su test es justo el caso buscado.
2. Un export está vivo solo si lo importa **un fichero que a su vez es alcanzable**.
3. `export type` / `export interface` quedan fuera: no se pueden llamar.
4. Un módulo importado con `import * as` se da por vivo entero — no se puede saber qué se usa, y se
   prefiere no acusar. Es un punto ciego declarado, con su test.

## La foto: 8 módulos de dominio inalcanzables de 82

**Suelo de la medición:** 82 módulos de dominio, 199 ficheros de `src` indexados, 180 alcanzables.

### (b) Cierre en falso — ticket CERRADO, función inalcanzable → **reabiertos por el fundador**

| módulo | exports huérfanos | ticket |
|---|---|---|
| `system/domain/flagFiscal.service.ts` | `cambiarFlagFiscal`, `FLAGS_FISCALES`, `esFlagFiscal`, `ErrorCambioFlag` | SCRUM-218 |
| `system/domain/borradoMerchant.ts` | **`borrarMerchant`**, `FUERA_DEL_BARRIDO_GENERICO` | SCRUM-244 (RGPD-1) |

⚠️ El segundo **no sale como módulo inalcanzable** —dos de sus constantes sí se usan—, y por eso
estuvo a punto de no salir. Es el caso que da nombre al hallazgo de arriba.

### (a) A medio construir con ticket abierto — normal, se anota

| módulo | exports | ticket |
|---|---|---|
| `invoicing/domain/retencionIrpf.ts` | 6 | SCRUM-293 (A2) — esperando P12 y campo de schema |
| `invoicing/domain/recargoEquivalencia.ts` | 4 | SCRUM-294 (A3) — esperando **P13** (los tipos) |
| `invoicing/domain/criterioCaja.ts` | 3 | SCRUM-294 (A3) |
| `invoicing/domain/huecosSerie.ts` | — | SCRUM-291 ① |
| `jobs/domain/albaranSerie.ts` | 3 | SCRUM-306 |
| `jobs/domain/entregaPendiente.ts` | 3 | SCRUM-367 / entregas |

### (c) Código muerto — **candidato único, NO se retira**

| módulo | export | por qué queda anotado y no borrado |
|---|---|---|
| `invoicing/domain/finalInvoice.service.ts` | `buildFinalInvoice` | **Sin dueño y sin llamador**, y es del módulo de **facturación**. Un export ahí no se retira por descarte: merece veredicto propio. Queda nombrado para que alguien lo decida, no para que se caiga solo. |

## El trinquete

`MODULOS_DOMINIO_INALCANZABLES_MAX = 8`, y **solo puede bajar**. Si sube, el test cae **nombrando
el módulo nuevo**; si baja porque alguien cableó uno, el test también cae y obliga a bajar el tope
en el mismo commit — un tope con holgura es el descuadre silencioso.

## Verificación

| control | resultado |
|---|---|
| los cuatro conocidos salen (`retencionIrpf`, `recargoEquivalencia`, `criterioCaja`, `flagFiscal.service`) | ✅ |
| **control negativo**: `invoiceNumber.service` NO sale | ✅ |
| **el control que me corrigió**: `borrarMerchant` sale como huérfano aunque su fichero esté vivo | ✅ |
| suelo: sin módulos de dominio, el análisis no dice «todo bien» | ✅ |
| trinquete en rojo: un export de dominio nuevo sin llamador sube a 9 y cae nombrándolo | ✅ |
| tipos e interfaces no cuentan como export | ✅ |

## Lo que NO se ha medido — declarado

* **Los 127 exports sueltos de módulos vivos** están listados por el analizador pero **sin
  clasificar**: ahí hay constantes exportadas solo para sus tests (legítimo) mezcladas con
  funciones sin cablear. El trinquete de hoy **no los cubre**: solo cuenta módulos enteros.
* **Los tipos e interfaces quedan fuera a propósito.** No se pueden llamar.
* **Reflexión y montaje dinámico no se ven.** Un router montado por una cadena, o algo alcanzado
  por `import()` dinámico, saldría como muerto sin serlo. No se ha encontrado ninguno, pero **no se
  puede afirmar que no exista**.
* **`import * as` da el módulo por vivo entero**, así que un módulo importado así podría estar
  muerto y no saldría.
* **No se mide el alcance desde CRONS que no cuelguen de `index.ts`**, si los hubiera.

## Ficheros

* `tests/_alcance-dominio.mjs` (nuevo) — el analizador: grafo de alcance + exports por AST.
* `tests/scrum411-exports-inalcanzables.test.mjs` (nuevo) — trinquete, suelos y los controles.

---

# SCRUM-411 · SEGUNDA ENTREGA (10-ago-2026) — ¿se pueden cerrar los bloques B, D y G?

**Fecha:** 10-ago-2026 · **Carril:** medición · **Gate:** informe, **cero construcción** · **Toca código:** NO
**Medido contra:** `origin/main` = `036241eb385835005de227631f973d49c17cc8be` · 2026-08-10T14:33:39+02:00
(anclado con `git ls-remote`, que coincide con la ref local)
**Tanda:** 2465 tests · 2391 pass · **0 fail** · 74 gateados · `npm test` exit **0**

> **NO cierra ni reabre nada en Jira, y no cablea nada.** Cada motor sin superficie que salga aquí se
> **anota**; cablearlo es su propio ticket, con su decisión y su microcopy. La salida es para el
> asesor, que decide.

## 🔴 EL HALLAZGO QUE VA PRIMERO: la lista de Jira NO SE HA PODIDO LEER

El encargo pedía derivar los hijos **del repo y de Jira** y tratar la discrepancia como hallazgo.
**Esta sesión no tiene acceso a Jira** —ni MCP, ni `gh`, ni un volcado cacheado; `scripts/censo-reparto.mjs`
exige un `--jira <f.json>` que se genera fresco y **a propósito no vive en el repo** (SCRUM-387)—.
Así que **la mitad «Jira» del cruce no se ha hecho**, y eso se declara en vez de rellenarse con la
frase del encargo. Lo único que aporta el encargo sobre Jira es que **los tres bloques no tienen ni
un hijo abierto**; ese dato entra como premisa ajena, no como medición mía.

**Consecuencia para leer esta tabla:** los veredictos de abajo dicen **qué hay en `main`**. Si en
Jira hubiera un hijo que el repo no nombra, este censo **no lo vería** — y ése es exactamente el
punto ciego que el encargo quería cubrir. Queda abierto.

## La lista de hijos, derivada del repo — y de dónde sale cada uno

No hay en el árbol ningún fichero que enlace epic → hijos. La derivación usa **la etiqueta del
propio bloque en el título de la entrada de registro** (`B1`, `D2`, `G5`…), que es evidencia que
**nombra el ticket** en el sentido de SCRUM-388:

| bloque | hijos derivados | evidencia |
|---|---|---|
| **B** · SCRUM-277 · Arquitectura de información | B1 `SCRUM-284` · B2 `SCRUM-283` · B3 `SCRUM-286` · B4 `SCRUM-285` | títulos de `docs/master/`; el diseño verbatim de la epic está en `docs/diseno/bloque-b.md` y define **exactamente B1–B4** |
| **D** · SCRUM-279 · Alta e importación | D0 `SCRUM-310` · D1 `SCRUM-312` · D2 `SCRUM-313` · D3 `SCRUM-314` · D4 `SCRUM-315` | títulos de `docs/master/`, salvo **D1**, que sale de `docs/master/SCRUM-324.md:91` («El importador (D1 / SCRUM-312)») |
| **G** · SCRUM-282 · El Trabajo | G0 `SCRUM-309` · G1 `SCRUM-316` · G2 `SCRUM-317` · G3 `SCRUM-318` · G4 `SCRUM-319` · G5 `SCRUM-320` | títulos de `docs/master/` |

**SUELO del barrido:** 15 hijos censados, **15 con evidencia en `main`**. Si hubiera salido cero, el
censo se declara ciego y no informa — cero hijos es imposible con trabajo cerrado en los tres bloques.

⚠️ **Y el diseño de D y de G no está en el repo.** Solo `bloque-a`, `bloque-b` y `bloque-c` tienen
copia verbatim (`docs/diseno/`). Para B se ha podido contrastar lo entregado **contra el enunciado**;
para D y G solo contra lo que declara cada entrega. **Es una asimetría de la medición, no de los
bloques**, y explica por qué los tres huecos duros salen todos en B.

## El instrumento, y su control — pegado

El detector de SCRUM-411 corrido sobre el árbol de hoy (`8/87` módulos de dominio inalcanzables,
mismo tope del trinquete):

```
════ CONTROL: los cuatro casos conocidos de SCRUM-411 ════
✅ src/modules/invoicing/domain/retencionIrpf.ts       inalcanzable=true  huérfanos=[TIPOS_RETENCION, esTipoRetencionValido, calcularRetencion, liquidoAPercibir, bloqueRetencion, leerTipoRetencion]
✅ src/modules/invoicing/domain/recargoEquivalencia.ts inalcanzable=true  huérfanos=[RECARGO_POR_TIPO_IVA, calcularRecargo, calcularRecargoDeFactura, leerRecargoDelCliente]
✅ src/modules/invoicing/domain/criterioCaja.ts        inalcanzable=true  huérfanos=[ADVERTENCIA_CAJA, clasificarPorCobro, leerCriterioCaja]
✅ src/modules/system/domain/flagFiscal.service.ts     inalcanzable=true  huérfanos=[FLAGS_FISCALES, esFlagFiscal, ErrorCambioFlag, cambiarFlagFiscal]
   (control que corrige) borradoMerchant.ts inalcanzableComoModulo=false huerfanos=[FUERA_DEL_BARRIDO_GENERICO, borrarMerchant]
   (control NEGATIVO)    invoiceNumber.service.ts inalcanzable=false
✅ CONTROL OK: los cuatro salen.
```

Y los 24 tests de los dos instrumentos (`scrum411-exports-inalcanzables`, `scrum388-censo-mecanismo`,
`scrum388-centinela-main`) en verde antes de creerse nada.

### 🔴 El instrumento NO alcanza a la mitad del objeto medido, y hay que decirlo

**SCRUM-411 solo mira `src/modules/*/domain/*.ts`.** Los bloques B y G son **casi enteros
`public/dashboard/js/`**, que el detector no indexa. Aplicarlo tal cual a B y a G y no encontrar nada
habría sido el verde hueco de siempre: «no supe mirar» leído como «está bien».

Para esa mitad se midió **aparte**, con el criterio equivalente: un módulo de front es alcanzable si
(1) tiene su `<script>` en `public/dashboard/index.html` y (2) **alguna vista real lo llama**, con la
llamada anclada a fichero y línea. Los tests **no cuentan como llamador**, igual que en SCRUM-411.

**Esto NO es un mecanismo: es una medición de una vez.** No corre en `npm test`, así que no impide
que el número crezca mañana, y se hizo por identificador y no por AST — un llamador dentro de un
comentario contaría, y un acceso dinámico no se vería. Las seis llamadas de abajo se comprobaron
**una a una en su línea** para que el resultado no dependa de eso. Un guard de alcance para `public/`
sería su propio ticket.

| módulo de front | del hijo | llamador real |
|---|---|---|
| `settingsSubmenus.js` | B1 | `settingsView.js:107` `paneles[submenuDeCampo(clave)]`, `:129` `rotuloDeSubmenu(clave)` |
| `invoiceActionsRegistry.js` | B2 | `invoiceDetailView.js:220` `window.INVOICE_ACTION_REGISTRY` |
| `jobActionsRegistry.js` | G1 | `jobDetailView.js:481` `destinoAccionTrabajo(id)` |
| `jobRailBlocks.js` | G3 | `jobDetailView.js:1764` `construirBloquesRail(job, …)` |
| `jobDocsReparto.js` | G4 | `jobDetailView.js:1650` `repartirDocumentos(docs)` |
| `jobCobroHuecos.js` | G5 | `jobDetailView.js:177` `huecosDeCobro(job)`, `:586` `seccionCobroVisible(job)` |

## La tabla, hijo a hijo

`(a)` acabado y alcanzable · `(b)` motor sin superficie → cierre en falso · `(c)` hueco declarado

| hijo | ticket | SCRUM-388 | ¿lo alcanza un profesional? | casilla |
|---|---|---|---|---|
| **B1** barra lateral + Configuración | 284 | ENTERO | **La mitad.** Configuración troceada en 10 submenús: sí. **La barra lateral: NO EXISTE** | **(c)** |
| **B2** patrón de detalle | 283 | ENTERO | Sí — registro leído por `invoiceDetailView.js:220`. Aplicado a FACTURA | **(a)** con hueco *(ver abajo)* |
| **B3** formularios numerados | 286 | ENTERO | Sí — 4 bloques en `quotesView.js:324` | **(a)** |
| **B4** separar Facturas de Cobros | 285 | ENTERO | **NO. No hay nada que alcanzar**: solo se entregó el censo | **(c)** |
| **D0** las seis preguntas | 310 | **PARCIAL** ⚠️ | Informe. Su entregable es el documento, y está en `main` | **(a)** *(el PARCIAL es del detector, ver abajo)* |
| **D1** importador de clientes | 312 | ENTERO | Sí — `importarClientes.service.ts` vivo (4/7 exports alcanzables), ruta con `requireRole('admin')`, 3 pantallas | **(a)** |
| **D2** «¿por qué número vas?» | 313 | ENTERO | Sí — `vistaPreviaSerie.ts` **0 huérfanos**, pantalla en el alta + puerta de última oportunidad | **(a)** |
| **D3** wipeDemo derivado | 314 | ENTERO | Sí — `barridoDemo` alcanzable; botón en Configuración | **(a)** |
| **D4** checklist hasta el cobro | 315 | ENTERO | Sí — `homeView.js` + `metrics.service.ts` vivos | **(a)** |
| **G0** el Trabajo, medido | 309 | ENTERO | Informe. Documento en `main` | **(a)** |
| **G1** detalle con patrón B2 | 316 | ENTERO | Sí — `jobDetailView.js:481` | **(a)** |
| **G2** el Trabajo por su nombre | 317 | ENTERO | Sí — `job.service.ts` y `jobs.routes.ts` vivos | **(a)** |
| **G3** contenido del rail | 318 | ENTERO | Sí — `jobDetailView.js:1764` | **(a)** |
| **G4** DOCUMENTOS por tipo | 319 | ENTERO | Sí — `jobDetailView.js:1650` | **(a)** |
| **G5** qué falta para cobrar | 320 | ENTERO | Sí — `jobDetailView.js:177` y `:586` | **(a)** |

**Ni un `(b)`.** Ningún hijo de B, D o G dejó un motor de dominio sin superficie: los ocho
inalcanzables del árbol son de los bloques A y de RGPD-1, ya nombrados en la primera entrega. Lo que
hay en B es **de otra clase**: trabajo que **no se empezó**, declarado.

### Los tres huecos de B, con dónde están declarados

1. **La barra lateral no se ha construido** — `docs/master/SCRUM-284.md:416`: *«La sidebar
   (incremento 2) y la pestaña de Plantillas (incremento 3) no se tocan»*. Medido hoy en
   `public/dashboard/index.html:30-142`: la navegación sigue siendo `Principal · Catálogo · Finanzas ·
   Cuenta`, que es **literalmente el «lo que hay hoy» del diseño**. De los cuatro movimientos que
   pide B1 no hay ninguno: no existen los grupos `VENTA`/`NEGOCIO`, **no existe la entrada `Cobros`**,
   `Plantillas` sigue en `Catálogo` y `Descargar datos` sigue en `Finanzas`.
2. **B4 no separó nada, y lo dice** — `docs/master/SCRUM-285.md:9-11`: *«NO separa nada. La
   construcción de B4 … necesita B1 (la entrada de menú), que sigue parada»*. B4 entregó el censo de
   las 4 acciones-cobro **para que al separar no se pierda ninguna**. La separación no ha ocurrido.
   **B4 está bloqueado por el hueco 1.**
3. **El patrón de detalle no se aplicó a PRESUPUESTO** — `docs/diseno/bloque-b.md:134` lo lista con
   su tabla de estados, junto a FACTURA, ALBARÁN y TRABAJO. Medido: existen
   `invoiceActionsRegistry.js` (B2), `albaranActionsRegistry.js` (C2/SCRUM-302) y
   `jobActionsRegistry.js` (G1/SCRUM-316); **no existe ningún registro para presupuesto** y **ningún
   ticket lo nombra**. Éste es el único de los tres que **no está declarado en ninguna parte**: no es
   un hueco anotado, es uno que se ha caído de las listas.

### ⚠️ El `PARCIAL` de D0 es del detector, no de D0

SCRUM-388 marca `PARCIAL` porque encuentra la marca «no lo llama nadie» en el texto de la entrega.
Está en `docs/master/SCRUM-310.md:292`, y **habla de `borrarMerchant`**, que es de SCRUM-244 —el
informe está *citando* un motor sin superficie ajeno, no declarando el suyo—. D0 es un informe con
**cero construcción**: no puede dejar mecanismo sin conectar porque no dejó mecanismo.

Es el límite de una lista de marcas de texto, y es **el error barato**: se equivoca hacia «queda
trabajo», que es la dirección en la que este censo debe equivocarse. **No se propone tocar
`MARCAS_SIN_CONECTAR`**: distinguir «declaro mi parcialidad» de «cito la de otro» exige entender la
frase, y eso convierte un detector de hecho en un detector de tono — que es justo lo que SCRUM-388
decidió no ser.

## Dos cosas más que salieron al medir (se reportan, no se tocan — regla 9)

* **D1 (SCRUM-312) no tiene entrada en `docs/master/`.** Es el único hijo de los tres bloques sin
  ella; su veredicto `ENTERO` se sostiene en commits y rama. El fichero `docs/master/SCRUM-D1.md` que
  aparece en la historia **no era su entrada**: lo creó SCRUM-313 con el nombre equivocado (`cf91c70`)
  y lo movió a su propio fichero al día siguiente (`dae4014`).
* **`jobRailBlocks.js` aparece dos veces en `public/dashboard/index.html`** (`:218` en un comentario
  de SCRUM-319, `:224` el `<script>` real). Es una mención, no una carga duplicada — comprobado.

## Recomendación (mía; la decisión es del asesor)

* **G se puede cerrar.** Sus seis hijos entregaron y **los seis son alcanzables desde
  `jobDetailView.js`**, con la llamada anclada. Los huecos que quedan son **AB6 (matriz de
  dispositivos y capturas), que es humano**, y dos decisiones de producto declaradas en
  `SCRUM-320.md:146-151`. Nada de eso es código sin cablear.
* **D se puede cerrar** en cuanto a alcance: cinco hijos, cinco alcanzables, cero motores sin
  superficie. Lo que le falta es **registro**, no producto: la entrada de D1 en `docs/master/`.
* **B NO se puede cerrar.** Y el motivo no es de matiz: **la barra lateral —que es el título y la
  mitad de B1, y la pieza de la que cuelga B4— no está construida**, y con ella se caen tres de los
  cuatro movimientos del enunciado y la entrada `Cobros` entera. B2 y B3 sí están entregados y
  alcanzables; B1 está a medias y B4 no ha empezado.

**Y el aviso que da sentido al encargo:** los cuatro hijos de B salen **`ENTERO`** en SCRUM-388.
Cerrar B mirando solo esa columna habría dado por terminada una barra lateral que nadie ha tocado.
Es el punto ciego que el propio SCRUM-388 declara en su primera línea —*«un ticket al que se le
construyó la mitad EN SILENCIO, y se conectó esa mitad, sale ENTERO»*— ocurriendo de verdad, en tres
hijos a la vez. **Lo que lo destapó no fue ninguno de los dos mecanismos: fue contrastar lo entregado
contra `docs/diseno/bloque-b.md`.** Para D y para G ese contraste **no se pudo hacer**, porque su
diseño no está en el repo.

## Lo que NO cubre

* **Jira, entero.** Ver el hallazgo de arriba. Ni el estado de los tickets ni si hay hijos que el
  repo no nombra.
* **Que lo entregado cubra el enunciado, en D y en G.** Sin el diseño verbatim de esas dos epics en
  el repo, lo único con lo que contrastar es lo que declara cada entrega — y una entrega no es juez
  de su propio alcance. **Copiar las descripciones de SCRUM-279 y SCRUM-282 a `docs/diseno/` es el
  siguiente paso barato**, y es lo que hizo SCRUM-287 para A y B.
* **El alcance en `public/` no queda vigilado.** La medición de esta entrega es de una vez; el
  trinquete de SCRUM-411 sigue cubriendo solo `src/modules/*/domain/`.
* **Los 134 exports huérfanos de módulos vivos** siguen sin clasificar (eran 127 en la primera
  entrega). Tres de ellos son de D1 (`CAMPOS_CLIENTE`, `ETIQUETA_CAMPO`, `normalizarCabecera`) y uno
  de D3 (`PREFIJO_TELEFONO_DEMO`): son constantes, no funciones sin cablear, pero **no se ha
  verificado una por una**.

## Ficheros

Ninguno de producción. Solo esta entrada.

---

# SCRUM-411 · TERCERA ENTREGA (10-ago-2026) — el diseño de D y G entra al repo, y G se contrasta

**Fecha:** 10-ago-2026 · **Carril:** medición · **Gate:** informe, **cero producto** · **Toca código:** NO
**Medido contra:** `origin/main` = `db814df3d9b438ca969bdb0ec3c5e9587159bb7e` · 2026-08-10T14:55:00+01:00
**Tanda:** 2484 tests · 2410 pass · **0 fail** · 74 gateados · `npm test` exit **0**

> Cierra el hueco que dejó la segunda entrega: *«copiar las descripciones de SCRUM-279 y SCRUM-282 a
> `docs/diseno/` es el siguiente paso barato»*. Los textos los copió de Jira el asesor y los pasó a
> la sesión; **esta sesión no alcanza Jira** y no los reconstruyó — reconstruir un diseño desde lo
> construido garantiza que coincidan, que es el error entero que este trabajo evita.

## Lo que entra

`docs/diseno/bloque-d.md` (epic SCRUM-279) y `docs/diseno/bloque-g.md` (epic SCRUM-282), con la
cabecera que estableció SCRUM-287 y reutilizó SCRUM-300: `FUENTE` · `COPIADO EL` · `ORIGEN` ·
`QUÉ ES` (copia verbatim de la DESCRIPCIÓN, no los comentarios) · `⚠️ STALE`.

**Verbatim de verdad, incluido lo que está mal.** El recuadro de la maqueta de §4 **no cuadra**:
contados sus bordes, el superior lleva **56** guiones, el siguiente **55** y los dos últimos **54**,
y las columnas de la derecha no cierran a la misma altura. No se ha alineado. Alinearlo habría sido
editar, y entonces el fichero dejaría de poder usarse como referencia contra la que contrastar.

### El control de la copia, con su límite declarado

Cada cuerpo se transcribió **dos veces por separado** y se compararon byte a byte:

| | caracteres | líneas | `diff` |
|---|---|---|---|
| `bloque-d.md` (cuerpo, sin cabecera) | **1375** | 29 | ✅ idénticos |
| `bloque-g.md` (cuerpo, sin cabecera) | **9519** | 177 | ✅ idénticos |

🔴 **Y lo que este control NO prueba, porque las dos transcripciones son mías:** demuestra que las
dos pasadas coinciden —que es el fallo realista: una línea caída, un recuadro estropeado— **pero no
que ninguna de las dos coincida con Jira**. Eso solo lo puede verificar quien tiene Jira delante.
Se dice en vez de dejar que un ✅ parezca más de lo que es.

**El control se cazó a sí mismo antes de dar resultado.** La primera extracción del cuerpo usaba
`awk '/^──+ -->$/'` sobre la línea de guiones de caja de la cabecera; el patrón no casó, el cuerpo
salió **vacío**, y el `diff` cantó «DIVERGEN» sobre un fichero que estaba perfecto. Es «no supe
mirar» disfrazado de hallazgo, en el sitio donde más caro sale. Se cambió a buscar la línea del
`-->` por número, y se le puso suelo: **se imprime la primera línea del cuerpo extraído**, para que
un cero no pueda volver a leerse como un resultado.

## 🔴 Copiar el diseño de D demuestra que D NO TIENE DISEÑO

El documento de D **termina literalmente en `**Sin diseñar.**`**. Son cuatro viñetas de contenido
(D1–D4), una dependencia (A4), un argumento de orden frente al Bloque E y una declaración de estado.
Es una página de **justificación**, no un diseño: no hay maqueta, ni estados, ni acciones, ni
microcopy, ni criterio de aceptación.

**Copiarlo no lo diseña — deja constancia de que no lo está**, y eso convierte una suposición de la
segunda entrega en un hecho del repositorio. **Contra esto no se puede contrastar nada**, y no por
falta de instrumento: no se contrasta contra lo que nunca se escribió.

## G, contrastado promesa por promesa

Ahora sí se puede hacer lo que con B: leer lo que el diseño promete y medir si existe y si un
profesional lo alcanza.

| promesa del diseño | ¿existe? | ¿alcanzable? |
|---|---|---|
| **G1** · patrón B2 (1 primaria + 2 secundarias + ⋮) | sí, `jobActionsRegistry.js` | sí — `jobDetailView.js:481` |
| **G1** · la primaria sale del **cruce de los dos ejes** | **no como tal** — ver abajo | — |
| **G2** · el Trabajo se llama por su nombre | sí | sí — `jobDetailView.js:750` `PATCH {titulo}` |
| **G2** · el presupuesto pasa al rail como origen | sí — `DESTINO_POR_TIPO.presupuesto = 'rail-presupuesto'` | sí |
| **G3** · DATOS pasa al rail | sí — bloque `CLIENTE` | sí |
| **G3** · 🏆 **enlace a mapa** | el código sí | **NO — no se pinta nunca** |
| **G4** · DOCUMENTOS por tipo | sí, y con una sección **de más** | sí |
| **G4** · justificantes al bloque DINERO | sí — `DESTINO_POR_TIPO.justificante = 'rail-dinero'` | sí |
| **G5** · las cuatro filas que no dependen de nada | sí — `HUECOS_COBRO` (4) | sí — `:177`, `:586` |
| **G5** · la línea «quedan N» | el motor sí, la línea **no** | **NO — nadie llama al motor** |

### ① El enlace a mapa está construido y no lo ve nadie → **SCRUM-424**

`jobRailBlocks.js:87` compone bien el `href` (`google.com/maps/search/?api=1&query=…`) y con el mismo
dato que se pinta. Pero `bloqueDonde` sale por `if (!direccion) return null` (`:77`) **siempre**,
porque **`Job.direccion` no lo escribe nadie**: `job.service.ts:101` lo deja a `null` al crear y el
`PATCH /admin/jobs/:id` no lo acepta (solo abrió `titulo`, `jobs.routes.ts:597`). El propio módulo lo
declara en su comentario. Segundo hueco encima: el rótulo del enlace sigue siendo el marcador
`[PENDIENTE microcopy oficial]` (`:32`) porque «abrir en mapa» no está aprobado.

**Es el 🏆 del bloque —«que no lo tiene nadie y es de lo más usado desde una furgoneta»— y no existe
para ningún profesional.** No se cablea aquí: se anota, como se anotó la barra lateral.

### ② «Quedan N»: C6 construyó el motor, cerró, y no lo llamó nadie → **SCRUM-423**

`src/modules/jobs/domain/entregaPendiente.ts` (`resumenEntrega`, `COPY_ENTREGA`, `fraseDeCuenta`)
está **importado únicamente por `tests/scrum305-entrega-pendiente.test.mjs`**. Es uno de los 8
inalcanzables del trinquete. **SCRUM-305 (C6) está Finalizada.**

Es un `(b)` de manual, y con una diferencia que lo hace peor que los de la primera entrega: aquí el
diseño **ya había declarado el hueco** —*«HUECO DECLARADO y entra con C6»*— así que el hueco tenía
dueño, fecha y ticket. **C6 lo cerró sin cablear, y el hueco declarado dejó de estar en ninguna
lista.** Un hueco declarado que se cierra en falso es invisible dos veces.

La regla del diseño («sin línea vacía ni pendiente de calcular: o está el dato, o no está la línea»)
**se cumple**: la línea no se pinta. Lo que no llegó es el dato.

### ③ La primaria NO sale del cruce de ejes — divergencia, no hueco

El diseño da una tabla de cinco filas (`Sin agendar → Agendar` · `Agendado → Empezar` ·
`En curso → Marcar terminado` · `Terminado + pendiente/parcial → Cobrar` · `Terminado + pagado → —`).

Lo construido delega la primaria en la escalera preexistente: `JOB_ACTION_REGISTRY` la declara como
`{ id: 'cta', destino: 'primaria', fuente: 'jobNextAction' }`, y `jobNextAction.js` tiene **seis
niveles que responden a otra pregunta** —cuál es el siguiente paso *documental*— y **solo consulta el
eje TRABAJO en un sitio**: `job.status === 'terminado'` (`:39`). Medido: `pendiente_agendar`,
`agendado` y `en_curso` **no aparecen en todo el fichero**.

O sea: **de las cinco filas del cruce, la que está implementada es una** —la importante, `terminado +
saldo → Cobrar`— y las otras tres del eje TRABAJO no gobiernan la primaria. Las acciones existen
(`Marcar terminado` está en la cabecera, medido en G0), pero **no salen del cruce**.

**No lo llamo cierre en falso, y el motivo está escrito desde antes:** G0 (`SCRUM-309.md:238`) midió
que ninguna de las 37 acciones consulta `job.status` y concluyó que *«la tabla acciones-por-estado no
se puede escribir con lo que hay: si el diseño la quiere, es una decisión nueva»*. G1 lo respetó y
dejó la escalera *«igual que salió de SCRUM-366»*. **Es una promesa del diseño que el propio bloque
midió como no transcribible.** Va como divergencia declarada, no como defecto de G1 — y merece
decisión del asesor, no un ticket automático.

### ④ G4 entregó una sección MÁS que el diseño

El diseño parte DOCUMENTOS en tres (`QUÉ FALTA PARA COBRAR` · `ALBARANES` · `GASTOS`). Lo construido
tiene cuatro: `SECCIONES_CUERPO = ['que-falta-para-cobrar', 'albaranes', 'facturas', 'gastos']`. La
de más es **FACTURAS**, con la rectificativa anclada a su original, y está declarada en
`docs/master/SCRUM-319.md`. **Es un superávit declarado, no un hueco** — se anota porque un
contraste que solo mira lo que falta no es un contraste.

### ⑤ La maqueta de §4: nueve huecos, **ocho se pintan y uno no es el que pedía el diseño**

Cuerpo 4 (`que-falta-para-cobrar`, `albaranes`, `facturas`, `gastos`) + rail 5 (`cliente`, `donde`,
`dinero`, `presupuesto`, `responsable`) = **9 huecos**. Pero la cuenta redonda esconde dos cosas:

* **`donde` no se pinta nunca** (①) → ocho de nueve.
* **El cuarto bloque del cuerpo no coincide.** El diseño pide `NOTAS INTERNAS`; lo construido pone
  `FACTURAS`. Y medido: **las notas internas del Trabajo no están en el detalle** — el único sitio
  donde se editan es la tarjeta del **listado** (`jobsView.js:325`, *«Notas internas del trabajo…»*),
  y no aparecen ni en `jobDetailView.js` ni en el rail. Así que no es que se hayan movido: **en la
  pantalla que el diseño describe, no están**. Es un hueco de G4 que ninguna entrega declara.

**Y aquí está el valor de haber traído el diseño:** con la cuenta de nueve, G4 salía cuadrado. Es la
misma forma de error que dio B por acabado — un número que coincide sobre una composición que no.

## 🔴 Corrección al registro de la PRIMERA entrega — no se borra la línea

La tabla «(a) A medio construir con ticket abierto» de la primera entrega atribuye
`jobs/domain/entregaPendiente.ts` a **«SCRUM-367 / entregas»**. **Es incorrecto:** la cabecera del
fichero dice `// src/modules/jobs/domain/entregaPendiente.ts — SCRUM-305 (C6)`.

La línea original **se conserva** (regla 16) y esta es su corrección, con el motivo: la primera
entrega atribuyó por *parecido temático* —367 y 305 tocan los dos el eje de entrega— y eso es
exactamente el error de atribución que SCRUM-388 existe para impedir, cometido dentro del informe que
lo cita. Y no es cosmético: mal atribuido, el módulo se leía como **(a) a medio construir con ticket
abierto**; bien atribuido es **(b) cierre en falso con el ticket Finalizado**, que es otra casilla y
otra decisión. → **SCRUM-423**.

## Los dos veredictos

**G · NO ACABADO.** Falta, en orden de daño: **(i)** un camino para escribir `Job.direccion`, sin el
cual el 🏆 del bloque no existe para nadie (**SCRUM-424**); **(ii)** cablear `entregaPendiente` para
que aparezca la línea «quedan N» (**SCRUM-423**); **(iii)** `NOTAS INTERNAS` en el detalle, que el
diseño coloca en la maqueta y hoy solo existe en el listado (⑤, **sin ticket**); **(iv)** el
microcopy aprobado del enlace a mapa. Y una divergencia que no es hueco sino decisión: la primaria no
sale del cruce de ejes (③). Lo demás del diseño está entregado y es alcanzable.

**D · NO SE PUEDE SABER contra su diseño, y ya no por falta de documento: porque el documento dice
que no hay diseño.** Lo único que se puede afirmar de D sigue siendo lo de la segunda entrega —sus
cuatro hijos que construyen (D1–D4) entregaron y son alcanzables; D0 es informe—, y eso **no es un
veredicto sobre el bloque**: es un veredicto sobre sus hijos. Para pasar de uno a otro hace falta
que alguien escriba el diseño de D, o que se acepte que D es *«las cuatro tareas que había»* y se
cierre por esa vía, que es una decisión del asesor y no una medición.

**Y el hueco de D es de registro, no de producto:** `docs/master/SCRUM-312.md` **sigue sin existir**
—verificado contra el `main` de hoy, no heredado de la entrega anterior—. D1 es el único hijo de los
tres bloques sin entrada de registro.

## Hallazgo fuera de carril, reportado (regla 9)

La tanda no arrancaba: `_prisma-client-guard.mjs` (SCRUM-252) cortó con *«el campo
`Quote.esAdicional` está en `schema.prisma` y NO en el cliente generado»*. **El guard tenía razón y
funcionó como debe** — no dejó correr 2.484 tests contra un cliente de otro schema.

Medido antes de tocar nada, comparando `sha256` de `prisma/schema.prisma` en los cuatro worktrees:
tres coinciden con el `main` de hoy (`b2064c94…`) y el cuarto —`cobroflash-backend`, en
`scrum-205-dev-y-registro-migraciones`— tiene otro (`316b2713…`). El cliente compartido por junction
venía de ése. Se regeneró **desde este worktree** (`npx prisma generate`, el arreglo que el propio
guard indica), que deja el cliente en el schema que comparten tres de los cuatro.

**No se ha tocado `prisma/schema.prisma`, ni ningún `.env`, ni la base.** Se anota porque afecta a
`node_modules` compartido: si la sesión de `cobroflash-backend` necesita su cliente, tendrá que
regenerarlo desde el suyo — y ése es el efecto que hay que saber, no descubrir.

## Lo que NO cubre

* **Que las copias coincidan con Jira.** Ver el límite del control. Y llevan `⚠️ STALE`: son fotos.
* **El contraste de D**, por el motivo de arriba.
* **Nada de `public/` queda vigilado.** Este contraste es de una vez, como el de la segunda entrega.
  El trinquete de SCRUM-411 sigue cubriendo solo `src/modules/*/domain/`.
* **No se ha abierto, cerrado ni tocado ningún ticket de Jira**, ni SCRUM-423 ni SCRUM-424, que ya
  existen y son del asesor.

## Ficheros

* `docs/diseno/bloque-d.md` (nuevo) — copia verbatim de la epic SCRUM-279.
* `docs/diseno/bloque-g.md` (nuevo) — copia verbatim de la epic SCRUM-282.
* `docs/master/SCRUM-411.md` — esta entrada.
