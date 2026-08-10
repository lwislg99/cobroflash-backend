# SCRUM-369 · VERIFICADOR DEL SELLO: el hash de la firma se recalcula, con la regla de SU versión

**Fecha:** 5-ago-2026 · **Carril:** A (garantía probatoria del albarán firmado) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `7503c894d45c8b3f55c6debc6eb12822c56a4191` · 2026-08-05T15:42:08+01:00

**Tanda:** 1696 tests, 1629 pass, 0 fail, 67 skipped (los 67 son los gateados de staging, que
`npm test` no corre)

> **`main` se movió a mitad del ticket, y esto se midió DOS VECES.** El trabajo empezó anclado en
> `1ef584cb` (2026-08-05T15:22:43+01:00) y a las 15:35 entró **SCRUM-367**, que toca precisamente
> `albaran.service.ts` (+76). Se re-ancló al `main` resultante y se volvió a medir todo contra él.
> Lo que cambió: los números de línea. Lo que NO cambió: **los tres vectores congelados de v:1 dan
> el mismo hash**, o sea que SCRUM-367 no alteró el cálculo del sello — comprobado, no supuesto.

## El defecto

`computeAlbaranContentHash` se invocaba en **UN SOLO SITIO** de `src/` —al firmar, dentro de
`buildFirmaEvidencia`, [albaran.service.ts:383](../../src/modules/jobs/domain/albaran.service.ts#L383)—
y **nada lo recalculaba**. Lo que había no era un sello que protege el contenido firmado: era una
huella guardada que nadie comparaba con nada.

**Un hash que nadie recalcula no detecta ninguna manipulación.** Vale ante un juez porque queda
fechado y almacenado, no porque el sistema lo revise. Y el PDF ya imprimía, en el certificado de
evidencias, «El hash certifica la integridad del contenido firmado»
([albaranPdf.service.ts:263](../../src/modules/jobs/infra/albaranPdf.service.ts#L263)): una frase
que describía un archivador.

Es «un rojo que no se ejecuta se lee igual que uno que pasa» aplicado a una garantía de producto:
**el sello sin verificador se lee igual que un sello que funciona.**

## La decisión, y por qué

### ① El despacho por versión es la pieza, no una precaución

SCRUM-300 (C5) cambia la ENTRADA del hash —`obra` deja de salir de `Job.direccion` y pasa a
`Albaran.lugarEntrega`— y sube el sobre a `v: 2`. A partir de ahí hay dos poblaciones de albaranes
firmados. Un verificador que aplicase la regla de v:2 a un sobre v:1 declararía manipulados
**todos** los albaranes anteriores: **una acusación de falsificación contra papeles que nadie tocó**.
Es el peor resultado posible de esta herramienta — peor que no tenerla.

De ahí las dos reglas duras: la versión se **lee** del sobre, nunca se supone; y una versión sin
receta **se declara** (`version_no_soportada`), no se aproxima con la más parecida.

### ② Las recetas están escritas en el verificador, y NO llaman al sellador

Podrían llamar a `computeAlbaranContentHash` y ahorrarse la repetición. No lo hacen, por el mismo
motivo por el que cada versión canónica se escribe entera y aparte: **una versión cerrada no se
refactoriza.** Un verificador que derive sus reglas del código de sellado de HOY hereda cualquier
cambio futuro de ese código.

El beneficio se midió: sellador y verificador son **dos testigos independientes**, y el test los
cara contra el mismo vector congelado. Si alguien toca el cálculo de v:1, el rojo sale **en el
commit que lo toca**, no diez años después delante de un juez.

### ③ Los vectores de v:1 son LITERALES congelados, no recalculados

Un test que compara el resultado del sellador contra **el resultado del propio sellador** no puede
fallar nunca: si alguien cambia el cálculo de v:1, los dos lados se mueven juntos y el verde se
mantiene. Ese test mide que la función es determinista, no que sigue calculando lo mismo que en
2026. Los tres hashes de `SELLOS_V1_CONGELADOS` se calcularon una vez, contra el sellador de
`1ef584cb`, y están escritos a mano.

### ④ ⚠️ Aquí no se reescribe ningún sobre

Si un albarán no cuadra, el módulo lo **declara**: no lo recalcula, no lo migra, no lo «deja bien».
Mismo espíritu que la regla 29 con las facturas — **lo firmado no se toca, ni siquiera para
arreglarlo**: un sobre reescrito deja de ser prueba de nada, y el arreglo destruiría justo el dato
que documenta el incidente.

No es una promesa en un comentario: el módulo **no importa nada que escriba** (solo `crypto` y un
import de tipos, que desaparece al compilar), y eso se comprueba sobre el AST.

### ⑤ El suelo está en el TIPO, no en la buena voluntad de quien lee el informe

Con cero albaranes examinados la conclusión es `no_se_pudo_mirar`, nunca `todo_cuadra`. «Cero
manipulados» y «no supe mirar» son el mismo número con significados opuestos.

## Lo que se midió

Todo con AST sobre el árbol de `1ef584cb`, no con `grep` (un guard de texto se caza a sí mismo en
el comentario que explica la prohibición):

| Medición | Resultado |
| --- | --- |
| Invocaciones de `computeAlbaranContentHash` en `src/` | **1**, `albaran.service.ts:383` (al firmar) |
| Recálculos / comparaciones del hash en `src/` | **0** — el hallazgo del ticket, confirmado |
| Versiones de sobre que el sellador puede emitir | **{1}**, `albaran.service.ts:336` — `v: 2` NO está en este árbol |
| Lecturas de `Albaran.evidenciaFirma` en `src/` | **1**, `albaran.service.ts:486` (imprimir el PDF) |

**SCRUM-300 (C5) no está en `main`** —espera una migración de esquema que es turno humano—, así que
el mecanismo se construyó contra un árbol donde `v: 2` todavía no existe. El despacho está hecho
para las dos poblaciones igual, y el guard del final se pone ROJO el día que el sellador gane una
versión sin receta.

## Verificado en rojo

Nueve sabotajes, cada uno aplicado sobre el árbol, compilado, corrido y revertido con verificación
byte a byte del fichero restaurado:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| La receta de v:1 lee `lugarEntrega` (= aplicar la regla de v:2 a un sobre v:1) | ① positivo, vectores congelados, y 4 más |
| `verificarSobre` no compara nunca | ② el carácter cambiado, campos vigilados, y 2 más |
| La conclusión con cero examinados pasa a `todo_cuadra` | ③ suelo |
| El despacho cae a la versión más nueva cuando no hay receta | ④ despacho, y el censo |
| El censo deja de contar los sobres que no cuadran | ⑤ censo por versión |
| El verificador «arregla» el sobre que no cuadra | ⑥ no toca nada, y ② |
| El verificador importa `prisma` | ⑥ no puede escribir |
| Se le quita v:1 al recetario | el guard de versiones sin receta, y 8 más |
| **Se reordena UNA clave del canónico v:1 DEL SELLADOR** | **solo** los vectores congelados |

El último es el que justifica el diseño: con el vector recalculado en vez de literal, ese sabotaje
—que es exactamente el que rompe la verificación de albaranes firmados hace años— **no lo detecta
nadie en toda la suite**.

Y el ancla de esta entrada también se probó en rojo: con el sha abreviado, el guard de SCRUM-267
falla nombrando `SCRUM-369.md`.

## Lo que NO cubre

* **Nadie lo llama todavía desde `src/`.** Es deliberado y está en el ticket: dónde se ve es
  decisión de producto (paquete de evidencias de A7, detalle del albarán de C2, o herramienta
  interna) y se toma con el mecanismo ya construido. Hasta que tenga llamador, esto es **un
  mecanismo probado, no una garantía viva en producción**: el sello sigue sin comprobarse solo.
* **No hay adaptador desde filas de la base.** Quien conecte la superficie tiene que resolver
  `cliente`, `emisor`, `emisorNif` y `referenciaTrabajo` **igual que los resuelve
  `buildFirmaEvidencia`** (cadenas `||`, vacío → `null`). El verificador normaliza esos campos
  precisamente para que un `''` mal resuelto no acuse a un albarán intacto, pero la consulta es de
  quien la escribe.
* **No verifica v:2**, porque v:2 no existe en `main`. El guard exige su receta y su vector el día
  que entre; mientras tanto un sobre v:2 se declara no soportado en vez de aproximarse.
* **No mira ninguna población real.** No toca la base: ni producción (prohibida incluso en lectura)
  ni staging. El suelo de «cero examinados» protege el contrato del barrido, no una tanda contra
  datos reales.
* **No detecta una manipulación hecha con acceso a la base**: quien pueda reescribir `lineas`
  también puede reescribir `evidenciaFirma`. Esto detecta que el contenido cambió **después de
  firmar** sin re-sellar; no es una firma criptográfica con clave del cliente.
* **`quoteLineIndex` (SCRUM-367) NO está sellado**, y queda declarado con su propio test. El
  contenido canónico enumera claves fijas, así que un campo nuevo en la línea no cambia el hash —
  que es justo lo que permite que SCRUM-367 sea aditivo y no rompa ninguna firma anterior. La
  contrapartida: ese índice se puede cambiar después de firmar sin que el sello lo note. Es
  trazabilidad interna, no lo que el cliente firmó. Si algún día tuviera que estar protegido, eso
  **no es tocar v:1**: es una versión nueva con su número.

## Hallazgo (regla 37 — se reporta, no se arregla aquí)

En la rama de C5 (`scrum-300-firmado-por`, sin mergear) el comentario que protege el cálculo de v:1
dice: «`tests/scrum300-albaran-firmado-por.test.mjs` verifica un v:1 contra su hash de entonces. Si
tocas esto, ese test es el que te lo dirá». **Medido: no se lo dirá.** Ese test calcula el hash
esperado con `hashComoLoCalculabaV1()`, que llama al propio `computeAlbaranContentHash` — los dos
lados del assert se mueven juntos, así que un cambio en el canónico de v:1 lo deja en verde. El
vector congelado de este ticket es lo que cierra ese hueco; lo que queda pendiente es **corregir la
frase del comentario**, que hoy promete una protección que no da. Va en la rama de C5, no en ésta.

## Ficheros

* `src/modules/jobs/domain/albaranVerificacion.ts` — **nuevo**. El verificador entero: recetas por
  versión, `verificarSobre`, `verificarPoblacion` con censo y suelo. No modifica ningún fichero
  existente (ni el mecanismo de firma, ni el camino de emisión, ni `schema.prisma`).
* `tests/scrum369-verificador-sello.test.mjs` — **nuevo**. 14 tests: controles positivo y negativo,
  suelo, despacho por versión, censo, no-reescritura, lo que el sello NO cubre, y el guard que exige
  receta para toda versión que el sellador pueda emitir.
