# SCRUM-267 · ANCLA-DE-MEDICIÓN: una entrada declara contra qué `main` se midió, y cuándo

**Fecha:** 3-ago-2026 · **Carril:** B (docs/tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `b8094d77544a69f4b78e14be9382008f593f578f` · 2026-08-03T19:15:00+02:00

## El defecto

Dos incidentes el mismo día:

* **Javier paró** ante una contradicción entre Jira y el máster: uno decía «hecho y en main», el
  otro «por hacer». Hizo lo correcto —no avanzar sobre una afirmación que no podía comprobar—
  pero **no tenía forma de saber cuál de los dos estaba viejo**.
* Una medición **correcta** de otra sesión **caducó en una hora**, porque `main` se movió tres
  veces mientras trabajaba. El dato no estaba mal: estaba viejo, y nada en el texto lo decía.

El segundo define el diseño. **El problema no es medir mal: es que una medición buena no lleva su
fecha de caducidad encima.** Con cuatro sesiones mergeando, `main` cambia varias veces por hora —
este mismo ticket vio la base moverse entre el `fetch` y el `worktree add`.

## La decisión, y por qué

El ancla va en el **encabezado de toda entrada**, no junto a cada afirmación:

```
**Medido contra:** `origin/main` = `<sha de 40>` · <ISO-8601 con huso>
```

Se descartó **detectar la afirmación** —buscar «está en main», «mergeado»— por dos motivos medidos
en este repo: sería un **guard de texto**, y un guard de texto **se caza a sí mismo** en la prosa
que explica la prohibición (ha mordido cinco veces); y **se esquiva reformulando**. *Una regla que
depende de cómo escribas la frase no es una regla.*

Exigirlo en todas es estructural: la comprobación es «¿el encabezado tiene el campo?», no «¿la
prosa afirma algo?». Y no es burocracia — **toda entrada se produce contra algún `main`**, así que
declararlo siempre significa algo. Lo que cambia es que **deja de ser costumbre y pasa a ser
mecanismo**.

**Sha de 40, no abreviado:** `1bb0b5e` aparece en tres ramas distintas de este repo en una semana.
Un sha corto identifica un commit igual de mal que un número de PR identifica un ticket (R12).

**Fecha Y hora, con huso:** sin hora, el ancla no distingue «medido hace cinco minutos» de «medido
esta mañana», que es exactamente la diferencia que costó la vuelta.

## Por qué no vive dentro del guard de SCRUM-273

Responden preguntas distintas —273 vigila **dónde** se escribe el registro; éste, **qué lleva
dentro** cada entrada— y un rojo de «falta el ancla» aterrizando en un fichero llamado
*registro-por-fichero* obliga a quien lo lee a averiguar cuál de las dos reglas rompió.

Y la razón que decide: 273 guarda un **censo congelado**. Colgarle una propiedad nueva haría que
ese fichero cambiase por motivos ajenos al censo — **la misma mezcla de lo estable con lo que
cambia a menudo que causó SCRUM-273**, repetida dentro del propio arreglo.

**Coste aceptado:** dos ficheros recorren `docs/master/`. Si el directorio se mueve, hay dos
sitios que tocar. Un helper compartido para seis líneas sería un tercer fichero y no compensa.

## El censo heredado, y por qué no es una allowlist

Al llegar este guard, `docs/master/` ya tenía entradas escritas **cuando el README todavía no
mencionaba el campo**: SCRUM-231, SCRUM-244 y SCRUM-264. Quien las escribió **hizo lo correcto
según la documentación vigente**; exigirles una regla que no estaba escrita sería castigar a quien
siguió el formato. Por eso el README y el guard entran **en el mismo merge**: la regla se dice y se
exige en el mismo instante, sin ventana entre los dos.

Dos condiciones lo separan de una lista de excepciones:

1. **No puede crecer.** Cualquier entrada que no esté en el censo necesita ancla o es rojo. El
   conjunto queda cerrado en el mismo commit que lo crea.
2. **Si el número baja, también falla.** Cuando alguien le ponga su ancla a una de las tres, el
   guard le obliga a actualizar el censo — la mejora queda **anotada** en vez de pasar
   desapercibida.

**No se van a rellenar**, y es decisión del fundador con su razón: el ancla sirve para saber si una
afirmación sobre `main` ha caducado, y **nadie relee la entrada de un ticket ya cerrado para
decidir nada**. Su valor es **prospectivo**. Reconstruirlas hoy no sería recordarlas: sería
inventarlas, y un ancla que ancla a otra cosa es peor que ninguna.

### Lo que NO entró en el censo, y por qué importa la diferencia

Mientras este ticket esperaba merge entraron en `main` **más entradas sin ancla** —`SCRUM-274` fue
la primera—. **Ninguna se añadió al censo**, y el criterio es el que sostiene todo lo anterior:

> El censo se justifica por una **fecha** —«el formato existía sin el campo»— y esa fecha es el
> merge de SCRUM-267. Una entrada que llega **mientras** 267 espera no es anterior a la regla: es
> **contemporánea**. Meterla convertiría un corte fechado en lo que se descartó por la mañana:
> una lista que crece con buenas razones.

Y la diferencia con `SCRUM-252`, que sí necesitó que su dueña actuara: aquella **ya estaba en
`main`** antes de que el guard existiera, así que solo cabía o censarla o reconstruir su medición.
`SCRUM-274` todavía podía ponerse el ancla **antes de que el guard llegara** — y eso se arregla
**sin que nada se ponga rojo en ningún momento**.

Se resolvió congelando los merges de las cuatro sesiones unos minutos: la sesión dueña de la
entrada añadió su ancla —una línea, con el dato fresco— y este ticket entró después. **Parar la
fuente cuesta veinte minutos; perseguir rezagados a golpe de rebase no termina nunca.**

## Verificado en rojo

Cinco, cada uno con una sola causa y con el mensaje que da el diagnóstico:

* entrada nueva **sin ancla** → *no declara «Medido contra»*
* **sha de 7** → *el sha está ABREVIADO (hacen falta las 40 posiciones)*
* **sin hora** → *falta la HORA (la fecha sola no dice si caducó)*
* **barrido ciego** → lo caza el suelo: «no hay entradas sin ancla» y «no miré» dejan de verse igual
* **una del censo recibe su ancla y el número no se actualiza** → rojo. Es el que demuestra la
  segunda condición: el guard falla **por una mejora**, a propósito.

## Lo que NO cubre

* **No valida que el sha exista** ni que sea antepasado de nada: comprueba la forma, no el hecho.
  Un sha de 40 hex inventado pasa. Atarlo al repositorio exigiría ejecutar `git` desde el test, y
  eso convierte un guard de formato en uno que depende del estado del clon.
* **No comprueba que la hora sea plausible**: una fecha de 1999 con huso válido pasa.
* **No exige ancla en las entradas del máster antiguo** (las 110 anteriores a SCRUM-273). Ese
  documento está cerrado a entradas nuevas y no se reescribe.
* **No mide si el ancla se corresponde con el trabajo**: dice contra qué `main` se midió, no que se
  midiera bien. Eso lo sostienen los guards de cada ticket, no éste.

## Ficheros

* `tests/scrum267-ancla-de-medicion.test.mjs` (5, sin gate).
* `docs/master/README.md` — el campo en el formato, su porqué, y el corte fechado con por qué esas
  tres no se rellenan.
* `docs/master/SCRUM-273.md` — recibe su ancla.
* `docs/master/SCRUM-267.md` — esta entrada.
