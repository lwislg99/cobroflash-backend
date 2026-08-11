# SCRUM-463 · ¿ve el firmante lo que está firmando?

**Fecha:** 11-ago-2026 · **Carril:** H (offline) / evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `2ff61f01bf4c1afffaf43bf85304e00dff3e10d1` · 2026-08-10T23:24:26Z

**Paso 0:** `docs/master/SCRUM-463.md` no existía en `main` ni en ninguna rama remota — y **su
ausencia no era la prueba**: se buscó además cobertura previa del hecho (ningún test comprobaba qué
ve el firmante). La rama no la tenía ningún worktree (`git worktree list` antes de nada).

---

# 🔴 LA RESPUESTA: NO. Y PARO AQUÍ.

**En el camino que usa el bloque H —el cliente firmando en el móvil del profesional— el firmante no
ve NADA del contenido.** No las líneas, no la cantidad, no el importe, no el cliente.

Qué se enseña y dónde es **decisión de producto**, y tocar la pantalla de firma roza el sellado
(regla 38). **No lo he arreglado.** Aquí está qué falta en cada camino.

## 1 · Los DOS caminos de firma, y qué ve el firmante en cada uno

| | Camino 1 · **el panel** | Camino 2 · **la página pública** |
| --- | --- | --- |
| Quién firma | **el cliente, en el móvil del pro** (H0 §1) | el cliente, en su propio móvil |
| Pantalla | `public/dashboard/js/albaranDetailView.js` → pad en `signaturePad.js` | `src/modules/jobs/app/routes/albaranPublic.routes.ts` |
| Dispara | `albaranDetailView.js:441` | `albaranPublic.routes.ts:398` |
| **Líneas** | 🔴 **NO** | ✅ sí (`class="lines-table"`, concepto + cantidad) |
| **Cantidad** | 🔴 **NO** | ✅ sí |
| **Importe** | 🔴 **NO** | 🔴 **NO** |
| **Cliente** | 🔴 **NO** | ✅ sí (*«Hola, {cliente} 👋»*) |

## 2 · Cómo se midió — EJERCITADO, no leído

**Camino 1.** Se carga el dashboard entero con el banco de SCRUM-417 y se **pinta la vista de
verdad** (`renderAlbaranDetailView`), con un albarán VALORADO cuyos valores son distintivos. La
vista **no revienta y pinta nodos** — y en el DOM que sale **no está ninguno de los cuatro**.

> ⚠️ El banco no resuelve `destinoEfectivo` y la vista reventaba en `cubos[destino].push`. Se le
> suplió esa pieza — que decide **dónde va cada botón**— porque no es lo que se mide: suplir el
> reparto de botones no puede fabricar unas líneas que la vista no pinte.

**Y el remate, que hace el diagnóstico accionable:** no es un fallo de pintado ni de datos que no
llegan. **La pantalla ni siquiera lee esos campos.** Leído con `leerFuente` (SCRUM-193), que quita
los comentarios:

| campo | menciones en el fichero | **en código** |
| --- | --- | --- |
| `concepto` | 1 | **0** — la única está en un comentario |
| `cantidad` · `precioUnitario` · `lineas` · `totales` | 0 | **0** |

*«Mencionar no es hacer»*, literal: contar la mención habría dicho que la vista lo usa.

**Camino 2.** La página se construye en el servidor; se mide qué hay en el marcado que se le manda
al cliente. Pinta la tabla de líneas y saluda al cliente por su nombre. **No menciona
`precioUnitario`, `calcAlbaranTotales` ni `totales`**: un albarán **VALORADO se firma sin que el
cliente vea un solo importe**.

## 3 · La medición 3 — el estado precargado sin red — **respondida, y no es lo que parecía**

[S2] destapó el síntoma al probar modo avión, y las líneas **sí viajan** en el paquete. Pero el
ejercicio de arriba se hizo con **el albarán completo en memoria**, sin red de por medio, y la
pantalla **tampoco los pintó**.

> **La causa no es la precarga.** Es que esa pantalla no pinta el contenido **en ningún estado**.
> Arreglar la precarga no habría cambiado nada.

## 4 · Por qué esto no es interfaz

Un albarán firmado sirve para ganar la discusión de *«yo no pedí eso»*. Si quien firma no vio las
líneas, **la firma prueba mucho menos de lo que creemos** — y se la vendemos al profesional como su
garantía. El sistema puede demostrar que el contenido no se ha tocado desde la firma (SCRUM-438) y
que el cliente firmó lo que tenía delante (SCRUM-361); lo que **no** puede demostrar es que lo que
tenía delante fuera el albarán.

## 5 · Lo que entrego, y lo que NO

**Entrego la medición y su testigo.** `tests/scrum463-firmante-ve-el-contenido.test.mjs` (6 tests):

* **SUELO**: los dos caminos de firma se encuentran — si el censo diera cero, «ninguno lo esconde» y
  «no supe mirar» serían el mismo verde.
* **CONTROL NEGATIVO**: el banco **sí** ve el contenido cuando una vista lo pinta. Sin él, «no lo
  pinta» sería indistinguible de «no supe leer».
* **CONTROL POSITIVO dentro del test de lectura**: el lector no devuelve vacío ni se come el código.

> 🔴 **Los tests DOCUMENTAN lo medido; NO exigen que siga roto.** Están escritos para caer si esto
> cambia **en cualquier dirección**, y su mensaje lo dice: *«si faltan MENOS, alguien lo ha
> arreglado: actualiza esta lista y avisa, es la buena»*. Si el fundador prefiere no dejar un
> testigo con esa forma, se retira sin perder la medición — está aquí.

**NO entrego** ningún arreglo: ni pintar líneas en el panel, ni importes en la pública. Tampoco he
tocado el sellado, el verificador, la precarga (SCRUM-460), la cola (H3), `prisma/schema.prisma` ni
ningún albarán de producción.

## 6 · Lo que hay que decidir (y no es mío)

1. **¿Qué debe ver el firmante en el móvil del pro?** Hoy: nada. Es el camino que el bloque H da por
   bueno.
2. **¿Debe ver el importe un albarán VALORADO?** Hoy no lo ve en ninguno de los dos caminos.
3. **¿Y el pad?** `signaturePad.js` tampoco muestra contenido: título, campos de firmante, canvas y
   botones. Si la respuesta a (1) es «sí», el sitio natural es el pad o la pantalla de detrás.
