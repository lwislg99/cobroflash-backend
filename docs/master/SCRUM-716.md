# SCRUM-716 · El vigía decía «al día» cuando NO había podido mirar

**Medido contra:** `origin/main` = `2c161c38cfba4ad81479dd302a933412d496f58c` · 2026-09-04T12:30:44+02:00
**Rama:** `scrum-716-vigia-no-dice-al-dia-sin-mirar`

## PASO 0 (regla 39) · el defecto sigue vivo HOY

El hallazgo era del 3-sep y `main` se ha movido tres veces desde entonces. Recomprobado sobre
`main` de hoy, con la función pura:

```
conoceElCommit: true, shaDeMain: null   →   veredicto: al-dia   salida: 0
   «producción dice 2d826de6 · `main` está en ? · sin hueco»
```

**Nadie lo había arreglado.** Sale VERDE habiendo impreso «`main` está en **?**».

🔒 Y lo peor no es el texto: **con salida 0 no aparece ni en rojo**. El guard construido para que
no vuelvan a pasar nueve días sin desplegar callaba justo cuando no sabía. El rojo de las PR de
ayer era el camino que **sí** funciona.

## El enumerado · cuántos caminos emiten veredicto sin las dos puntas

La comparación necesita **dos** commits: el que dice producción y el que dice `main`. Se enumeran
los doce estados posibles y se cuenta cuáles emitían veredicto sin tenerlos.

| # | Camino | Antes | Ahora |
|---|---|---|---|
| 1 | producción no responde | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 2 | producción responde vacío | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 3 | `/version` no publica un sha de 40 (el fallback de `env.ts`) | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 4 | el clon no conoce el commit de producción | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| **5** | **`origin/main` NO se resuelve** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| **6** | **`origin/main` resuelve a algo vacío** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| **7** | **las dos puntas, pero no se pudo CONTAR el hueco** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| 8 | hay hueco pero no se pudo fechar el más antiguo | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 9 | producción corre algo que no está en `main` | 🔴 atrasado · 1 | 🔴 atrasado · 1 |
| 10 | sin hueco | ✅ al-día · 0 | ✅ al-día · 0 |
| 11 | hueco dentro del margen | ✅ al-día · 0 | ✅ al-día · 0 |
| 12 | hueco pasado el margen | 🔴 atrasado · 1 | 🔴 atrasado · 1 |

**Eran TRES, no uno.** El enumerado los contó; no se supusieron.

## La causa, en una línea

```js
if (!commitsPorDelante) {   // ← `null` (no se pudo contar) y `0` (no hay hueco), por la misma puerta
```

Es la confusión de la casa entre **«no medido» y «cero»** — esta vez dentro del propio vigilante,
y en el fichero que lleva escrito: *«Esto NO es "producción está al día": es que no se ha podido
comprobar. Un vigilante que confunde las dos cosas es peor que ninguno.»*

## El arreglo

**SUELO 4 · la otra punta.** Los tres suelos existentes miraban lo que dice *producción*. Faltaba
mirar `main`: sin `origin/main` resuelto no hay contra qué comparar. Pasa en CI de verdad — en un
checkout de PR, `origin/main` puede no existir como rama de seguimiento.

**Y `null` deja de ser `0`:** `commitsPorDelante == null` es ciego; `=== 0` es «sin hueco».

## Los rojos

| | Resultado |
|---|---|
| el test contra el mecanismo de HOY | **2 de 7 fallan**, nombrando los dos caminos verdes-ciegos |
| tras el arreglo | **8 de 8 en verde** |
| **CONTROL POSITIVO** · dos puntas y sin hueco | sigue «al día», salida 0 |
| **CONTROL POSITIVO** · hueco dentro del margen | sigue verde — no se vuelve ruidoso |
| **CONTROL NEGATIVO** · 30 h de hueco | sigue cantando, con las horas y los commits |
| **CONTROL NEGATIVO** · producción fuera de `main` | sigue cantando |

Un vigía que se pone ciego **siempre** es tan inútil como uno que se pone verde siempre — y se
desactiva antes, porque molesta todos los días. Por eso los cuatro controles.

Y el suelo del propio enumerado: si diera **un** camino, o si todos dieran **el mismo** veredicto,
falla — la regla se cumpliría por no encontrar nada.

## El vigía real, después

```
[vigilante de despliegue] https://yaqu.app/version
producción dice ad3d3889 · `main` está en 2c161c38 · 0.9 h de hueco (margen 6 h)
   3 commit(s) sin llegar. Un despliegue en curso se lee así.
exit 0
```

Un despliegue en curso, leído como lo que es.

## ⚠️ Lo que este ticket NO arregla, y es otro hecho

El **rojo de ayer en las PR #989 y #990** es distinto: el checkout del PR no traía el commit de
producción, así que el script se declaró ciego **correctamente** (camino 4). Eso se arregla en el
**job** —fetch más profundo, o traer la ref— **no en el script**, y va en su propio commit.

Medido ayer: ninguna de las dos ramas contenía `2d826de6`, que llegó a `main` a las 11:18.

## ⛔ No tocado

El `continue-on-error: true` del job (es de Javier, y está así a propósito) · el contrato de
`GET /version` · `scripts/db-push-prod`.

---

# SCRUM-716b · El JOB, que es donde estaba el otro rojo

**Medido contra:** `origin/main` = `382439a16a3888c24e4678d560c3e1429194e085` · 2026-09-04T13:40:00+02:00
**Rama:** `scrum-716b-job-del-vigia`

## PASO 0 · seguía pasando

SCRUM-716 ya está en `main` (el `SUELO 4` está dentro). El job ya llevaba `fetch-depth: 0`.
**Y no basta.**

## Medido reproduciendo el checkout, no deducido

Se reprodujo lo que hace `actions/checkout@v4` en un `pull_request`: traer **una sola ref** con
toda su historia. Contra el remoto de verdad:

```
¿resuelve origin/main?           NO
producción dice                  5bfc1136…
¿está su commit en el clon?      NO
→ ⚠️ NO SUPE MIRAR: el commit de producción no existe en este repositorio.   exit 2
```

**Faltaban las dos cosas a la vez.** El script hacía lo correcto declarándose ciego; lo que
faltaba se lo tenía que dar el job.

⚠️ **Y el banco mintió primero:** la primera versión apuntaba el `origin` del clon de prueba al
**checkout local, que está 1.933 commits atrás**, así que `origin/main` resolvía a `5749f2f1`. La
misma trampa de siempre, esta vez dentro del instrumento. Se rehízo contra el remoto real antes de
concluir nada.

## El arreglo, y el control que decide

Un paso, antes de llamar al vigía:

```yaml
- name: Traer `main` (el vigía compara contra él)
  run: git fetch --no-tags --prune --no-recurse-submodules origin +refs/heads/main:refs/remotes/origin/main
```

**Veredicto REAL en el mismo banco, después:**

```
producción dice 5bfc1136 · `main` está en 382439a1 · 0.7 h de hueco (margen 6 h)
   6 commit(s) sin llegar. Un despliegue en curso se lee así.
exit 0
```

Ya no es «no supe mirar»: es una lectura.

**CONTROL NEGATIVO** — con `main` ya traído y un `/version` que no responde:

```
⚠️ NO SUPE MIRAR: no se pudo leer `/version` de producción.
```

Arreglar el fetch **no** convierte una ceguera legítima en un veredicto inventado.

## 📌 El workflow PROGRAMADO no lo necesita

`vigia-despliegue.yml` se ejecuta sobre `main`, así que `actions/checkout` ya crea
`refs/remotes/origin/main`. **Por eso aquél funcionaba y éste no.** Hay un test que impide
añadírselo «por simetría»: hacerlo escondería la razón por la que el otro sí lo necesita.

## ⛔ No tocado

El `continue-on-error: true` (hay test que lo comprueba) · `scripts/vigilante-de-despliegue.mjs` ·
ninguna base.
