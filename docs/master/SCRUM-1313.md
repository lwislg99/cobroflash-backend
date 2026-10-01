# SCRUM-1313 · Cuatro guards de navegador CIEGOS en `main`: causa, desde cuándo, y un recuento que dice las tres cosas

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T00:58:11Z
A9: comprobación → `tests/scrum1313-ciego-no-es-verde-ni-rojo.test.mjs`
**Rama:** `scrum-1313-ciegos-editor-suelto`. **Sesión:** J1.

## En corto

- Los cuatro CIEGOS los metió **mi propio puesto** dos días antes, en el PR #1943 de SCRUM-825
  (merge `ba1b096661db77f93aaaf52acdcfd7c9d99db9aa`, 2026-09-29T00:14:04Z).
- 🔴 **El rojo del job «guards de navegador» de CI en `main` ES esto mismo**, no otra cosa: los mismos
  cuatro guards, los mismos mensajes, salida 2. El ticket y el encargo decían que no había que
  mezclarlos; la medición dice que son el mismo hecho.
- Con este PR los cuatro vuelven a MIRAR, los cuatro se han visto caer con una violación real, y la
  puerta cuenta `verdes · CIEGOS · rojos` por separado.

## ① La causa, medida

Dos cambios del mismo PR, y los cuatro guards no caían por lo mismo:

| cambio (commit) | qué hace |
|---|---|
| `0002f3db` · D1, con firma (SCRUM-825 c.17446) | el valor `'justificante'` sale del contrato: `app.js` lo lee como `'no'`, y el rótulo «Emitir justificante» desaparece |
| `5716ac9b` · arreglo de pantalla | la ruta `#invoices-new` falla cerrado: en modo `'no'` pinta el listado de Facturas, no el editor |

| guard | qué servía su arnés | por qué no veía |
|---|---|---|
| `guard:cabecera-del-editor` (caso D) | `'no'` | sólo la ruta cerrada |
| `guard:pasos-del-editor` (caso suelto) | `'justificante'` | D1 lo convierte en `'no'` + la ruta cerrada |
| `guard:ajustes-del-justificante` (6 casos de 6) | `'justificante'` | lo mismo |
| `guard:un-solo-presupuesto` (caso B) | `'justificante'` | lo mismo, **y además** buscaba el botón «Emitir justificante», que ya no existe |

Cómo se midió (no leyendo): con la puerta de la ruta desactivada a mano (1 línea de `app.js`,
`git diff --numstat` 1/1, restaurada después), tres de los cuatro volvieron a salir 0 y
`un-solo-presupuesto` siguió en 2 con otro motivo: «el PRIMER «Emitir justificante» (no-encontrado)
dejó 0 documento(s)». **Una causa común y una segunda sólo en uno.** Ese experimento no es un
arreglo: sin la puerta, un merchant en modo `'no'` vuelve a ver «Nueva factura».

**El ciego era PARCIAL en tres de los cuatro**: sus casos de presupuesto se seguían midiendo y
salían bien; lo que no se miraba era el caso del documento suelto. Sólo `ajustes-del-justificante`
estaba ciego entero.

## ② Desde cuándo

Por efecto, en el job de CI «guards de navegador (fuera de la tanda)»:

| commit de `main` | job | acabó |
|---|---|---|
| `837a9e5350cc9bd3849df0cfde4fd5ae3404556d` (el anterior) | success | 2026-09-28T23:34:06Z |
| `ba1b096661db77f93aaaf52acdcfd7c9d99db9aa` (merge de #1943) | failure | 2026-09-29T00:25:26Z |

El log del primer rojo y el de un run del 30-sep (36791371620) dicen lo mismo, literal: los cuatro
guards en `CIEGO`, «37 guards · … verdes: 33 · no verdes: 4», «NO MEDIDO (salida 2) · CIEGO en 4
guard(s)». De los 77 push a `main` desde el 28-sep 23:00Z: 34 failure, 40 cancelled, 2 success, 1 en
curso. El job **no es obligatorio** (lo dice `ci.yml`, SCRUM-963), y el del propio PR #1943 acabó en
failure a las 00:16:00Z, dos minutos DESPUÉS del merge.

**Lo que entró en esa pantalla sin vigilancia** (`837a9e53..origin/main`, ficheros del editor):
`quotesView.js` +78/−3 —las casillas de cláusulas de SCRUM-1180 (S2) y la retirada de SCRUM-825—,
`app.js` +21/−4, `rotulosDelDocumento.js` +19/−30, `invoicesView.js` +9/−4. Con la pantalla pintada,
los cuatro guards salen **verdes sobre ese árbol**: no se ha colado nada de lo que ellos vigilan.
Lo que NO se sabe: si en esos dos días hubo algún estado intermedio roto que luego se arregló.

## ③ El recuento

`scripts/guards-visuales.mjs`: `recuento(filas)`, pura, con la misma regla que el código de salida
(`llegoAMedir`). La línea del total, la cabecera del volcado, el mensaje de verde y la anotación y el
resumen de Actions dicen ahora, por ejemplo, `33 verdes · 4 CIEGOS · 0 rojos`. Si los que no
midieron no son todos del mismo tipo, van desglosados.

De paso, un agujero de la misma puerta: un guard declarado cuyo fichero falta sumaba un fallo pero
no dejaba fila, y `veredicto` —que sólo ve filas— contestaba 0. Ahora deja fila de CIEGO
(`filaDeFicheroAusente`). Medido sólo sobre la función pura (caso A5 del test), no de punta a punta.

**Límite declarado:** los guards del editor miran `ciegos` antes que `hallazgos`, así que uno que
encuentra defectos en un caso y se queda ciego en otro sale 2 y cuenta como CIEGO. Visto de verdad:
una mutación dejó a `ajustes-del-justificante` con 5 hallazgos y 1 ciego, salida 2. Es decir: **del
29-sep a hoy, un defecto real en los casos de presupuesto de esos guards habría salido «CIEGO»**. No
se toca aquí (son 24 guards con las dos salidas; el orden de cada uno hay que leerlo, no contarlo
por posición). Va como hallazgo al orquestador.

## ④ El arreglo, y el rojo primero

Los cuatro arneses sirven `'factura'` cuando abren el documento suelto, que es el único modo en que
esa pantalla existe hoy; `un-solo-presupuesto` pulsa «Emitir factura». **Lo que cada guard EXIGE no
cambia ni una línea**: sólo el escenario que monta y las etiquetas de los casos, que decían
«justificante». Es lo mismo que el PR #1943 hizo con `guard:caja-documento-suelto` y no hizo con
éstos. Los nombres de los guards no se tocan.

Rojo visto, uno por guard, con una violación real en `quotesView.js` (numstat 1/1 cada una, árbol
limpio comprobado tras restaurar):

| guard | violación inyectada | salida | lo que dijo |
|---|---|---|---|
| `cabecera-del-editor` | el suelto enseña el aviso de autoguardado | 1 | «suelto -> el documento suelto enseña «✓ Guardado automáticamente»» |
| `pasos-del-editor` | la fila «Ajustes del documento» no se monta | 1 | «INVENTARIO: «IVA por defecto» — hay 0 y hoy hay 1» |
| `un-solo-presupuesto` | tras emitir no navega y rehabilita el botón | 1 | «B · … 2 documento(s) en total» |
| `ajustes-del-justificante` | el resumen dice «IVA» en vez de «IVA por defecto» | 1 | 2 hallazgos en revisar-cerrado y el-valor-viaja |

Una primera mutación de `un-solo-presupuesto` (sólo quitar la navegación) salió MUDA: el botón se
queda deshabilitado en «Emitiendo…» y no hay segundo clic posible. No era el guard: eran dos
protecciones redundantes.

Después: `npm run guards:visuales` entero, **37 guards · 526,4 s · 37 verdes · 0 CIEGOS · 0 rojos**,
salida 0 (con estos mismos `scripts/`, árbol limpio).

## La comprobación (A9)

`tests/scrum1313-ciego-no-es-verde-ni-rojo.test.mjs`, 10 casos, en `npm test`:

- **A1–A7** · el recuento: las tres cuentas, que rojo y CIEGO no comparten línea, que suman la
  población, que clasifican igual que `veredicto`, y que la puerta lo usa.
- **B0–B2** · todo guard que le sirve `documentoSuelto` al panel sirve un valor que el panel lee tal
  cual, y el que abre `invoices-new` sirve uno que pinta el editor. La regla no está escrita en el
  test: se saca de `app.js` por AST y se ejecuta. Población: 8 guards, 6 leídos, 2 declarados
  ilegibles con su motivo, 4 que abren el documento suelto.

Rojo real: con los cuatro guards como están en `origin/main`, B2 cae y nombra a los cuatro (7
defectos). Es lo que habría puesto en rojo el check OBLIGATORIO del PR #1943.

Mi instrumento también falló una vez: B2 buscaba el texto con almohadilla y `un-solo-presupuesto`
compone la ruta por trozos. Lo cazó el suelo que exige a los cuatro por nombre.

Corrido en local: 10 ficheros, 89 tests, 89 pass, 0 fail, 0 skip (éste, los de la puerta 522/639/645,
scrum237, scrum976, scrum391, scrum548, scrum825 y scrum1294). **La tanda completa de `npm test` NO
se ha corrido en local**: se deja al CI, de acuerdo con el orquestador (el cambio es `scripts/` y un
test; ni `src/` ni `public/`).

## Lo que NO es

Un job de navegador en verde en 14 s (PR #2032) no es un verde sin medir: ese PR toca un solo
fichero de `docs/master/` y el paso sale `skipped` por la regla de SCRUM-1284. Medido en los pasos
del job 110163395146.

## Mis errores

1. El origen es mío: en SCRUM-825 moví al lado factura los guards de `npm test` y uno de navegador, y
   no los otros cuatro.
2. Anoche (SCRUM-1142) los di por «no míos» tras descartar sólo el diff del día. No miré desde cuándo.
3. La primera versión de B2 no veía a uno de los cuatro (arriba).

Los dos primeros, en `docs/equipo/cicatrices/J1.md`.

## SCRUM-1313 · segunda vuelta: el CI del PR #2038, y la declaración del arreglo

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:16:43Z
A9: comprobación → `tests/scrum775-suelo-que-no-dispara.test.mjs`

**El job «guards de navegador» del PR volvió a verde** (9 min 47 s) sobre `023bd450`, con los
37 guards corridos de verdad (no es el salto de sólo-documentación de SCRUM-1284).

**El check obligatorio salió rojo con cuatro tests, y dos eran míos:**

| test | de quién | qué |
|---|---|---|
| `tests/scrum775-suelo-que-no-dispara.test.mjs` | mío | añadí a la puerta un suelo «recuento ≠ lista» que no puede saltar nunca (cada vuelta deja una fila); su censo no lo sabía leer. Retirado: sobraba |
| `tests/scrum737-cifra-con-arbol-y-hora.test.mjs` | mío | un comentario mío citaba una cifra de recuento sin fecha. Reformulado sin número |
| SCRUM-128 y SCRUM-55 | ajenos | trinquetes de fecha, ya rojos en `main` |

Y el meta-guard cae por `scrum853`, que tampoco es de este PR (medido por J2 y J3 en otros PR).

Mi error: corrí en local scrum237 y scrum976, que es lo que pide la nota de «test nuevo», y no los
censos que barren `scripts/` y los comentarios. Los cazó el CI, que es para lo que se le dejó la tanda.

### Qué buscaba el arnés antes, qué busca ahora, y por qué es lo mismo

- **Antes:** abría `#invoices-new` diciéndole al panel que el modo era `'justificante'` (o `'no'`), y
  esperaba encontrar el editor del documento suelto.
- **Ahora:** abre la misma ruta diciéndole que el modo es `'factura'`, y espera el mismo editor, con
  los mismos selectores y las mismas exigencias. En `un-solo-presupuesto`, además, pulsa el botón por
  su rótulo de hoy.
- **Por qué es lo mismo:** el editor que se pinta es el mismo código (`renderDocumentoSueltoView`)
  y la pantalla SÍ se pinta para una persona: en modo `'factura'`, que es el único que el servidor
  puede mandar para quien puede crear un documento suelto. En modo `'no'` no se pinta A PROPÓSITO
  (SCRUM-825, con firma). El defecto no estaba en el producto: el arnés apuntaba a un modo retirado.

El control que lo separa de una relajación es el ④ de arriba: con el arreglo puesto y el editor roto
a mano, los cuatro salen ROJOS (salida 1), cada uno en su caso del documento suelto.
