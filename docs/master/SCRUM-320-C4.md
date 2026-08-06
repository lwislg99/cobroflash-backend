# SCRUM-320 · C4: el cuarto hueco — «aceptados y sin facturar»

**Fecha:** 6-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `dc6349675ebafac45c2be5e126063c064bb188d8` · 2026-08-06T13:32:39+02:00

## Qué cierra

El invariante de G5 —«si la cabecera propone una acción del eje COBRO, esta sección lista algún
hueco»— cazó una contradicción el primer día: un Trabajo `terminado`, con importe aceptado y **sin
ningún documento**, hacía que la cabecera dijera «Cobrar el resto» y la sección no listara nada, o
sea que no se pintara. La pantalla decía a la vez que había que cobrar y que no faltaba nada.

**Es el caso en que el 100 % del dinero está fuera, y callarse justo ahí es fallar cuando más falta
hace.** Decisión del fundador: entra el cuarto hueco.

## Lo que entra

```
853,05 € aceptados y sin facturar     → Facturar el trabajo
```

- **Condición:** importe aceptado > 0 **y ninguna factura**. «Sin facturar NADA» significa nada, no
  «poco»: con una factura emitida —aunque sea de 1 €— deja de ser cierto, y del resto informa
  `sin-cobrar`. Tiene control negativo.
- **Orden:** después del parcial. Leídos de arriba abajo escalan el alcance —«600 € de lo entregado»
  y luego «853,05 € del trabajo entero»—. Los dos pueden salir a la vez y son dos verdades
  distintas: esta sección **enumera**, no elige.
- **Destino del enlace: ALBARANES, no FACTURAS.** Este hueco sale precisamente cuando no hay
  ninguna factura, así que la sección FACTURAS no está pintada y el enlace no llevaría a ningún
  sitio. La de albaranes se monta siempre, y es donde se empieza a documentar lo que luego se
  factura.

## El test provisional se BORRÓ, no se adaptó

`el HUECO MEDIDO queda a la vista, no tapado` fijaba la situación provisional para que no se
quedara en una nota que nadie relee. Con la decisión tomada, esa situación ya no existe.

Adaptarlo habría dejado un test describiendo un estado superado — y eso es exactamente lo que se
cazó en A4: **un test que fija un defecto cuesta más que no tener test, porque el siguiente que lo
lea creerá que está decidido.** Lo que protegía lo protege ahora el invariante, ya **sin
exclusiones**: vuelve a valer para todos los casos, que es como tenía que ser.

## 🔴 Y el rojo 4 destapó una constante decorativa

Quitar `sin-facturar-nada` de `HUECOS_COBRO` **no rompía nada**: la lista canónica estaba declarada
y ningún test la contrastaba con lo que `huecosDeCobro` produce de verdad. Una lista que nadie
compara con la realidad se queda vieja sin avisar.

Ahora hay un test que construye un Trabajo donde salen los cuatro, compara el conjunto producido
con el declarado en las dos direcciones, y comprueba que el orden de salida es el canónico.

## Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar el cuarto hueco | 🔴 el test de C4 **y el invariante con la cabecera** |
| 2 | Sale aunque ya haya una factura | 🔴 «sería falso» + el control positivo |
| 3 | Lleva otro importe que el aceptado | 🔴 nombrando el importe |
| 4 | Se pierde en el orden canónico | 🔴 «hay un hueco que sale y nadie declaró» |

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **1996 tests · 1929 pass · 0 fail · 67
  skipped**, ya con `main` mergeado hacia dentro.
- Los cuatro rojos, **repetidos enteros después de ese merge** y leídos por `$?`.

## 🔴 El error de proceso que casi entra, y cómo se ve venir

Al consolidar usé `git reset --soft origin/main` desde un worktree creado sobre un `main`
**anterior**. Eso compara mi árbol viejo contra el `main` nuevo: **todo lo que había entrado en
medio salió marcado como BORRADO** — 21 ficheros de otras sesiones (SCRUM-290, 296, 306, 386 y sus
tests, `libroRegistro.ts`, `albaranAFactura.ts`). Y se subió así.

Lo destapó leer el `--stat` del commit, no que el push fallara: el push dijo OK. Corregido
recuperando el estado bueno del reflog, mergeando `main` hacia dentro y consolidando **sin
`reset --soft`**.

**La regla que sale de aquí:** `git reset --soft <rama>` solo es seguro si tu base **ya contiene**
esa rama. Si no, no consolida: reescribe el diff contra un punto que tu árbol nunca vio. Y se
comprueba en una línea, mirando si el commit **borra** algo:

```
git diff --diff-filter=D --name-only origin/main...HEAD
```

En un ticket que solo añade, eso tiene que salir **vacío**.

## Microcopy (regla 30)

`853,05 € aceptados y sin facturar` y `Facturar el trabajo` — aprobados por el fundador y usados
literales. Ni un texto inventado.
