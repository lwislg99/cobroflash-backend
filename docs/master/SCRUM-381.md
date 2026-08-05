# SCRUM-381 · Los dos sembradores rotos, y la capa que nadie cargaba

**Fecha:** 6-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `df4057b4e05f1106a6439df04cac5befa707c8f2` · 2026-08-06T00:14:24+01:00

**Tanda:** 1830 tests, 1763 pass, 0 fail, 67 skipped

## El defecto de fondo

**Un script que nadie ejecuta no tiene forma de decir que está roto.** `scripts/seed-demo.mjs`
llevaba tickets enteros **sin poder ni arrancar** y nadie se enteró, porque ninguna suite tocaba la
capa `scripts/`. Se descubrió porque otra sesión necesitó datos a la una de la madrugada.

## ① El import muerto — y el test que lo sostenía

`seed-demo.mjs:45` importaba `barridoDemo` de `./_wipe-demo.mjs`, un fichero que **SCRUM-314
(`cbc2880`) borró** al mover el barrido al dominio, sin actualizar el import. Arreglado: ahora
importa de `../dist/modules/system/domain/barridoDemo.js`, que es la convención de esta capa
(`_conciliacion-fiscal.mjs`, `gen-registros-sample.mjs`).

🔴 **Y había un test FIJANDO el import roto.** `scrum314-wipedemo-derivado.test.mjs:170` afirmaba:

```js
assert.match(src, /from '\.\/_wipe-demo\.mjs'/, '🔴 seed-demo no importa el barrido derivado');
```

Comprobaba el **texto** del import y **nunca que el destino existiera**, así que sostuvo el defecto
en verde: el script no podía arrancar y el test decía que sí. Apareció al arreglar ①, porque el
arreglo lo puso rojo.

> **Un guard que fija una ruta sin resolverla vigila la ortografía, no el cableado.**

Es el mismo defecto que SCRUM-378 encontró en el `<script>` comentado de `index.html`, una capa más
abajo. El assert ahora apunta a la ruta real, y **de que esa ruta exista se encarga el guard nuevo**.

## ③ El guard: la capa `scripts/` se comprueba sin ejecutarla

Importar de verdad un sembrador **lo ejecuta**: abre conexión y siembra. No hace falta para contestar
la pregunta —«¿este script podría siquiera arrancar?»—, así que se resuelve **estáticamente**:

1. cada `import`/`require` relativo **resuelve a un fichero que existe**;
2. cada **símbolo con nombre** está exportado por su destino (el fichero puede existir y ya no
   exportar lo que se le pide: revienta igual, y el mensaje de Node es peor de leer).

Con su **suelo**: ≥10 scripts, ≥5 con dependencias relativas, y `dist/` construido — si no, el guard
aprobaría por ausencia en vez de comprobar.

### Verificado en rojo

| Sabotaje | Sale rojo |
| --- | --- |
| **Devolver el defecto ① exacto** (`from './_wipe-demo.mjs'`) | el guard, **nombrando `seed-demo.mjs:45 → ./_wipe-demo.mjs`** |
| Borrar en memoria un fichero que 5 scripts importan (`_db-guard.mjs`) | el guard, nombrándolo — y antes comprueba que **alguien lo importa**, o el sabotaje no probaría nada |
| Quitar del destino el símbolo `barridoDemo` | el lector de exportaciones lo nota |
| Cambiar el import a otra ruta inexistente | **los dos guards**: 314 («ya no importa el barrido derivado») y 381 («no resuelve») |

El primero es el que decide: **el guard, aplicado al árbol de ayer, habría cazado el defecto ① el
día que se introdujo.**

## 🔴 ② PARADO — necesita decisión del fundador

`seed-demo.mjs:244` y `seed-video.mjs:456` llaman a `allocateInvoiceNumber` con `opts` vacío, y
SCRUM-207 hizo `camino` y `actor` **obligatorios**. Medido antes de proponer nada:

| | Tipo | Dónde | Valores |
| --- | --- | --- | --- |
| `camino` | **unión cerrada de TypeScript** (no enum de Prisma) | `invoiceNumber.service.ts:23` | `C1…C7` |
| `actor` | interfaz TS `{ tipo, teamMemberId?, ref? }`; `ActorTipo` es unión cerrada TS | `audit.service.ts:162-169` | `pro_propietario · pro_equipo · cliente_final · sistema · psp` |

**Quién escribe cada uno, hoy:**

* `C1` `quotes.routes.ts:606` · `C2` `jobs.routes.ts:775` · `C3` y `C4` `quotesAdmin.routes.ts:201/404`
  · `C5` `invoicesAdmin.routes.ts:853` · `C6` `lib/invoicing.ts:316` · `C7` `invoicing.service.ts:43`.
  **Los siete están ocupados por un camino real.**
* `actor`: `actorDeRequest()` da `pro_propietario`/`pro_equipo`; `quotes.routes.ts:609` escribe
  `cliente_final` con `ref: 'quote_token'`; `lib/invoicing.ts:320` escribe `sistema` con
  `ref: 'ensureInvoiceForCharge'`. **`psp` está declarado y no lo escribe nadie.**

**¿Hay ya un valor que signifique «esto no es una emisión real»? NO.** Los siete caminos describen
vías reales, y `sistema` **ya lo usa un camino real** (`ensureInvoiceForCharge`), así que reutilizarlo
rompería el principio: un número sembrado dejaría de distinguirse de una emisión de verdad mirando el
`AuditLog`.

**Por qué paro:** cumplir el principio exige **un valor nuevo** —en `CaminoEmision`, en `ActorTipo` o
en ambos—. No toca `prisma/schema.prisma` (son uniones de TypeScript, no enums de Prisma), pero **sí
son listas cerradas**, y este repo trata ampliarlas como decisión del fundador (regla 5; el propio
`audit.service.ts` lo dice de su lista bloqueante: *«ampliarla es una decisión del fundador, no un
detalle de implementación»*).

**El único hueco que no exige valor nuevo** es `actor.ref`, que es texto libre —hoy lleva
`'quote_token'`, `'ensureInvoiceForCharge'`—. Pero `ref` **matiza**, no clasifica: `tipo` seguiría
diciendo `sistema`, que es lo que usa un camino real. **No lo hago sin que lo decidas.**

## Lo que NO cubre

* **Los sembradores siguen sin poder emitir** hasta que ② se decida: el import está arreglado y el
  script arranca, pero la llamada a `allocateInvoiceNumber` sigue sin `camino`/`actor`.
* **El guard no ejecuta nada**: no dice si un script funciona, dice si **podría arrancar**. Un fallo
  en tiempo de ejecución (una consulta mal escrita) no lo ve nadie todavía.
* **No sigue especificadores de paquete** (`@prisma/client`): eso lo resuelve npm.
* **`export *` en un destino** hace que el segundo guard no pueda afirmar nada sobre esos símbolos, y
  se salta esa comprobación en vez de inventarse un rojo.

## Ficheros

* `scripts/seed-demo.mjs` — el import, corregido, con el porqué al lado.
* `tests/scrum381-scripts-cargables.test.mjs` — **nuevo**, 5 tests.
* `tests/scrum314-wipedemo-derivado.test.mjs` — su assert ya no fija un fichero inexistente.
