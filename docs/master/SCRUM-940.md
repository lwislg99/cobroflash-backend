# SCRUM-940 · Los suelos que ya no pueden saltar

**Medido contra:** `origin/main` = `652d90ec2f73b1f8a17b4d096fb2da2bb96fcf52` · 2026-09-17T22:16:13+01:00

**Rama:** `scrum-940-suelos-que-no-pueden-saltar`

> ⛔ **No se ha subido ningún suelo.** Ni `SUELO_GUARDS` ni `SUELO_DECLARACIONES` —los está
> subiendo S2 en SCRUM-812 fase c— ni ningún otro: esto mide y propone.
> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36).
> ⚠️ **Esto NO afirma que sea un patrón.** Ver §3: es un censo completo de la FORMA y una MUESTRA
> medida del cociente. La diferencia está dicha donde toca.

---

## 1 · ① El censo · las dos cifras, y la tercera que nadie cuenta

| | |
|---|---|
| ficheros de `tests/` y `scripts/` mirados | **1.245** |
| de ellos, **instrumentos** | **789** |
| · con al menos un suelo | **379 · 48 %** |
| · 🔴 **DESNUDOS** (ningún suelo) | **410 · 52 %** |
| **suelos hallados** | **861** |
| · de POBLACIÓN CENSADA (los únicos que envejecen) | **496** |

**Más de la mitad de los instrumentos de esta casa no tienen suelo.** No están mal calibrados:
están desnudos. Su cero no se distingue de un cero de detector roto, y nada lo diría.

### Cómo se reconoce un suelo · por forma, no por nombre

La forma es *una magnitud comparada contra un mínimo, dentro de algo que aborta*. Eso solo da
**1.766** coincidencias en el árbol, y ahí dentro están `buf.length > minBytes` y `html.length > 0`,
que no protegen ninguna conclusión. Lo que distingue a un suelo es **su sentido**, y se reconoce
por cualquiera de tres señales:

| señal | cuántos |
|---|---|
| ① el tope es una constante declarada como suelo (`SUELO_*`, `MINIMO_*`, `*_MIN`) | 68 |
| ② el mensaje declara ceguera («CIEGO», «no ha mirado», «no está midiendo»…) | 802 |
| ③ la comparación está en un `if` que **aborta** (`throw`, `process.exit(n≠0)`) | 42 |

El nombre nunca decide solo: `if (n < 3) throw` no lleva constante y es un suelo.

### Y lo que se sacó del censo, con su motivo

**Relojes y básculas.** Un tope de 20.000 junto a `.length` parece un suelo enorme y es un
*timeout* en milisegundos; uno de 5.000 es el tamaño de un PDF en bytes. Salieron en la primera
muestra medida. Ninguno envejece con la población del árbol —que es el defecto de este ticket—,
así que no son el sujeto. Contarlos habría inflado el censo con comparaciones que **no pueden
estar muertas porque nunca midieron una población**.

## 2 · ② y ③ · declarado contra real, y la clasificación

El valor real no se puede leer del código: un suelo sólo publica su población cuando falla. Se
mide **por bisección** —se sube el tope hasta que el test cae; el mayor valor que NO cae es la
población de hoy—, que no exige interpretar ningún mensaje, sólo el código de salida.

**Cuesta ~log₂(N) ejecuciones por suelo, así que se midió una MUESTRA de 11, no los 496.** Se dice
aquí y no en una nota al pie: **lo de abajo es una muestra, no un censo de cocientes.**

| decl | real | cociente | clase | dónde |
|---|---|---|---|---|
| 54 | 273 | 0,20 | 🔴 MUERTO | `tests/scrum763-restaurar-el-arbol.test.mjs:139` |
| 20 | 86 | 0,23 | 🔴 MUERTO | `tests/scrum765-la-puerta-y-el-suelo.test.mjs:219` |
| 50 | 273 | 0,18 | 🔴 MUERTO | `tests/restauracion-del-arbol-ejecutable.test.mjs:179` |
| 40 | 96 | 0,42 | 🔴 MUERTO | `tests/public-js-parsea.test.mjs:92` |
| 200 | 6.102 | 0,03 | 🔴 MUERTO | `tests/scrum225-mapa-tres-bd.test.mjs:79` |
| 5 | 11 | 0,45 | 🔴 MUERTO | `tests/scrum158-montajes-admin-muestreados.test.mjs:49` |
| 196 | 287 | 0,68 | ✅ **VIVO** | `tests/scrum243-tenencia-lectura.test.mjs:190` |
| 7 | 7 | 1,00 | ⚠️ pegado | `tests/scrum128-frontend-census.test.mjs:122` |
| 14 | 14 | 1,00 | ⚠️ pegado | `tests/scrum176b-force-por-identidad.test.mjs:100` |
| 2 | 2 | 1,00 | ⚠️ pegado | `tests/scrum198-consumidores-xml.test.mjs:164` |
| 20 | — | — | NO DECIDIBLE | `scripts/meta-guard-mutaciones.mjs:120` (ya rojo con su propio valor) |

### 🔴 Los tres «AJUSTADOS» NO son un defecto, y lo dice haberlos mirado a mano

Mi clasificación los marcó como AJUSTADO —cociente ≥ 0,9, «salta con el primer borrado
legítimo»—. Al abrirlos, los tres están pegados **a propósito**:

- `SIGUEN_BLOQUEADOS.length >= 14` — una lista de casos peligrosos **enumerada a mano**;
- `CONOCIDOS_AL_MEDIR.length >= CENSO_MIN` — un censo de calibración, cuyo propio mensaje dice
  «sólo se baja si un fichero se BORRÓ del repo de verdad, a propósito y con el motivo»;
- `consumidores.length >= 2` — «las DOS conocidas»: perder una **debe** saltar.

Ninguna es una población que crezca con el árbol, así que estar pegado es el diseño, no el
descuido. **En esta muestra no he encontrado un solo AJUSTADO que sea defecto.** El defecto
contrario que el encargo temía puede existir; estos datos no lo demuestran.

    🔒 Un suelo de población envejece solo. Un trinquete sobre una lista escrita a mano, no.

### Lo que sí se puede afirmar, y lo que no

**Se puede:** los dos casos que abrieron el ticket están muertos, confirmado por reducción y no
por división. Y hay al menos otros cuatro en la muestra.
**No se puede:** decir qué proporción de los 496 está muerta. Once no son 496, y elegí la muestra
mirando los tramos de tamaño, no al azar.

## 3 · Los controles, EJECUTADOS

### 🔴 POSITIVO · los dos conocidos salen MUERTOS, y por el eje correcto

```
SUELO_DECLARACIONES  declarado 54 · real 273 · 0,20
SUELO_GUARDS         declarado 20 · real  86 · 0,23
```

No por su nombre: **por el cociente**, medido ejecutando. Y hay dos sondas independientes de
acuerdo — la bisección y una llamada directa a `censoDeDeclaraciones()` dan **86 y 273** las dos.

⚠️ Y un dato que no buscaba: **S2 midió esta mañana 83 guards y 254 declaraciones; esta noche son
86 y 273.** El defecto se agrava solo. La población crece mientras el suelo sigue quieto, que es
exactamente el mecanismo que lo mata.

### 🔴 EL QUE DECIDE · reducir la población, no dividir

`20/86 = 0,23` es aritmética sobre dos números que he leído yo. Lo que decide es bajarle la
población al suelo y ver que sigue callado. Sobre el **mecanismo real** (`sueloDelCenso()`, la
función que usa el guard), con poblaciones reducidas:

```
hoy, sin tocar nada              →  86 guards · 273 declaraciones  ·  🔇 calla
perdiendo un cuarto              →  64 guards · 204 declaraciones  ·  🔇 calla
perdiendo LA MITAD               →  43 guards · 136 declaraciones  ·  🔇 calla
perdiendo tres cuartos           →  21 guards ·  68 declaraciones  ·  🔇 calla
justo POR ENCIMA del declarado   →  21 guards ·  55 declaraciones  ·  🔇 calla
justo POR DEBAJO del declarado   →  19 guards ·  53 declaraciones  ·  🔊 HABLA
```

**La casa puede perder la mitad de sus guards y este suelo no dice nada.** Y la última línea
importa tanto como las otras: el mecanismo **funciona**. No está roto, está mal puesto.

### ✅ NEGATIVO · un suelo bien calibrado sale VIVO

`tests/scrum243-tenencia-lectura.test.mjs:190` — `MINIMO_QUE_FILTRAN`, declarado 196 sobre 287
reales (0,68): perder un tercio de las lecturas que filtran lo dispara. **Ése era el que tenía que
salir verde, y sale.** Revisado a mano: su mensaje lleva ancla de fecha y explica qué significa
que baje.

### SUELO DEL PROPIO CENSO

Si el barrido no encuentra ningún suelo, aborta declarando CIEGO — hay al menos dos medidos.

## 4 · ④ La propuesta · cómo se deriva una holgura honesta

**No se implementa nada de esto.**

### Primero: la vía de S2 no generaliza con los datos que hay

S2 derivó su holgura midiendo cuánto se movía su cifra **al día**. Es la dirección correcta —una
holgura medida vale más que una intuición—, pero **no se puede generalizar todavía, y el motivo es
de método**: entre su medición y la mía hay dos puntos (83 → 86 guards).

    🔒 Dos muestras no son una dispersión: son una diferencia.

Es la lección que este repositorio ya se comió en SCRUM-790. Para derivar una holgura de la
variación haría falta una **serie**: recalcular la población en N commits del historial y mirar
cuánto BAJA —no cuánto crece—, porque lo que un suelo tiene que tolerar son los borrados
legítimos, no el crecimiento.

### Y la propuesta de fondo: el suelo no es el número, es el cociente

Un suelo escrito a mano nace con la población de su día y **envejece solo**, sin que nadie toque
nada. Subirlo hoy a 86 sólo compra unas semanas: dentro de un mes volverá a estar al 0,5.

    🔒 Un número derivado no se elige: se recalcula.

Lo que no caduca es **la relación**. En vez de `assert(guards >= 20)`, lo que se vigila es que el
suelo siga guardando proporción con lo que protege:

1. **Se guarda el par, no el número**: valor y población del día en que se midió, con su fecha —
   que es lo que hoy ya hace el comentario de `meta-guard-mutaciones.mjs`, pero sin que nada lo
   compruebe.
2. **Un guard exige que el cociente no baje de un umbral** (p. ej. 0,5): el día que la población
   dobla, salta pidiendo que se vuelva a poner el listón. No pide un número: pide una decisión.
3. **La holgura hacia abajo se mide, no se inventa**: cuánto baja la población en un mes normal,
   sacado del historial. Mientras no exista esa serie, cualquier cifra concreta sería lo mismo que
   este ticket viene a denunciar.

### Y lo que NO hay que hacer, porque es peor

**Subir los suelos en bloque.** Un suelo mal calibrado hacia arriba pone la tanda en rojo por
sorpresa, y un rojo que nadie entiende lo apaga el segundo que lo ve. Los 496 no se tocan de
golpe: se empieza por los que protegen algo caro y se les mide el real primero.

Y los **410 instrumentos desnudos** son otro ticket: ponerles suelo es escribir 410 instrumentos,
no ajustar 410 números.

## 5 · Lo que esta tanda NO ha medido

1. **El cociente de los 496.** Sólo 11, y elegidos por tramos.
2. **Cuánto baja una población en un mes normal**, que es lo que haría falta para §4.3.
3. **Si los 410 desnudos lo están por descuido o porque su conclusión no necesita suelo.** No es
   lo mismo y no lo he mirado.
4. **Los suelos de `docs/`**: fuera del censo a propósito, sus actas no protegen ninguna tanda.

## 6 · Errores míos

1. **El detector perdía el caso conocido.** Exigía que la magnitud acabara en `.length`, y
   `SUELO_GUARDS` compara `guards >= SUELO_GUARDS` —una variable ya contada—, así que **no salía**.
   Lo cazó el control positivo, que para eso estaba.
2. **No resolvía constantes importadas**, y `SUELO_DECLARACIONES` salía como «no decidible» siendo
   el otro caso conocido. Y al arreglarlo metí el error simétrico: guardé TODAS las constantes
   numéricas, también las minúsculas, y entonces en `guards >= SUELO_GUARDS` los dos lados
   parecían tope y la comparación se descartaba otra vez.
3. **Mi criterio por mensaje reconocía 749 de 759** — casi todo, porque «suelo» es vocabulario
   corriente aquí. Un criterio que dice que sí a casi todo no separa nada.
4. **Escribí un banco con un heredoc y `'\\b'` llegó al disco como `'\b'`** — el carácter
   BACKSPACE, no un límite de palabra. El regex no casaba nunca y **seis suelos de once salieron
   «no decidible» por un fallo mío, no por el árbol**. Lo destapó ver `SUELO_GUARDS` en la línea y
   el contador diciendo cero: cuando el instrumento y lo que ves se contradicen, se mira el
   instrumento.
5. **Acusé en falso a tres suelos** como AJUSTADOS: eran listas escritas a mano, pegadas a
   propósito. Tres de once — un 27 % de la muestra. Lo cazó abrirlos, no el código.
6. **Mi primer control negativo no podía funcionar**: intenté «simular un suelo bien calibrado»
   llamando a una función que lleva el suelo CABLEADO dentro, así que medía el mismo suelo muerto
   con otros números. Salió en rojo y tenía razón. El negativo de verdad no se simula: se mide
   sobre un suelo real que esté bien puesto.

## 7 · Ficheros

| fichero | qué |
|---|---|
| `scripts/_censo-de-suelos.mjs` | el instrumento: reconoce suelos por forma y clasifica por cociente |
| `tests/scrum940-el-censo-de-suelos.test.mjs` | su caso conocido, en los dos sentidos. **No es un trinquete** |
| `docs/master/evidencias/scrum940/censar.mjs` | el acta del censo |
| `docs/master/evidencias/scrum940/reales-por-biseccion.mjs` | el valor real, medido ejecutando |
| `docs/master/evidencias/scrum940/el-que-decide.mjs` | la reducción de población sobre el mecanismo real |
