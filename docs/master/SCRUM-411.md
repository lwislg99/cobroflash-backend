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

---

# APÉNDICE · SCRUM-411 (2ª entrega) — LA SEGUNDA POBLACIÓN: los exports huérfanos dentro de módulos vivos

**Medido contra:** `origin/main` = `72294230f9c1fecd9ac0316f2d131eb9b76e76f6` · 2026-08-12T09:38:36+01:00
(primera medición: `1117b313…` a las 09:30 → **190**. Al mezclar `main` subió a **192**, y por qué
subió está contado abajo — es la mejor prueba que tiene esta entrega.)
**Fecha:** 12-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Cero cables, cero borrados, cero schema, cero emisión.** Esto cuenta, clasifica y VIGILA.

## Qué faltaba, exactamente

La primera entrega vigila **módulos enteros** que nadie alcanza: 8, con tope. Pero un módulo está
vivo en cuanto **uno solo** de sus exports tiene llamador, así que dentro de un módulo vivo caben
funciones que no llama nadie. Ésa es **la otra población: 190 exports en 66 módulos vivos** (192 al cierre de esta entrada), y no la
vigilaba nadie.

SCRUM-484 (mergeado en `917bf2c7`) la **midió** y nombró seis. Lo que entregó fue un censo fechado —
un documento— y lo dice él mismo: *«No he clasificado los 189»*. Lo que faltaba no era el número:
era **el método**. Esto es el método.

> 🔴 **La víctima que motivó el encargo — y su premisa, MEDIDA:**
> `system/domain/borradoMerchant.ts → borrarMerchant` no lo llama nadie, y su ticket RGPD
> (SCRUM-244) está CERRADO. Eso es cierto y sigue siéndolo. **Lo que NO es cierto es la consecuencia
> que el encargo le atribuía** («un profesional no puede pedir que le borren la cuenta»): la
> supresión real la hace **otra** función, `suprimirMerchant`
> (`supresionMerchant.service.ts:34`), que **sí tiene ruta montada** —
> `supresion.routes.ts:56`. Lo midió SCRUM-485 y **se ha comprobado aquí con el instrumento propio
> antes de reclasificarlo**: no es una promesa rota, es la función vieja superada y sin retirar.
>
> **El encargo sigue en pie igual, y por un motivo mejor:** que la premisa concreta se cayera no
> cambia que el defecto existía —un export con cero llamadores estuvo meses siendo indistinguible de
> una función entregada— y que **no lo encontró ningún instrumento, sino un censo lanzado a mano
> buscando otra cosa.** Es exactamente lo que este trinquete viene a impedir. (SCRUM-485 es de otro
> equipo: aquí se cuenta, no se arregla.)

## 🔴 Por qué NO es un tope numérico, que era el ticket entero

Un trinquete que diga «no más de 192» no sirve. En una base viva **se escribe un export antes que su
consumidor constantemente**, así que un tope sólo tiene dos finales: o bloquea trabajo legítimo, o se
sube sin mirar hasta que deja de significar nada. Las dos acaban en un guard que nadie atiende.

Lo que se vigila aquí **no es el número**: es que **nadie entre en esta población en silencio**. Un
huérfano nuevo tiene que **declararse**, con su fecha y su motivo — exactamente el contrato que la
primera población ya tiene escrito (*«se sube con su fecha y su motivo en vez de cablearlo a la
fuerza»*). Ese contrato se **respeta y se extiende**; no se cambia. El tope de 8 y
`_alcance-dominio.mjs` quedan **intactos**: se añade una población, no se cambia la que hay.

Y cae **en los dos sentidos**. Que el recuento BAJE es sospecha, no mejora: o alguien lo cableó —y
entonces la constancia va en el mismo commit— o el detector se quedó ciego, y desde fuera las dos se
ven igual.

## Los tres instrumentos, POR SEPARADO — porque uno solo miente

| instrumento | qué vio | en qué se equivocó |
|---|---|---|
| **① AST / grafo de alcance** (`_alcance-dominio.mjs`, reutilizado) | **190** huérfanos en **66** módulos vivos (192 tras mezclar `main`) | No ve el import dinámico por nombre (`sendQuoteEmail`, ya medido por SCRUM-484) ni `public/`, que es vanilla y no entra en el grafo |
| **② TEXTUAL**, 1.258 ficheros, incluido `public/` | 12 menciones en `public/`, 21 «cero menciones», 121 «sólo tests» | **Sobre-marca con palabras genéricas**: `PENDIENTE`, `FALTA`, `AVISOS`, `avanzar` son ruido de prosa castellana. De sus 12 hits en `public/`, **2 son reales**. Y daba por muertos a `ensureReferralCode` y `funnelForPeriod`, que se llaman dentro de su propio módulo |
| **③ GRAFO INTERNO del fichero** (nuevo) | **35 de 190** no los alcanza ningún export vivo de su módulo (34 tras el merge: uno se cableó) | Un uso en **posición de tipo** no cuenta como ejecución (por eso `JOB_STATES` sale en los 35 sin ser un fallo). Es correcto para esta pregunta, pero hay que saberlo |

**Lo que sacó cada uno que los otros no podían:**

* El ② encontró los **2 hallazgos que el AST no puede ver**: `partirMetodo` y `JOB_DIRECCION_MAX`
  están **copiados a propósito** en el frontend vanilla, que no puede importar de `src/`. El propio
  `public/dashboard/js/cobrosView.js:117` lo declara: *«ESTO ES UNA SEGUNDA COPIA DELIBERADA DE
  `partirMetodo`, Y CONSTA COMO TAL»*. No están muertos: viven dos veces.
* El ③ **corrigió al ②**, que había dado por muertos dos que se llaman dentro de su propio módulo, y
  es el que hace posible la clasificación: separa «el `export` sobra» de «esto no lo corre nadie».

## 🔴 La autoprueba: el detector se prueba antes de que nadie se crea su número

Un censo medido sólo contra el repo real no distingue «no hay huérfanos nuevos» de «me he quedado
ciego»: las dos salen como una lista que no crece. Así que antes de creerse ningún número, el detector se
mide contra un árbol **sintético escrito en disco** con la respuesta conocida:

```
index.ts → app.ts → x.routes.ts → domain/motor.ts → domain/ayuda.ts
```

* `motorVivo` lo importa la ruta → **no debe salir**
* `ayudaIndirecta` lo importa `motor.ts`, que a su vez es alcanzable → 🔴 **llamada INDIRECTA a
  través de otro módulo: no debe salir.** Ahí es donde se equivoca un detector ingenuo
* `motorHuerfano` no lo importa nadie → **sí sale, con su línea**
* `SEMILLA` no lo importa nadie pero `motorVivo` lo usa dentro del fichero → sale con
  `loEjecutaAlguien: true`, que es la señal que hace posible clasificar

Sólo vale si acierta **exacto**. Y el **suelo**: si el censo devuelve cero o cae por debajo de 100,
**falla declarándose ciego** — sabemos que hay 192.

## Los rojos, probados sobre el árbol real (no prometidos)

1. **Huérfano nuevo sin declarar.** Se plantó `pruebaDeRojoScrum411` en `system/domain/soporte.ts` y
   el guard cayó nombrándolo: `src/modules/system/domain/soporte.ts:108  pruebaDeRojoScrum411`.
   Retirado en el acto; `git status` de `src/` limpio.
2. **El sentido inverso.** Se declaró un huérfano que no existe y cayó el trinquete al revés, con sus
   dos causas escritas en el rojo (① lo has cableado → borra la línea; ② el detector se quedó ciego).
3. 🔴 **Y el rojo me corrigió a mí:** con el huérfano real plantado, «EL TEST QUE DECIDE» fallaba
   diciendo *«el trinquete NO caza nada»* justo cuando acababa de cazar dos, porque exigía
   `length === 1`. Un rojo que miente sobre su causa manda a quien lo lee a arreglar el guard en vez
   del código. Corregido a «el plantado está ENTRE los cazados», con el motivo escrito en el test.

## 🔴 Y entonces entró un merge de `main`, y el guard lo cazó en el acto

Esto no es un ejemplo inventado: pasó **mientras se escribía esta entrada**. Medido a las 09:30
contra `1117b313` había **190**. Al traer `main` (`72294230`, que incorpora SCRUM-474 fase 2 y
SCRUM-485), el trinquete cayó **nombrando dos exports huérfanos nuevos con su fichero y su línea**:

```
   src/modules/billing/domain/cobros.service.ts:72  camposDeMetodo
   src/modules/billing/domain/metodoDeCobro.ts:79   CUBO_SIN_METODO
```

Entraron en verde, como entra todo lo de esta población. **Ninguno es un fallo** —los dos declaran su
razón en su propia cabecera— y **ninguno se ha cableado ni borrado**: se han DECLARADO, que es
exactamente el camino que este mecanismo pide y la razón de que no sea un tope numérico. Un tope
habría dicho «191, 192» y nadie habría mirado cuáles.

`camposDeMetodo` obligó además a una **categoría nueva**, `EXPORTADO_PARA_LAS_FIXTURES`: su cabecera
dice literalmente *«SE EXPORTA PARA QUE LAS FIXTURES DERIVEN DE ELLA»*, porque una fixture escrita a
mano se quedó atrás y el test acusó al filtro de un fallo que no era suyo. Eso no es «exportado de
más»; es exportado a propósito, y pedirle lo mismo a las dos cosas sería gastar el rojo.

### Y una BAJA, que es la que de verdad importa

En la misma medición, **`metodoParaAgrupar` dejó de estar sin ejecutar**. SCRUM-484 lo nombró el día
antes entre los seis que un profesional nota — *«agrupar sus cobros por método fiable: la validación
existe y no se aplica»*— y ese mismo día SCRUM-474 fase 2 entró en `main` con `cuboDeCobro`, que sí
lo llama. Su declaración **baja de `MOTOR_EN_ESPERA` a `PIEZA_INTERNA_EXPORTADA` con la fecha y el
motivo escritos**, en vez de desaparecer sin más: así el registro queda como la constancia de que la
deuda duró exactamente lo que duró. Es lo mismo que hace el tope de la primera población cuando baja,
y por eso el contrato se extendía en vez de reinventarse.

## La clasificación de los 192

### 🔴 Antes de la tabla: una premisa que se cayó midiendo, y era la mía

`borrarMerchant` y su constante entraron aquí como `PROMESA_SIN_CABLE` **repitiendo el encargo**.
Midiendo, no lo son: pasan a `SUPLANTADO_POR_UNA_COPIA` por lo que está escrito arriba. Con eso,
**`PROMESA_SIN_CABLE` se queda HOY EN CERO** — y eso es una noticia, no un hueco:

* La categoría **se queda definida a propósito**. Es donde tiene que aterrizar el siguiente «el
  producto lo ofrece y no ocurre», y sin ella volvería a repartirse entre las blandas. Hay un test
  que impide borrarla por estar vacía.
* Y no significa «no hay nada que mirar». Significa que **de los 192, ninguno resultó ser una
  capacidad que el producto ofrezca y nadie sirva** — porque los dos que lo parecían los sirve otra
  función. Lo que sí queda es `SIN_LECTOR_NI_TEST` con un miembro, abajo.

| categoría | qué significa | cuántos |
|---|---|---|
| `PROMESA_SIN_CABLE` | el producto lo ofrece y no ocurre | **0** |
| `SIN_LECTOR_NI_TEST` | nadie lo nombra en ningún sitio del repo | **1** |
| `SUPLANTADO_POR_UNA_COPIA` | lo hace otro, copiado | **4** |
| `MOTOR_EN_ESPERA` | construido a propósito antes que su consumidor | **18** |
| `REGLA_COPIADA_AL_FRONT` | duplicada en public/ porque el front no puede importar | **2** |
| `FALSO_POSITIVO_MEDIDO` | tiene llamador que el instrumento no ve | **1** |
| `EXPORTADO_PARA_LAS_FIXTURES` | exportado a propósito para que las fixtures deriven de él | **1** |
| `VOCABULARIO_DEL_MODULO` | la única fuente de un término | **94** |
| `PIEZA_INTERNA_EXPORTADA` | vivo dentro, exportado de más | **71** |

**Total: 192** en 66 módulos vivos.

### `PROMESA_SIN_CABLE` — 0


### `SIN_LECTOR_NI_TEST` — 1

* `maintenance/domain/maintenance.service.ts:490` → **`maintenanceEurInMonth`** — 🔴 Ni código vivo, ni test, ni documento lo mencionan en todo el repo. Es el único del censo del que no consta ni para qué se escribió.

### `SUPLANTADO_POR_UNA_COPIA` — 4

* `quoteRequests/domain/attachment.service.ts:40` → **`listQuoteRequestAttachments`** — La galería de adjuntos se sirve, pero con un `prisma.attachment.findMany` inline en `quoteRequests.routes.ts:25` en vez de con esta función. Misma consulta, dos sitios.
* `system/domain/borradoMerchant.ts:129` → **`borrarMerchant`** — 🔴 LA PREMISA ERA FALSA Y SE CORRIGE AQUÍ. Se declaró como PROMESA_SIN_CABLE, y midiendo NO lo es: `borrarMerchant` sigue con cero llamadores, pero la supresión real la hace `suprimirMerchant` (`supresionMerchant.service.ts:34`), que SÍ tiene ruta montada — comprobado en `supresion.routes.ts:56`. Lo midió SCRUM-485 y lo he verificado con mi propio instrumento antes de reclasificarlo. El profesional PUEDE, así que no es una promesa rota: es la función vieja, superada y sin retirar.
* `system/domain/borradoMerchant.ts:83` → **`FUERA_DEL_BARRIDO_GENERICO`** — La lista de lo que el barrido genérico NO debe tocar, escrita para `borrarMerchant`. Sigue a su función: si aquélla está superada por `suprimirMerchant`, ésta también. Cae con ella cuando SCRUM-485 decida (aquí se cuenta, no se retira).
* `team/domain/team.service.ts:4` → **`listTeamMembers`** — El profesional SÍ ve su equipo: lo sirven `teamOverview.service.ts:58` y consultas inline en rutas (`jobs.routes.ts:133`, `reports.routes.ts:99`). No es una promesa rota, es la misma consulta escrita en varios sitios, con varios sitios donde divergir.

### `MOTOR_EN_ESPERA` — 18

* `billing/domain/cobros.service.ts:129` → **`diasDeDeuda`** — Los días de deuda; ni código vivo ni test lo leen, solo consta en documentos.
* `billing/domain/cobros.service.ts:124` → **`esDeuda`** — El predicado de deuda, construido y sin llamador vivo.
* `billing/domain/paidVia.ts:49` → **`esPaidViaValido`** — La validación del método de cobro existe y no se aplica en ningún camino vivo (SCRUM-484).
* `expenses/domain/justificante.ts:196` → **`avisaDeSimplificado`** — E3: el aviso de que con un ticket NO se puede deducir el IVA. El veredicto está construido y ninguna pantalla lo enseña (SCRUM-484).
* `exports/domain/portabilidadRegistro.ts:79` → **`diasTranscurridos`** — Ídem: la cuenta de días del plazo, sin consumidor vivo.
* `exports/domain/portabilidadRegistro.ts:72` → **`fechaLimite`** — El plazo legal de la portabilidad, en la misma espera que `solicitudesPendientes`.
* `exports/domain/portabilidadRegistro.ts:163` → **`solicitudesPendientes`** — Ver si una solicitud de portabilidad se atendió dentro de plazo. Construido, sin pantalla (SCRUM-484).
* `invoicing/domain/selladoEstado.ts:82` → **`estadoAlNacer`** — Decide el estado de sellado al nacer un documento. Su constante `SELLADO_NO_APLICA` SÍ la usa código vivo; la función no la llama nadie. Cablearla es tocar el sellado → STOP (regla 38).
* `jobs/domain/albaran.service.ts:571` → **`recomputarHashDeEvidencia`** — La otra mitad de la verificación de evidencia, en la misma espera y con el mismo STOP.
* `jobs/domain/albaran.service.ts:605` → **`verificarEvidenciaAlbaran`** — Comprobar que la evidencia de una firma no se ha alterado. Construido y sin cable (SCRUM-484). Cablearlo toca el camino de sellado → GO explícito (regla 38).
* `jobs/domain/albaranAFactura.ts:270` → **`baseDeFacturables`** — La base de líneas facturables de un albarán; ningún export vivo del módulo la alcanza.
* `jobs/domain/albaranesListado.ts:126` → **`filtrarAlbaranes`** — C1 (SCRUM-301): el filtro por los dos ejes del listado global de albaranes. Su hermano `listarAlbaranesDelMerchant` sí está cableado; el filtro no lo aplica nadie todavía.
* `jobs/domain/albaranNumber.service.ts:16` → **`isAlbaranNumber`** — El reconocedor de números de albarán; su serie está construida y sin cable (SCRUM-484 lo cuenta entre los 8 por el módulo hermano `albaranSerie.ts`).
* `jobs/domain/precarga.service.ts:193` → **`esDelTecnico`** — H1 fase 2 (SCRUM-458/460): el paquete de precarga está cableado por `GET /admin/precarga`, pero esta condición concreta no la alcanza ese camino.
* `messaging/domain/constanciaCorreo.ts:114` → **`avanzar`** — SCRUM-475/478: saber si el correo llegó. La tabla `email_messages` está parada A PROPÓSITO (su SQL se aplicó a DEV el 12-ago-2026); el consumidor es la fase siguiente.
* `messaging/domain/constanciaCorreo.ts:36` → **`ESTADOS_CORREO`** — El vocabulario de estados de `avanzar`, en la misma espera (SCRUM-475/478).
* `quotes/domain/billingPlan.ts:99` → **`getNextBillingStage`** — El siguiente tramo del plan de cobro: construido, sin llamador vivo.
* `quotes/domain/billingPlan.ts:139` → **`getStageAmount`** — El importe de un tramo del plan de cobro: construido, y ningún export vivo del módulo lo alcanza.

### `REGLA_COPIADA_AL_FRONT` — 2

* `billing/domain/metodoDeCobro.ts:37` → **`partirMetodo`** — La regla vive DOS veces a propósito: `public/dashboard/js/cobrosView.js:117` lo declara («ESTO ES UNA SEGUNDA COPIA DELIBERADA DE `partirMetodo`, Y CONSTA COMO TAL»). El backend no la importa porque el navegador no puede importarla.
* `jobs/domain/jobDireccion.ts:32` → **`JOB_DIRECCION_MAX`** — El tope está duplicado como literal `300` en `public/dashboard/js/jobDetailView.js:803`, que lo dice en un comentario. La constante del backend es la fuente; el front la copia porque es vanilla y no puede importarla.

### `FALSO_POSITIVO_MEDIDO` — 1

* `messaging/domain/email.service.ts:109` → **`sendQuoteEmail`** — 🔴 NO es huérfano: lo llama `quotesAdmin.routes.ts` por import DINÁMICO, y `nombresImportados` solo lee imports estáticos, así que no ata el nombre. Medido y nombrado por SCRUM-484. Se declara aquí para que el trinquete no lo cuente como hallazgo — arreglar el instrumento es el ticket de 411, no éste.

### `EXPORTADO_PARA_LAS_FIXTURES` — 1

* `billing/domain/cobros.service.ts:72` → **`camposDeMetodo`** — Lo declara su propia cabecera: «SE EXPORTA PARA QUE LAS FIXTURES DERIVEN DE ELLA», porque la fixture de SCRUM-474 escrita a mano se quedó atrás en cuanto el serializador estrenó `metodoCubo` y el test acusó al filtro de un fallo que no era suyo. Entró en `main` el 12-ago-2026 y la cazó este trinquete en su primer merge.

### Las dos categorías de volumen (165 de 192), sin listar una a una

* **`VOCABULARIO_DEL_MODULO` (94)** — constantes, copy y errores exportados para ser la **única
  fuente** de un término. Su lector de hoy es su propio módulo y su test. No es deuda: es cómo se
  evita que el término se escriba a mano en cinco sitios.
* **`PIEZA_INTERNA_EXPORTADA` (71)** — código que **sí ejecuta** su propio módulo; el `export` es
  superficie que nadie de fuera consume, normalmente para que su test pueda fijar la regla sin pasar
  por la ruta entera.

Los 192 están declarados **uno a uno** en `tests/_huerfanos-declarados.mjs`, con categoría, fecha y
motivo. La lista completa es ese fichero; aquí se resume.

## Lo que cambió respecto a las categorías propuestas

El encargo proponía tres (deliberados documentados · infraestructura para tests · promesa
incumplida). **Midiendo salieron nueve**, y dos de las nuevas son las que ganan información:

* 🟠 **`SUPLANTADO_POR_UNA_COPIA`** — la que faltaba, y la que acabó absorbiendo a `borrarMerchant`. `listTeamMembers` y
  `listQuoteRequestAttachments` no tienen llamador **porque la misma consulta se rehízo inline en
  otro sitio** (`teamOverview.service.ts:58`, `jobs.routes.ts:133`, `reports.routes.ts:99`;
  `quoteRequests.routes.ts:25`). **No son promesas rotas** —el profesional sí ve su equipo y sus
  fotos— pero tampoco son higiene: es la misma regla en dos sitios, con dos sitios donde divergir.
  Meterlas en el saco de `borrarMerchant` habría sido acusar de más y habría gastado el rojo.
* 🟡 **`REGLA_COPIADA_AL_FRONT`** — el frontend es vanilla y no puede importar de `src/`, así que la
  regla vive dos veces **a propósito y declarado**. Sin esta categoría, `partirMetodo` parecía muerto.

Y una que preferiría no haber necesitado: 🔴 **`SIN_LECTOR_NI_TEST`**, con un solo miembro —
`maintenance.service.ts:490 → maintenanceEurInMonth`. Es el único del censo del que **no consta ni
para qué se escribió**: ni código vivo, ni test, ni documento lo nombran en todo el repo.

## Lo que NO cubre, declarado

* **`import * as x` sigue dando el módulo por vivo entero** (límite heredado de
  `_alcance-dominio.mjs`, que él declara). **El 192 es un suelo, no un techo.**
* **El import dinámico por nombre** sigue sin atarse: 1 falso positivo medido y **declarado**
  (`sendQuoteEmail`). Arreglar el instrumento es el ticket de 411, no éste — no se toca un guard
  ajeno (regla 9).
* **`public/` no entra en el grafo.** Se barrió con el instrumento textual, que sobre-marca; los 2
  hallazgos reales están confirmados a mano, pero **no se ha medido export por export**.
* **La clasificación de los 157 que sí ejecuta código vivo es por SEÑAL, no por lectura.** Los **34**
  que hoy no alcanza ningún export vivo sí están leídos y clasificados **uno a uno**.
* **No se ha cableado ni retirado nada.** Ni un export. Tres de los deliberados esperan un diff de
  esquema y borrarlos sería tirar trabajo pagado.
* **`borrarMerchant` no se arregla aquí**: es SCRUM-485, de otro equipo. Se cuenta y se nombra.
* **Nada de `public/dashboard/js/` se ha tocado** (zona ajena, dos sesiones dentro).

## Tests

* `tests/scrum411-exports-inalcanzables.test.mjs` — el trinquete de las **dos** poblaciones (17 tests:
  los 8 de la primera, INTACTOS, + los 9 de ésta).
* `tests/_huerfanos-en-modulos-vivos.mjs` — el instrumento y su autoprueba sobre fuente sintética.
* `tests/_huerfanos-declarados.mjs` — el registro: los 192, con categoría, fecha y motivo.

## Ficheros

* `tests/_huerfanos-en-modulos-vivos.mjs` (nuevo) — el censo de la segunda población + autoprueba.
* `tests/_huerfanos-declarados.mjs` (nuevo) — las declaraciones, que son el guard.
* `tests/scrum411-exports-inalcanzables.test.mjs` — se le AÑADE la segunda población; el tope de 8 y
  todo lo anterior quedan sin tocar.
* `docs/master/SCRUM-411.md` — este apéndice.

---

# APÉNDICE · SCRUM-411 (fase 2b) — ¿llega desde una entrada viva? Y una etiqueta mía que estaba mal

**Medido contra:** `origin/main` = `3cbf6794199525956d9b4a7893a4596136f8b189` · 2026-08-12T10:21:07+01:00
**Fecha:** 12-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Cero cables, cero borrados, cero schema.** Esto contesta una pregunta y corrige una clasificación.

**Paso 0:** cuatro worktrees. La rama del otro equipo que mide lo mismo es
`scrum-485-borrar-cuenta`, último commit `e4a8f0b7` (Luis, 2026-08-12 09:26:50 +0100). `main` al
ramificar `db820c35`, al cerrar `3cbf6794`.

---

## 1 · 🔴 LA PREGUNTA: `ensureReferralCode` SÍ es alcanzable

`ensureReferralCode` no lo importa nadie, pero lo llama por dentro `getReferralStats`. La pregunta
era si **ese llamador** está vivo: si estuviera muerto, la cadena entera lo estaría y **el defecto
existiría** — un merchant antiguo no obtendría nunca su código de referido.

**No es el caso.** La cadena, medida y nombrada entera para que se pueda contrastar:

```
src/app.ts                                   ← entrada viva
  └─ app.get('/admin/referral', …)           ← ruta MONTADA (app.ts:498)
       └─ getReferralStats                   ← único importador: src/app.ts (app.ts:104)
            └─ ensureReferralCode            ← llamada interna (referral.service.ts:42)
```

El código de referido se genera con **backfill perezoso** la primera vez que el profesional abre
Configuración → Referidos. **No hay ticket que abrir.**

### «Entrada viva», definido ANTES de contestar

| | Entrada | Por qué |
|---|---|---|
| ① | `src/index.ts` | el arranque del proceso, y donde se registran los crons |
| ② | `src/app.ts` | donde se montan las rutas |
| ③ | los `scripts/*.mjs` que **`package.json` declara** | derivados del `package.json`, no listados a mano: un script que nadie invoca sigue muerto |

**`tests/` NO es una entrada viva.** Y es **la misma definición** que ya usaba la primera población
(`ENTRADAS` + `entradasDeComando` de `_alcance-dominio.mjs`), reutilizada a propósito: si dos
mediciones partieran de entradas distintas, comparar sus números no significaría nada.

## 2 · El método, con el detalle para poder arbitrarlo contra otra medición

`tests/_alcance-desde-entradas.mjs`. Tres pasos:

1. **Qué ficheros toca el proceso.** BFS desde las entradas vivas siguiendo imports estáticos,
   dinámicos y las traducciones `dist/**.js → src/**.ts` (se reutiliza `importsDe`, no se reescribe).
2. **Qué exports ata un fichero alcanzable.** 🔴 Aquí está lo que afina: cada import se resuelve a
   **(módulo, nombre)**, y se exige además que el nombre **se USE en el cuerpo** del importador.
3. **Qué llama eso por dentro.** Propagación por el grafo interno del fichero desde los exports que
   entraron por (2). Este tercer paso es el que contesta la pregunta de `ensureReferralCode`.

### 🔴 Por qué hacía falta un instrumento nuevo y no valía el de 411

`_alcance-dominio.mjs` indexa los importadores **por NOMBRE, global**: un export `X` de A cuenta
como vivo si algún fichero alcanzable importa un nombre `X` **de donde sea**, aunque sea de B.

Para su pregunta —«¿hay un huérfano nuevo?»— ese sesgo **sobre-marca vivos**, así que nunca inventa
deuda: es un sesgo seguro, y por eso **su guard no se toca** (regla 9; se AÑADE un instrumento).
Para *esta* pregunta el mismo sesgo es el peligroso, porque diría «alcanzable» de una cadena muerta.

### 🔴 El suelo es un TERCER veredicto, no un booleano

`ALCANZABLE` · `NO_ALCANZABLE` · **`NO_SE_PUDO_DETERMINAR`**.

Un `import * as`, un `export * from` o un import dinámico no dicen **qué** nombres se usan. Ahí el
instrumento dice que no sabe. **«No se pudo determinar» y «no es alcanzable» son opuestos**, y
confundirlos fabrica un defecto que no consta.

**Control real, no sintético:** el falso positivo ya conocido —`sendQuoteEmail`, que llama
`quotesAdmin.routes.ts` por import dinámico— sale **`NO_SE_PUDO_DETERMINAR`**. Si saliera
`NO_ALCANZABLE`, el instrumento estaría afirmando que un correo de presupuesto no se manda.

### Los números

| | |
|---|---|
| exports censados en `src/` | **800** |
| ficheros alcanzables desde entradas vivas | **240** |
| `ALCANZABLE` · `NO_ALCANZABLE` · `NO_SE_PUDO_DETERMINAR` | **690 · 108 · 2** |
| de los **192** huérfanos declarados | 158 alcanzables · 33 no · 1 indeterminado |

**Autoprueba antes de creerse el número**, sobre fuente sintética con la respuesta conocida: uno
alcanzable por import, uno alcanzable **solo por llamada interna** (el caso de `ensureReferralCode`
en pequeño), uno muerto, y un módulo opaco que tiene que salir indeterminado **y no muerto**.

---

## 3 · 🔴 LA RECLASIFICACIÓN, y la etiqueta mala era mía

`borrarMerchant` ha pasado por dos categorías equivocadas: `PROMESA_SIN_CABLE` (repitiendo el
encargo) y **`SUPLANTADO_POR_UNA_COPIA`, que la puse yo**. No es ninguna de las dos.

**Verificado por mí antes de copiar al otro equipo**, leyendo lo que sus tests *afirman*:

| Guard | Llamadas | Qué comprueba **en la función** |
|---|---|---|
| `scrum192-borrado-merchant.test.mjs` | **4** (L119, 124, 140, 163) | `event` cae ANTES que los charges · `merchant` se borra el ÚLTIMO · el recorrido filtrado es igual a `ORDEN_BORRADO_MERCHANT` |
| `scrum244-colgados-de-otro-modelo.test.mjs` | **3** (L135, 152, 170) | `reconciliation` se borra **ANTES** que `charge` (la FK es RESTRICT) · cada colgado se filtra por su padre · **ningún `where` vacío** |

Los dos la **CORREN** contra un prisma falso y comprueban la **secuencia**. Con cero FK en cascada,
**ese orden ES la garantía**, y no está escrito en ningún otro sitio.

Y `suprimirMerchant` **no puede heredarlos**, comprobado: **anonimiza** con un único `updateMany` —
no borra. Su propia cabecera dice que un borrado completo *«se llevaría por delante la propia
anotación»* de `auditLog`. **No tiene orden de borrado que verificar.**

> 🔴 **Por qué esto no es taxonomía.** Una copia superada **se acaba borrando** — ésa es la conducta
> correcta para una copia, y la que aquí destruye la única comprobación del orden de borrado seguro.
> **Mi etiqueta era una invitación a limpiarlo dentro de seis meses.** Entra
> `ESPECIFICACION_EJECUTABLE_SIN_SUPERFICIE`, y hay un test que fija la categoría con ese motivo
> escrito en el rojo.

`FUERA_DEL_BARRIDO_GENERICO` va con ella, y no por arrastre: `scrum192` la comprueba **directamente**
(*«tiene que estar declarada FUERA, no simplemente ausente»*), que es la diferencia entre un modelo
que se decidió dejar fuera y uno que se olvidó.

### 🔴 Contraste con el otro equipo — porque si sale distinto, uno de los dos está ciego

Coincidimos en `scrum192` = **4**. En `scrum244` ellos dicen **2** y yo mido **3**.

Doy las líneas exactas para que se pueda arbitrar sin repetir el trabajo: `L135`, `L152` y `L170` de
`tests/scrum244-colgados-de-otro-modelo.test.mjs`, contadas como **`CallExpression` por AST**, no por
`grep` — que contaría igual una mención en un comentario y el literal `'borrarMerchant'` dentro de la
lista de prohibidos de `scrum244-puerta-portabilidad.test.mjs:80`. **La conclusión no cambia con 2 o
con 3**; lo que cambia es si el instrumento del otro lado ve todas las llamadas.

### Repasé los demás: solo éste

**12** huérfanos son sujeto de un test **y** no alcanzables desde una entrada viva. Sólo uno entra en
la categoría nueva, y el discriminante **no es «tiene test»**: casi todos son `MOTOR_EN_ESPERA` y su
test es cobertura normal de un motor que espera cable (`avanzar`, `filtrarAlbaranes`,
`avisaDeSimplificado`, `isAlbaranNumber`, `getStageAmount`, `esPaidViaValido`, `esDelTecnico`,
`baseDeFacturables`, `solicitudesPendientes`, `fechaLimite`, `diasTranscurridos`).

Lo que distingue a `borrarMerchant` es que **no le va a llegar consumidor** —otro sirve ya la
capacidad— **y aun así no se puede borrar**.

## 4 · El reparto, que ahora SUMA

| categoría | cuántos |
|---|---|
| `VOCABULARIO_DEL_MODULO` | 94 |
| `PIEZA_INTERNA_EXPORTADA` | 71 |
| `MOTOR_EN_ESPERA` | 18 |
| `REGLA_COPIADA_AL_FRONT` | 2 |
| `SUPLANTADO_POR_UNA_COPIA` | 2 |
| `ESPECIFICACION_EJECUTABLE_SIN_SUPERFICIE` | **2** (nueva) |
| `EXPORTADO_PARA_LAS_FIXTURES` | 1 |
| `SIN_LECTOR_NI_TEST` | 1 |
| `FALSO_POSITIVO_MEDIDO` | 1 |
| `PROMESA_SIN_CABLE` | **0** (definida a propósito, con test que impide borrarla) |

**192 declarados = 192 medidos = 192 repartidos.** Hay un test nuevo que lo exige: *un censo cuyas
partes no suman su total no es un censo*.

## 5 · Verificación

| | |
|---|---|
| 🔴 El trinquete cae en los DOS sentidos | plantado real en `soporte.ts:108` → rojo nombrándolo · declaración fantasma → rojo con sus dos causas |
| 🔴 AUTOPRUEBA del alcance | sobre fuente sintética, antes de creerse el número |
| 🔴 SUELO | lo opaco sale `NO_SE_PUDO_DETERMINAR` y **nunca** `NO_ALCANZABLE` |
| 🔴 Las categorías suman | 192 = 192 = 192 |
| Guards ajenos | el tope de 8 y `_alcance-dominio.mjs`, **intactos** |

**Suite:** línea base **3.306 · 3.229 pasan · 0 fallos · 77 saltados** (medida aparte restaurando los
dos ficheros a su versión de `main`; la reversión se guardó con `git stash`, no se borró nada).

## 6 · Huecos declarados

* **La respuesta es sobre `main` de hoy.** Si mañana alguien quita `GET /admin/referral`, la cadena
  muere y el defecto aparece. El test lo fija: si el importador deja de ser `src/app.ts`, cae.
* **El paso 3 propaga por identificadores de nivel superior.** Una llamada por tabla de despacho o
  por miembro calculado no se sigue: en ese caso el veredicto se queda corto **hacia
  `NO_ALCANZABLE`**, que es el sesgo que acusa de más. No se ha medido cuántos casos hay.
* **`NO_SE_PUDO_DETERMINAR` es de grano grueso:** si un módulo se ata con `import * as`, **todos**
  sus exports quedan indeterminados, no solo los que de verdad se usen por el namespace.
* **Los 108 `NO_ALCANZABLE` de `src/` no se clasifican aquí.** Este apéndice contesta una pregunta y
  corrige una etiqueta; los 192 huérfanos declarados sí están cruzados con su alcance.
* **No se ha cableado ni borrado nada.** Ni un export — y menos `borrarMerchant`, que resulta ser
  una especificación.

## 7 · Ficheros

* `tests/_alcance-desde-entradas.mjs` (nuevo) — el instrumento y su autoprueba.
* `tests/_huerfanos-declarados.mjs` — categoría nueva y las dos reclasificaciones.
* `tests/scrum411-exports-inalcanzables.test.mjs` — 6 tests más (23 en total).
* `docs/master/SCRUM-411.md` — este apéndice.
