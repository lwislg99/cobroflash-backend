# SCRUM-306 · C7: la serie de albaranes — reutilizando el mecanismo de A4

**Fecha:** 6-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `4b4f30a6bcfb4ffd75694f781704865510336580` · 2026-08-06T13:08:40+02:00

## La medición corrige al ticket en tres sitios

**① `allocateAlbaranNumber` ya existía y ya reutilizaba lo importante.** Mismo
`pg_advisory_xact_lock`, **mismo `SERIE_LOCK_NS` importado** de `invoiceNumber.service.ts` (no una
constante duplicada), reserva dentro de la `tx` y reinicio anual. No había un segundo mecanismo que
escribir.

**② Los generadores NO se unifican, y el motivo es la regla 38.** `allocateInvoiceNumber` exige
`camino` y `actor` y arrastra `getEmissionMode`/VeriFactu; `allocateAlbaranNumber` existe
precisamente para **no** pasar por ahí (Parte L: serie no fiscal e independiente). Unificarlos
metería el albarán **dentro del camino de emisión**, que es justo lo que esa regla protege. Lo que
sí comparten —el cerrojo y su namespace— ya estaba compartido antes de este ticket.

**③ A4 tiene UN campo configurable, no cuatro.** Medido con recuento explícito:

| | ficheros |
|---|---|
| `invoiceSeriesPrefix` | **9** |
| `seriesFormat` · `seriesDigits` | **0** |
| `albaranSeriesPrefix` | **0** |

Formato y dígitos **están fijos** dentro de `formatInvoiceNumber` (`${year}-${p}-${padStart(3)}`):
no existen como configuración en ninguna parte del producto. El ticket pedía «los mismos cuatro
campos que A4» y A4 tiene uno.

## 🔴 Hueco declarado: EL PREFIJO CONFIGURABLE NO ENTRA

`Merchant` solo tiene `nextAlbaranNumber` y `albaranSeriesYear`. Un prefijo por merchant **necesita
una columna nueva**, y las migraciones están congeladas (SCRUM-383: las claves de base apuntan a
sitios distintos según el worktree). No hay rodeo que no sea inventarse dónde guardarla.

**Consecuencia, sin disimular:** quien viene de otro programa **sigue sin poder continuar su serie
de albaranes**. Es la mitad del argumento del bloque D2 y se queda fuera hasta que exista la
columna.

## Lo que sí entra

### 1 · La trampa heredada, cerrada antes de ser alcanzable

`resolveAlbaranSeq` tenía **exactamente** la forma de `resolveSeriesSeq`:

```ts
return m.albaranSeriesYear === year ? m.nextAlbaranNumber : 1;
```

Con ella, **fijar el número sin fijar el año reinicia la serie en 1 en silencio**. Hoy no es
alcanzable porque ninguna ruta edita el contador — y el ticket de C7 pedía crear justo esa ruta.
Cerrarla después habría sido cerrarla tarde.

**Se distingue por el año NULO, no por el contador.** Un año distinto *con* año fijado es el
reinicio anual legítimo y sigue devolviendo 1; lo que no puede pasar es año sin fijar y contador ya
avanzado. Y **falla ruidosamente** en vez de caer al 1 por defecto: el suelo del propio ticket dice
que un albarán con un número de otra serie es un documento mal identificado.

> **📌 HALLAZGO DE OTRO CARRIL (regla 9):** `resolveSeriesSeq` (facturas) tiene la misma forma. Hoy
> no es explotable porque su ruta escribe `nextInvoiceNumber` e `invoiceSeriesYear` **juntos,
> siempre**. No se toca: es el camino de emisión (regla 38) y no es este ticket.

### 2 · El detector de huecos, por extensión aditiva

`huecosDeLaSerie` gana un quinto parámetro **opcional** `componer`, con `formatInvoiceNumber` como
valor por defecto: las llamadas de factura no cambian ni una letra. `albaranSerie.ts` **importa** ese
detector y le pasa la composición del albarán — no lo copia, no reimplementa el barrido y no parsea.

**Avisa, no bloquea.** Un albarán no es documento fiscal: la AEAT no le exige secuencialidad sin
saltos. Copiar aquí el rigor de A4 sería convertir una recomendación en una prohibición, y eso
estorba sin proteger de nada. El módulo devuelve un diagnóstico y nadie lo usa para impedir nada.

### 3 · La vista previa

Usa `resolveAlbaranSeq` + `formatAlbaranNumber`, **las mismas que usa la reserva**, así que no puede
enseñar un número distinto del que se va a emitir. Y **propaga el fallo** de la trampa en vez de
enseñar `ALB-2026-001`: enseñarlo sería confirmarle al profesional el reinicio justo antes de que
ocurra.

## Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Vuelve la forma heredada de `resolveAlbaranSeq` | 🔴 **nombrando** que «se habría reiniciado en 1» |
| 2 | El albarán se escribe su propio detector | 🔴 «uno escrito dos veces» + el suelo |
| 3 | Desaparece el cerrojo | 🔴 el guard de C7 **y el censo de SCRUM-234, nombrando la serie** |
| 4 | La generalización rompe el caso viejo | 🔴 control positivo con facturas |

Cada uno con `npm run build` entre medias: en TypeScript el test corre contra `dist`, y revertir la
fuente no revierte lo que se ejecuta.

## 🔴 Había un test que fijaba la trampa como comportamiento esperado

`tests/albaran.test.mjs` afirmaba:

```js
assert.equal(resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 5 }, 2026), 1);
```

bajo el rótulo «con serie nueva». **Un contador en 5 no es una serie nueva**: es una serie a la que
alguien le movió el número. Ese assert hacía que el reinicio silencioso pareciera deliberado — y un
test que dice lo que no es cuesta más que no tenerlo, porque el siguiente que lo lea creerá que está
decidido. Corregido: la serie nueva de verdad es contador 1, y el contador movido sin año falla.

## Dos guards ajenos se pusieron en rojo, y los dos los rompí yo

- **SCRUM-291 ①** comprobaba que el detector compusiera con `formatInvoiceNumber` buscando la
  llamada literal. Tras la generalización, esa función es el **valor por defecto** del parámetro. El
  invariante no cambió —compone, no parsea— pero el assert miraba la forma. Reescrito para exigir
  que **el defecto del compositor sea exactamente `formatInvoiceNumber`**, que es más fuerte: si
  alguien lo cambiara, las llamadas de factura compondrían con otra función sin tocar una línea suya.
- **SCRUM-237** cazó una negación mía sin respaldo (`!huecos.includes('ALB-2026-005')`): sola sería
  verde permanente si ese número no se compusiera nunca. Añadido su hermano positivo.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **1934 tests · 1867 pass · 0 fail · 67
  skipped**.
- Cero migraciones y cero `db push`.

## Microcopy (regla 30)

**Cero texto nuevo.** Nada de esto se pinta todavía: son módulos de dominio y su guard. El rótulo de
la serie de albaranes llegará con la pantalla, cuando exista la columna.

## Lo que NO se tocó

`prisma/schema.prisma` · `allocateInvoiceNumber` y su cerrojo (regla 38) · el detalle (**C2**) · el
listado (**C1**) · el PDF · el generador de facturas.
