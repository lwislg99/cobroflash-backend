# SCRUM-568 · La promesa con fecha, con mecanismo — hoy 0 de 9

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-21T16:20:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14.

**21-ago-2026** · **Carril:** B (landing) · **Gate:** el test corre en `npm test` y está **VERDE
hoy**: esto es un registro, no una puerta

**Alcance:** el registro de anclas de nueve afirmaciones, una línea de estado y un test. **No se
escribe ninguna nota. No se toca ninguno de los nueve textos. No se toca ningún flag.**
`public/index.html` **intacto**.

**Rama:** sale de `scrum-564-documentar-la-condicion` y no de `main`, a propósito: la medición del
punto 4 vive allí y todavía no está fusionada. Si sólo se fusiona ésta, la medición viaja con ella.

---

## ⓪ La decisión cambió, y la medición es la que la cambió

El 20-ago-2026, **después** de leer los caracteres que caben en cada sitio, el fundador decidió:

> **No se documenta la condición.** Los tres medios se quedan enunciados como están. *«Cuando
> hagamos el go para empezar a vender, todo será verdad. De momento no pasa nada.»*

Eso **anula** el encargo anterior. **Este ticket no revisa esa decisión: la sostiene.** Lo que hace
es convertir *«antes del go, o los medios están encendidos o los nueve textos cambian»* en algo que
el repositorio comprueba solo.

## ① Nueve, no diez — mi propia corrección, usada

`faq/div#3` **no pertenece**: dice «cobro», no nombra ningún medio, y el cobro por transferencia
existe hoy. Queda fuera de las nueve, como pedía el encargo. (Sigue apareciendo como `FALSA` en el
registro de SCRUM-564 por su vieja declaración `SIN_ANCLA`; reclasificarla exige anclarle nueve
capacidades y **sigue abierto**.)

## ② Ancladas con 551 + 558, no declaradas «falsas» a mano

Las nueve pasan de `anclas: SIN_ANCLA` —un veredicto escrito por una persona— a **ancla real +
`tras`**, así que su veredicto lo **deriva** `alcanzabilidad()` del valor que tengan hoy los flags.

| ancla | símbolo |
|---|---|
| tarjeta | `payCard.routes.ts::/card/:token` |
| Bizum | `payBizum.routes.ts::/bizum/:token` |
| transferencia | `payBank.routes.ts::/bank/:token` |

Las tres **vivas**, comprobadas con `anclaViva()`. Las puertas declaradas en `tras`:
`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED`, cada una con su motivo.

## ③ 🔴 Por qué `tras` NO lleva `porDefecto` — desviación medida del encargo

El encargo pedía `porDefecto: false`. **Con él, el punto 2 no se cumple.** Medido antes de decidir:

| | flag apagado | flag encendido |
|---|---|---|
| con `porDefecto: false` | 🔴 ANCLADA PERO INALCANZABLE | **EL VALOR DECLARADO CADUCÓ** ← sigue en rojo |
| sin `porDefecto` | 🔴 ANCLADA PERO INALCANZABLE | **sin problemas → ALCANZABLE** ← cambia solo |

`porDefecto` es un **centinela de la foto**: avisa de que alguien movió el valor. Es útil — pero
exige **una edición** para pasar a verde, y eso es exactamente lo que el punto 2 prohíbe («si hay
que editar un fichero para que cambien, NO SIRVE»). **Gana el punto 2.**

🟢 **El valor observado no se pierde:** está en el `motivo` de cada puerta y en
`DEFECTOS_AL_DECLARAR`, que un test vigila **sin condicionar el veredicto de nadie**. Si alguien
mueve un default, ese test cae **diciendo que el mundo se movió** — no bloqueando por lo de hoy.

## ④ El punto que da sentido a todo: el veredicto cambia solo

```
node → estadoCondicionadas(...)                  de las 9 afirmaciones condicionadas a un flag,
                                                 0 son alcanzables hoy
node → estadoCondicionadas(..., flagsEncendidos) de las 9 afirmaciones condicionadas a un flag,
                                                 9 son alcanzables hoy
```

**Sin tocar ningún fichero.** La tabla P se puede inyectar (`veredictos(html, raiz, censoF,
tablaP)`), y eso es lo que permite que una prueba lo ejercite: sin ella, «cambia solo» sería una
intención escrita en un comentario.

Y un control que separa «depende del flag» de «depende de algo»: **con un solo flag encendido sólo
cambian las que dependen de él**, y las que siguen fuera son exactamente las que declaran la otra
puerta.

## ⑤ El estado, en una línea — punto 3

**«de las 9 afirmaciones condicionadas a un flag, 0 son alcanzables hoy»**

N se cuenta por las entradas que declaran `tras`, no por una lista escrita a mano que se quedaría
vieja el día que aparezca la décima.

## ⑥ La medición archivada — punto 4

`docs/DONDE_CABE_LA_CONDICION.md` y `scripts/_hueco-condicion.mjs` **se reencuadran**: la decisión
que los motivó ya no existe, y un documento que sigue diciendo «se va a documentar la condición»
miente. Ahora dicen lo que son: **un archivo**, para el día que haga falta una nota si el go llega
antes que los flags.

Lo que se guarda: junto al texto **6–43** caracteres · pie del bloque **36–56** · pie de sección
**45–187**, con los dos números por sitio («1 línea» y «sin mover») y qué significa cada uno.

**Y las tres trampas**, porque las va a repetir el siguiente:

1. **`elementFromPoint` es relativo al viewport** y estas secciones están bajo el pliegue: sin traer
   la sonda a la vista salía «tapada» en los 30 sitios.
2. **Hay que exigir que la sonda SE VEA**, o se mide dentro de un `<details>` cerrado y el binario
   concluye «caben 400 caracteres» donde no se ve ni uno.
3. **La foto de táctiles, con el scroll FIJO.** Con la base sin desplazar salían diferencias
   negativas — la señal de que se comparaban dos páginas, no dos estados de la misma.

## ⑦ Verificación

**SUELO** — si el censo de condicionadas devuelve cero, falla declarándose ciego: un cero se leería
como «ninguna promesa depende de una puerta cerrada», que es justo al revés.

**CONTROL POSITIVO** — todas las anclas vivas del bloque F siguen vivas; y lo que **no** está
condicionado no se mueve al encender los flags.

**ROJO POR EL MECANISMO** — el que decide, sobre `<SHA>`: se enciende el flag y las nueve pasan de
INALCANZABLE a alcanzable **solas**. Se ejercita de dos formas: inyectando la tabla P (en el test,
sin tocar nada) y **editando `src/core/flags.ts` de verdad**, con reversión byte a byte contra el
blob.

**Tanda completa:** ver informe.

## ⑧ De camino: una regla que yo mismo incumplí

🟠 `docs/master/SCRUM-564-condicion.md`, que creé ayer, **violaba SCRUM-273**: los ficheros de
`docs/master/` se llaman `SCRUM-<n>.md` para que dos tickets no escriban nunca en el mismo sitio.
Se ha convertido en **apéndice de `SCRUM-564.md`**, sin borrar nada de lo anterior, que es una de
las dos salidas que el propio guard propone.

⚠️ **Y hay otro igual sin arreglar:** `docs/master/SCRUM-555-punto4.md`, en la rama
`scrum-555-suelo-n-m`, que **todavía no está fusionada**. Habrá que hacerle lo mismo antes de
fusionarla.

🟢 Existe `npm run guards:entrada` —cuatro guards estructurales en 11 s— y **es lo que había que
haber corrido antes de empujar** las dos veces. Ahora está corrido: 21 tests en verde.

## ⑨ La mitad que no es código — decide el fundador

El mecanismo dirá «0 de 9» el día del go **y nadie lo habrá mirado** si esa línea no sale del
repositorio. Tres sitios posibles, y la decisión es suya:

| dónde | aporta | le falta |
|---|---|---|
| `docs/RUNBOOKS.md`, en el runbook de lanzamiento | es donde ya se buscan los procedimientos, y SCRUM-273 nombra ese fichero como destino de lo operativo | no hay hoy un runbook de «go comercial»; habría que abrirlo |
| Parte U del máster, junto al sprint del go | lo lee quien decide el orden, y el máster es la fuente única | el máster no es una lista de comprobación: se lee al planificar, no el día de |
| `/yaqu-release-check` (la skill de cierre) | ya se ejecuta y ya imprime estado; añadir una línea es barato | hoy cierra sprints, no lanzamientos comerciales: sería estirar su alcance |

**Mi recomendación, con el motivo:** `docs/RUNBOOKS.md`. Es el único de los tres que alguien
**ejecuta** en una fecha concreta, y esto es una comprobación de fecha concreta. Pero no lo he
creado: abrir un runbook de lanzamiento es una decisión de producto.

## ⑩ Lo que NO se ha hecho

- ⛔ **Ninguna nota de condición.** El fundador decidió que no. Un test lo comprueba sobre el marcado.
- ⛔ **Ninguno de los nueve textos tocado** — verificado byte a byte.
- ⛔ **Ningún flag encendido.** Reglas 18 y 23.
- ⛔ **Ningún mecanismo nuevo:** 551 + 558 llegaban. Lo único que no llegaba era `porDefecto`, y
  está dicho en ③ en vez de construir un tercero.
- ⛔ **Nada que deje el CI en rojo hoy.** El test está verde con las nueve inalcanzables, porque eso
  es la decisión correcta.
