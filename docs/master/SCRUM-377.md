# SCRUM-377

**Fecha:** 9-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

## El censo, medido DOS VECES porque el primer instrumento estaba mal

Un `grep` de `\w+\(s\)` da **43** resultados y la mayoría **no son texto**: `test(s)`, `has(s)`,
`esc(s)`, `Number(s)`, `String(s)`, `includes(s)`, `appendChild(s)` son **llamadas** con un
argumento llamado `s`. Y `línea(s)` salía como `nea(s)`: `\w` no casa la `í`, así que el
instrumento **partía las palabras con tilde** — en castellano eso no es un detalle.

Mirando **solo literales de cadena** y con un rango que incluye acentos: **26 ocurrencias en 12
ficheros**. (El ticket decía 11 sitios; la diferencia es que las frases compuestas cuentan dos:
`parte(s) seleccionado(s)`.)

| Fichero | Textos |
| --- | --- |
| `jobDetailView.js` | `parte(s)` ×3, `seleccionado(s)`, `distinto(s)`, `factura(s)`, `creada(s)`, `línea(s)` |
| `api.js` · `quotesDetailView.js` | `tramo(s)`, `facturado(s)` |
| `albaranDetailView.js` · `albaran.service.ts` · `albaranAFactura.ts` | `línea(s)` |
| `libroRegistroView.js` · `reportsView.js` · `exports.routes.ts` | `factura(s)` |
| `modelo303.ts` | `factura(s)`, `importe(s)` |
| `invoiceReminder.service.ts` | `recordatorio(s)` ×2 |

## El guard: TRINQUETE, no prohibición

`tests/scrum377-plural-de-programador.test.mjs`, tope **26** puesto a mano. Los que hay **no se
arreglan aquí**: cada texto nuevo es microcopy y lo aprueba el fundador (regla 30). Lo que se
sostiene desde hoy es que **el número no suba** — el siguiente cae en rojo **nombrando su fichero**.

Con dos suelos: que el censo vea `(s)` de verdad y **no** cuente código, y que las palabras con
tilde se cuenten enteras. Más un test de que el tope **no va holgado** (máximo 3 de margen), para
que no quepan varios sin saltar.

**Probado en rojo:** inyectando `'Se han creado 3 albarán(s) nuevo(s).'` → `exit 1`, contando 28 y
nombrando el texto.

## ⚠️ Lo que NO se hace aquí (regla 30)

**Ningún texto nuevo.** Los 26 siguen como están hasta que haya microcopy aprobada. La propuesta
—«1 factura creada» / «3 facturas creadas», resuelto por el número— va al fundador, no al código.
