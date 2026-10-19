# SCRUM-1543 · A8.4 caía con `'menu' !== 'handoff'`: el bot guardaba `handoff` DESPUÉS de enviar

**Medido contra:** `origin/main` = `76c29b57c871584b04c8206c11571f9c56c9d699` · 2026-10-14T07:01:54Z

A9: comprobación → `tests/scrum1543-handoff-se-guarda-antes-de-enviar.test.mjs`

Sesión `jv-j2f`, puesto J2, lanzada por el orquestador del equipo de Javier (`cobroflash-backend-2e`).
Etiquetas leídas en Jira: `equipo-javier`, `area-j2`, `calidad`, `bug`. El permiso para construir es
la decisión del orquestador en **SCRUM-1543 c.19586**: se hacen (b) y (a), en un solo PR de J2. La
causa la encontró **jv-j3d en c.19551**; aquí se ha vuelto a ver, se ha arreglado y se ha comprobado.

⚠️ El hook de inicio dijo SIN IDENTIDAD. Se construyó con la orden escrita del orquestador, que lo
tiene medido y abierto en SCRUM-1549.

## En corto

- **Causa.** En `bot_human`, el bot avisaba al profesional (sin esperar), enviaba «le he avisado» al
  cliente y solo DESPUÉS hacía `await setSession(…'handoff')`. El paso 9 de A8.4 leía la sesión en
  cuanto veía los dos mensajes. Si el UPDATE no había llegado, leía el `menu` del «cancelar» de 8h.
- **El hueco de ~2,6 s es consecuencia, no causa.** Son los pasos 10 y 11, que no corren porque el
  caso ya cayó en el 9 (medido por jv-j3d en c.19551; aquí no se ha vuelto a medir en CI).
- **(b) · el bot** (`src/modules/whatsappBot/domain/botFlow.service.ts`). `handoff` se guarda ANTES
  de cualquier envío en los dos handoffs: el botón `bot_human` y la 2.ª vez de texto fuera de flujo
  (K1). Solo cambia el orden de operaciones que ya existían: ni texto, ni estado, ni envío nuevo.
- **(a) · el test** (`tests/bot-suite.test.mjs`, paso 9). Espera con `esperarCondicion`, techo de
  6 s, a que la sesión esté en `handoff`, y después hace el mismo `assert`. No es un sleep: si el
  techo vence, sale `NO MEDIDO` y en rojo.
- **Un guard nuevo, porque (a) deja ciego a A8.4 sobre el orden:**
  `tests/scrum1543-handoff-se-guarda-antes-de-enviar.test.mjs` (AST). Exige que, en el bloque de
  cada `setSession(…, { state: 'handoff' })`, no haya ningún `send*` ni `notifyMerchantAlert` antes,
  y que vaya con `await`. Sin él, devolver el `setSession` a su sitio de antes dejaría A8.4 verde.

## El rojo primero, y después

Banco desechable local (`embedded-postgres` 17.5 en `127.0.0.1:55437`, base `yaqu_libro_test`,
esquema de `migrate diff --from-empty`, 33 tablas), con `LIBRO_PG_URL`. La siembra va en una COPIA
del test, fuera del árbol, sobre el mismo cliente Prisma que usa el bot:

- **`retraso`**: 300 ms antes del `botSession.update` a `handoff`. Es la receta de c.19551.
- **`nunca`**: ese UPDATE escribe `menu`, o sea, un bot que nunca pasa a `handoff`.

Cada pasada imprime cuántas veces se disparó la siembra.

| código del bot | test | siembra | pasadas | resultado | disparos |
|---|---|---|---|---|---|
| original (antes de (b)) | original | ninguna | 1 | 🟢 pasa | — |
| original | original | `retraso` | 3 | 🔴 **cae 3 de 3**, `'menu' !== 'handoff'` | 1 en cada una |
| con (b) | original | ninguna | 1 | 🟢 pasa | — |
| con (b) | original | `retraso` | 3 | 🟢 **pasa 3 de 3** | 1 en cada una |
| con (b) | original | `nunca` | 1 | 🔴 cae, `'menu' !== 'handoff'` | 1 |
| con (b) | con (a) | ninguna | 1 | 🟢 pasa | — |
| con (b) | con (a) | `retraso` | 3 | 🟢 pasa 3 de 3 | 1 en cada una |
| con (b) | con (a) | `nunca` | 1 | 🔴 cae, `NO MEDIDO · … «la sesión en handoff (9)»` | 1 |

Para el «original» se reconstruyó `dist/` con el bloque devuelto a su orden de antes. `git diff`
contra el commit anterior a (b) solo mostraba mis comentarios.

La fila de `nunca` es la que dice que (a) **no afloja** el caso: un bot que no pasa a `handoff` sigue
cayendo. El fichero real, ya con (a) y (b) y sin copia: `node --test tests/bot-suite.test.mjs` →
1 test, 1 pasa, «SUITE OK — 33 mensajes simulados, 0 llamadas a Meta».

**El guard nuevo, en rojo primero.** Una copia apuntada al `botFlow.service.ts` de antes de (b) sale
exit 1 y nombra `botFlow.service.ts:656` y `:710`, cada una «DESPUÉS de: notifyMerchantAlert,
sendWhatsAppText». Sobre el árbol actual sale exit 0, con 2 guardados de handoff mirados. Lleva
además un control sembrado propio: el orden viejo cae, el `await` que falta cae, el orden bueno pasa
y un `setSession` a otro estado no cuenta.

## Lo que el orquestador pidió medir: un envío que FALLA con el orden nuevo

Medido leyendo `src/integrations/whatsapp.ts` (`sendWhatsAppText`), no ejecutándolo:
**`sendWhatsAppText` no lanza**. Las credenciales que faltan, el freno del demo, la baja (que trae su
propio `try/catch` en `corteDeLaBaja`) y el error de Meta (dentro de `try/catch`) **devuelven**
`{ ok: false, … }`. Y el handoff no mira lo que devuelve.

Así que **con el orden de antes, un envío fallido ya dejaba la sesión en `handoff`** sin que el
cliente hubiera recibido nada. El orden nuevo no crea ese estado: ya existía. Lo único que cambia es
qué pasa si **el propio UPDATE** lanza:

- **Antes:** el cliente ya tenía «le he avisado» y el profesional el aviso de «silencio 24 h», y la
  sesión seguía en `menu`: el bot le seguía contestando.
- **Ahora:** el handler lanza antes de enviar nada. Ni aviso ni promesa de silencio.

No se propone nada más. Quién recoge esa excepción, en el webhook en segundo plano, no está medido.

## Lo que NO he medido

- **CI.** Esta rama no ha corrido en CI al escribir esto. Con 4 caídas en 65 logs (c.19462 y c.19551),
  ver verde unas cuantas veces no probaría el arreglo. Lo que lo prueba es la tabla de arriba: la
  siembra que da la firma exacta de CI cae antes de (b) y pasa después.
- **Que en CI fuera esta carrera.** CI no deja traza del orden. La siembra prueba que A8.4 **es
  sensible** a ese orden y que da esa misma firma, no que en CI fuera eso (igual que dijo c.19551).
- **(a) sola sobre el bot original, con la siembra.** No lo he corrido. Lo midió jv-j3d: verde 3 de 3
  (c.19551).
- **Otras lecturas inmediatas de la base en `tests/bot-suite.test.mjs`.** Las de las líneas 260, 277
  y 298 (`quoteRequest`, `attachment`) leen después de ver el buzón. No las he juzgado: no han caído
  en los 65 logs, y eso no dice que no puedan.
- **La fila de `whatsAppMessage` que sobrevivió a la limpieza** en el rojo 115337104180 (c.19551).
- **Producción.** Nadie ha medido que la ventana le haya pasado a un cliente real. No es urgencia.

## Errores propios

- **Escribí (b) ANTES de haber visto el rojo en mi propio banco.** Para el «antes» tuve que volver a
  dejar el bloque en su orden de antes. El guard `guard-dangerous` me paró dos veces, con razón: un
  `git checkout --` que habría tirado el arreglo sin commitear, y un `>` que truncaba el fichero.
  Lo resolví haciendo antes commit del arreglo y volviendo atrás con `Edit`. Lo que lo paró fue el
  hook, no yo.
- **En mi primer mensaje al orquestador di (b) como «el arreglo de verdad» sin haber leído
  `sendWhatsAppText`.** La pregunta del orquestador sobre el envío fallido la contestó la lectura:
  ese estado ya existía.
