# SCRUM-359 · H4 — los tres relojes, y la ventana que hace contrastable la hora del móvil

**Medido contra:** `origin/main` = `a224d363d2020336e97bc6478a17c45c08eaffca` · 2026-08-11T22:33:59+01:00
**Rama:** `scrum-359-los-tres-relojes` · **Carril:** H (albarán sin red) · **Gate:** sin gate, corre en `npm test`

> La rama salió de `687d262b` y el censo se midió contra ese árbol; `main` avanzó a `a224d363`
> durante la sesión y se metió dentro antes de verificar. Ninguno de los commits nuevos toca el
> camino de firma, la cola ni la precarga — comprobado.

## PASO 0

- **`docs/master/SCRUM-359.md` no existía.** Su ausencia no prueba nada, así que se buscó por
  **contenido** y no por número, sobre todas las cabezas remotas: `firmadoEn`, `recibidoEn`,
  `ultimaConexion`, `scrum359` → **cero commits** en cualquier rama. `SCRUM-359` como cadena solo
  aparece en `docs/master/SCRUM-307.md`, el censo del bloque H, que ya el 10-ago dejó dicho que los
  tres ficheros no existían.
- **`main` no se movió al arrancar:** `687d262b` antes y después del fetch. Sí se movió más tarde
  (`a224d363`), y se metió dentro — ver la nota de la cabecera.

---

## 1. El defecto, medido

Cuando se firma **sin red**, el trazo se queda en la cola del móvil y sube al abrir la aplicación —
que puede ser **días** después (H5 midió el desalojo de iOS a los 7 días). El servidor sella
`firmadoAt = new Date()` **en el instante de la llegada**:

- `src/modules/jobs/app/routes/albaranes.routes.ts:697` (in situ, y por donde entra la cola)
- `src/modules/jobs/app/routes/albaranPublic.routes.ts:400` (remoto)

Y `src/modules/jobs/domain/albaran.service.ts:312` lo dice por escrito: *«ISO 8601, reloj del
servidor (no del cliente)»*. **El albarán acredita como hora de firma un momento en el que el
cliente ya no estaba delante.**

🔴 **Y la hora en que se firmó de verdad ya se captura — lo que pasa es que se tira.**
`public/dashboard/js/colaDeFirmas.js:88` guarda `encoladaEn: Date.now()`, y su comentario dice
*«es cuándo el cliente firmó, no cuándo se intentó subir»*. Pero `:279-283` declara lo contrario
para el envío: *«`claveIdempotencia`, `albaranId` y `encoladaEn` son NUESTROS … no viajan»*.

---

## 2. 🔴 EL CENSO — y cambia el plan del encargo

El suelo de la ventana no es «la última vez que ese móvil hizo algo»: es **el evento más reciente
de NUESTRO servidor, con NUESTRO reloj, anterior a la llegada de la firma**. Los cuatro candidatos
del encargo, uno a uno:

| # | candidato | ¿registrado con fecha? | medida |
|---|---|---|---|
| **a** | entrega del paquete de **precarga** (SCRUM-460) | 🔴 **NO** | `GET /admin/precarga` (`precargaAdmin.routes.ts:27`) construye el paquete y lo devuelve. **Cero `create`/`update`, cero `auditLog`.** `precarga.service.ts` solo lee. |
| **b** | cualquier **petición autenticada** posterior | 🔴 **NO** | `requireAuth` (`authMiddleware.ts:15-36`) lee la sesión y rellena `req`. No escribe. Y **`AuthSession` no tiene `updatedAt`** — no hay dónde se marcaría. |
| **c** | último **drenado con éxito** de la cola (SCRUM-358) | ⚠️ **no como tal** | El drenado ocurre en el navegador. Su único efecto observable en el servidor es el `firmadoAt` de **otra** firma, así que solo existe si hubo otra. |
| **d** | `AuthSession` | 🔴 **NO (actividad)** | `usedAt` se escribe **una sola vez**, al canjear el magic link (`auth.service.ts:218`), y `:215` impide reescribirlo. `createdAt` sí sirve, pero es el suelo más ancho. |

> **El encargo daba (a) por «el suelo garantizado» —*«éste SIEMPRE existe para una firma offline»*—.
> Medido: como acto ocurre siempre; como dato registrado, no existe.** Es la diferencia entre que
> algo pase y que quede constancia de que pasó, y es justo lo que este censo tenía que separar.

### Lo que SÍ existe hoy, y es de nuestro reloj

| fuente | dónde se escribe | alcance |
|---|---|---|
| `Albaran.enviadoParaFirmaAt` | `albaranWhatsApp.service.ts:133`, `new Date()` | solo canal remoto |
| `Albaran.updatedAt` | `@updatedAt` de Prisma | siempre — leído **antes** de escribir la firma |
| `Albaran.createdAt` | `@default(now())` | siempre; el más ancho |
| `AuthSession.createdAt` | `@default(now())` | la sesión con la que se firmó |
| `AuditLog.createdAt` | `@default(now())` | solo acciones concretas, no peticiones |

### 🔴 Las que NO pueden ser suelo, y por qué importa

`Albaran.fecha` y `Albaran.fechaEntrega` son **editables en borrador** (medido en el esquema).
Usarlas como suelo haría que el reloj del dispositivo se contrastara contra **un dato del propio
dispositivo**: el contraste sería circular y siempre saldría «coherente».

Por eso `elegirSuelo` **no acepta una fecha suelta**: acepta una fecha **con su procedencia**, y la
procedencia tiene que estar en `FUENTES_DE_SUELO`. La lista es el mecanismo, no una etiqueta.

### Cuál se elige

**El más reciente de los que existan**, evaluado antes de escribir la firma. Cuanto más reciente,
más estrecha la ventana y más dice el contraste. Hoy, en la práctica: `enviadoParaFirmaAt` en el
canal remoto y `updatedAt` en el resto. Con la marca de precarga registrada (§5) el suelo pasaría a
ser mucho más estrecho justo en el caso que importa —el offline—, que es la razón por la que su
columna va en el diff.

---

## 3. Lo construido: `src/modules/jobs/domain/ventanaDeFirma.ts`

Dominio **puro**: no lee la base, no escribe y **no toca el camino de firma**.

- `elegirSuelo(candidatos, techo)` — el más reciente, descartando los posteriores al techo (un
  evento nuestro registrado *después* de que la firma llegara no acota nada hacia atrás, y daría
  una ventana imposible que haría «desfasadas» todas las firmas).
- `contrastarReloj({ horaDispositivo, candidatosSuelo, llegadaAlServidor })` → `coherente` ·
  `desfase_adelantado` · `desfase_atrasado` · `ventana_desconocida` · `sin_hora_dispositivo`.
- `cruzaDias(ventana, zona)` — lo hace **observable**; no lo resuelve (§6).

**El desfase se declara con su magnitud y NUNCA se corrige.** No hay ninguna función que ajuste la
hora del dispositivo, y un test lo vigila sobre la fuente: un valor «arreglado» es indistinguible de
uno correcto y destruye la anomalía que hacía falta ver.

**Los bordes cuentan como dentro.** Con cobertura, la hora del móvil y la llegada son casi el mismo
instante; si el borde fuera «fuera», marcaríamos como reloj desfasado la mitad de las firmas del
producto.

---

## 4. 🔴 EL DIFF DE ESQUEMA — PREPARADO Y PARADO

`prisma/schema.prisma` es del fundador. **No se ha tocado.** El diff se generó con la herramienta de
la casa (`scripts/preview-migracion.mjs`: CLI local por ruta, nunca `npx`) comparando el esquema
actual contra una copia con las columnas, en un fichero temporal que se retiró después.

**Control positivo de la herramienta: OK.** Es aditivo, todo nullable, **sin pérdida de datos**:

```sql
-- AlterTable
ALTER TABLE "albaranes" ADD COLUMN     "firmado_en_dispositivo_at" TIMESTAMP(3),
ADD COLUMN     "ventana_suelo_at" TIMESTAMP(3),
ADD COLUMN     "ventana_suelo_fuente" TEXT;
```

```prisma
  // SCRUM-359 (H4) · LOS TRES RELOJES. Al lado del sobre, nunca dentro.
  firmadoEnDispositivoAt DateTime? @map("firmado_en_dispositivo_at")
  ventanaSueloAt     DateTime? @map("ventana_suelo_at")
  ventanaSueloFuente String?   @map("ventana_suelo_fuente")
```

**El tercer reloj no necesita columna:** la llegada al servidor **es** `firmadoAt`, que ya se
escribe con `new Date()` del servidor. Lo que cambia no es el dato, es que deja de ser el único.

⚠️ **`firmadoEnDispositivoAt` se llama así a propósito.** Viene del reloj del móvil y el usuario lo
controla: el nombre impide que alguien lo lea dentro de seis meses como si fuera hora nuestra.
Prohibición del fundador que sigue en pie: **jamás se presenta la hora del dispositivo como si fuera
la nuestra, y no se oculta la de obra** — es la que dice cuándo se firmó de verdad.

### La cuarta columna que NO se pide todavía

Registrar **la entrega del paquete de precarga** daría el suelo más estrecho en el caso offline, que
es el que importa. No va en este diff porque es una decisión aparte —¿columna en `AuthSession`,
tabla propia, `AuditLog`?— y este ticket ya tiene su STOP abierto. Queda declarado.

---

## 5. 🔴 Lo que FALTA para que esto llegue al profesional, y por qué no está aquí

Tres pasos, en este orden, y el primero no es mío:

1. **El fundador aplica el diff de §4.** Sin columnas no hay dónde guardar dos de los tres relojes.
2. **`encoladaEn` tiene que VIAJAR.** Hoy `subirFirmaDeLaCola` lo excluye a propósito. Es un campo
   nuevo en el cuerpo del `POST /admin/albaranes/:id/firmar`.
3. **Cablear `contrastarReloj`** en los dos caminos de firma, justo donde hoy se hace
   `const firmadoAt = new Date()`.

> ⚠️ **El paso 3 es el que roza el STOP de la regla 38**, y por eso se para aquí. Leer el camino de
> firma es libre; **modificarlo no**. Los tres datos van **al lado** del sobre y no dentro —el sobre
> v:3 congela cinco campos (`albaranVerificacion.ts:85`) y meter tiempos dentro sería un v:4 del
> formato, que toca el sellado—, pero aun así el paso 3 **añade una escritura al endpoint que
> sella**, y en el diff eso no se distingue de tocar el sellado. Va con GO explícito, no de paso.

**Consecuencia honesta:** la verificación exigida *«los tres datos se guardan SIEMPRE, también con
cobertura»* **todavía no se puede cumplir**, porque no se guarda ninguno. Lo que sí está construido
y probado es la lógica que lo decide, y `contrastarReloj` es indiferente al camino: recibe los tres
instantes y no sabe si hubo red. Cuando se cablee, se cablea en los dos sitios o el test ⑥ lo dice.

### 🔴 Y ese hueco lo cazó un guard ajeno: el tope de SCRUM-411 sube de 7 a 8

`ventanaDeFirma.ts` es **dominio que nadie puede alcanzar**, y `tests/scrum411-exports-inalcanzables.test.mjs`
lo puso en rojo con su nombre dentro. Es exactamente para lo que existe: *«un módulo de dominio sin
llamadores pasa todos los tests y entra verde, así que su ticket se cierra y el cableado que falta
deja de estar en ninguna lista»*.

**El guard no se ha relajado: se ha seguido su contrato**, que es el que él mismo documenta y ya
ejerció SCRUM-460 —*«se sube con su fecha y su motivo en vez de cablearlo a la fuerza»*—. El tope
sigue siendo **exacto** (su segundo assert exige igualdad, así que no queda holgura) y el número es
la constancia de esta deuda mientras dure. **Baja a 7 el commit que cablee** `contrastarReloj`.

Cablearlo a la fuerza para que el número no subiera habría sido saltarse el STOP de la regla 38
además de vaciar el guard.

---

## 6. ⚠️ La ventana que CRUZA DÍAS — se declara, no se resuelve

El ancho de la ventana es la duración de la desconexión, y H5 midió que puede ser de **días**. Un
albarán acredita una entrega de **un día concreto**. Si el suelo cae el martes y el techo el jueves,
**nuestros datos no dicen en qué día se firmó**: solo lo dice el reloj del dispositivo, que es justo
el que no controlamos. La ventana lo acota, no lo determina.

`cruzaDias` lo hace observable y **pregunta en hora local** (`Europe/Madrid` por defecto): en UTC una
firma de las 23:30 de Madrid cae en otro día, y «qué día fue» es una pregunta local porque local es
el día en que se factura.

**Qué hacer con ello es decisión del fundador y microcopy del asesor.** No se resuelve aquí, y sobre
todo **no se oculta**: era la instrucción del encargo y es lo que impide que aparezca dentro de tres
meses en una discusión con un cliente.

---

## 7. Microcopy — **no se propone texto todavía, y es deliberado**

Este ticket no pinta nada: sin las columnas de §4 no hay dato que enseñar, y sin cablear no hay
veredicto que redactar. **Proponer ahora un texto sería pedirle al asesor que apruebe algo que no
tiene dónde ir**, y medir su caja daría números de un elemento que no existe — justamente lo que el
encargo prohíbe («no escribas como justificación ningún número que no hayas medido tú»).

Lo que sí queda declarado es **qué tendrá que aprobarse** cuando haya superficie, que son tres
estados distintos y no se pueden decir con el mismo texto:

| estado | qué afirma | por qué no vale el texto de al lado |
|---|---|---|
| `coherente` | la hora del móvil encaja con lo que podemos probar | no es «verificado»: es «no contradice» |
| `desfase_*` | el reloj del dispositivo está desfasado, con su magnitud y sentido | **no puede sonar a acusación de fraude**: un móvil con la hora mal es lo más común |
| `ventana_desconocida` | no hay evento nuestro anterior con el que acotar | **opuesto** a «ventana estrecha», y decir «no consta» aquí es obligatorio |

La caja se medirá con el CSS real a 390 y 320 px **cuando exista el elemento que la ocupa**.

---

## 8. Verificación

- **Tests de este ticket: 16, todos en verde.** Positivo (dentro, y los bordes dentro), los **dos**
  negativos (adelantado y atrasado), el suelo, el cruce de días y dos que atan la premisa al árbol.
- `npm test` → **3267 tests · 3190 pass · 0 fallos · 77 saltados.** Ninguno de los 77 es de este ticket: todos gateados por `QA_DB_TEST` o `LIBRO_PG_URL`.
- Línea base **medida** sin el fichero de este ticket → **3251.** 3251 + 16 = 3267 — medido, no restado de cabeza.
- `npm run guards:entrada` → **4 guards, 17 tests, rc=0.**
- Marcadores por el guard **oficial** (`tests/scrum393-marcadores-de-conflicto.test.mjs`) →
  **6 tests, 0 fallos: 0 `<<<`, 0 `===`, 0 `>>>`.**

### Los rojos, con su mensaje literal

Probados **sobre código ya commiteado** (`e2c255ad`) y devueltos con el editor.

| # | qué se rompe | qué cae |
|---|---|---|
| ① | se quita la comparación contra la ventana | **3 tests**, y el que decide dice: `🔴 LA FECHA DE LA FIRMA DEPENDE DE UN RELOJ QUE EL USUARIO CONTROLA. Una hora dos semanas posterior a la llegada de la propia firma pasa por buena, y el albarán acredita esa fecha ante un cliente.` |
| ② | `elegirSuelo` deja de exigir que la fuente esté en `FUENTES_DE_SUELO` | **1 test**: `🔴 se ha aceptado como suelo una fuente que NO está en FUENTES_DE_SUELO … con una fecha que el usuario edita, el contraste se vuelve circular.` |

---

## 9. Huecos declarados

1. **No se guarda nada todavía.** §5. El ticket entrega el censo, la lógica y el diff; el guardado
   necesita el esquema y un GO para tocar el endpoint de firma.
2. **La ventana no determina el día** cuando cruza días. §6. Declarado, no resuelto.
3. **El suelo hoy es ancho.** Sin la marca de precarga, en el caso offline el suelo más reciente
   suele ser `updatedAt` del albarán, que puede ser de bastante antes de la desconexión. La ventana
   sigue siendo válida —acota de verdad— pero acota menos de lo que podría.
4. **`AuditLog` como suelo no se ha ejercido.** Está en `FUENTES_DE_SUELO` porque su `createdAt` es
   nuestro y sirve, pero ningún candidato lo alimenta hoy: registra 14 acciones concretas, ninguna
   por petición. Queda disponible, no usado.
5. **Nada verificado en yaqu.app**: no hay superficie que abrir. La verificación es en Node.
