# SCRUM-719 · El suelo de los doce — y por qué eran trece

**Medido contra:** `origin/main` = `c9cf435b20287ad7a0dc02a3a17d3fe182dfa372` · 2026-09-04T17:31:48+02:00
**Rama:** `scrum-719-suelo-de-los-doce`

> Hallazgo de la sesión 4 (SCRUM-700b). El ancla se remidió tras mezclar `main` dentro de la rama
> (AA2): estaba en `119484af…` y se movió mientras se trabajaba.

---

## 1 · PASO 0 (regla 39) · el número que vale es otro, y el instrumento que lo dice también

El encargo hablaba de **doce**, salidos de romper `soloEjecutable` sobre los 24 guards que
SCRUM-700b migró. Remedido hoy sobre **toda** la población —los guards que llaman al filtro, no
sólo los migrados—: **73 lo llaman de verdad, 60 se ponen rojos y 13 siguen en verde mirando la
nada**.

Y los nombres **no estaban en el registro**: SCRUM-700b nombra los 24 migrados, los 7 pendientes y
3 auxiliares, pero no los doce. Así que se derivaron midiendo, que era lo que había que hacer de
todos modos.

### 🔴 Las tres veces que el instrumento mintió antes de dar un número

Ninguna la vio una revisión. Las tres las cazó la medición, y las tres iban **hacia el mismo lado**:

| | lo que pasó | cómo se vio |
|---|---|---|
| ① | Barrer con `grep soloEjecutable` metía **5 ficheros que sólo lo NOMBRAN en un comentario** (`scrum226`, `402`, `403`, `409`, `480`), dos con el `import` vivo sin usar | 17 «mudos» → 12 al mirar el código sin comentarios |
| ② | Deducirlo del fuente metía a **`scrum201`**, que sí llama a `leerFuente` pero con `{ conComentarios: true }` — **no pasa por el filtro**, y eso al fuente no se le ve | pasó a NO APLICA sólo al medirlo en ejecución |
| ③ | `execFileSync` devuelve **sólo stdout**, así que en las tandas VERDES la marca del filtro se perdía | tres guards que sí llaman salían como «no aplica» |

La ① es la autorreferencia de siempre: el sitio natural donde se escribe el nombre del helper es el
comentario que explica por qué se usa.

### Y uno de los doce NO estaba mudo

**`scrum374-direccion-sin-escritores`** salía verde por otra razón:

```js
const sinComentarios = (s) => soloEjecutable(s);   // ← CERO usos en 123 líneas
```

Envoltorio muerto, con su `import` vivo al lado. **No estaba mudo: nunca llegaba a usarlo.** Son
dos diagnósticos distintos y sólo se separan midiendo. Se retira el envoltorio en vez de
inventarle un uso.

## 2 · El escalón de la sesión 4, cerrado: `scripts/censo-mudez.mjs`

Su control «no distinguía guard mudo de fichero sin tests — lo separó a mano». Ahora hay **cuatro
puertas y las cuatro se deciden midiendo**:

| puerta | cuándo | hoy |
|---|---|---|
| **VIVO** | se pone rojo con el filtro vacío | **74** |
| **MUDO** | sigue verde: su negación pasaría sobre un fichero vacío | **0** |
| **CIEGO** | no ejecutó **ni un test**: verde por no mirar | 0 |
| **NO APLICA** | nunca llegó a llamar al filtro | 9 |

La pregunta «¿llegó a llamar al filtro?» **se la contesta el propio filtro**: en la pasada limpia se
instrumenta para que avise la primera vez que lo llaman. Medido, no leído — que es lo que las
trampas ① y ② demostraron que hacía falta.

⛔ La mutación **nunca se commitea**: se restaura en un `finally` **y se verifica byte a byte**; si
no cuadra, sale con código 3 gritándolo.

## 3 · 🔴 Lo que había que entender para arreglarlo bien

**Casi todos tenían suelo ya. Todos lo tenían apuntando UN PASO ANTES de la ceguera:**

| guard | su suelo decía | y la ceguera estaba |
|---|---|---|
| `scrum374` | «he leído el sellador» (`length > 2000`) | sobre el texto CRUDO |
| `scrum394` | «he encontrado la rama» (AST) | **antes** de filtrar |
| `scrum382`, `293`, `D1` | «el nombre prohibido existe en la casa» | en **otro** fichero |
| `scrum549` | «sigo viendo los marcadores» | sobre el texto CRUDO |
| `scrum372` | «he mirado 3.000 líneas» | cuenta lo que **ENTRA**; la ceguera está en lo que sale |

Ninguno comprobaba lo único que respalda una negación: **que el texto registrado tenga sustancia.**

### El arreglo: un ancla, no un número

El ancla es algo de lo que el guard **ya depende** —el símbolo que importa, la función que la
pantalla publica, el marcador que el censo busca—. Si desaparece, el guard estaba mirando otro
fichero y quiere enterarse. **No hay ningún número que mantener a mano**, que es el defecto de
SCRUM-402: un umbral escrito a mano nace para desactivarse. Y es lo contrario del umbral con
holgura de SCRUM-559: un ancla es binaria, no tiene margen, así que detecta la pérdida **parcial**.

## 4 · Los trece, uno a uno

| guard | suelo | control positivo (su violación) |
|---|---|---|
| `scrum149-sin-lineas-no-sella` | `ancla: 'listQuotesAdmin'` + `'router'` | `createInvoiceFromQuoteAdmin` en `quoteAdmin.ts` |
| `scrum199-fuente-unica-hijos` | `ancla: '_evidencia-tanda'` | un `.test.mjs` a mano en `test-staging-gated.mjs` |
| `scrum293-retencion-irpf` | `ancla: 'TIPOS_RETENCION'` | `calcVatBreakdown` en `retencionIrpf.ts` |
| `scrum317-trabajo-por-su-nombre` | `ancla: 'renderJobDetailView'` | `Presupuestos ›` en `jobDetailView.js` |
| `scrum347-origen-de-la-factura` | `'allocateInvoiceNumber'` + `'emitInvoice'` | `backfill` en `invoicing.service.ts` |
| `scrum370-gastos-del-trabajo` | `ancla: 'Gastos de este trabajo'` | `Total` en la sección de gastos |
| `scrum372-un-dato-un-nombre` | `lineasConCodigo > lineasMiradas / 3` | `alb.estadoCobro` en `cobrosView.js` |
| `scrum382-foto-duplicada` | `ancla: 'huellaDeBytes'` | `computeAlbaranContentHash` en `fotoDuplicada.ts` |
| `scrum394-plan-mudo` | `ancla: 'skipped.push'` | `nextDueAt` en la rama del opt-out |
| `scrum448-cobros-estado-de-carga` | `ancla: 'renderCobrosView'` | `setTimeout` en `cobrosView.js` |
| `scrum458-paquete-de-precarga` | `sinCodigo` + `ficherosBarridos > 100` | un nombre de precarga declarado en `albaran.service.ts` |
| `scrum549-nada-publicable-sin-marcar` | `ancla: [...MARCADORES]` | `'PROPUESTA'` en el censo |
| `scrumD1-puerta-serie` | `'renderPuertaSerie'` / `'renderSettingsView'` | `invoiceSeriesYear` en `puertaSerie.js` |

En `scrum149` se retiró además **un segundo filtro de comentarios escrito a mano encima de
`leerFuente`**, que filtraba por líneas —sólo las que EMPIEZAN por `//`— y por tanto dejaba pasar el
comentario al final de una línea con código: el hueco exacto que `soloEjecutable` existe para
cerrar (SCRUM-176, SCRUM-694).

## 5 · Verificación

### 🔴 EL ROJO, y que cae con el mecanismo viejo

**Con `soloEjecutable` devolviendo la cadena vacía: MUDO 0.** Los 74 que llaman al filtro se ponen
rojos. Antes eran 13 los que seguían verdes, y cada uno se nombra arriba.

### ✅ CONTROL POSITIVO, uno por uno — **13 de 13**

No basta con que la suite pase: a **cada** guard se le inyectó **su propia violación** en el fichero
de producción que vigila, se comprobó que cae, y se revirtió verificando el árbol limpio. La
columna derecha de la tabla es esa inyección.

### ✅ CONTROL NEGATIVO — población pequeña **pero real**

Un módulo de **una línea** con su ancla pasa: el ancla es binaria y no exige tamaño. Un guard que se
pusiera rojo ante un módulo pequeño empujaría a bajarle el listón, y un listón bajado es un guard
apagado.

Y el caso que lo obligó a estar bien planteado: **`src/` tiene SIETE ficheros `.ts` de CERO BYTES**
(`src/api/routes.ts`, `src/core/http/types.ts`, cinco más). Mi primer suelo para `scrum458` los
marcaba a los siete. **Un fichero vacío en disco y uno VACIADO por el filtro son hechos distintos**
—sólo el segundo deja hueca la negación—, así que el suelo compara **entrada contra salida**.

### 🔴 Y el censo se cegó a sí mismo con su propio arreglo

Al migrar los trece, nueve pasaron de importar `soloEjecutable` a importar `ejecutableDe` — y el
censo, que buscaba **el nombre viejo**, dejó de verlos: la población cayó de 82 a 73 y el veredicto
pasó a «0 mudos» **en parte por no mirar**. Lo cazó que los candidatos bajaran **exactamente en 9**,
que eran los 9 migrados. Hay un test que lo impide repetirse.

### Y `scrum237` cazó mi demostración, con razón

La primera versión del control «cae con el mecanismo viejo» era `assert.doesNotMatch('', /X/)` —
literal, una negación sin respaldo: **el defecto de este ticket cometido en su propia
demostración**. Se reescribió como afirmación positiva sobre la regex. **No se tocó `scrum237`**: se
arregló la frase.

## 6 · Ficheros

* `tests/_guard-texto.mjs` — `ejecutableDe(fuente, { ancla, donde })` (ancla **obligatoria**: que
  llamarlo obligue a decir qué debe sobrevivir es el mecanismo), `ejecutablesDe(entradas)` para los
  barridos sin ancla común, y `ancla` como opción de `leerFuente` — opcional ahí, porque por ese
  camino también pasan tests que EXIGEN algo, y a ésos el filtro no puede cegarlos.
* `scripts/censo-mudez.mjs` + `npm run censo:mudez` — fuera de `npm test`: corre cada guard **dos
  veces** en subproceso, unos 5 min.
* `tests/scrum719-el-suelo-de-los-doce.test.mjs` — 8 tests. La red que sí corre siempre: que los
  trece conserven su ancla y que el censo no pueda cegarse por su lista de nombres.

## ⛔ No tocado

`soloEjecutable` (su cuerpo sigue byte a byte igual; la mutación sólo se usó para medir) ·
`scrum237` · los 43 guards que importan `soloEjecutable` directamente y **sí** se ponen rojos ·
los dos vigías y su `continue-on-error` · producción · ninguna base · la rama
`scrum-653-dos-firmas`, que sigue bloqueada esperando el ALTER de Javier.
