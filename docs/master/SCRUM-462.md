# SCRUM-462 · ¿puede hoy un albarán quedar FIRMADO sin evidencia?

**Fecha:** 11-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `e928472efd9acd2d377f5b6f44a5cda39ed69745` · 2026-08-10T23:08:35Z

**Paso 0:** `docs/master/SCRUM-462.md` **no existía** en `main` ni en ninguna rama remota, y la rama
**no la tenía ningún worktree** (`git worktree list`, comprobado antes de nada — la lección de 460).

## 1 · La respuesta, en una línea

**NO. Hoy ningún camino puede dejar un albarán `firmado` sin sobre.** Y la hipótesis de las fechas
se confirmó — **pero no por las fechas**.

## 2 · El hecho que abre el ticket

De **4** albaranes con `estado = 'firmado'` en producción, **3 sin sobre** y `sobre_sin_v = 0`. No
son sobres viejos sin versionar: son documentos marcados como firmados sin nada que lo respalde.

## 3 · Medición 1 · ¿desde cuándo se escribe `evidenciaFirma`?

Del **historial**, no de la intuición: `git log -S"evidenciaFirma" --reverse -- src/`

> **22-jul-2026**, commit `2863836a` — *«SCRUM-68: evidencias probatorias de la firma del albarán»*.
> Ese commit toca `albaranes.routes.ts`, `albaranPublic.routes.ts` y `albaran.service.ts`: es la
> escritura, no una mención.

| Albarán | Fecha | ¿Antes del mecanismo? |
| --- | --- | --- |
| merchant 22 | 2026-06-16 · sin sobre | **sí** |
| merchant 18 | 2026-07-14 · sin sobre | **sí** |
| merchant 22 | 2026-07-16 · sin sobre | **sí** |
| merchant 22 | 2026-07-23 · **v:1** | no — un día después |

## 4 · Medición 2 y 3 · pero eso no bastaba

Una ruta que marcara `firmado` sin construir sobre **produciría exactamente los mismos datos**. Así
que se midió el **código de hoy**, en las **dos** superficies:

| Superficie | Dónde | Qué hace |
| --- | --- | --- |
| El panel del profesional | `albaranes.routes.ts:686` | `const evidencia = await buildFirmaEvidencia(…)` y `evidenciaFirma` en el **mismo** `data` |
| La página pública del cliente | `albaranPublic.routes.ts:398` | idéntico |

Y las dos **sin `.catch`**: si el sobre falla, el `update` no se ejecuta y el albarán se queda sin
firmar — que es lo correcto.

> ⚠️ **Un censo por texto habría contado mal.** De las **cinco** apariciones de `estado: 'firmado'`
> en `src/`, **tres son `where`** (lecturas: `paquete.repo.ts`, `albaranBarrido.ts`,
> `pendientesFacturar.service.ts`) y solo **dos son `data`**. Por eso el censo va por **AST**.

## 5 · 🔴 El guard, que es la entrega tanto como la medición

Que hoy esté cerrado no lo mantiene cerrado: **nada impide que mañana alguien añada la tercera
ruta**. Es el patrón de SCRUM-417.

**Invariante:** toda escritura que marque `firmado` construye y guarda su sobre. Y **no basta con
que la clave esté** —`evidenciaFirma: null` la tendría y sería exactamente el defecto—: se exige que
el valor no sea nulo **y** que la función llame a `buildFirmaEvidencia`.

* **SUELO ×3, por separado**: ficheros recorridos · escrituras encontradas · escrituras que marcan
  firmado (≥1). Un suelo agregado puede tapar otro.
* **CONTROL POSITIVO dentro del mismo test**: las **dos** superficies salen clasificadas, y son
  exactamente dos. Una lista vacía haría verdad cualquier «todas la construyen».
* **CONTROL NEGATIVO**: las otras **seis** escrituras —`pdfUrl`, token, `invoiceId`, emitir, el
  PATCH— no pueden hacerlo caer. Un guard que acusa a los que hacen lo correcto se desactiva al
  primer roce.
* **El hueco del censo, cubierto**: el censo mira *actualizaciones*, así que hay test propio de que
  **ningún albarán nace firmado** (dos creaciones, ninguna lo marca), con su suelo.

### Un solo censo, dos preguntas

El censo de escrituras ya existía dentro de `scrum361-version-al-firmar.test.mjs` (en `main`) para
otra pregunta. Se **extrae** a `tests/_censo-escrituras-albaran.mjs`: copiarlo habría dejado dos
censos del mismo hecho que se desincronizan en cuanto uno mejore — la familia de defectos que esta
casa persigue.

### Los rojos por el mecanismo — cada uno con post-condición en disco

| Mutación | Cae diciendo |
| --- | --- |
| una **tercera ruta** marca firmado sin sobre | *«…albaranes.routes.ts:400 · no guarda `evidenciaFirma` · no llama a `buildFirmaEvidencia`»* (+2 tests) |
| el sobre se guarda **vacío** | *«…albaranPublic.routes.ts:395 · la guarda a NULL»* |
| un `.catch` sobre `buildFirmaEvidencia` | *«…envuelve `buildFirmaEvidencia` en un `.catch`. Parece prudencia y es el defecto»* |
| un albarán **nace** firmado | *«UN ALBARÁN PUEDE NACER YA FIRMADO: · jobs.routes.ts:838»* |

> **Y un hallazgo de la segunda mutación:** `evidenciaFirma: null` **no compila** — el tipo de Prisma
> para un `Json?` no lo admite (`TS2322`). Esa vía la cierra el compilador. La que **sí** compila es
> `undefined`, y ésa la caza el guard: la mutación se rehízo con ella, porque una que ni siquiera
> llega a ejecutar la tanda es **una prueba no ejecutada**, no una superada.

### 🔴 Tres veces el escáner fui yo

1. **Una regex golosa acusó a código correcto.** `buildFirmaEvidencia\([\s\S]*?\)\.catch` **salta el
   cierre real del paréntesis** y casó con el `.catch` de `ensureAlbaranPdf` —que es otra llamada y
   ahí es **correcta**—. Rehecho **por AST**, con control negativo de que el `.catch` que sí existe
   se ve.
2. **Ampliar el censo ajeno no fue gratis.** Al extraerlo lo amplié a `create`/`upsert` «por
   completitud», y eso **cambió el significado del guard de SCRUM-361**: una creación pone `lineas`
   y no incrementa `version` porque nace en 1. Devuelto a su alcance, y las creaciones medidas
   aparte con su propio test.
3. **Mi post-condición no comprobó que el fichero siguiera parseando**: el corte dejó un `}`
   huérfano. Ahora pasa `node --check` antes de correr.

## 6 · Lo que NO se ha tocado

**Ni un albarán de producción** — esos tres se quedan como están: son prueba de algo, aunque sea de
esto; no hay credencial de producción y no se ha pedido. Tampoco el sellado, el verificador, las
versiones del sobre (SCRUM-438 está cerrado), `prisma/schema.prisma` ni `public/dashboard/`.

**No se ha arreglado nada porque no había nada que arreglar**: el camino ya estaba cerrado. Lo que
faltaba era saberlo y que siguiera siéndolo.
