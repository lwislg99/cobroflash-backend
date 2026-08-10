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
