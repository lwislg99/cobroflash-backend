# SCRUM-1600 · `scrum1571b` y `scrum1571c` bajan de ~1,2 GB a ~0,9 GB de pico cada uno, con la misma salida del censo byte a byte

**Medido contra:** `origin/main` = `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f` · 2026-10-23T20:24:20Z

J2 (jv-j2av). Windows 11 · Node `v24.18.0` · máquina compartida con otras sesiones vivas. Cada medición, de una en
una y en primer plano. Las horas son de la cabecera `Date:` de GitHub; la memoria libre, de `os.freemem()` justo antes.
Instrumentos en `docs/master/evidencias/SCRUM-1600/`: `sonda-pico.mjs` (la sonda `--import` de SCRUM-1244 ③, escribe
`resourceUsage().maxRSS` al salir), `por-partes.mjs`, `huella.mjs` y `veredictos.mjs`.

## ① Por qué pesan

Los dos tests llaman DOS veces a `censar()` de `tests/_censo-escrituras-sobre-id.mjs` (con y sin semilla), y cada
llamada hace un `ts.createProgram` con un host nuevo: vuelve a parsear `src/`, la lib, `@types` y el cliente de prisma.
No es el barrido AST (recorre sólo los 333 ficheros de `src/`) ni un banco por caso (1571b no levanta ninguno; 1571c
levanta un Express por caso contra un doble de la base, sin PGlite).

`por-partes.mjs`, 20:18Z, 4.091 MB libres:

| paso | rss | pico | heap |
| --- | --- | --- | --- |
| importar el censo (typescript) | 97 MB | 98 MB | 12 MB |
| `censar({ semilla: true })` | 708 MB | 708 MB | 491 MB |
| `censar({ semilla: false })` | 1.192 MB | 1.192 MB | 950 MB |
| tras `gc()` (con `--expose-gc`, 20:18:50Z) | 1.144 MB | 1.191 MB | **27 MB** |

⇒ El segundo programa añade ~480 MB, y tras un `gc()` quedan 27 MB de heap vivo: era **basura** del primer programa
que V8 no recoge antes de crecer. Lo que devuelve `censar` son datos planos, sin nodos del AST. El mismo mecanismo que
SCRUM-1244 midió en `scrum1093h`.

Los helpers de otros carriles NO pesan aquí: `_arnes-de-router.mjs` (sólo `reqDeSesion`) y `_envio-doblado.mjs` los usa
1571c para su banco de cuatro casos, y la diferencia entre los dos tests enteros (~70 MB) es lo que cuesta cargar
`dist/` con Express. No medido aparte.

## ② El arreglo, sin cambiar lo que miden

`tests/_censo-escrituras-sobre-id.mjs` (J2, de SCRUM-1571b): los `SourceFile` leídos de disco se guardan en un `Map` del
módulo y se reutilizan entre llamadas del mismo proceso. La semilla se fabrica ANTES de consultar la caché y no entra
nunca en ella; sin semilla, su ruta devuelve `undefined` como antes (no existe en disco). Ningún test se ha tocado.

- **La salida completa del censo, con y sin semilla, es byte a byte idéntica**: `huella.mjs`, 207.214 B, sha256
  `fd07bf99759a867aba8bf8d2fa6921167c070c9ef3c1c6e1bd784a8ac2a04585` antes y después (`cmp` sin diferencias). Población:
  333 ficheros · 128 rutas de escritura · 80 sobre un `:id` · 14 con escritura many + `merchantId` · 0 sospechosas;
  lecturas: 119 rutas · 44 con `findFirst`/`findUnique` + `merchantId` · 0 sospechosas. Con la semilla, una ruta más en
  cada cuenta de escritura, cuatro más de lectura, y las sembradas vistas.
- **Mismos casos y mismos veredictos POR NOMBRE** (`veredictos.mjs`, ancla al inicio del caso y suma contra `# tests`):
  1571b 4 de 4 pasan, antes y después; 1571c 9 de 9, antes y después. `diff` de las dos listas: vacío.

Por partes, después (20:21Z, 2.193 MB libres): 713 MB tras la primera llamada, **847 MB** tras la segunda.

## ③ Por efecto, con el mismo instrumento

Los dos tests enteros, uno detrás de otro, `node --import sonda-pico.mjs --test <fichero>`:

| | antes (20:20Z) | después (20:22Z) |
| --- | --- | --- |
| `scrum1571b` | 1.198 MB · 19,4 s · libre 2.550 MB | **860 MB** · 12,5 s · libre 2.564 MB |
| `scrum1571c` | 1.270 MB · 16,8 s · libre 3.069 MB | **925 MB** · 16,6 s · libre 2.457 MB |

La cifra «antes» reproduce la de jv-j6au en SCRUM-1244 (1.199 y 1.270). Juntos, si corren a la vez: de ~2,47 GB a
~1,79 GB. n = 1 cada una.

**Lo que queda**: ~710 MB es el suelo de UN programa con tipos sobre `src/` (la primera llamada no cambia). Bajarlo pide
compartir el programa entre las dos llamadas, y eso cambia lo que mide «sin semilla»: no se ha hecho.

## ④ Controles

- **Positivo sembrado, con la caché puesta**: vaciado el texto de la semilla (`TEXTO_SEMILLA` → `''`), caen
  1571b «el censo ve su positivo SEMBRADO» y 1571c «ve sus dos positivos SEMBRADOS» y «el negativo SEMBRADO … no sale
  señalado» (4/4 y 9/9 leídos). La mutación cambia una sola línea del censo arreglado (`sed` sobre la llamada que
  fabrica la semilla); restaurado y comprobado con `cmp` contra la copia del arreglo.
- **La caché sirviendo la semilla a la llamada sin semilla**: no se puede provocar sin cambiar más de una pieza, porque
  sin semilla su ruta no está entre las raíces y nadie pide ese fichero. No mutado.

A9: aviso → cicatriz J2 «el censo de SCRUM-1571b montaba un programa de TypeScript nuevo en cada llamada, semanas después de que SCRUM-1244 dejara escrita la caché de SourceFile para ese mismo caso, y sus dos tests eran el pico de memoria de la suite» — no se pudo comprobar: ningún guard cuenta cuántos programas de TypeScript monta un censo por proceso, y escribir uno es un guard nuevo (A23), no este ticket; lo cazó la medición de memoria de jv-j6au, no un test
