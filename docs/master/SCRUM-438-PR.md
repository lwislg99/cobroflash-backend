SCRUM-438 · v:3 — el sobre se lleva su contenido dentro, y los cinco guards vuelven a verde

**Base: `scrum-438-atestiguar`** (no `main`: la fase 1 sigue sin mergear y las dos ramas comparten `docs/master/SCRUM-438.md`).

| | Antes | Después |
| --- | --- | --- |
| Tanda | 🔴 2674 tests · 2595 pasan · **5 caen** · salida **1** | ✅ 2691 tests · 2617 pasan · **0 caen** · salida **0** |
| `guards:entrada` | — | ✅ 4 guards, 17 tests |

**Medido contra:** `origin/main` = `e171c752f61231bec77dc2c22ecc7f82167d964c` · `2026-08-10T18:58:26Z`

---

## 🔴 EL DIFF DEL CAMINO DE SELLADO, ENUMERADO (enmienda 2 del asesor)

Todo en `src/modules/jobs/domain/albaran.service.ts`. Nada más de este PR toca emisión.

**① `ALBARAN_CONTENIDO_VERSION_ACTUAL`: `2` → `3`.** Una línea.

**② `FirmaEvidencia` y `AlbaranContenidoParams` ganan `contenidoCongelado?: ContenidoCongelado`.**
Opcional en los dos: v:1 y v:2 no lo tienen y **no se rellena a posteriori jamás**. Cero schema —
cabe en `evidenciaFirma`, que ya es `Json?`.

**③ `contenidoCanonico` gana la rama `if (version === 3)`, entera y aparte.** Las trece claves en el
mismo orden que v:2; lo que cambia es que las cinco salen de `contenidoSegunVersion(3, …)`, o sea
del bloque. Las ramas de v:1 y v:2 **no se tocan ni un carácter**.

**④ `obraSegunVersion` cambia de firma y de cuerpo.** Era:

```ts
if (version === 1) return fuentes.jobDireccion || null;
return fuentes.lugarEntrega || null;
```

Ahora delega en `contenidoSegunVersion`, que resuelve los cinco y **lanza** ante una versión que no
conoce. Las 36 combinaciones de v:1, v:2 y sin-firmar dan **exactamente** lo de ayer — hay test que
lo cara contra el cuerpo viejo transcrito a mano.

**⑤ `buildFirmaEvidencia` construye el bloque UNA sola vez, antes del hash.** Es lo más importante
del diff: **lo que se sella y lo que se guarda salen del MISMO objeto**. Construirlo dos veces es
exactamente cómo se consigue que el sello certifique algo distinto de lo que el sobre dice haber
sellado, y no se detectaría hasta que alguien verificara, meses después.

```ts
const contenidoCongelado: ContenidoCongelado = {
  obra: a.lugarEntrega || null,
  referenciaTrabajo: job?.titulo || null,
  cliente,
  emisor: merchant?.legalName || merchant?.name || null,
  emisorNif: merchant?.taxId || null,
};
```

**Cero consultas nuevas:** `job`, `customer` y `merchant` ya estaban leídos. Las cinco resoluciones
son las de v:2. 🔴 **`obra` lleva `|| null`, no `??`** — ver el defecto ② más abajo.

**⑥ La llamada al hash pasa los cinco DESDE el bloque** (`obra: contenidoCongelado.obra`, etc.) más
`contenidoCongelado` entero. Se siguen pasando sueltos porque `computeAlbaranContentHash` es el
mismo para las tres versiones y v:1/v:2 sí los usan; sus valores son **los del bloque**: una sola
fuente, no dos.

**⑦ El sobre devuelto gana `contenidoCongelado` — el MISMO objeto** con el que se calculó el hash.

**⑧ `ensureAlbaranPdf` pasa la versión GUARDADA por el despachador.** Sin esto un v:3 caería en la
rama de v:2 e imprimiría `lugarEntrega` **coincidiendo por accidente**. ⚠️ Consume **dos de cinco**;
ver el hueco ① — está escrito junto a la línea.

Y fuera del sellado, `src/modules/jobs/domain/jobDireccion.ts` **sale como BINARIO en el diff**
(sus sondas llevan un byte `NUL` dentro, ya era así). Su cambio: la sonda pasa de dos valores a
tres y se envuelve en `try/catch` que devuelve `true`.

---

## Los cinco guards: ninguno se relajó

**GRUPO A · SCRUM-371 ×2 — reapuntado de fondo.** El invariante del asesor, **derivado del árbol**:

> para CADA versión, la receta lee EXACTAMENTE las fuentes que declara `FUENTES_POR_VERSION` para
> esa versión — ni una de más, ni una de menos.

Las dos listas se leen del **producto**: `RECETAS_POR_VERSION` del AST del verificador (y de ahí qué
receta atiende cada versión, **no del nombre**) y `FUENTES_POR_VERSION` del módulo de declaración.
Se exige además que **las dos hablen de las mismas versiones**. Una v:4 entra sola, y entra **en
rojo** hasta que receta y declaración digan lo mismo: **no caduca**.

La comparación vieja —adaptador contra sellador— **no se retiró**: se reapuntó al bloque congelado,
que es donde el sellador resuelve hoy los cinco. Sigue cazando un `||` cambiado por un `??`, que es
lo que acusaría de manipulación a toda la población v:1/v:2 de golpe.

Dos guards que antes no existían: el adaptador **entrega** todas las fuentes que alguna receta
declara, y el bloque le llega **DESDE EL SOBRE**, no reconstruido de filas vivas.

**GRUPO B.** A ninguno se le cambió un 2 por un 3. SCRUM-374 pineaba la v:2 disfrazada de invariante
(*«la obra sale de `lugarEntrega`»*); el defecto que cerró era que **la versión de hoy no puede leer
`Job.direccion`**, y eso es lo que pinea ahora. SCRUM-415 SUELO ya derivaba las versiones: le
faltaban unas fuentes que ejercieran el delta. SCRUM-424 R4 no era un test caducado — **la sonda
lanzaba**.

## 🔴 Dos defectos VIVOS que salieron al cerrarlos

**① `versionLeeJobDireccion` reventaba con un sobre v:3** → la ruta que escribe `Job.direccion`
habría devuelto **500**. Y una versión desconocida se responde ahora **`true` (depende → no se
escribe)**: negarse a escribir es un 409 que alguien resuelve mirando; escribir sobre una firma que
sí dependía deja esa firma sin poder verificarse (regla 29).

**② El `??` que rompía la CONDICIÓN DURA.** `contenidoSegunVersion` colapsaba con `?? null` donde el
`obraSegunVersion` al que sustituye usaba `|| null`. **Medido: 12 de 36 combinaciones divergían.**
El PDF de un v:1/v:2 con una fuente vacía imprimiría la cadena vacía donde hoy no imprime nada, y
`recomputarHashDeEvidencia` sacaría **otro hash sobre un documento intacto**. Restaurado en tres
sitios.

## ✅ La medición: la `v` SÍ está atada al hash

`recetaV2` = `03ca0042…` ≠ `recetaV3` = `7cfb5a6d…` sobre el mismo contenido. Bajar la `v` de 3 a 2
sale como **`hash_de_otra_version`** y lo nombra. Las dos consecuencias que se temían **no se dan**.

## Los seis rojos, probados por mutación con post-condición en disco

Cada uno comprueba que **cambió el fichero que se dice** antes de correr la tanda. Detalle en el
§3 quater del máster.

## 🔴 Huecos declarados

1. **El PDF resuelve los cinco pero consume dos.** `cliente`, `emisor` y `emisorNif` siguen en vivo.
   En un v:3 cuyo cliente cambie de razón social, el PDF imprimirá la nueva y el sello certifica la
   antigua. No se arregla aquí: los objetos `customer`/`merchant` llevan campos que **no** están
   entre los cinco, y decidir qué viene del sobre es decisión del asesor.
2. **Nada ejecutado contra base de datos.** No existe todavía ningún sobre v:3 en ninguna parte.
3. **`recomputarHashDeEvidencia` lanzaría con un v:3.** Sigue sin llamadores fuera de su fichero.
4. **`jobDireccion.ts` sale como binario en el diff** (byte `NUL` preexistente).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
