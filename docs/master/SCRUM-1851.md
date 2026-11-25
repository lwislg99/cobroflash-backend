# SCRUM-1851 · `soloEjecutable` ya no trata la barra doble como comentario en CSS

## SCRUM-1851 · J6 · la barra doble depende del tipo de fichero, con rojo primero

**Medido contra:** `origin/main` = `c83ebdbea13a426c2a3e3b5655fca37567d62300` · 2026-11-25T03:29:47Z

Puesto J6, sesión jv-j6gf, rama `scrum-1851-barra-doble-no-comenta-css`, por encargo del orquestador J.
Carril: `tests/_guard-texto.mjs` sale «sin fila en §3: nadie lo reclama» (`carriles.mjs de`) y queda
declarado para este ticket en SCRUM-1851 c.22733: SOLO el helper, ningún guard, ningún llamador.

**El defecto** (medido por jv-j1kt en SCRUM-1843b): con `{ almohadillaEsComentario: false }`, un
`url(https://x.y/z.png)` en CSS hacía que el helper se comiera la línea hasta el final, llave incluida.
Tres reglas sembradas se leían como dos. En CSS no existe el comentario de barra doble.

**PASO 0** sobre el sha de arriba: `git log --grep=SCRUM-1851` 0 commits · `ls-remote 'refs/heads/scrum-1851*'`
vacío · `gh pr list --search 1851` sólo devuelve el PR #1851, que es de SCRUM-1186 (control: la búsqueda
encuentra algo) · `git grep "1851\|url("` en el helper 0 líneas (control: `almohadilla` da 9).

**La cura**, en `tests/_guard-texto.mjs` y sólo ahí:
- `soloEjecutable` admite `barraDobleEsComentario`. Por defecto vale `true`, así que JS y TS no cambian.
- `ejecutableDe` y los elementos de `ejecutablesDe` pasan esa opción al filtro.
- `barraDobleComenta(ruta)` vale `false` sólo para `.css`, igual que `almohadillaComenta`. SCSS y LESS
  sí tienen ese comentario, así que no entran.
- `leerFuente` decide la opción por la ruta.

**Rojo primero:** `tests/scrum1851-barra-doble-no-comenta-css.test.mjs`. Contra el helper sin arreglo
salieron 5 de 5 casos en rojo, cada uno por su motivo:
- «el filtro se ha comido una llave»;
- «ESCÁNER CIEGO … url(https:» en `leerFuente` y en `ejecutableDe`;
- «no exporta `barraDobleComenta`»;
- «la opción no llega al filtro».

Con el arreglo: 5 de 5 en verde, 0 rojos y 0 saltados.

Mutaciones: catálogo → `tests/scrum1851-barra-doble-no-comenta-css.test.mjs`

Las dos declaradas tumban el test con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`:
- la barra doble vuelve a comentar siempre: cae el caso 1, y 3 más de rebote;
- `barraDobleComenta` devuelve siempre `true`: cae el caso 2, y 1 más.

La pasada limpia dio 5 de 5 en verde. Después de mutar, el sha256 del helper coincidió con el de antes.

### Censo de llamadores, estático (población declarada)

- **Población:** 3.987 ficheros `.mjs/.js/.cjs/.ts` versionados (`git ls-files`).
- **Llamadores:** 140 importan del helper, por nombre, `soloEjecutable`, `ejecutableDe`, `ejecutablesDe`,
  `leerFuente` o `literalesDeCadena`.
- **Con CSS a la vista:** 29 de esos 140 tienen alguna línea que nombra `.css`.
- **Control positivo sembrado:** un fichero fuera del árbol que importa `soloEjecutable` y lee
  `styles.css`. Sale en la lista.
- **Control del otro lado:** `tests/scrum700-filtros-de-comentario.test.mjs` importa `soloEjecutable` y
  sale entre los 140, pero no entre los 29.

⚠️ **No hice censo dinámico** (instrumentar el helper y correr los 140): no me cabía en el contexto.
La lista de abajo sale de leer la línea de cada llamada con `grep`, no de leer cada test entero.

**Quedan arreglados solos, porque leen con `leerFuente` y la ruta es `.css`:** los cinco
`tests/scrum139-*.test.mjs` y `tests/scrum406-escribenos.test.mjs`.

**NO quedan arreglados: pasan el CSS a mano, sin ruta.** Les falta `barraDobleEsComentario: false`, y
por c.22733 no los toco. El orquestador abre 1851b con esta lista.

`carriles.mjs de` contesta «NO-PUDE-MIRAR: sin fila de ruta, pero es el test de SCRUM-N» en los catorce.
Cada uno es del carril de su propio ticket.

| llamada | ticket |
|---|---|
| `tests/scrum1145-pestana-sitios.test.mjs:275` | SCRUM-1145 |
| `tests/scrum1587-reenviar-correo-cobros-44.test.mjs:37` | SCRUM-1587 |
| `tests/scrum1681-modales-trabajo-con-relleno.test.mjs:31` | SCRUM-1681 |
| `tests/scrum1692-parte-abierta-se-marca.test.mjs:71` | SCRUM-1692 |
| `tests/scrum1699-partes-n-lineas-y-cabeceras.test.mjs:93` | SCRUM-1699 |
| `tests/scrum1722c-la-hoja-del-parte-pide-su-ancho.test.mjs:59` | SCRUM-1722 |
| `tests/scrum1725-ficha-lenguaje-del-parte.test.mjs:70` | SCRUM-1725 |
| `tests/scrum1752-avisos-desplazamientos-plural.test.mjs:93` | SCRUM-1752 |
| `tests/scrum1762b-hallmark-ficha.test.mjs:25` | SCRUM-1762 |
| `tests/scrum1762c-hallmark-inicio.test.mjs:22` | SCRUM-1762 |
| `tests/scrum1762d-parte-ancho-y-hallmark.test.mjs:29` | SCRUM-1762 |
| `tests/scrum1768-ficha-aprovecha-el-ancho.test.mjs:112` | SCRUM-1768 |
| `tests/scrum1768b-ficha-pestanas.test.mjs:197` | SCRUM-1768 |
| `tests/scrum1787e-conceptos-en-movil.test.mjs:85` | SCRUM-1787 |

En `scrum1681:31` la llamada no lleva `almohadillaEsComentario: false`: si `styles.css` tuviera un selector
`#…` a principio de línea, también lo perdería. Eso queda dicho aquí y no lo toco.

**Hoy ningún CSS del árbol tiene una barra doble fuera de comentarios y cadenas.** De los 8 `.css`,
0 cambian con la opción nueva. Así que ninguno de los catorce lee de menos HOY: el defecto está
latente hasta que entre un `url(https://…)` sin comillas. El de SCRUM-1843 todavía no está en main.

### No-regresión, byte a byte (sha256 por fichero)

Guion: `docs/master/evidencias/SCRUM-1851/no-regresion.mjs`. Lo lancé con el helper de antes del
arreglo, sacado con `git show` del sha de arriba a una carpeta temporal:

    node docs/master/evidencias/SCRUM-1851/no-regresion.mjs . <copia del helper viejo> <tsv>

Para cada fichero JS/TS saca cuatro salidas, con el helper viejo y con el nuevo:
- `soloEjecutable`;
- `soloEjecutable` con la almohadilla en `false`;
- `leerFuente`, que decide por la ruta;
- `literalesDeCadena`.

| población JS/TS (recorrido del árbol; fuera `node_modules`, `dist`, `.git`, `coverage`) | ficheros |
|---|---|
| `tests` · .mjs | 2.002 |
| `docs` · .mjs | 981 |
| `src` · .ts | 373 |
| `scripts` · .mjs | 320 |
| `public` · .js | 103 |
| `docs` · .cjs | 84 |
| `.claude` · .mjs | 54 |
| `.agents` · .mjs | 49 |
| `docs` · .js | 9 |
| `.agents` · .js · `.claude` · .js | 4 · 4 |
| `tests` · .cjs · `tests` · .ts · `prisma` · .ts | 2 · 2 · 1 |
| **total** | **3.988** |

- **Comparaciones:** 3.988 × 4 = 15.952.
- **DISTINTOS: 0.**
- **Huella de la población** (sha256 de fichero + salidas nuevas):
  `e23456853b1fff30401d9d110060f734c6c770f9b3c2ccb3a536ff2010882bc9`.
- **El TSV**, con los cuatro sha256 de cada fichero, queda fuera del repo (unos 700 KB). El guion lo
  regenera.

**Controles del comparador:**
- El CSS sembrado TIENE que cambiar, y cambia.
- El JS sembrado no cambia.
- **Ciego a propósito:** con el helper sin arreglo puesto como «nuevo», sale «NO cambia ✖ CIEGO» con
  código 1.
- **Que ve diferencias en JS:** un helper con la barra doble apagada por defecto da DISTINTOS 2 de 2,
  con código 1.

**Mi error, dicho:** el primer control «ciego» lo monté al revés. Puse de «viejo» una copia del helper
NUEVO, que sí entiende la opción, y salió «cambia ✔»: comparaba dos llamadas distintas, no dos helpers.
El control bueno es el de arriba: el helper sin arreglo en el sitio del nuevo.

**Regla 41:** ningún guard ni test cambia lo que mide. Sólo cambia el helper que filtra, y para JS/TS
da lo mismo byte a byte.

**Lo que NO medí:** el censo dinámico, y la suite entera (el encargo la prohíbe). Los verdes dirigidos
están en el comentario de entrega de Jira.

A9: comprobación → `tests/scrum1851-barra-doble-no-comenta-css.test.mjs`
