# SCRUM-1120 · El fixture caducó y paró la línea entera

**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T15:27:23Z

25-sep-2026 · Lo construye **el orquestador** (A13). **Y lo causé yo.**

## Lo medido

Los **tres** PR abiertos —#1760, #1761 y #1762, de tres sesiones distintas— fallaban el check
**obligatorio** «build + tests» con **un solo fallo**:

```
🔴 SCRUM-1107 tiene rama viva SIN mergear y el criterio lo saca DENTRO
   (entrada en main + 10/10 artefactos suyos presentes).
   Un censo que da por DENTRO lo que no está cierra tickets vivos.
```

## 🔴 No era un defecto del censo: era su FIXTURE

`tests/scrum804b-el-barrido-de-la-42.test.mjs` tenía `const NEGATIVO = 1107;` — **un número de
ticket escrito a mano**, elegido porque entonces tenía rama viva sin mergear. El caso comprueba
que un ticket con obra abierta salga `FUERA`.

**Hoy 1107 está mergeado** (PR #1743 y #1758, los dos a las 14:52Z). El censo lo clasifica
`DENTRO` —**correctamente**— y el test cae **por su propio ejemplo**.

**El censo acertaba. El ejemplo había dejado de serlo.**

## Y es la SEGUNDA vez en dos días

El comentario de esa misma línea lo dejaba escrito:

> *«SCRUM-1099 (el negativo anterior) se mergeó el 24-sep (PR #1734) y este mismo test pasó a
> fallar en el sentido contrario… Este número ENVEJECE por diseño: en cuanto `scrum-1107b-…` se
> mergee, hay que re-elegir un ticket vivo.»*

**Predijo exactamente lo que pasó. Dos veces.** Y las dos veces el aviso llegó **tarde**: el
test cayó primero, y alguien fue a leer el comentario después.

⚠️ **La segunda vez paró la línea entera.** «build + tests» es obligatorio, así que mientras el
fixture estuvo caducado **ningún PR del repositorio podía entrar** — tres sesiones bloqueadas por
un número de cuatro cifras.

🔴 **Un suelo declarado no deja de ser un defecto por estar declarado.** Un fixture que envejece
por diseño y bloquea a todo el mundo no es un suelo: es una bomba con un comentario al lado.
Decir «esto va a caducar» no es lo mismo que hacer que no caduque, y este fichero lo demuestra
con dos ocurrencias en cuarenta y ocho horas.

### Quién lo disparó

**Yo.** Al desatascar el PR #1743 y mergear 1107 dejé el fixture sin ejemplo. Estaba avisado en
el propio fichero y no lo miré.

## Lo que se ha hecho

**El negativo se DERIVA del estado vivo.** Entre las ramas de `origin`, se busca una que no esté
en `main` y se toma su número.

### 🔴 Por una vía INDEPENDIENTE de la del censo

El test usa **sólo** `ls-remote` + el número de la rama + `merge-base --is-ancestor`. El censo,
además, lee entradas de registro, artefactos y commits.

**Si el censo se equivocara leyendo las ramas, esta derivación no se equivocaría igual** — que es
exactamente lo que un control tiene que garantizar, y lo que un fixture sacado del propio censo
**no** garantizaría. Un control que comparte el error de lo que mide no es un control.

### Y si no hay ninguna rama viva, se SALTA declarando

`null` **no es «todo bien»**: es que el control **no se puede montar**. El caso se salta **con el
motivo escrito**, en vez de pasar en silencio.

> *«⚠️ SIN NEGATIVO: hoy no hay ninguna rama sin mergear en origin, así que el control de "rama
> viva → FUERA" no se ha ejercitado. No es un verde: es que no había caso.»*

Un negativo que no se ejercita y sale verde es **verde sin ganar**, y es la forma más silenciosa
de tener un guard apagado.

### Y una fila ausente ahora es ROJA

Si el censo no trae fila para el ticket que SÍ tiene rama viva, el caso **cae**. Un ticket con
obra abierta que no aparece en el censo es el peor de los casos: **no sale mal clasificado, sale
invisible.**

## Verificado

| | resultado |
|---|---|
| Antes | **1 fail**, nombrando SCRUM-1107 |
| Después | **5 de 5** |
| El negativo que elige solo | **SCRUM-1118** (`scrum-1118-citas-rfact-contiguas`) — la rama viva de verdad hoy |

**`POSITIVOS = [866, 881]` sin tocar:** el control en el otro sentido —los cerrados salen
`DENTRO`— sigue exactamente igual. Sólo se ha cambiado el lado que estaba roto.

## ⛔ Lo que NO se ha hecho

- ⛔ **No se relajó nada** (regla 41 / A7). El criterio del censo —`scripts/censo-regla-42.mjs`—
  **no se ha tocado ni una línea**. Se arregló el ejemplo, que era lo que estaba mal.
- ⛔ No se tocó `POSITIVOS`, ni ningún otro tope, ni ningún otro test.

## ⚠️ Suelo

⚠️ **El caso «no hay ninguna rama viva» no se ha ejercitado de verdad**: hoy hay 147 ramas
remotas y varias sin mergear, así que la vía del salto está escrita y **no observada**. Se dice
en vez de contarla como probada.

⚠️ Se elige **el número más alto** de los candidatos —el más reciente— para que no sea justo el
que está a punto de mergearse mientras corre la tanda. **Es una heurística, no una garantía:**
si ese PR entra entre el `ls-remote` y la comprobación, el caso volverá a caer. La diferencia con
antes es que **se recupera solo en la siguiente pasada**, en vez de necesitar que alguien edite
un número.
