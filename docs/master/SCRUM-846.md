# SCRUM-846 · 19 de 95 instrumentos de medición no tienen un caso conocido delante

**Fecha del expediente:** 15-sep-2026 · **Carril:** instrumentos · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `3b50990f09d0023e7654d14a24a366b7a167a4a5` · 2026-09-15T11:04:12Z
**Sha real del merge que entró sin expediente:** `658976f0a28cd3192c11ddd4040ca934c6a686f7`
(PR #1257, 2026-09-15T10:08:09Z, rama `scrum-846-caso-conocido-por-ast`)
**Rama de esta reconstrucción:** `scrum-846-834-expedientes-reconstruidos`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión de **SCRUM-854**, que midió que este ticket había entrado en `main` sin
> registro. **Todo lo que hay aquí está DERIVADO del árbol y de Jira, y cada afirmación dice de
> dónde sale.** No se ha reconstruido ninguna medición que no se pueda verificar hoy, ni se ha
> inventado un rojo que nadie presenció. Lo que no se pudo saber está en el **§5**, con su nombre.
>
> **El ticket sigue EN CURSO en Jira.** Esto no lo cierra: le pone el registro que le faltaba para
> que el siguiente PR no nazca bloqueado por el guard de SCRUM-854.

---

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Título:** *«🔴 19 de 95 instrumentos de medición NO tienen un caso conocido delante: pueden dar
un cero y nadie sabrá si es real»* · **Tipo:** Error · **Prioridad:** Medium ·
**Estado:** **En curso** · Creado 2026-09-09 por Luis Lara.

El enunciado, citado del ticket:

> «El instrumento de mutación de la Sesión 3 mintió TRES veces sobre sí mismo, y las tres las cazó
> ella. Ninguna la habría cazado un guard. ¿Cuántos otros instrumentos de la casa no tienen nada
> que los vigile?»

Y la regla que lo motiva:

> 🔒 «Un suelo no tiene por qué ser un mecanismo: a veces basta UN caso conocido encima de la mesa.
> **Un cero sin ningún caso conocido delante no se puede juzgar.**»

**Medición original declarada en el ticket** (9-sep-2026, `origin/main` = `19215875`):
137 funciones en **95 módulos** → **76 CON** caso fabricado delante · **19 SIN** ninguno.

**Alcance fijado en el ticket (regla 37):** ⛔ no se abre un ticket por cada instrumento; la lista
vive en el censo y se prioriza por lo que decide cada uno — dinero, camino fiscal y puerta del
robot primero; un censo de clases de botón, el último.

## 2 · Qué entró en `main`, derivado de `git log`

**Tres commits de trabajo**, y sólo uno por una rama propia:

| commit | fecha | entró por | asunto |
|---|---|---|---|
| `322a2a47` | 2026-09-09 | **PR #1238 · rama `scrum-637-verificacion-s5`** | «cuatro instrumentos con un caso conocido delante — y mi censo inflaba la cifra» |
| `a3f8438f` | 2026-09-15 | `186b19a3` (merge de main en `scrum-637-verificacion-s5`) | «mi censo mintió una TERCERA vez hoy, y ésta acusaba de menos» |
| `a476b234` | 2026-09-15 | **PR #1257 · rama `scrum-846-caso-conocido-por-ast`** | «cuarta corrección del censo — la procedencia se resuelve por AST, y la cifra buena es 15» |

### 🔴 Y aquí está el motivo de que nadie lo echara en falta

**Dos de los tres commits entraron dentro de PRs de OTRO ticket** (`scrum-637-verificacion-s5`).
El trabajo de SCRUM-846 viajó dentro de ramas que no llevan su número, así que ni el nombre de la
rama ni el PR delatan que había que escribir `docs/master/SCRUM-846.md`.

> ⚠️ **Esto es un límite del guard de SCRUM-854, y se declara aquí:** aquel guard exige la entrada
> del ticket **de la rama**. Un commit de SCRUM-846 dentro de una rama `scrum-637-*` sigue pasando.
> Cerrarlo obligaría a exigir entrada por **cada** ticket que nombren los commits, y eso no se
> decide en una reconstrucción a posteriori: se mide y se propone aparte.

**Fichero tocado (los tres commits):** `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs`.
El PR #1257 fue `+205 / -24` sobre ese único fichero.

## 3 · Qué dicen los commits (citado, no reinterpretado)

El mensaje de `a476b234` documenta la cuarta corrección. Se cita porque **está en git y se puede
verificar**; no es una medición de esta sesión:

* **El defecto que corrige:** el criterio era de regex sobre el texto y *«mentía hacia los dos
  lados»*. Un `for-of` desestructurado casaba cualquier `for-of` del fichero sin mirar el nombre,
  y todo acceso a propiedad contaba como caso fabricado.
* **El criterio nuevo:** el nombre se resuelve **en su ámbito léxico**, y cada forma es una regla
  con su siembra en el control negativo — *«19 siembras, todas en verde»*.
* **La cifra declarada:** **81 CON / 15 SIN de 96 módulos** (antes `main` decía 83/13), calibrada
  contra 20 veredictos a mano, **20/20**.
* **Límites que el propio commit declara:** sólo se mira el **primer argumento** de cada llamada,
  así que `detector('x.ts', leerDeVerdad())` saldría con caso; y el juicio a mano cubre los 20
  módulos donde los criterios discreparon, **no los 96** — *«donde los dos criterios coinciden,
  pueden equivocarse juntos»*.
* **La calibración no se comiteó**, a propósito: *«una lista cableada caduca»*.

## 4 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

El censo existe y corre hoy sobre `main`. **Esto sí es medición propia**, y se marca como tal
para no confundirla con la del ticket:

```
INSTRUMENTOS censados: 141 funciones en 99 modulos
  CON caso fabricado delante: 84  (77 en la función censada misma, 7 en una hermana …)
  SIN ninguno:                15
SUELO — los tres que YA sé que lo tienen:  ✅ CON tautologiasDe · enPatronPeligroso · censarReferenciaMovil
CONTROL NEGATIVO — sembrado, en los dos sentidos: ✅ un censo que sólo recibe la raíz sale SIN
```

`rc=0`. La población ha crecido de 96 a 99 módulos (esta sesión misma añadió dos), y **los SIN
siguen siendo 15**. El censo trae su suelo y su control negativo dentro y los pasa.

## 5 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

Se nombra en vez de rellenarse. Cada punto es algo que **sólo sabe quien hizo el trabajo**:

1. **Los rojos de las cuatro correcciones.** El commit dice que el censo mintió cuatro veces y que
   las cazó contrastándolo con uno estricto y juzgando a mano. **Esas ejecuciones no están en el
   árbol** y no se reconstruyen: enseñar aquí un rojo que no presencié sería fabricar evidencia.
2. **La calibración de 20 veredictos a mano.** El propio commit dice que **no se comiteó**. No hay
   forma de verificar el «20/20» ni de saber qué 20 módulos eran.
3. **Qué instrumentos de los 15 se han priorizado**, y por cuál se empieza. El ticket fija el
   criterio (dinero, fiscal y puerta del robot primero) pero no consta la decisión tomada.
4. **Las dos primeras correcciones** (las que el ticket llama ① y ②) no tienen commit propio
   localizable en `main` con ese número: el ticket las describe, el árbol no las separa.
5. **Por qué el trabajo viajó en ramas de `scrum-637`.** Puede ser deliberado —mismo carril de
   verificación S5— o accidental. No consta, y la diferencia importa para decidir si el guard de
   SCRUM-854 debería cubrir ese caso.
6. **El estado real del ticket.** Jira dice «En curso»; el árbol no dice qué falta para cerrarlo.

## 6 · Lo NO tocado por esta reconstrucción

No se ha modificado ni una línea de `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs` ni
de ningún otro fichero del ticket. Esto es **sólo el registro que faltaba**.
