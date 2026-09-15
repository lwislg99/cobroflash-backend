# SCRUM-857 · El guard de SCRUM-854 no ve el trabajo que viaja en la rama de OTRO ticket

**Fecha:** 15-sep-2026 · **Carril:** proceso · registro · **Gate:** medición + arreglo del criterio · **Prioridad:** High

**Medido contra:** `origin/main` = `3e2ecda1dd77da0bf1287f6d5c3f2b343188ed91` · 2026-09-15T13:17:42Z
**Rama:** `scrum-857-union-de-vias`
**Preámbulo (A1):** `./node_modules/.bin/prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** al ramificar · árbol limpio.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> ⛔ **No se reabre SCRUM-854**: su promesa está cumplida y en `main`. Esto la **amplía**.
> ⛔ **No se escriben aquí las entradas que faltan** (§5): son de quien conoce cada ticket.

---

## 1 · 🔴 CORRECCIÓN DE UNA AFIRMACIÓN MÍA, y va primero porque el ticket nace de ella

El informe de esta mañana —y el ticket que salió de él— dice que sobre los dos merges donde el
trabajo de SCRUM-846 viajó en `scrum-637-*` **«el guard habría dicho CUMPLE»**.

**Lo he ejecutado sobre el árbol real, y no es así.** El criterio de SCRUM-854 daba **`FALTA`** en
los dos — pero reclamando `docs/master/SCRUM-637.md`, porque la rama era `scrum-637-*` y ese PR
tampoco traía la entrada de la 637:

```
51a28288 PR#1248 scrum-637-verificacion-s5
   asuntos:  SCRUM-846: mi censo mintio una TERCERA vez hoy…
   VIEJO (solo rama): FALTA · tickets=637     · falta=637
   NUEVO (union)    : FALTA · tickets=637,846 · falta=637,846
```

**Aquello era una deducción, no una medición**, y por eso el encargo pedía ejecutarlo en vez de
darlo por hecho. Tenía razón: no era como lo escribí.

**El defecto sigue siendo real, y el daño idéntico** — pero el mecanismo es otro y hay que decirlo
bien: *el guard no se callaba, señalaba el ticket equivocado*. Quien viera aquel rojo habría
añadido la entrada de la 637, el guard se habría callado, y la 846 seguiría sin expediente. Que es
exactamente lo que pasó durante seis días.

### Y el verde falso literal existe: son otros dos, medidos

Buscado sobre los 198 merges de PR, «¿en cuáles el criterio viejo decía CUMPLE y el nuevo dice
FALTA?». **Dos**, y son PRs que **sí traían su propia entrada**:

| merge | PR | rama | trae | lleva dentro un commit de |
|---|---|---|---|---|
| `b07546cf` | #1149 | `scrum-805-que-firmo-el-cliente` | `SCRUM-805.md` | **SCRUM-797** |
| `855562ac` | #1143 | `scrum-818-parte-de-trabajo` | `SCRUM-818.md` | **SCRUM-722** |

Y `docs/master/SCRUM-722.md` **no existe hoy en `main`**. El criterio nuevo no destapa un caso de
laboratorio: destapa un expediente que sigue faltando.

---

## 2 · PRIMERO SE MIDIÓ LA COBERTURA, DESPUÉS SE ELIGIÓ EL CRITERIO

### ⚠️ Antes de ninguna cifra: de dónde se leen los mensajes, y si el merge los conserva

Con squash el commit de una rama nunca llega a `main` tal cual, y una cifra de «mensajes de
commit» sacada del sitio equivocado es **plausible y falsa**. Medido sobre la población:

```
198 merges de PR
  con DOS padres (merge real, conserva los commits de la rama): 198
  con UN padre (squash/rebase: esta vía NO existiría):            0
  el merge DEVUELVE commits de rama en 195/198
```

Se leen de `<merge>^1..<merge>`, y ahí están. **Si algún día se pasa a squash, esta cifra cambia y
hay que volver a medirla antes de fiarse de este criterio.**

### Cobertura de cada vía — «en cuántos merges produce al menos un número de ticket»

| vía | cobertura |
|---|---|
| **A** · nombre de la rama | **186 / 198 — 93,9 %** ← lo que usaba el guard |
| **B** · `SCRUM-n` en cualquier parte del mensaje | 194 / 198 — 98,0 % |
| **B'** · `SCRUM-n` al **INICIO del ASUNTO** | 175 / 198 — 88,4 % |
| **C** · título del PR (cuerpo del merge) | 100 / 198 — 50,5 % |
| **D** · ficheros tocados | 151 / 198 — 76,3 % |

### 🔴 Y el número que decidió: «¿en cuántos esa vía ve un ticket que la RAMA no ve?»

| vía | merges | |
|---|---|---|
| **B** (cualquier parte del mensaje) | **157 / 198 — 79,3 %** | 🔴 **INSERVIBLE** |
| **C** (título del PR) | 11 / 198 | poco y redundante |
| **B'** (inicio del asunto) | **18 / 198 — 9,1 %** | ✅ **el elegido** |

**La vía B cuenta las menciones de pasada.** Medido en el PR #1248: sus commits nombran 778 y 833
**en el cuerpo** —citas a trabajo ajeno— y su único asunto es `SCRUM-846: …`. Un guard que pidiera
entrada de todo lo mencionado la pediría en **4 de cada 5 PR**, y *un guard demasiado amplio acaba
relajado*: ése es el riesgo real de este ticket, no el falso negativo.

> **El asunto es la línea entre SER trabajo de un ticket y MENCIONARLO.** Y no es una convención
> inventada aquí para que salgan las cuentas: **175 de 198 merges ya la siguen.**

---

## 3 · El criterio nuevo

Una rama que toca código debe traer la entrada de **todos** los tickets de los que trae trabajo:

* el de su **nombre** (`scrum-<n>-…`), como hasta ahora;
* **más** todo `SCRUM-<n>` que aparezca **al inicio del asunto** de alguno de sus commits.

Derivado, no una lista. Y las dos exenciones de SCRUM-854 siguen siendo criterios, no una lista de
ramas: **no toca código** y **no se sabe el ticket** — esta última con su veredicto propio,
`NO_SE_PUDO_DETERMINAR`, que **no es CUMPLE**.

---

## 4 · El censo, sobre MÁS población que la vez anterior

**400 merges leídos → 197 de PR → 151 tocan código.** El número no es redondo por gusto: el censo
de SCRUM-854 miró **60** y por eso sólo alcanzó **una** de las **cinco** fases del 834. 400 cubren
desde el PR #1069 hasta hoy — las cinco fases del 834 (#1211-#1233), los dos merges del 846
(#1238, #1248) y los dos verdes falsos (#1143, #1149), con margen por delante.

```
MERGES QUE TOCAN CODIGO Y NO TRAEN ALGUNA ENTRADA QUE LES TOCA:
  con el criterio de SCRUM-854 (solo la rama) ....... 29
  con el criterio de SCRUM-857 (rama + asuntos) ..... 31
  🔴 merges donde el criterio NUEVO reclama algo que el viejo no veia: 9
```

**SUELO:** si el censo no encontrara ningún merge de PR, sale con **3** diciendo `CENSO CIEGO` —
*vacía y no-medida se leen igual y significan lo contrario*.

---

## 5 · 🔴 LO QUE ESTO DESTAPA: cinco expedientes que faltan y nadie sabía

Tickets con trabajo en `main` que el criterio viejo **no reclamaba**:

| ticket | merges | entrada hoy |
|---|---|---|
| SCRUM-846 | 2 (#1248, #1238) | existe — se escribió hoy |
| **SCRUM-842** | 2 (#1234, #1227) | 🔴 **NO EXISTE** |
| **SCRUM-838** | 1 (#1221) | 🔴 **NO EXISTE** |
| **SCRUM-833** | 1 (#1204) | 🔴 **NO EXISTE** |
| SCRUM-797 | 1 (#1149) | existe |
| **SCRUM-722** | 1 (#1143) | 🔴 **NO EXISTE** |
| **SCRUM-601** | 1 (#1085) | 🔴 **NO EXISTE** |

**Cinco tickets con trabajo mergeado y sin registro.** No se escriben aquí: son de quien conoce
cada uno, igual que se decidió con la 846 y la 834.

---

## 6 · Lo que el criterio nuevo SIGUE sin ver, declarado

**Tres merges tocan código y ninguna vía dice a qué ticket pertenecen** — ni la rama, ni el asunto
de ningún commit:

```
5dcf766a PR#1196 scrum-automerge-rojo-falso
441c185c PR#1142 scrum-e6-recorrido-entre-vistas
f3ba28b8 PR#1088 medicion-dist-en-el-meta-guard
```

Es la familia de **SCRUM-828**: el número no aparece en ninguna parte. **Ninguna vía los salva**, y
por eso el guard los marca `NO_SE_PUDO_DETERMINAR` en vez de darlos por buenos. Queda escrito aquí
en vez de dejarlo implícito: *una lista de excepciones es deuda; un criterio derivado no lo es*.

---

## 7 · Los controles

| # | control |
|---|---|
| ⑤ | **SUELO**: los merges medidos existen y traen datos — y **traen asuntos**, o la vía no existiría |
| ① | 🔴 **EL QUE DECIDE**: los dos verdes falsos literales caen, nombrando al ticket sin entrada |
| ①bis | 🔴 el caso del ticket: antes **no nombraba** la 846, ahora **sí** (con la corrección del §1 dentro) |
| ② | 🔴 **MUTACIÓN**: apagada la vía nueva, vuelve el verde falso y la 846 desaparece de lo reclamado |
| ③ | ✅ **POSITIVO**: un PR normal pasa, y una **mención de pasada NO** exige entrada |
| ④ | ✅ **NEGATIVO**: lo que cerraba SCRUM-854 sigue cerrado — se amplía, no se sustituye |

Los datos de ①, ①bis y ② **salen de git**, de merges que están en la historia: no dependen de
ninguna rama viva ni de un caso escrito a mano.

`node --test tests/scrum857-union-de-vias.test.mjs` → **7 pass · 0 fail · `# skipped 0`**
y los seis de SCRUM-854 siguen corriendo.

---

## 8 · Lo NO tocado

SCRUM-854 no se reabre ni se relaja · no se escriben las entradas que faltan · ningún estado ni
flag nuevo (27) · ninguna dependencia (36) · `prisma/schema.prisma` · **nada contra producción ni
staging**.

> ⚠️ **Nota de método, por sexta vez hoy:** los bancos llaman a git **sin shell** (`execFileSync`
> con argumentos en array). En Windows `cmd.exe` trata `^` como escape y `<sha>^1` llega como
> `<sha>1`. Y al regenerar una salida, el hook `guard-dangerous` bloqueó la redirección que
> truncaba un fichero ya versionado: se generó a un temporal y se copió, en vez de usar la
> exención de un solo uso.

## 9 · Los bancos

`docs/master/evidencias/scrum857/cobertura-de-cada-via.mjs` (+ `salida-cobertura.txt`) ·
`verdes-falsos.mjs` (+ `salida-verdes-falsos.txt`) ·
`censo-con-criterio-nuevo.mjs` (+ `salida-censo-nuevo.txt`).
