# SCRUM-880b — Las afirmaciones con sello «medido», y el host que parece staging

*17-sep-2026 · rama `scrum-880b-afirmaciones-caducadas`*

**Medido contra:** `origin/main` = `e437a51f7d58bc8b7bbcf20c1386a9fa9c1acb38` · 2026-09-17T11:19:56+01:00

⛔ **Esto MIDE. No arregla ni re-fecha nada** (regla 9). `docs/equipo/00-normas-comunes.md` se ha
**leído y no escrito**: tiene un dueño, la Sesión 0.

> 🔒 Una afirmación con el sello «medido» y sin fecha de caducidad es la forma más convincente que
> tiene un dato viejo de seguir pareciendo cierto.

## ① Las tres cifras

```
a) POBLACIÓN     55 afirmaciones con marca de medición · 14 ficheros
b) VERIFICABLES   9 desde este worktree, sin tocar staging ni producción
c) SIGUEN CIERTAS 3   ·   🔴 CADUCADAS 6
   NO VERIFICABLE 46, contadas aparte
```

**La población**, declarada: `CLAUDE.md` + `docs/equipo/*.md`. **No** se mira `docs/master/` ni el
máster — ahí una medición es el REGISTRO fechado de un trabajo, que es lo que debe ser; en estos
dos sitios son **instrucciones vivas** que alguien lee para decidir hoy.
Criterio: participio de medición (`medid*`, `censad*`, `contad*`, `comprobad*`, `verificad*`) como
palabra. **Descontadas y declaradas:** 4 instrucciones («hay que medir», «mídelo» — mandan hacer,
no afirman) y 5 apariciones de la palabra dentro de un nombre de fichero.
Instrumento: `scripts/censo-afirmaciones-medidas.mjs`.

### 🔴 De las 9 comprobables, 6 han caducado

| # | afirmación | hoy | |
| --- | --- | --- | --- |
| 1 | `CLAUDE.md:77` (regla 3, **REGISTRO MEDIDO** 10-ago-2026) · «los cuatro worktrees llevan `_STAGING`, `_DEV` y `_TESTS`» | en `cobroflash-b4` **faltan dos** | 🔴 **CADUCADA** |
| 2 | `sesion-4.md:102` y `:162` · «**A15 NO EXISTE**, la numeración salta de A14 a A16» | **A15 existe**: `00-normas-comunes.md:249`, «`git stash` es estado COMPARTIDO» | 🔴 **CADUCADA** (×2 líneas) |
| 3 | `sesion-1.md:135` · «66 ficheros de `tests/` gateados, 63 por `QA_DB_TEST`» | **81 gateados · 67 por `QA_DB_TEST`** | 🔴 **CADUCADA** |
| 4 | `afirmaciones-verificadas.md:59` · «el `CLAUDE.md` del checkout tiene **102 líneas**» | **160** | 🔴 **CADUCADA** |
| 5 | `afirmaciones-verificadas.md:58` · «el checkout va **3.782 commits** por detrás» | **41** | 🔴 **CADUCADA**, y ver la nota |
| 6 | `afirmaciones-verificadas.md:31` · «cuatro sitios del atajo N» → **seis** | **6 con tecla**, de 10 botones | ✅ sigue cierta |
| 7 | `afirmaciones-verificadas.md:50` · «`YAQU_MASTER.md` no está en la raíz» | no está | ✅ sigue cierta |
| 8 | `sesion-1.md:30` · «en `verifactu.service.ts` el NIF del cliente no se imprime: DECIDE» | `MODO_SIN_DESTINATARIO` sigue ahí y el comentario lo mantiene | ✅ sigue cierta |

⚠️ **La #5 caduca ANUNCIÁNDOLO y hay que decirlo a su favor:** su propia fila dice *«Cierto en su
momento, y crece»*. Es la única de las seis que lleva su caducidad escrita — el número cambió, pero
el lector estaba avisado. Lo que sí ha dejado de ser cierto es el «y crece»: **decreció**, de 3.782
a 41, porque alguien actualizó el checkout.

⚠️ **Y la #6 sigue cierta por poco:** «seis» sigue siendo el número con tecla, pero la población
pasó de los sitios de entonces a **10 botones de crear**, con **4 sin tecla**. Un número que
acierta sobre un denominador que ha cambiado envejece sin que se note.

### 🔴 El caso que abrió esto demuestra que la fecha no basta

`CLAUDE.md` regla 3 **lleva fecha** (10-ago-2026) y **aun así caducó**, porque afirma un estado en
**presente** —«los cuatro worktrees llevan…»— que el lector toma por vigente. Medido sobre el
propio censo: de las 55, **17 llevan fecha y 38 no**; y **31 no llevan ni fecha ni con qué volver
a preguntarlo**. La fecha protege del olvido, no de la lectura.

### Las 46 NO VERIFICABLES, y por qué

Contadas aparte, clasificadas **por lectura** (lo que no pude decidir fue al lado malo):

* **~22 no son afirmaciones de estado**: doctrina, encabezados, anclas de medición (`medido sobre
  origin/main = <sha>`), o líneas que **se declaran a sí mismas como no comprobadas** —
  `sesion-1.md:193` («lo medido, no un hecho comprobado. Se dice así a propósito»),
  `sesion-4.md:160-161` («contado por el fundador, **no medido aquí**»), `sesion-4.md:168` («esta
  sesión NO lo ha comprobado, a propósito»). **Ésas son el modelo**: una afirmación que declara su
  propio alcance no puede caducar en silencio.
* **~15 son eventos pasados fechados**: «el 8-sep se barrieron 456 ramas», «el PR #1214 llevó 3
  tickets». No pueden dejar de ser ciertos: dicen lo que pasó, no lo que hay.
* **~9 necesitan algo fuera de este worktree**: GitHub/CI (`delete_branch_on_merge`, runs de
  workflows, PRs), Jira/MCP, transcripts de otras conversaciones, o el runtime del orquestador.

### Lo que esto significa para la decisión

**6 de 9 comprobables han caducado — el 67 %.** Y la muestra no está sesgada hacia lo viejo: dos
de las seis son de **ayer y de hoy** (`afirmaciones-verificadas.md`, 17-sep). El problema no es
que las notas sean antiguas: es que **nada vuelve a preguntarlas**.

## ② El host que parece staging

**Resultado: tres mecanismos deciden mirando el HOST. Dos contestan la pregunta correcta; uno la
equivocada — y ese uno falla CERRADO.**

La clave la deja escrita el propio guard, `_db-guard.mjs:180`: *«staging, y las demás bases del
mismo Postgres (**SCRUM-84: el criterio es el HOST**)»*. **Son dos preguntas distintas y la casa
las contesta con dos criterios distintos, a propósito:**

| pregunta | criterio correcto | quién lo usa |
| --- | --- | --- |
| **«¿es seguro ESCRIBIR aquí?»** | **HOST** — todo lo que vive en ese Postgres es no-producción, y para un permiso eso es exactamente lo que hace falta saber | `assertSafeStagingUrl` (`_db-guard.mjs:291`) → `marcar-staging`, `test-staging-gated`, `turno-staging` · `DESTINOS_SEMBRABLES` (`:180`, `:260`) |
| **«¿QUÉ es esto: staging, desarrollo o producción?»** | **DESTINO** — el host aloja dos bases distintas | `_clave-vs-destino.mjs` (SCRUM-418) → `comprobar-claves-bd` |

### 🔴 El único que mezcla las dos

`scripts/conciliar-auditoria-fiscal.mjs:103-104`:

```js
if (h === PROD_HOST)    return { clase: 'prod',    host: h };
if (h === STAGING_HOST) return { clase: 'staging', host: h };
```

Contesta la pregunta de **identidad** con el criterio de **permiso**: una base de **DESARROLLO**
sale clasificada como `staging`.

✅ **Y no es explotable hoy, porque falla CERRADO** — medido leyendo `:144-147`:

```
if (clase === 'staging' && !marcada) {
  console.error('❌ El host dice staging pero la base NO lleva el marcador YAQU_STAGING.');
  console.error('   Abortado: si no se puede verificar de qué base se trata, no se lee.');
```

Una base de desarrollo clasificada como `staging` **aborta** en vez de leerse. El mensaje describe
literalmente la confusión —*«el host dice staging pero…»*— sin saber que la está describiendo.

**El resultado del censo, entonces, no es «hay un defecto»: es «hay un criterio equivocado que hoy
no hace daño porque otro mecanismo lo tapa».** El día que cambie el host, o que alguien marque la
base de desarrollo, deja de taparlo.

## Lo NO tocado

`docs/equipo/00-normas-comunes.md` (leído, no escrito — es de la Sesión 0) · ninguna afirmación
re-fechada ni corregida · `conciliar-auditoria-fiscal.mjs` sin tocar · `CLAUDE.md` sin tocar:
re-fechar la regla 3 exige medir **los cuatro** worktrees y desde aquí sólo se ve uno.
**Staging y producción: no tocados, ni para mirar.**
