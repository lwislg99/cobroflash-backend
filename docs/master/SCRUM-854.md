# SCRUM-854 · Un PR puede entrar en `main` SIN entrada de registro y ningún guard lo ve

**Fecha:** 15-sep-2026 · **Carril:** proceso (registro de máster) · **Gate:** censo + guard

**Medido contra:** `origin/main` = `3b50990f09d0023e7654d14a24a366b7a167a4a5` · 2026-09-15T11:04:12Z
**Rama:** `scrum-854-merge-sin-entrada`
**Preámbulo (A1):** `./node_modules/.bin/prisma generate` rc=0 · `npm run build` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** · árbol limpio.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> ⛔ **No se escriben aquí las entradas que faltan** de los casos encontrados: cada una es de
> quien conoce su ticket. Lo que se entrega es el censo y el mecanismo.

---

## 1 · El censo: **5 merges entraron sin expediente**, no 3

Derivado de `git log --merges`, **no** de `ls-remote`: el autoborrado ya se llevó esas ramas, así
que preguntarle al remoto daría cero **por no mirar**, no por estar limpio.

Sobre los **60 últimos merges** de `origin/main`: **37 son entradas de PR** y 23 son merges de
`main` *hacia* una rama (que no meten nada nuevo en `main` y por eso no se juzgan).

### 🔴 8 merges tocan código sin tocar su entrada — y no todos son lo mismo

La distinción que el ticket no hacía, y que cambia la gravedad: **«el ticket no tiene expediente»
no es lo mismo que «este PR no lo actualizó»**. Y se mide **en el momento del merge**, no hoy: que
hoy exista no dice nada, pudo escribirlo otra sesión tres días después.

| sha | PR | rama | ¿existía su entrada al mergear? | veredicto |
|---|---|---|---|---|
| `658976f0` | #1257 | `scrum-846-caso-conocido-por-ast` | NO · y hoy **tampoco** | 🔴🔴 **entró sin expediente, y sigue sin él** |
| `4dec28eb` | #1233 | `scrum-834e-censo-de-modulos` | NO · y hoy **tampoco** | 🔴🔴 **entró sin expediente, y sigue sin él** |
| `5359f41d` | #1261 | `scrum-839b-edad-y-rojo-obligatorio` | NO · hoy sí | 🔴 entró sin expediente; se escribió después |
| `07ccd16c` | #1240 | `scrum-848-tactil-ficha-trabajo` | NO · hoy sí | 🔴 entró sin expediente; se escribió después |
| `85f4e0cb` | #1239 | `scrum-839-detectar-conflicto` | NO · hoy sí | 🔴 entró sin expediente; se escribió después |
| `51a28288` | #1248 | `scrum-637-verificacion-s5` | SÍ | ⚠️ el expediente existía; el PR no lo actualizó |
| `d0ab360b` | #1238 | `scrum-637-verificacion-s5` | SÍ | ⚠️ ídem |
| `5c35a66d` | #1234 | `scrum-637-verificacion-s5` | SÍ | ⚠️ ídem |

**ENTRARON SIN EXPEDIENTE: 5.** El ticket nombraba tres; el censo encuentra **dos más que nadie
había visto** —SCRUM-846 y SCRUM-834—, y son los peores: **siguen sin expediente hoy**.

### Control positivo del censo

Los tres shas que el ticket nombra se buscan dentro de los merges y el censo los marca:

```
404c0f59 -> PR#1240 (scrum-848-tactil-ficha-trabajo)   ✅ marcado sin entrada
d2990977 -> PR#1239 (scrum-839-detectar-conflicto)     ✅ marcado sin entrada
e91a3741 -> PR#1261 (scrum-839b-edad-y-rojo-obligatorio) ✅ marcado sin entrada
```

Y **suelo**: si el censo devolviera cero merges de PR, o cero sin entrada, sale con **3** diciendo
`CENSO CIEGO` — porque el ticket nombra tres con su sha y un cero ahí sería el instrumento roto,
no el repositorio limpio.

---

## 2 · 🔴 POR QUÉ VÍAS SE SABE A QUÉ TICKET PERTENECE UN MERGE (y cuál no funciona)

El encargo pedía medirlo, porque de eso depende que el guard no se trague justo los casos que
importan. Sobre los mismos 37 merges:

| vía | cobertura | sirve para exigir |
|---|---|---|
| ① nombre de la rama (`scrum-<n>-…`) | **35 / 37** | sí |
| ② mensajes de sus commits (`SCRUM-<n>`) | **36 / 37** | sí — **cubre uno más que la rama** |
| ③ entrada de `docs/master/` tocada | 22 / 37 | **no**: es justo lo que se quiere probar |
| 🔴 **por NINGUNA de las tres** | **1 / 37** | — |

El único que no se puede atribuir es `scrum-orquestador-prompt-solo-a-quien-habla` (PR #1259):
una rama de proceso, sin número de ticket. **No se le puede exigir la entrada de un número que no
existe**, y por eso ese caso tiene veredicto propio en vez de contarse como que cumple.

**Consecuencia de diseño:** el guard mira ① **y** ②, en unión. Con el nombre de la rama a secas se
escaparían los merges cuya rama no lleva número — que es exactamente lo que enseñó el caso de
**SCRUM-828**: el número puede no aparecer *en ninguna parte*.

---

## 3 · El guard

`tests/_entrada-de-la-rama.mjs` (instrumento) + `tests/scrum854-todo-merge-deja-entrada.test.mjs`
(6 controles).

**Regla:** una rama que toca código (`src/`, `tests/`, `scripts/`, `public/`, `prisma/`) tiene que
traer o tocar `docs/master/SCRUM-<n>.md`.

### No es un guard de texto, y no por gusto

La descripción de este mismo ticket lleva dentro los patrones que persigue (`scrum-<n>-*`,
`docs/master/SCRUM-<n>.md`). Un guard que barriera ficheros buscando esas cadenas **se cazaría a
sí mismo** — es la trampa de SCRUM-349. Aquí no se lee el texto de nada: se le pregunta a **git**
por la estructura (qué toca la rama, de dónde parte, qué dicen sus commits).

Y el motor **no nace aquí**: `baseDeLaRama` y `ficherosDeLaRama` ya existían (`_censo-eol.mjs`,
SCRUM-533; reexpuestos por `_base-de-la-rama.mjs`, SCRUM-723), con su `null` honesto cuando no
pueden resolver y con el matiz de que en CI `merge-base` da la punta de `main`. Escribir un
segundo `merge-base` sería tener dos que divergen el día que alguien arregle uno.

### 🔴 TRES veredictos, no dos

| veredicto | cuándo |
|---|---|
| `CUMPLE` | trae su entrada — **o** no toca código (un PR de sólo documentación no necesita expediente propio) |
| `FALTA` | toca código y no trae `docs/master/SCRUM-<n>.md` |
| `NO_SE_PUDO_DETERMINAR` | no se sabe de qué ticket es, o no se pudo resolver la base |

**El tercero existe porque «no he podido saberlo» no es «cumple».** Se reporta con su motivo en
vez de tragarse como verde. Y cuando los commits nombran **varios** tickets y la rama no desempata,
**no se elige uno**: adivinar ahí acusaría de faltar una entrada que quizá no le toca a ese PR.

### Las exenciones son CRITERIOS, no una lista

*Una lista de excepciones es deuda; un criterio derivado no lo es.* Las dos exenciones salen del
**contenido** del PR y llevan su motivo escrito dentro del veredicto:

* **no toca código** → documentación sola;
* **no se sabe el ticket** → y eso no es cumplir, es el tercer veredicto.

El control ④ lo prueba cambiando el contenido: `docs/ + src/` **sí** exige entrada, aunque la
primera mitad fuera documentación. No hay ninguna rama en ninguna lista.

---

## 4 · Los controles, y sus rojos

| # | control |
|---|---|
| ① | **SUELO**: resuelve la base y ve lo que la rama toca; si no, CIEGO |
| ② | 🔴 **EL QUE DECIDE**: esta rama, si toca código, trae su entrada |
| ③ | 🔴 **ROJO POR MECANISMO**: el criterio distingue traer entrada de no traerla — y la entrada de **otro** ticket no cuenta |
| ④ | las dos exenciones se derivan del contenido y llevan motivo |
| ⑤ | 🔴 **la trampa de SCRUM-828**: sin número, `NO_SE_PUDO_DETERMINAR`, nunca `CUMPLE` |
| ⑥ | las vías: rama **y** commits, y se dice por cuál se supo |

### 🔴 EL ROJO, y esta vez sobre la rama de verdad

No hizo falta fabricarlo: **el guard falló sobre sí mismo** en cuanto tocó `tests/` sin tener aún
su expediente, y nombró la rama y el fichero que faltaba:

```
not ok 2 - SCRUM-854 · 🔴 ② esta rama, si toca código, trae su entrada de registro
  error: |-
    🔴 ESTA RAMA ENTRA EN MAIN SIN DEJAR ENTRADA DE REGISTRO.
        rama:     scrum-854-merge-sin-entrada
        ticket:   SCRUM-854 (por rama)
        falta:    docs/master/SCRUM-854.md
```

**Escribir este fichero es lo que lo pone en verde** — que es justo la conducta que el guard
existe para provocar. El rojo de ③ es el de laboratorio, por si algún día esta rama deja de ser
el caso: una rama sintética que toca `src/` sin entrada sale `FALTA`, con ella sale `CUMPLE`, y
con la entrada de otro ticket vuelve a salir `FALTA`.

---

## 5 · Lo NO tocado

**SCRUM-273 no se relaja ni se modifica**: comprueba que la entrada que existe esté bien puesta;
esto comprueba que exista. Son preguntas distintas sobre el mismo fichero y conviven.
Tampoco se escriben las entradas que faltan de los cinco casos (§1) — son de quien conoce cada
ticket. `prisma/schema.prisma` · ninguna base · **nada ejecutado contra producción ni staging**.

## 6 · Los bancos

`docs/master/evidencias/scrum854/censo-merges-sin-entrada.mjs` (+ `salida-censo.txt`) —
el censo de los 60 merges, con suelo y control positivo de los tres shas.
`docs/master/evidencias/scrum854/momento-del-merge.mjs` (+ `salida-momento.txt`) —
si la entrada existía **en el momento del merge**, con control del comprobador (una entrada que
está y una que no).

> ⚠️ **Los dos bancos llaman a git SIN shell** (`execFileSync` con argumentos en array), y no es
> estilo: en Windows `cmd.exe` trata `^` como carácter de escape, así que `<sha>^1` le llegaba a
> git como `<sha>1` y el censo reventaba con *«unknown revision»*. Medido: pasó en esta tanda.

## 7 · Documentos consultados

`docs/equipo/00-normas-comunes.md` (A1, A2, A7, A8, A16) · `tests/_censo-eol.mjs` (SCRUM-533) ·
`tests/_base-de-la-rama.mjs` (SCRUM-723) · `tests/scrum273-registro-por-fichero.test.mjs` ·
`CLAUDE.md`

---

# APÉNDICE · SCRUM-854 (16-sep-2026) · Entrada exigida por un asunto de commit, sin trabajo de SCRUM-854

**Medido contra:** `origin/main` = `7000a0cffe284fc99c669af2ba27e74ab9cb78c9` · 2026-09-16T19:32:47Z

**Rama:** `scrum-839e-solo-pr-armados` (PR #1367). El trabajo de la rama es SCRUM-839e (ver `docs/master/SCRUM-839.md`).

## Por qué existe esta entrada

El commit `56484895` («SCRUM-854: entrada de registro que le faltaba al commit 9f396783»), empujado a la rama
por el bot de Claude (cuenta `github-actions[bot]`), empieza su asunto por `SCRUM-854`. El guard de esta ficha
(vía SCRUM-857: el ticket se lee del **inicio del asunto** de cada commit de la rama) exige entonces
`docs/master/SCRUM-854.md`, aunque ese commit no trae trabajo de SCRUM-854: solo añade la entrada de SCRUM-859 y
un bug en `docs/BUGS.md`. Norma A7: se escribe la entrada, no se relaja el guard.

## El efecto, anotado como dato del guard

Un commit que **cita** el guard en su asunto para explicar por qué escribe una entrada crea la obligación de
OTRA entrada. Medido en esta rama: `9f396783` (asunto `SCRUM-859:`) hizo caer el guard en el CI de `89f25523`
(«build + tests» en `failure`); el arreglo del bot (`56484895`, asunto `SCRUM-854:`) lo habría vuelto a tumbar.
Arreglo de proceso, sin tocar el guard: el asunto de un commit de registro empieza por el ticket de la RAMA.
