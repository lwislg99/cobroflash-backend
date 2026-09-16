# SCRUM-381 · Los dos sembradores rotos, y la capa que nadie cargaba

**Fecha:** 6-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `68a5bfcc19a5fc27dd82a6e1ab06c0cf80d390bd` · 2026-08-06T00:35:01+01:00

**Tanda:** 1852 tests, 1785 pass, 0 fail, 67 skipped — medida sobre la rama YA REBASADA
sobre `68a5bfc` (la de antes del rebase daba 1839/1772; el delta lo trae `main`, no este ticket)

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
> **Un test que fija el estado actual convierte un defecto en un requisito** — éste no falló al
> romperse el import: falló al **arreglarse**.

Es el mismo defecto que SCRUM-378 encontró en el `<script>` comentado de `index.html`, una capa más
abajo. Las dos reglas quedan escritas en `docs/METODO_YAQU.md`.

### 🔴 Y el primer arreglo fue el mismo defecto mirando a otro lado

La primera corrección cambió el `assert.match` por `assert.ok(src.includes('…/barridoDemo.js'))`:
**texto otra vez**, apuntando a la ruta nueva. Eso no arregla el defecto, lo MUDA — volvería a fijar
el siguiente import roto. Lo detectó el asesor preguntando por la línea concreta.

Ahora el test **resuelve el cableado**: `origenDe(seed-demo, 'barridoDemo')` dice de qué fichero
sale de verdad el símbolo, o por cuál de tres motivos no sale (`no_importado` · `no_resuelve` ·
`no_exportado`), cada uno con su mensaje. Y comprueba que ese fichero esté bajo `dist/modules/`, que
es el hallazgo de SCRUM-314: el barrido no puede volver a vivir en la capa `scripts/`. La ruta
exacta deja de importar.

**Las dos filas que separan cableado de ortografía, ambas comprobadas sabotéandolas:**

| Sabotaje | Texto del import | Cableado | El test |
| --- | --- | --- | --- |
| El módulo se mueve a otra ruta válida del dominio | cambia | intacto | **sigue VERDE** ✔ |
| El destino existe pero ya no exporta el símbolo | **no cambia** | roto | **ROJO**, «ya no exporta» ✔ |

Un assert de texto contesta las dos al revés: caería en la primera y aprobaría la segunda.

Resolver tiene que ser tan fácil como deletrear o nadie lo hará, así que vive en
`tests/_imports-estaticos.mjs` y no dentro de un test.

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

## ② El sobre vacío de los sembradores — DECIDIDO por el asesor

`seed-demo.mjs:244/315` y `seed-video.mjs:456` llamaban a `allocateInvoiceNumber` con `opts` vacío,
y SCRUM-207 hizo `camino` y `actor` **obligatorios**. Compilaba porque **un `.mjs` no pasa por
`tsc`**: la obligatoriedad no alcanza a esta capa. Resultado: un número sembrado quedaba en el
`AuditLog` **indistinguible de una emisión real**.

### La decisión (asesor, 6-ago-2026): `ActorTipo += 'semilla'`. `CaminoEmision` NO se toca.

Su razonamiento, que es el que manda sobre la forma del arreglo:

> `camino` contesta **por qué vía se emitió** este número, y un número sembrado **sí se emite por
> una de las vías reales** — el sembrador llama al mismo código. Meterle un `C8` ensuciaría una
> lista que enumera **caminos del producto** con algo que no es un camino del producto.
>
> Lo que de verdad es distinto es **quién lo pidió**: no un profesional, no el sistema actuando por
> un merchant, sino un script de siembra. **`actor` es exactamente el eje donde vive el «esto no es
> real».**

Una sola unión ampliada, y la que significa lo que hay que decir. Con dos condiciones suyas:

* **`sistema` NO se reutiliza. Ni ahora ni como atajo.** Ya lo escribe un camino real
  (`lib/invoicing.ts`, `ref:'ensureInvoiceForCharge'`).
* **`ref` matiza, no clasifica.** Lleva qué sembrador y qué tanda (`seed-demo:paidJob@<ISO>`), pero
  sin ampliar `tipo` el `AuditLog` seguiría diciendo `sistema`.

### Qué declara ahora cada llamada

`camino` **se deriva, no se fija**, porque cambia y tiene que decir la verdad sobre la vía imitada:

| Llamada | `camino` | Por qué |
| --- | --- | --- |
| `seed-demo` · `paidJob` | `C1` | el cliente aceptó el presupuesto desde WhatsApp (`decisionChannel:'whatsapp'`), ya cobrado |
| `seed-demo` · pendiente | `C1` | mismo camino, cobro sin pagar (el «dinero en juego» de la Home) |
| `seed-video` · tramo *i* | `i === 0 ? 'C1' : 'C2'` | el primer tramo nace de la aceptación; los siguientes son collect-rest |

`actor` se define **una vez por script** (`sembrado(punto)`): dos literales en dos sitios se
desincronizan solos, y el que se quede atrás lo hace en silencio.

## Y la medición que llevó al STOP, que sigue siendo el porqué

Antes de tocar nada:

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

**Por eso se paró:** cumplir el principio exigía **un valor nuevo** en una lista cerrada. No toca
`prisma/schema.prisma` (son uniones de TypeScript, no enums de Prisma), pero **sí son listas
cerradas**, y este repo trata ampliarlas como decisión del fundador (regla 5; el propio
`audit.service.ts` lo dice de su lista bloqueante: *«ampliarla es una decisión del fundador, no un
detalle de implementación»*). Ninguna lista enumeraba `ActorTipo` —ni un `switch`, ni un test que la
fijara—, así que ampliarla compiló limpio: la unión existe para que el compilador exija declararla,
no para que nadie pueda tocarla.

## Los dos guards que entran con el valor, y el segundo importa más

### ① Ninguna ruta real puede escribir `semilla`

Derivado del **árbol entero** (`src/**/*.ts`, superconjunto estricto de «las rutas reales»: si
mañana la emisión se dispara desde un servicio, un cron o un webhook nuevo, ya está cubierto). AST,
no `grep` — un guard de texto se caza a sí mismo en la prosa que explica la prohibición.

Lo sostienen tres asertos que se necesitan entre sí: **nadie en `src/` lo escribe**, **el valor
existe** en la unión (si no, «nadie lo escribe» sería verdad por vacío) y **los dos sembradores sí
lo escriben** (si un sembrador deja de declararlo, sus números vuelven a ser indistinguibles).

🔴 **El suelo tumbó el analizador dos veces antes de que este guard significara nada**, y las dos
son de la familia «el censo no reconoce lo que mira»:

1. Solo miraba `tipo: 'literal'`, y `actorDeRequest` escribe
   `tipo: t == null ? 'pro_propietario' : 'pro_equipo'` — **un ternario**. No veía ni un
   `pro_propietario` en todo `src/`, y habría aprobado sin ver nada.
2. Al arreglarlo, el recorrido devolvía el acumulador y **`ts.forEachChild` para en cuanto su
   callback devuelve algo truthy**: de un ternario solo se visitaba la condición. Las dos ramas
   seguían invisibles.

En los dos casos el guard estaba verde. **Lo cazó el suelo, no el guard.**

### ② El sembrador se niega a arrancar contra producción

La protección de verdad: la etiqueta hace **distinguible** un número sembrado; esto impide que
llegue a escribirse en una base real. `seed-demo.mjs` traía escrita su propia condición de
endurecimiento desde SCRUM-208 (29-jul-2026): *«Si algún día se confirma que producción nunca debe
ser destino de una semilla, se endurece con la allowlist de host de SCRUM-118»*. Ese día llegó.

* **Allowlist, no lista negra de producción** (`DESTINOS_SEMBRABLES` en `scripts/_db-guard.mjs`):
  staging, `localhost`, `127.0.0.1`, `[::1]`. Lo desconocido **falla cerrado**. No es preferencia de
  estilo — comprobar `host !== PROD_HOST` es literalmente el defecto que SCRUM-118 quitó de ese
  mismo fichero: deja pasar una prod rotada, un pooler, una IP o un alias.
* **Va ANTES de la confirmación, y el orden es el guard.** Nombrar la base (`SEED_*_CONFIRM`)
  contesta «¿es la que querías?», no «¿se puede sembrar ahí?». Con solo la ceremonia, **teclear el
  hostname de producción bastaba para resembrar producción**: la ceremonia estaba, la prohibición
  no. Ahora son las dos, en orden: identidad y luego intención.
* **Ampliarla es un cambio de código**, no una variable de entorno. Una vía de escape por entorno
  convierte el guard en un trámite («exporta la variable y sigue»), que es como se saltan de verdad.

**⚠️ Sin exponer nada, como pediste:** lo único que sale por pantalla es `host/base` —lo que
devuelve `describirBD`, público y necesario para saber dónde ibas a sembrar—. Un test lo comprueba
con una contraseña de pega dentro de la URL: el mensaje de aborto no contiene la contraseña, ni el
usuario con su separador, ni la URL, ni siquiera un `://`.

### Y de paso, `seed-video.mjs` parseaba la URL a mano

`new URL(dbUrl).hostname` dentro de un `try/catch` — la forma que SCRUM-223 quitó de `seed-demo.mjs`
**después de que publicara una contraseña de producción** (incidente #14: `new URL()` no redacta y
la cadena entera viaja dentro del objeto de error). No filtraba hoy, porque el `catch` no imprimía,
pero sobrevivió por lo mismo que el import muerto: **nadie miró los dos sembradores a la vez**.
Ahora usa `parseBDSegura`, y un guard lo vigila en todo `seed-*.mjs`.

## Verificado en rojo — cada guard, con su sabotaje

| Sabotaje | Sale rojo |
| --- | --- |
| Una ruta real escribe `tipo: 'semilla'` | ① sí, **nombrando `src/lib/invoicing.ts:NN`** |
| …y escondido **dentro de un ternario** | ① sí (la ceguera que el suelo destapó) |
| `PROD_HOST` entra en `DESTINOS_SEMBRABLES` | ② sí |
| La allowlist se degrada a lista negra (`host === PROD_HOST`) | ② sí, por el **host desconocido** |
| El sembrador comprueba el destino **después** de confirmar | ② sí: «CONFIRMA ANTES DE COMPROBAR» |
| El sembrador deja de comprobarlo del todo | ② sí: «NO comprueba el destino» (mensaje distinto) |
| El mensaje de aborto empieza a llevar la URL dentro | ② sí |
| Un sembrador vuelve a `allocateInvoiceNumber(tx, id, {}, …)` | sí, con fichero y línea |
| `seed-video` vuelve a `new URL(<variable>)` | sí, nombrándolo |
| El import del barrido apunta a un fichero inexistente | 314 sí: «QUE NO EXISTE» |
| El destino existe y **no exporta** el símbolo | 314 sí: «ya no exporta» |
| El barrido vuelve a un fichero de `scripts/` | 314 sí: «no es el dominio compilado» |
| `seed-demo` deja de importarlo | 314 sí: «YA NO IMPORTA» |
| El módulo se mueve a otra ruta válida del dominio | **VERDE** (lo correcto: no se rompió nada) |

Cada sabotaje verifica que **la mutación llegó al disco** antes de correr, y restaura comprobando
sha byte a byte. Uno de ellos salió «mutación no aplicada» a la primera y se rehízo: un rojo que no
se inyectó y un verde son indistinguibles en la terminal.

## 🔴 Hallazgo: tres scripts más parsean la URL de BD a mano

El guard de parseo se probó primero contra **todos** los scripts y salió rojo señalando cinco.
Medidos uno a uno — no todos son el mismo caso:

| Script | ¿Es el defecto? |
| --- | --- |
| `backfill-quote-jobid.mjs:46` · `conciliar-auditoria-fiscal.mjs:95` · `preflight-schema-drift.mjs:78` | **SÍ**: `new URL(<var>)` sobre `DATABASE_URL`, la forma del incidente #14 |
| `guard-contraste.mjs:194` | no: `new URL(req.url, …)`, una petición HTTP sin credenciales |
| `backup-dump.mjs:167` | no: extrae la contraseña **a propósito** para `pg_dump` y pasa adelante la URL sin ella |

Los tres primeros **no se arreglan aquí**: otro carril, ninguno bloquea, y ampliar el alcance del
guard sin arreglarlos dejaría la suite en rojo por ficheros ajenos al ticket (regla 37). El guard se
declara con alcance `seed-*.mjs`, derivado del árbol, y el alcance está escrito en su comentario con
esta medición al lado. **Siguiente acción concreta:** sustituir esos tres `new URL` por
`parseBDSegura`; gate: el mismo guard, ampliado a todos los scripts.

## Lo que NO cubre

* **El guard no ejecuta nada**: no dice si un script funciona, dice si **podría arrancar**. Un fallo
  en tiempo de ejecución (una consulta mal escrita) no lo ve nadie todavía. En particular, **ningún
  sembrador se ha ejecutado contra una base en este ticket**: el sobre y el destino se comprueban
  estáticamente.
* **`ActorTipo` no lo valida nada en runtime**: es un tipo de TypeScript, y un `.mjs` no compila. Lo
  que impide que un sembrador escriba otra cosa es el guard, no el compilador.
* **No se toca `CaminoEmision`** — decisión explícita del asesor, con su porqué arriba.
* **No sigue especificadores de paquete** (`@prisma/client`): eso lo resuelve npm.
* **`export *` en un destino** hace que el segundo guard no pueda afirmar nada sobre esos símbolos, y
  se salta esa comprobación en vez de inventarse un rojo.

## Ficheros

* `src/modules/system/audit.service.ts` — `ActorTipo += 'semilla'`, con el razonamiento del asesor
  al lado del valor. **Único fichero de `src/` tocado**; el camino de emisión no se modifica.
* `scripts/seed-demo.mjs` — el import corregido · allowlist antes de la confirmación · el sobre en
  sus dos llamadas.
* `scripts/seed-video.mjs` — allowlist · `parseBDSegura` en vez de `new URL` a mano · el sobre, con
  el camino derivado del tramo.
* `scripts/_db-guard.mjs` — `DESTINOS_SEMBRABLES` y `destinoSembrable()`.
* `tests/_imports-estaticos.mjs` — **nuevo**: resolver un import sin ejecutarlo (`origenDe`).
* `tests/scrum381-scripts-cargables.test.mjs` — **nuevo**, 5 tests (la capa `scripts/` carga).
* `tests/scrum381-semilla.test.mjs` — **nuevo**, 9 tests (los guards ① y ②).
* `tests/scrum314-wipedemo-derivado.test.mjs` — su assert **resuelve** el destino en vez de
  deletrearlo.
* `docs/METODO_YAQU.md` — las dos reglas de esta familia.
