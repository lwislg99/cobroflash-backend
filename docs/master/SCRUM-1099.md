# SCRUM-1099 · Censo por AST — toda escritura a `Invoice` en el árbol

**Medido contra:** `origin/main` = `6e97b236863ff3de08dfcd8b8308959cbdce32ab` · 2026-09-23T16:50:58Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`) · **Rama:** `scrum-1099-censo-ast-escritores-invoice`

> Cierra el hueco (d) que J6 declaró sin medir en **SCRUM-1097** (censo de 18 vías de emisión):
> «me ancle a `allocateInvoiceNumber` + un barrido manual de `scripts/`/cron/exports; si hay una
> vía que escriba `Invoice` sin pasar por ahí y sin ser un seed ya censado, no la he visto». El
> orquestador lo pidió por AST, no por `grep`: un censo anclado a una premisa no comprobada
> acredita la premisa, no el hecho.

Solo lectura. No toca `src/`, no toca producción, no construye el guard.

---

## 1 · El instrumento

`scripts/censo-escritores-invoice.mjs` (committeado, reutilizable). AST con el paquete
`typescript`, mismo patrón que `scripts/censo-escritores-del-arbol.mjs` (SCRUM-808). Población:
**todos** los `.ts` de `src/` y `.mjs` de `scripts/`, recursivo. Busca:

1. Llamadas literales `<algo>.invoice.<método>(…)` con método ∈ {create, createMany, upsert,
   update, updateMany, delete, deleteMany}.
2. SQL crudo (`$executeRaw`/`$executeRawUnsafe`/`$queryRaw`/`$queryRawUnsafe`) cuyo texto nombra
   la tabla `invoices` (`prisma/schema.prisma:926`, `@@map("invoices")`).
3. NO CONCLUYENTES: notación de corchete (`algo['invoice']`) y desestructuración
   (`const { invoice } = …`) — el límite declarado de una indirección, igual que SCRUM-808: no se
   cuentan como «no escribe», se nombran para revisión manual.

Control positivo: `crearFacturaEmitida.ts:65` tiene que salir como escritor de EMISIÓN — si no
sale, el instrumento se declara CIEGO (exit 2) en vez de dar un censo vacío.

```
node scripts/censo-escritores-invoice.mjs
```

### Error propio (A9)

El primer intento reventaba con `Cannot read properties of undefined (reading 'kind')` en todo
fichero que usara la forma con plantilla (`` prisma.$queryRaw`…` ``) — la mitad de los sitios
reales. Causa: `TaggedTemplateExpression` guarda su "callee" en `.tag`, no en `.expression`
(que es la propiedad de `CallExpression`); el código asumía el mismo nombre para los dos tipos de
nodo. Lo cazó la propia ejecución (`node scripts/…`), no una relectura del código.

---

## 2 · El resultado

Población: **541 ficheros** (297 `.ts` en `src/` + 244 `.mjs` en `scripts/`).

### 2.1 · Escrituras de EMISIÓN — `create` / `createMany` / `upsert`

**Exactamente 4, cero `createMany`, cero `upsert` en todo el árbol:**

| # | Sitio | ¿Ya censado en SCRUM-1097? |
|---|---|---|
| 1 | `src/modules/invoicing/domain/crearFacturaEmitida.ts:65` (`tx.invoice.create`) | **Sí** — el ÚNICO escritor de aplicación; los 10 caminos de SCRUM-1027 llegan aquí SIEMPRE después de `allocateInvoiceNumber` |
| 2 | `scripts/seed-demo.mjs:359` | **Sí** — vía #12, solo `DEMO_ID=1` |
| 3 | `scripts/seed-demo.mjs:419` | **Sí** — vía #12, solo `DEMO_ID=1` |
| 4 | `scripts/seed-video.mjs:529` | **Sí** — vía #13, merchant ES sintético sin override → hoy lanza `invocing_es_disabled` y revierte |

**Ninguno nuevo.** Las 4 son exactamente las que SCRUM-1097 ya tenía censadas por otro método
(grep dirigido + lectura). El censo de 18 vías **deja de apoyarse en la premisa** «no he visto
más» y pasa a apoyarse en esta medición: no hay una quinta.

### 2.2 · SQL crudo que nombra `invoices` — 3 sitios, los 3 SOLO LECTURA

| Sitio | Qué hace |
|---|---|
| `scripts/censo-etiquetas-del-documento.mjs:108` | `SELECT` sobre `information_schema.columns` (censo de esquema) |
| `scripts/censo-etiquetas-del-documento.mjs:122` | `SELECT COUNT(*)` de columnas por tabla |
| `scripts/censo-etiquetas-del-documento.mjs:164` | `SELECT COUNT(*)::int FROM invoices` |

Cero `$executeRaw`/`$executeRawUnsafe` que nombre `invoices` en todo el árbol — ningún INSERT/
UPDATE/DELETE crudo sobre la tabla. (El `INSERT INTO "${t}"` genérico de `backup-restore.mjs`
—ya censado en SCRUM-1097 vía #—no lo captura este instrumento por diseño: su tabla es una
VARIABLE de bucle, no el literal `invoices`; sigue siendo el mismo hallazgo ya declarado, con su
propio guard —`destinoDesechable`— fuera de producción y staging.)

### 2.3 · NO CONCLUYENTES — 0

Cero notaciones de corchete y cero desestructuraciones de `invoice` en los 541 ficheros. El
instrumento tiene la capacidad de encontrarlas (declarado en el código, sin caso real que lo
ejercite hoy) — no es lo mismo «no las busqué» que «las busqué y no hay», y aquí es lo segundo.

### 2.4 · Bonus, fuera del alcance de la regla 24 — `update`/`updateMany`/`delete`/`deleteMany`

24 sitios (11 en `src/`, 13 en `scripts/`) editan o borran filas de `invoices` ya existentes —
esto es objeto de la **regla 29** (una factura emitida no se edita ni borra), no de la 24, y
**no era lo que pedía este ticket**. Revisión rápida, no exhaustiva línea a línea: los que tocan
campos fiscales (`vfHash`, `type`) son `selladoEstado.ts` (sellado) y `verifactu.service.ts`
(alta/anulación) — el mismo camino ya analizado en `AUDITORIA_CAMINO_EMISION.md`; el resto son
estado (`paid`/`annulled`), `pdfUrl`/`qrData`, o `deleteMany` de limpieza en scripts de staging
(`clean-staging-tests.mjs`, `seed-staging.mjs`, `e2e-critico.mjs`). Nada saltó como sospechoso,
pero **esto NO es un censo de regla 29**: si hace falta esa pregunta, es un ticket propio con su
propio instrumento.

---

## 3 · Veredicto

El censo de 18 vías de **SCRUM-1097** ya no depende de «no he visto una quinta»: la depende de
que **la única función de `src/` que inserta una fila en `invoices` es `crearFacturaEmitida`**, y
los únicos otros dos insertores de todo el árbol son los dos seeds ya censados. Medido por AST
sobre 541 ficheros, con control positivo y sin NO CONCLUYENTES. El hueco (d) queda cerrado.

## 4 · Lo que no se ha tocado

`src/`, producción, el guard de solo lectura (siguiente encargo, con su propio GO y sus propios
límites).
