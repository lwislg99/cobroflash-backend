# SCRUM-944 · Gastos enseña datos internos — punto 2 (el nombre del Trabajo), servidor

**Fecha:** 20-sep-2026 · **Carril:** ticket de S1 (servidor); lo trabaja S4 por encargo del orquestador (excepción de carril aceptada por escrito por el canal el 20-sep, porque S4 lo midió y S1 estaba con la IA de presupuestos) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `205d3d4af7660d74281df366895436239b69d709` · 2026-09-20T13:35:47Z
**Rama:** `scrum-944b-nombre-del-trabajo`

El ticket tiene dos puntos. **El punto 1** (el KPI «Mayor categoría» pinta la clave cruda) es de front y de la
Sesión 2: no se toca aquí. **Este PR es sólo el punto 2**, y por eso lleva el sufijo `b`: el punto 1 lo entregará S2
y anexará su sección a este mismo fichero.

## El defecto, medido antes de escribir (PASO 0, corriendo)

Sonda sobre la lista de verdad (`dist/modules/expenses/…`, base doblada, sin red): un gasto de un Trabajo SIN título,
con presupuesto nº 5 y cliente María López.

```
Gastos   → GET /admin/expenses   job = {"id":500,"titulo":null}      (la pantalla cae a «Trabajo»)
Trabajos → tituloDeTrabajo(...)  = "Presupuesto #5 · María López"
```

Causa: `listExpenses` devolvía `Job.titulo` crudo (`trabajosPorQuote` lo selecciona tal cual). `tituloDeTrabajo()`
(`jobs/domain/trabajoDirecto.ts`) es quien decide cómo se titula un Trabajo, y Gastos no la llamaba. En staging, 10 de
los 13 Trabajos del merchant no tienen título (medido por S4 el 18-sep con SELECT de sólo lectura).

`tituloDeTrabajo` es una función pura (su único import es `tipoIntervencion`), así que se puede llamar desde el
servicio de gastos sin arrastrar nada. Un solo consumidor de `trabajosPorQuote` (`listExpenses`).

## Lo que se hace

`nombresDeTrabajos(merchantId, trabajos, prismaClient)` en `expenses.service.ts`, llamada desde `listExpenses`:
`job.titulo` pasa a ser el NOMBRE con el que Trabajos presenta ese Trabajo. **No decide nada**: llama a
`tituloDeTrabajo` con las mismas entradas que le da `serializeJob` — el título propio, el presupuesto **original** del
Trabajo (el de `Job.quoteId`; a falta de éste, el primero por id de los que tienen `Quote.jobId`) y su cliente.

- Un gasto imputado a un presupuesto ADICIONAL lleva el nombre del Trabajo (el original), no el número del adicional.
- Un Trabajo CON título no cuesta nada: no se hace ninguna consulta de más.
- Para el resto, tres consultas por página (Trabajos, presupuestos, clientes), nunca una por gasto: el coste
  constante que fijó SCRUM-135. Todas acotadas por `merchantId` (regla 2).
- **API aditiva en forma:** la clave sigue siendo `job.titulo` y sigue siendo texto; lo que cambia es que ya no llega
  `null` para los Trabajos sin título. El «Trabajo» de respaldo del front (`jobLabel`) queda sin uso; es de S2.

## Tests

`tests/scrum944b-el-trabajo-se-llama-igual.test.mjs` (10). Se vio en **rojo** inyectando el fallo real (volver a
`titulo: j.titulo`): **4 pasan y 6 caen** sobre 10 (los 4 que pasan son el suelo y los positivos; los 6 que caen, el
defecto). Corregido y en verde 10/10 antes de seguir. El suelo comprueba que el banco ve el gasto y su Trabajo; sin él
el verde sería una frase.

## Lo que NO se hace

- No se cambia `tituloDeTrabajo` (su fichero no está en el diff): si no encajara, se pararía y se diría. Encaja.
- No se toca el punto 1 (KPI con clave cruda), ni `expensesView.js`, ni nada de front.
- No se tocan los nombres ya escritos: `Job.titulo` sigue como está en la base; el nombre se compone al leer.

## No mirado

- La medición contra staging (sólo el banco sin base). El caso con y sin `titulo` en staging se comprobará al
  desplegar con la lista real de gastos.
- Si el orden de `quotesDeJob` (original primero, luego por `Quote.jobId` sin `ORDER BY`) coincide siempre con «el
  primero por id» cuando falta `Job.quoteId`: se asumió; sólo importa en Trabajos sin `Job.quoteId`, que son los
  posteriores al paso 1 de SCRUM-195.

## Errores propios

- Dije al orquestador «contexto propio ~120k» sin medirlo: medido en mi jsonl eran ~158k. La cifra se mide, no se estima (A19).
- Al cambiar de rama en el mismo árbol, un `node --test` con la ruta de un test que ya no existía en esa rama corrió el
  resto sin quejarse (47 tests; con los 9 del otro ticket habrían sido 56): lo cazó la población, no el código de salida. Un fichero que no existe no es un fallo, es una ausencia.
- Exporté 
ombresDeTrabajos para poder probarla y scrum411-exports-inalcanzables cayó (un export sin consumidor de fuera): la salida fue cambiar el código —no exportarla; el test entra por listExpenses—, no declararla huérfana. Lo cazó correr los guards vecinos antes de empujar, no la suite.
