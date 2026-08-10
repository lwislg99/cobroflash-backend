# SCRUM-429 · PASO 0: el cliente de Prisma compartido — y la causa no era la que dije

**Medido contra:** `origin/main` = `9060820d550d894c3461c341cc57d41ee54c9680` · 2026-08-10T19:49:52+02:00
**Rama:** `scrum-429-cliente-prisma`

**10-ago-2026, 19:49 CEST (UTC+0200)** · commit `797b6e868ad849e5c5bff1f28b418a247b2cec56`

## 🔴 Lo primero: mi propio diagnóstico de hace una hora era falso

Reporté que la caída de las 18:52 la había provocado **otra sesión** regenerando en el
`node_modules` compartido. **No.** Medido:

```
wt-226\node_modules          → DIRECTORIO REAL, no junction
wt-226\node_modules\.prisma  → real
```

**Mi `node_modules` es propio y nadie me lo tocó.** Lo que cambió fue **mi rama**:
`prisma/schema.prisma` ganó 2 líneas entre mi rama duplicada y la buena —
`feat(SCRUM-425): columna clave_idempotencia en Albaran`— y **el cliente generado no viaja con la
rama**. Lo deduje del síntoma en vez de mirarlo.

## (1) Cómo está montado hoy — medido

| | |
|---|---|
| worktrees con `node_modules` **junction** | **96** |
| worktrees con `node_modules` **real** | **45** |
| sin `node_modules` | 25 |

No todos apuntan al mismo sitio: la mayoría a `cobroflash-backend\node_modules`, pero **hay una
cadena** — `wt-215-probe`, `wt-216-consolidar` y `wt-248-fixtures` apuntan a
`wt-209-conflicto\node_modules`. Eso es lo que explica que un `git worktree remove` vaciara el
compartido una vez: siguió la cadena.

**Lo que se comparte es TODO `node_modules`**, no solo el cliente: no hay ninguna granularidad hoy.

## 🔴 Y por tanto: HAY DOS CAUSAS, no una

| | causa | a quién afecta | cómo se distingue |
|---|---|---|---|
| **(A)** | tu propio **cambio de rama**: el schema viaja con la rama, el cliente no | a ti solo | `git log -1 -- prisma/schema.prisma` |
| **(B)** | **otro worktree**, si tu `node_modules` es junction | a todos los que comparten | `(Get-Item node_modules).LinkType` |

**La mía fue la (A).** Y el mensaje del guard **solo nombraba la (B)** — con esa frase delante,
diagnosticar mal era lo normal. **Aislar el cliente no resuelve la (A)**, que es inherente: cualquier
worktree que cambie de rama necesita regenerar.

## (2) Las opciones, con su coste

| | |
|---|---|
| `node_modules` completo | **413 MB** · 17.131 ficheros |
| solo el cliente generado (`.prisma`) | **24,7 MB** · 18 ficheros |
| **libre en `D:`** | **2,1 GB** |

### ① `node_modules` propio por worktree — **IMPOSIBLE HOY**

96 × 413 MB = **~39,6 GB**. Hay **2,1 GB**. No caben ni cinco. **La descarta el disco, no una
opinión.**

### ② `output` por worktree en el `generator` — exige GO, y además arrastra

Pondría el cliente fuera de `node_modules`. Pero **cambia de dónde se importa**: hoy todo el código
hace `from '@prisma/client'`, que re-exporta desde `node_modules/.prisma/client`. Con `output`
propio habría que tocar **todos los imports** de `src/`, y eso es mucho más que un cambio de schema.
`prisma/schema.prisma` es territorio del fundador: **no lo he tocado y no traigo diff**, porque
antes de pedir GO hay que decidir si se acepta el arrastre de los imports.

### ③ Aislar **solo el cliente** (24,7 MB por worktree)

**Es lo único que cabe**: 4 worktrees activos = **99 MB**. Exige que `node_modules` deje de ser un
junction entero y pase a ser un directorio real con enlaces por paquete y `.prisma` propio — un
pnpm a mano. **No lo he construido**: toca el `node_modules` compartido, y la instrucción era parar
y decirlo antes. **Aquí paro.**

## (3) La que decide: ¿alguna resuelve sin paso manual?

**Ninguna de las tres, y por un motivo que el encargo no contemplaba:** las tres atacan la (B), y
**la (A) sigue viva con todas**. Un cambio de rama deja el cliente viejo aunque el `node_modules`
sea propio — **es exactamente lo que me pasó a mí hoy con un `node_modules` real**.

Lo único que resuelve **las dos sin paso manual** es que la regeneración **ocurra sola cuando el
schema y el cliente divergen**, en vez de fallar. Y eso **solo es seguro si el cliente no se
comparte** — con junction, regenerar automáticamente le rompería la medición a quien esté corriendo
tests en ese momento. O sea: **③ + regeneración automática**, en ese orden y no al revés.

**Es una propuesta, no una entrega.** Necesita GO porque toca el `node_modules` compartido.

## Verificación

**Control positivo, la mitad que SÍ pude ejecutar:** regeneré en `wt-226` (que ya está aislado) y el
cliente compartido **no se movió**:

```
compartido ANTES: 19:11:12     ·  DESPUÉS: 19:11:12   (intacto)
el mío     ANTES: 19:05:05     ·  DESPUÉS: 19:46:10   (regenerado)
```

> **NO PUDE PROBAR EL AISLAMIENTO EN LA OTRA DIRECCIÓN.** Exigiría regenerar desde un worktree
> junctionado, y eso **rompe el cliente de las sesiones vivas** — justo el daño que el ticket quiere
> evitar. Cómo se ejecutaría cuando haya ventana: anotar la marca de tiempo del cliente de dos
> worktrees aislados, regenerar en uno, y comprobar que el otro **no cambia de marca y sigue en
> verde** con `npm run guards:entrada` y `node scripts/_prisma-client-guard.mjs`.

**Lo entregado hoy** es el mensaje del guard, que nombraba una sola causa. Ahora nombra las dos, dice
cómo distinguirlas y avisa de que en el caso (B) **arreglar el tuyo rompe el de los demás**. Rojo por
`$?`: recortar una de las dos causas → cae nombrando cuál falta.

**El guard de divergencia no se toca en lo que hace.** Es lo único que ha hecho detectable esto seis
veces.

## Si se aprueba ③, lo que cada worktree tendría que hacer UNA vez

Todavía no hay comando que dar: depende de la forma que se apruebe. **Lo digo para que conste que no
lo hay**, en vez de dejarlo en el aire.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el `node_modules` compartido · el comportamiento del guard · el camino de
emisión.

Ficheros: `scripts/_prisma-client-guard.mjs` (solo el mensaje) ·
`tests/scrum235-cliente-por-columnas.test.mjs`.
