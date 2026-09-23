# SCRUM-1097 · El guard de acreditación INVOICING_ES contra producción

**Medido contra:** `origin/main` = `64cabf5af9d2431c173d2a7916bb2270412e7f01` · 2026-09-23T18:24:46Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`) · **Rama:** `scrum-1097-guard-acreditacion-invoicing-es`

**GO:** del fundador, 23-sep-2026, con el encargo explícito de que lo corriera una sesión, no él.

---

## 0 · El censo de 18 vías (parte previa de este ticket) — CERRADO, sin re-medir

Una sesión anterior entregó, vía comentario de Jira, un censo de 18 vías por las que podría salir
un documento de facturación para un merchant ES real: 57/57 ejercitadas, 2 skip declarados.
Conclusión: **hoy, por código, ningún merchant ES real puede emitir** — falla cerrado en las 18;
la única vía es humana y deliberada (`scripts/cambiar-flag-fiscal.mjs` contra producción).

El propio censo declaró un hueco sin medir: *«si hay una vía que escriba `Invoice` sin pasar por
`allocateInvoiceNumber` y sin ser un seed ya censado, no la he visto»*. Ese hueco (d) **ya está
cerrado**, por **SCRUM-1099** (censo por AST de toda escritura a `Invoice` en 541 ficheros, merge
`350d48cf`, PR #1734): exactamente 4 sitios que insertan una fila en `invoices` en todo el árbol,
los 4 ya censados, ninguno nuevo. **No se repite aquí** — es lectura de partida, no medición propia
de esta rama.

Este ticket es el **segundo encargo**: el guard que vigila que esa conclusión siga siendo cierta.

---

## 1 · El guard — `scripts/guard-acreditacion-invoicing-es.mjs`

«Acreditado» = merchant con `country = 'ES'`, que NO es el demo (**id=1, regla 8** — exclusión
explícita por filtro `id <> 1`, nunca por efecto de otro criterio), y que cumple UNA de dos:

- **(a)** `merchant.flags.INVOICING_ES_ENABLED === true` (override por merchant, `core/flags.ts`);
- **(b)** tiene alguna `Invoice` de tipo fiscal — catálogo AEAT (RD 1619/2012): `F1, F2, F3, R1,
  R2, R3, R4, R5`. Medido hoy (SCRUM-413/1099): el producto solo escribe `F1`/`R1`/`JUST`; el
  catálogo del guard es deliberadamente el COMPLETO de la AEAT, no el que se usa hoy — para que un
  `F2` o un `R3` que nadie ha visto nunca siga cayendo dentro de la red.

**UNA sola llamada Prisma**, `prisma.merchant.findMany(…)`: el filtro (a) se resuelve **en
memoria**, con el mismo criterio exacto que `core/flags.ts::isFlagEnabled` (objeto plano, no
array, booleano estricto) — no se usó el filtrado JSON nativo de Prisma (`path`+`equals`) porque
no se usa en ningún otro sitio de este árbol y hoy sería la primera vez que se ejercitara contra
una base real; una sola llamada ya cubre las dos preguntas sin esa incertidumbre añadida.

### 1.1 · Solo lectura ESTRUCTURAL, por AST sobre su propio fuente

`verificarSoloLecturaEstructural` **se lee y se analiza a sí mismo en cada ejecución**, con el AST
de `typescript` (mismo motor que `scripts/censo-escritores-invoice.mjs`, SCRUM-1099): cualquier
`prisma.<algo>.<método>(…)` cuyo `<método>` no esté en la lista **BLANCA**
(`METODOS_PERMITIDOS = {findMany, $disconnect}`) **aborta la ejecución antes de conectar**. Blanca
y no negra, a propósito: una negra («nunca `create`/`update`/`delete`…») se queda corta en cuanto
exista un método que hoy no se ha pensado en prohibir; la blanca falla cerrado ante cualquier
nombre que no reconoce.

### 1.2 · El límite declarado — lo que este guard NO puede ver

`core/flags.ts` resuelve `INVOICING_ES_ENABLED` con precedencia **merchant > env > default de la
tabla**. Este guard solo ve el nivel **merchant** (columna `merchants.flags`, que es lo único que
vive en una fila de la base). Un `INVOICING_ES_ENABLED=true` puesto como **variable de entorno en
Railway** encendería la facturación fiscal para TODOS los merchants ES sin tocar una sola fila, y
**ninguna consulta SQL puede verlo** — no es un secreto ni un fichero, es una variable de proceso.
Por eso el brazo (b) —¿ha llegado a emitirse algo fiscal de verdad?— no depende de flags en
absoluto: mide el HECHO consumado, no la configuración, y por SCRUM-1099 `crearFacturaEmitida.ts`
es el único sitio de `src/` que puede producirlo.

### 1.3 · Los tres veredictos

`0` limpio (medido, cero acreditados) · `1` **HALLAZGO** (medido, ≥1 acreditado — la acreditación
se rompió) · `2` **CIEGO** (no se pudo medir; nunca se confunde con limpio). Si NO hay ni un
merchant ES no-demo en la base, el guard se declara CIEGO en vez de dar un «cero» sin control
positivo delante (la trampa que `docs/equipo/puesto-j6.md` nombra explícitamente).

### 1.4 · Uso

```
node scripts/guard-acreditacion-invoicing-es.mjs --staging     # DATABASE_URL_STAGING (.env)
node scripts/guard-acreditacion-invoicing-es.mjs --prod-ro      # DATABASE_URL_PROD_RO (entorno)
```

Sin bandera no hay destino por defecto — apuntar a producción es una decisión que se declara en
la línea de comando, nunca un olvido. Cada arranque comprueba además que el host resuelto de la
URL sea EXACTAMENTE el esperado (`STAGING_HOST`/`PROD_HOST` de `_db-guard.mjs`) antes de conectar.
Nunca imprime URL, usuario ni contraseña: todo pasa por `describirBD` (host/base únicamente).

---

## 2 · Visto en ROJO, en STAGING — con limpieza

Ejecutado hoy, 2026-09-23, contra `DATABASE_URL_STAGING` (host `acela.proxy.rlwy.net`, base
`railway`), con dos scripts efímeros **no committeados** (`scripts/_tmp-scrum1097-sembrar-rojo.mjs`
/ `_tmp-scrum1097-limpiar-rojo.mjs`, borrados tras el uso — `git status` limpio después):

| Paso | Comando | Resultado |
|---|---|---|
| ① Base, antes de sembrar | `node scripts/guard-acreditacion-invoicing-es.mjs --staging` | suelo=7 · acreditados=**0** · exit 0 |
| ② Siembra | `merchant.create({country:'ES', flags:{INVOICING_ES_ENABLED:true}, email:'qa-scrum1097-guard-rojo@test.local'})`, vía `destinoSembrable` (allowlist de host, nunca producción) | `CREADO id=4575` |
| ③ EN ROJO | `node scripts/guard-acreditacion-invoicing-es.mjs --staging` | suelo=8 · acreditados=**1** (`id=4575`) · **exit 1** |
| ④ Limpieza | `merchant.delete({id:4575})`, con verificación previa del email antes de borrar (nunca un borrado por id a ciegas) | `BORRADO id=4575` |
| ⑤ Verde, tras limpiar | `node scripts/guard-acreditacion-invoicing-es.mjs --staging` | suelo=7 · acreditados=**0** · exit 0 |

El guard cazó la inyección real en la primera pasada (③) y volvió a cero tras limpiar (⑤): no es
un guard que nunca ha visto fallar.

---

## 3 · Prueba automática — `tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs`

Sin base de datos real: `medirAcreditacion` recibe un `PrismaClient` inyectado (mismo patrón que
`ejecutorLocal` de `preview-migracion.mjs`), y el auto-check de solo-lectura se prueba con TEXTO,
en rojo (`.update`, `.create`, `.upsert`, `.delete`, `.$executeRaw`… uno por uno, sobre `prisma`) y
en verde (`.findMany` sobre `prisma`; y un `.update` sobre OTRO objeto, para comprobar que el
análisis ancla a la cadena que arranca en `prisma` y no al nombre suelto del método).

14 tests, 14 pass:

```
$ FORCE_COLOR=0 node --test tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs
ℹ tests 14
ℹ pass 14
ℹ fail 0
```

`npm test` (suite completa, tras `npm install` para sincronizar `read-excel-file` —dependencia
nueva de otra rama que esta copia del árbol no tenía instalada— y `prisma generate`): en curso al
cierre de este informe; se reporta en el comentario de entrega del ticket con el veredicto final,
no aquí, para no dejar esta sección con un número que no se ha visto de verdad.

---

## 4 · Lo que no se ha tocado

`src/`, producción (solo se ha ejecutado `--staging`; la pasada `--prod-ro` la coordina el
fundador, punto siguiente), `.github/workflows/ci.yml`, los bancos e instrumentos de S3. Los dos
scripts de siembra/limpieza fueron efímeros y no se han committeado.

## 5 · Siguiente paso

Coordinar con el fundador la pasada `--prod-ro` contra `DATABASE_URL_PROD_RO` (rol `yaqu_lectura`,
solo lectura verificado a nivel de Postgres) y registrar aquí su resultado como SCRUM-1097b.
