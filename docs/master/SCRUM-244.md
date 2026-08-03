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
