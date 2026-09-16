# SCRUM-662 · El invariante de los scripts no es la cuenta: es la lista

**Fecha:** 2-sep-2026 · **Carril:** higiene de guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `01d5c5a06027a443542cb327e029195ac561fda6` · 2026-09-02T12:10:00+02:00

## 1 · PASO 0 · quién usaba el número y para qué

**Dos consumidores, los dos tests, y ninguno quería un número:**

| quién | qué cree proteger |
| --- | --- |
| `dashboard-colision-declaraciones` | que lee el índice **entero** antes de decir «cero colisiones» |
| `scrum417` (banco de vistas) | que carga **todas** las vistas antes de decir «ninguna falla» |

Los dos usan la cuenta como **suelo anti-ceguera**, no como dato. Y SCRUM-559 ya había medido el
fallo real: con holgura, quitar **una** etiqueta dejaba a los dos en verde con ese fichero fuera de
la vigilancia. La lista contesta eso mejor, porque además **dice cuál**.

## 2 · 🔴 El caso que mata el ticket

```
lado de la rama .... 69   (68 + quoteApartados.js)
lado de main ....... 69   (68 + tiposDeIva.js)
```

**Los dos lados escriben el mismo número por scripts distintos.** Para un merge textual, `= 69`
contra `= 69` no es un conflicto. Lo único que hizo visible el choque fue que el comentario de al
lado llevaba meses engordando y también chocó — **un comentario haciendo de mecanismo por
accidente**. Sin esa casualidad: 70 scripts declarando 69, y los dos guards en verde.

Una **cuenta** no distingue «tu script» de «mi script». Una **lista** sí: o git funde las dos
adiciones y quedan las dos —correcto—, o chocan donde se ve. Nunca coinciden por accidente.

## 3 · El invariante elegido: **LA LISTA**, y por qué no la secuencia

Convivían **tres** afirmaciones sobre la misma población: se **declaraba** la cuenta, se
**comprobaba** la pertenencia (SCRUM-274 usa `new Set`) y el **mensaje de error** hablaba del orden.

**Elegido: la lista de nombres, comparada como conjunto, más las dependencias declaradas aparte.**

- Lo que rompe el producto no es «el orden» en abstracto: son **dependencias concretas** —un
  consumidor cargado antes que su pieza—, y ésas van declaradas con su motivo y se comprueban.
- Exigir las 69 posiciones prometería un orden que **nadie mantiene**: `public/sw.js` lleva su lista
  en otra secuencia **desde antes de este ticket**. Un invariante que el repositorio ya incumple
  nace muerto.
- Alfabética y no en orden de carga: dos inserciones en sitios distintos del alfabeto **se funden
  solas y correctamente** en vez de chocar por vecindad.

### Y por eso se retira la frase que mentía

`SCRUM-274` decía en su mensaje de error *«Añádelos a `SHELL` en `public/sw.js`, **en el mismo orden
que el HTML**»*. Ese guard **no comprueba el orden** — compara conjuntos. La frase se sustituye por
lo que sí hace, con la nota de por qué. **Una frase que miente dentro de un error es peor que
ninguna: la lee quien está depurando a las once de la noche.**

## 4 · Lo que conserva: la mitad que la cuenta nunca vigiló

> *«Si el merge se hubiera comido uno, el recuento habría salido bien y la vista habría reventado
> igual.»*

`DEPENDENCIAS_DE_CARGA` declara las cuatro parejas con su motivo, y `dependenciasRotas()` las
comprueba sobre el orden real. Un merge puede reordenar sin añadir ni quitar: la cuenta cuadraría y
la pantalla reventaría al abrirse.

## 5 · Los rojos

| # | se rompe | el test dice |
| --- | --- | --- |
| ① | **dos ramas, mismo número, scripts distintos** | la cuenta pasa y la lista **nombra** `tiposDeIva.js` |
| ② | un `<script src=` de más | *«SOBRAN en el índice: vistaQueNadieDeclaro.js»* |
| ③ | un `<script src=` de menos | *«FALTAN en el índice: api.js»* |
| ④ | una pieza movida detrás de su consumidor | cae nombrando **a los dos** y su motivo |

Más el **suelo de ceguera** (cero scripts leídos = «no supe leer», no «no hay»), el **control
positivo** con el índice intacto, y el **determinismo** (dos lecturas, el mismo resultado —
lección de SCRUM-520: no se cambia una comprobación frágil por otra frágil).

## 6 · Y el historial de colisiones se retira con el contador

El comentario acumulaba las seis colisiones, entrada por entrada, y era lo único que hacía visible
el choque. Queda **una línea**: ya no puede volver a pasar, porque lo que se declara es la lista.
