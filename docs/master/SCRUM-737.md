# SCRUM-737 · Un número necesita su unidad, su ÁRBOL y su HORA

**Medido contra:** `origin/main` = `97f95f9f5cc7b311c255d9bee70a3a77ad2dfff8` · 2026-09-04T23:33:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** censar las cifras congeladas en comentarios de `tests/` y `scripts/`, arreglar las
dos instancias medidas y dejar el censo atado. **Cero ficheros de `src/`.** No se toca ninguna
cifra «actualizándola» al valor de hoy.

---

## 0 · PASO 0 — el motor ya existía, y no se rehace

**Éste es el hallazgo que ahorró el ticket entero.** La casa ya tenía las tres piezas:

| Pieza | Qué aporta |
|---|---|
| `tests/_afirmaciones-derivadas.mjs` (SCRUM-498) | *«el 21 se cuenta; la prosa que lo escribe, se ata»* — y ya distingue que **un número con fecha visible no es el defecto** |
| SCRUM-680 | Llegó más lejos: *«una frase sin número no se desincroniza»*. **Reformular gana a atar**, porque no deja nada que mantener |
| `tests/_solo-codigo.mjs` (SCRUM-693/696) | Separa comentarios de código con el **scanner de TypeScript**, no con regex |

Lo que faltaba **no era el mecanismo**: era **censar quién más tiene el problema**. Así que aquí
no se reimplementa nada — se le da superficie.

### Los comentarios se DERIVAN del motor, no se re-implementan

`soloComentarios` es el complemento exacto de `soloCodigo`: **lo que aquél blanquea es, por
definición, lo que hay que mirar**. Se conservan las posiciones, así que el número de línea sigue
siendo el real. Dos consecuencias: no pueden divergir, y si el motor mejora, este censo mejora
con él.

**Y por eso no es un barrido de texto:** una URL dentro de una cadena (`'http://x/25'`) no es
comentario, y una cadena dentro de un comentario sí lo es — las dos cosas **por construcción**.

## 1 · Qué cuenta este instrumento, dicho ANTES del número

Lección de SCRUM-714: cada instrumento declara su unidad.

**NO** cuenta «toda cifra que aparece en un comentario». Eso son **312 en 171 ficheros**, y la
inmensa mayoría son legítimas: `«Caso 2:»`, `«las 4 rutas»`, `«21% IVA»`, `«3 merchants del mismo
test»`. Ninguna caduca, porque ninguna afirma un estado del árbol.

Cuenta **las afirmaciones de RECUENTO DEL ÁRBOL EN UN MOMENTO** — las que dicen cuántos hay
*hoy*, cuántos *se midieron*, cuántos pasan en la *suite*. Ésas envejecen solas y en silencio.

## 2 · El censo

| | |
|---|---|
| Población **declarada** | `tests/*.mjs` + `scripts/*.mjs` = **853** ficheros (856 tras mezclar `main`) |
| Cifras sin ancla **al empezar** (4-sep-2026) | **80**, en 62 ficheros |
| Tras retirar las dos de este ticket | **78** |
| **Al mezclar `main`** (4-sep-2026) | **80** otra vez — ver abajo |

### 🟢 Y el guard cazó TRES cifras nuevas el mismo día en que se escribió

Al mezclar `main`, el censo **volvió a subir**: primero a **80** —SCRUM-740 entró con **dos**
cifras de recuento sin fecha, en `tests/scrum740-carrera-por-el-arbol.test.mjs` y
`tests/_barrido-estable.mjs`— y luego a **81**, con **una más** de SCRUM-742 en
`scripts/censo-internos-de-prisma.mjs`.

**Tres cifras, de tres sesiones distintas, en una sola tarde.** Ése es el ritmo real al que
aparece el defecto, y explica por qué S3 vio caducar seis de siete cifras en 90 minutos.

**No se arreglan aquí** — es su carril, no el mío (regla 9). Pero **no se diluyen en el total**:
quedan **nombradas** en `HEREDADAS_FUERA_DE_CARRIL`, con el patrón de `PENDIENTES_FUERA_DE_CARRIL`
de SCRUM-498, y un test comprueba que siguen ahí — de modo que **el día que su ticket las arregle,
el guard avisa de que hay que vaciar la lista y bajar el congelado**. Subir un total sin decir qué
lo subió es exactamente cómo un censo se convierte en un número que nadie mira.

**Es la mejor evidencia de que el instrumento sirve: el defecto reapareció en cuestión de horas.**

### 🔴 SUELO, que era condición del encargo

El encargo decía: *«si devuelve cero, falla. Hay al menos dos.»* El censo **encontró las dos
nombradas y 78 más**. Y la autoprueba sobre cebo sintético acierta **2 de 2 exactas** e ignora
las cuatro legítimas — sin ese verde, el censo aborta.

### Una muestra de lo que había suelto

| Sitio | Decía |
|---|---|
| `scrum650d` | el recuento de tests de la suite «entera en verde» — caducado |
| `_identificadores-sueltos.mjs` | otro recuento de suite, de otro día |
| `scripts/_suelo-de-la-tanda.mjs` | tests, verdes, fallos y saltadas, los cuatro sin fecha |
| `scripts/turno-staging.mjs` | la suite «en N verdes» |

Cuatro instrumentos distintos afirmando el tamaño de la suite con cuatro números distintos, y
ninguno con su hora.

## 3 · La jerarquía, que tampoco es mía

El encargo daba tres escalones; la casa tenía cinco. Se usan los cinco:

1. **DERIVAR** — que la cuente el guard (SCRUM-498).
2. **REFORMULAR** — que la frase deje de decir un número (SCRUM-680). Mejor que atar: no deja
   nada que mantener.
3. **ATAR** al recuento derivado, cuando derivar es imposible.
4. **ANCLAR** con fecha o sha visible: un número **con** su hora no es el defecto.
5. **RETIRAR**, si no sostiene el argumento.

**⛔ Lo que no vale es «actualizar» la cifra al valor de hoy**: reproduce el defecto mañana, y
encima con aspecto de arreglo.

## 4 · Las dos instancias, y son de familias distintas

| | Qué era | Tratamiento |
|---|---|---|
| `scrum667` | el total de marcas de microcopy «de hoy» con su desglose — un **ESTADO** del árbol, y **derivable** (`scripts/censo-marcadores.mjs` lo cuenta) | **② reformular**: remite al censo, sin escribir la cifra |
| `scrum709` | el recuento de tests en verde del día de la PR #982 — un **HECHO HISTÓRICO**, no derivable | **⑤ retirar**: el número no sostenía el argumento — que la suite estuviera verde ya lo dice |

**Por eso la jerarquía tiene cinco escalones y no uno:** dos cifras que parecen el mismo problema
piden tratamientos opuestos.

## 5 · 🔴 El guard se cazó a sí mismo DOS veces mientras lo escribía

Y las dos con razón:

1. La nota con la que expliqué la retirada en `scrum709` **citaba la cifra retirada**.
2. La cabecera del propio test **copiaba entera** la frase de `scrum667`.

Es la trampa conocida —*un guard de texto se caza en el comentario que explica la prohibición*—
y **la salida no es eximirse**: es **describir la cifra sin escribirla**. Queda escrito en el
fichero porque es un error que se repite, no una anécdota.

## 6 · Probado en ROJO, por el mecanismo

| Mutación | Qué pasa |
|---|---|
| una cifra nueva sin ancla en otro fichero | cae **sólo** el censo, y **nombra** fichero, línea, cifra y frase |
| vuelve la cifra a `scrum667`, ya arreglado | caen **dos**: el censo y «las arregladas no reaparecen» |
| **la MISMA cifra, pero con fecha** | 🟢 **no cae nada — 4/4 verde** |

**La tercera es el control negativo de verdad**: demuestra que el guard distingue *el defecto*
(cifra sin ancla) de *lo legítimo* (cifra con ancla), y no simplemente «hay un número nuevo».
Los ficheros mutados quedaron **idénticos byte a byte** al original leído de disco.

Y siete casos inocuos más, atados en el test: fecha `4-sep-2026`, fecha ISO, numeración de
secciones, «las 4 rutas», datos de un caso de prueba, una cifra **dentro de una cadena** y los
identificadores `SCRUM-nnn`. **Un censo que acusa a lo legítimo se desactiva solo**, porque quien
lo lee deja de creerlo.

## 7 · Lo que NO se ha hecho

* **No se han tocado las otras 78.** Están censadas y congeladas: el guard impide que suban, y
  arreglarlas es trabajo de quien pase por cada fichero. Tocarlas todas habría sido un diff
  ilegible en 62 ficheros ajenos.
* **No se ha tocado `src/`**, ni `_solo-codigo.mjs`, ni `_afirmaciones-derivadas.mjs`.
* **No se ha «actualizado» ninguna cifra** al valor de hoy.

## 8 · Huecos declarados

* **El detector es heurístico y lo dice**: reconoce un recuento por su unidad más una palabra de
  momento. Una frase que afirme un estado con otras palabras **se le escapa**, y no sé cuántas.
* **Sólo `tests/` y `scripts/`.** `src/`, `public/` y `docs/` **no están en la población** — y
  `docs/` es justo donde más prosa con números hay. Es el siguiente sitio donde mirar.
* **No hay subdirectorios**: la población lee el primer nivel de cada carpeta.
* **Límite heredado, medido:** `soloCodigo` pierde código real ante un literal de regex con dos
  barras pegadas (`!/^https?:\/\//i`) — el mismo caso que su cabecera dice haber arreglado,
  citando una línea que ya no existe. **Medido: cero ficheros del árbol lo disparan hoy**, así
  que no afecta a este censo. Va como hallazgo de otro carril.
