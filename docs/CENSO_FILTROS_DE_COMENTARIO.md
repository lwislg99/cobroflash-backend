# Censo de los filtros de comentarios propios de `tests/`

**Medido el 4-sep-2026 (SCRUM-700), ejecutando cada filtro, no leyéndolo.**

Un guard que busca un literal en un fichero se caza a sí mismo, porque el sitio natural donde se
escribe ese literal es el comentario que explica por qué está prohibido. Por eso los guards filtran
comentarios. El problema es **cómo**: 94 ficheros lo hacen por su cuenta, cada uno con su regex.

## El censo

| | Ficheros |
|---|---|
| Ficheros en `tests/` | **697** |
| Con **filtro propio** de comentarios | **94** |
| 🔴 **Ciegan código real** (verde falso) | **31** |
| ⚠️ **Sólo encogen** (dejan el comentario dentro → ruido) | **47** |
| ✅ Correctos (quitan el comentario y no ciegan) | **16** |
| Que ya usan `soloEjecutable` | **34** (sólo **2** de ellos conservan además un filtro propio) |

**Los números del ticket estaban desfasados**, y por eso se remidieron: decía «27 cortan en cualquier
`//` y 31 encogen». Medido hoy: **31 cortan** y **47 encogen**.

### Cómo se clasificó: ejecutando, no mirando

Cada filtro se extrajo de su fichero y se aplicó a dos sondas:

- **¿ciega código?** — `const u = 'https://yaqu.app/x'; const VIVO = 1;`
  Si `VIVO` desaparece, ese filtro **corta dentro de una cadena** y el guard queda ciego a lo que
  venga detrás. Es el verde falso.
- **¿quita el comentario?** — `const x = 1; // aqui PALABRA`
  Si `PALABRA` sobrevive, el filtro deja el comentario dentro: el guard puede cazarse a sí mismo en
  la prosa que explica la prohibición. Es ruido, no silencio.

Las dos cosas **no tienen la misma urgencia**: un verde falso oculta una violación; un falso
positivo se ve y se corrige.

## El alcance real de la ceguera

**64 líneas en 28 ficheros** de `src/` y `public/` llevan un `://` en código con más código detrás.
Ahí es exactamente donde el filtro peligroso corta. El caso es inequívoco a propósito: `://` **nunca**
abre un comentario, así que este número no depende de saber distinguir comentarios.

Los sitios con más: `src/modules/system/audit.service.ts`, `public/dashboard/js/quotesView.js`,
`src/modules/jobs/app/routes/jobs.routes.ts`, `public/sw.js`.

## Qué se arregló y qué queda

**Se arregló el sitio único: `soloEjecutable`.** Es lo que hace migrable todo lo demás — sin eso,
migrar 31 filtros sólo cambiaría un defecto por otro.

Y hacía falta comprobarlo **contra el hecho, no contra los filtros que sustituye**: si el helper
tuviera el mismo defecto, los 94 coincidirían en el error y la comparación diría «de acuerdo». Nueve
sondas, y **fallaba una**: no quitaba el comentario al final de una línea con código. Justo el caso
que el fichero existe para cerrar. Ahora recorre el fuente carácter a carácter llevando la cuenta de
las cadenas, y las nueve pasan.

**Queda por migrar: los 31 que ciegan.** El corte es deliberado — primero el sitio único y su
demostración, luego los llamadores. Los 47 que sólo encogen pueden esperar: hacen ruido, no silencio.
