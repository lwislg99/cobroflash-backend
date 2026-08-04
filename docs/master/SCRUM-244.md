# SCRUM-244 · RGPD: el borrado ya no revienta a mitad — y el resto queda a dictamen

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** el ticket **NO se cierra**: 1(b) bloqueado por
dictamen del asesor fiscal. Lo entregado aquí es **1(a)**, que no tiene gate (no toca el camino de
emisión: solo el servicio de borrado, que hoy no llama ninguna ruta).

## Lo que se midió antes de tocar nada, porque cambió el ticket entero

El ticket pedía «exponer una ruta». La medición dijo que **exponerla tal cual habría sido peor que
no tenerla**, por dos motivos independientes:

### 1 · `Reconciliation` no estaba en el borrado, y no fallaba callando

De los 24 modelos del schema, **tres no tienen `merchantId`**: `Merchant` (la raíz), `Event` y
`Reconciliation`. Los dos últimos cuelgan de `Charge`. `Event` estaba tratado a mano y bien;
`Reconciliation` **no estaba en ninguna parte** (`grep -c reconciliation` → 0).

**Y no se quedaba huérfana: bloqueaba.** Su `@relation` no declara `onDelete`, luego la FK es
**RESTRICT**. El `deleteMany` de `charge` habría **fallado** con **ocho tablas ya vacías**. El
servicio devuelve `ok:false` en vez de lanzar (para eso está diseñado), pero el merchant queda
partido por la mitad: media identidad borrada y la otra media viva. Un borrado parcial de datos
personales es peor que ninguno — lo dice la cabecera del propio servicio, y esto lo demuestra.

### 2 · Por qué el guard existente no podía verlo, que es el hallazgo que importa

El guard de cobertura de SCRUM-192 **deriva del schema los modelos con columna `merchantId`** y
exige que cada uno esté cubierto. Es correcto para lo que mira. Pero estos modelos **no tienen esa
columna**: pertenecen a un merchant *por herencia*. Para ese guard **no existen**, y su verde nunca
habló de ellos. El único sitio donde existían era una lista escrita a mano — **y una lista a mano
no avisa de lo que le falta**. Es la familia de SCRUM-239/235/272: *el medidor mira un sitio y el
defecto vive en otro*.

## Lo entregado — 1(a)

- **`COLGADOS_DE_CHARGE`** (`src/modules/system/domain/borradoMerchant.ts`): los modelos que
  pertenecen a un merchant sin tener su columna, declarados con su motivo, y borrados en bucle
  filtrando **por su padre** (`where: { charge: { merchantId } }`) **antes** que ese padre.
  `event` se movió ahí desde su línea suelta; `reconciliation` se añadió.
- **`tests/scrum244-colgados-de-otro-modelo.test.mjs`** (10 tests): guard que **deriva del
  schema** los modelos sin `merchantId` que apuntan con `@relation` a uno que sí lo tiene, y exige
  que estén cubiertos. El siguiente que aparezca sale en rojo **el día que se declare**, no el día
  que alguien pida su baja.
- **Suelo anti-verde-hueco:** la derivación tiene que seguir encontrando ≥2 modelos. Comprobado
  cegándola: con el patrón roto ve 0 y **falla**, en vez de pasar sin mirar.
- **Control negativo:** ningún `deleteMany` puede salir con `where` vacío — sin él, «borrar por el
  padre» podría degenerar en «borrar la tabla entera» y los otros tests seguirían verdes.

**Rojo obligatorio, hecho por el mecanismo y no por un símbolo que falta:** el primer intento falló
por `SyntaxError` (la constante aún no existía), que no prueba nada. Se introdujo `COLGADOS_DE_CHARGE`
**con solo `event`** —el estado del mundo expresado en la forma nueva— y entonces salieron
**exactamente 2 fallos de 10**, nombrando `reconciliation (cuelga de Charge)`. Con el arreglo, 10/10.

## Lo que NO se ha hecho, y por qué

- **1(b) · Qué se borra y qué se anonimiza → DICTAMEN.** La lista de borrado incluye `invoice` y
  `auditLog`. La **regla 29** dice que una factura emitida jamás se edita ni se borra, y el
  **art. 17.3.b RGPD** exceptúa del derecho de supresión lo necesario para cumplir una obligación
  legal. Anonimizar *dentro* de la factura tampoco es gratis: la **huella de VeriFactu se calcula
  sobre su contenido y va encadenada**, así que tocarla destruye el valor probatorio que la
  conservación busca. Escrito como **pregunta cerrada (a/b/c + plazo)** en
  `docs/legal/PREGUNTAS_ASESOR.md` §E punto 13, con el análisis dentro para que el asesor no tenga
  que reconstruir el contexto. Referencia cruzada en `RGPD_TRATAMIENTO_DATOS.md` (pregunta 7).
- **3 · Quién dispara el borrado → DECIDIDO: opción C, mixta** (fundador, 3-ago-2026). El
  profesional **solicita** desde su cuenta —queda registrado, con fecha, y eso arranca el plazo
  legal— y el fundador **ejecuta** tras revisar. **El motivo de la decisión, que es el que manda:**
  lo que hoy falta para cumplir **no es la capacidad de borrar —ya existe— sino poder DEMOSTRAR
  que se atendió y cuándo.** C compra eso barato. El autoservicio completo (opción B) queda para
  cuando 1(b) esté resuelto, porque **un botón que borra facturas es peor que no tener botón**.
- **2 · Portabilidad: no se construye todavía, pero está medida.** El módulo de exports
  (`/admin/exports/datos.zip`, seis datasets en CSV + PDFs + XML VeriFactu, filtrable por fechas,
  con `requireRole('admin')` y filtrado por merchant) **sirve como base**: CSV cumple el
  «estructurado, de uso común y lectura mecánica» del art. 20. Le faltan tres cosas concretas:
  **(i)** siete datasets — `products`, `providers`, `teamMembers`, `attachments`,
  `maintenancePlans`, `albaranes`, `customerEvents`; **(ii)** una puerta de autoservicio (hoy exige
  rol admin y vive en `/admin`, no en «mis datos»); **(iii)** el registro de que se ejerció el
  derecho — el plazo legal es de **un mes** y sin registro no se puede demostrar que se atendió.

## Hallazgo de otro carril (reportado, no arreglado — regla 9)

`npm test` en `origin/main` está en **rojo por 1 test ajeno a esto**:
`tests/scrum273-registro-por-fichero.test.mjs` falla porque el commit `ba80273` metió la entrada de
**SCRUM-252** en `docs/YAQU_MASTER.md` cuando SCRUM-273 ya exige que los tickets nuevos vayan a
`docs/master/SCRUM-<n>.md`. Verificado que es previo y ajeno: el diff de esta rama no toca `docs/`
más que en ficheros nuevos, y la entrada está en `origin/main`. **Suite: 1088 tests, 1 fallo, y ese
fallo es ése.**

---

# SCRUM-244 · punto 3 (parte 1 de 2): EL REGISTRO de que se ejerció el derecho

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

> **Nota sobre el ancla.** Esta sección se midió contra `origin/main` =
> `dd61eb09b7a22121217c19dbbdd2ec13ab939873` · 2026-08-03T20:04:00+02:00. Va **en prosa y no como
> campo `Medido contra:`** a propósito: el fichero está en el censo heredado de SCRUM-267, cuya
> decisión escrita es que esas tres entradas **no se rellenan**. Ponerle el campo habría bajado el
> censo y obligado a editar el guard de otro ticket — así que el dato queda declarado sin cambiar
> una decisión que no es mía. Si prefieres que el fichero salga del censo, es una línea.

## Qué resuelve, y no es «poder exportar»

Exportar ya se puede. Lo imposible hoy es **demostrar que se atendió, y cuándo** — que es
justamente lo que se incumple: el art. 12.3 da **un mes desde la recepción de la solicitud**. Sin
registro no se sabe si un caso lleva tres días o cinco semanas, ni se puede probar después que se
respondió a tiempo.

## Dos instantes, porque el flujo tiene un humano en medio

Opción **C MIXTA** (decisión del fundador, 3-ago-2026): el profesional **solicita** desde su cuenta
—eso arranca el plazo— y el fundador **ejecuta** tras revisar. No son dos nombres para el mismo
hecho: hay una revisión humana entre medias, así que dos fechas no son teatro, son la forma del
flujo. El autoservicio completo espera a 1(b): **un botón que borra facturas es peor que no tener
botón.**

## Sin tocar schema, y sin tabla nueva

`AuditLog` ya traía todo: `createdAt` (los dos instantes), `entityId` (la correlación) y los dos
índices que las consultas necesitan (`[merchantId, action, createdAt]` y
`[merchantId, entityType, entityId]`). **Cero migraciones, cero índices nuevos** — y el schema es
el único freno duro del proyecto, así que evitarlo no es elegancia, es no abrir esa puerta.

**La correlación, que es lo único no obvio:** la fila de ATENCIÓN guarda en `entityId` el `id` de
la fila de SOLICITUD. Así «lo pendiente» es una diferencia de conjuntos entre dos columnas
indexadas — sin buscar dentro del JSON de `meta` y sin inventar un identificador propio.

## La pregunta que justifica el módulo

`solicitudesPendientes(cliente, { dias })` contesta **«¿cuántas solicitudes llevan más de N días
sin atender?»**. Un registro que guarda las dos fechas y no puede cruzarlas tiene el dato y no la
respuesta, y la respuesta es lo único que sirve para demostrar cumplimiento.

## Las dos acciones son BLOQUEANTES

Mismo criterio que `exportacion_fiscal`: registrar de menos es lo único que esto existe para
impedir. Una solicitud perdida en silencio deja **un plazo legal corriendo que nadie sabe que
corre**. Fire-and-forget aquí sería construir la prueba y tirarla si el `INSERT` falla.

`recordAuditOrThrow` pasa a devolver la fila (`Promise<{id}>`). Es **aditivo**: los llamadores
fiscales que la ignoran siguen igual. Hacía falta para que la atención pueda apuntar a su
solicitud sin releer la fila recién escrita, que sería una carrera contra uno mismo.

## Un defecto que cazó el propio test, al primer intento

`fechaLimite` usaba `setMonth`, que trabaja en hora **local**. Medido con el proceso en
`Europe/Madrid`: una solicitud del 1-mar a las 10:00Z daba límite el 1-abr a las **09:00Z** — el
cambio de hora CET→CEST cae en medio y **se comía una hora del plazo**, siempre hacia el lado
peligroso. Y peor que la hora: el resultado **dependía del huso del servidor**, así que el mismo
caso vencía en dos instantes distintos según dónde corriera el proceso. Corregido a `setUTCMonth`.

El plazo se cuenta por **mes de calendario, no por 30 días**: en un mes de 31, contar 30 adelanta
el vencimiento un día entero sobre una obligación legal.

## Verificado en rojo, tres veces, cada una en un mecanismo distinto

1. **La correlación se rompe** (la atención deja de apuntar a su solicitud) → cae nombrando que es
   «la fila que PARECE cumplimiento sin serlo».
2. **La consulta deja de excluir las atendidas** → caen dos tests: el registro diría que todo está
   al día, que es la mentira cara.
3. **Las acciones dejan de ser bloqueantes** → cae el que impide el fire-and-forget.

Las tres revertidas, verde comprobado después, y las inyecciones fueron en `dist`: `src` limpio.
**Suite ungated: 1162 tests, 0 fallos.**

## 🔴 Lo que NO tiene todavía, dicho aquí y no en una nota al pie

**Nadie lo dispara.** No hay ruta que registre una solicitud: eso es «la puerta», el paso
siguiente. Es a conciencia —el orden acordado es registro → cobertura → puerta— pero mientras
tanto **este mecanismo existe y no lo llama nadie**, que es exactamente el patrón que este
proyecto persigue. Queda escrito para que no se lea como terminado.

Y **la ruta de supresión sigue sin mergearse**: hoy ejecutarla destruiría el `AuditLog` fiscal.
Registro sí, ejecución no, hasta el dictamen.
