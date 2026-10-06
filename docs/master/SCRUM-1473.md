# SCRUM-1473 · El latido mira el disco, y hay con qué barrer los `tmp` de los trabajos

**Rama:** `scrum-1473-latido-disco-y-barrido` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `fdac6867180adf6892fa3cb0f514ebbf69d04ab5` · 2026-10-06T13:33:32Z (hora de GitHub)

A9: comprobación → `tests/scrum1473-latido-disco-y-barrido.test.mjs`

Carril S5: `scripts/equipo/disco.mjs` y `scripts/equipo/barrer-jobs.mjs` (nuevos), ocho líneas en
`scripts/equipo/latido.mjs` y un test. Encargo del orquestador del 6-oct-2026.

## Qué arregla y qué no

Arregla que **quien corre el latido sepa cuánto disco queda** antes de que una escritura reviente, y que
sepa **qué parte de lo ocupado es del equipo**. Y deja una herramienta para vaciar los `tmp` de los
trabajos sin tener que fiarse de una medición hecha a mano.

No libera disco: lo gordo de la unidad no es del equipo (abajo). Y no borra nada por sí solo: el barrido
se entrega con su pasada en seco y **no se ha ejecutado ningún borrado**.

## Qué pasó

El 6-oct-2026 la unidad donde viven los transcripts se quedó a **79 MB libres de 465 GB**. Se supo porque
a una sesión le reventó una escritura con `ENOSPC` a mitad de tanda. Una sesión que no puede escribir su
transcript muere sin avisar. El latido miraba el CI, el despliegue, las sesiones, el vigía y la cuenta QA,
y no miraba la máquina.

El orquestador liberó ~50 GB a mano. Dos cosas de esa limpieza, medidas después:

- Su medición previa decía 6,5 GB: el comando llevaba «ignora los errores» y las rutas largas fallaban
  calladas.
- Barrió los `tmp` de los trabajos sin actividad en **3 h**.

## Lo medido antes de elegir un número

Todo el 6-oct-2026, sólo leyendo, sin seguir enlaces y contando lo que no se pudo recorrer.

### Qué se escribe en un día

Ficheros creados o modificados desde las 00:00Z hasta las ~12:50Z, con 15 sesiones:

| Dónde | Población | Sin recorrer | Escrito en el día |
|---|---|---|---|
| El perfil de la unidad de la casa | 966.957 ficheros · 199.701 carpetas · 73 enlaces sin seguir | 2 (`EPERM`) | **4,78 GB** |
| …de ellos, las cuatro carpetas del equipo | | | **0,65 GB** (`.claude/jobs` 0,04 · `.claude/projects` 0,25 · `Temp` 0,25 · `npm-cache` 0,12) |
| La carpeta de los árboles de git, en la otra unidad | 2.880.402 ficheros · 370.728 carpetas · 152 enlaces sin seguir | 0 | **1,26 GB** (un árbol nuevo: 119 MB) |

Siete de cada ocho gigas escritos en la unidad de la casa no son del equipo: son programas que se
actualizan y el navegador. No se listan aquí: no son nuestros.

### Qué ocupa lo del equipo

| Carpeta | Ocupa |
|---|---|
| `.claude/jobs` | 0,04 GB (casi todo, `tmp` de las 15 sesiones del día: 39,4 MB; la mayor, 13,9 MB) |
| `.claude/projects` | 1,38 GB |
| `Temp` | 1,93 GB (1 carpeta sin recorrer, `EPERM`) |
| `npm-cache` | 0,77 GB |
| **Suma** | **~4,1 GB de los 414 ocupados (1,0 %)** |

**Las sesiones no llenan el disco**, y barrer todo lo del equipo no devuelve más que esos 4 GB.

### Cuánto calla una sesión y luego sigue

Sobre los 294 transcripts de trabajos (299 trabajos; 5 sin transcript en disco; 0 `state.json` ilegibles),
el mayor silencio entre dos líneas seguidas de cada uno:

| Callaron más de… y siguieron | Sesiones |
|---|---|
| 1 h | 7 |
| 3 h | **6** |
| 12 h | 4 |
| 24 h | **0** |

El máximo, 22,1 h. Con 3 h, a seis sesiones se les habría vaciado el `tmp` antes de seguir. El barrido
nace con **24 h**.

## Qué cambia

### La sección DISCO del latido

```
✅ DISCO · C: 51 GB libres de 465 (aviso por debajo de 28.8: casa) · D: 137 GB libres de 466 (aviso por debajo de 7.8: arboles) · lo del EQUIPO en C: suma AL MENOS 4.2 GB de los 414 ocupados (1.0 %): .claude/jobs 0.04 GB (de ellos `tmp` 0.04) · .claude/projects 1.4 GB · Temp 1.9 GB · npm-cache 0.86 GB · lo demás de C: NO es del equipo y no se mide aquí: barrer TODO lo nuestro no devuelve más que esos 4.2 GB · el barrido de `tmp` de trabajos sin actividad en 24 h devolvería 0.00 GB (0 trabajo(s)) → node scripts/equipo/barrer-jobs.mjs (pasada en seco: no borra) · ⚠️ 1 carpeta(s) o fichero(s) SIN RECORRER (EPERM: …\Temp\msdtadmin): los tamaños de arriba son un SUELO · 43528 ficheros medidos, 0 enlace(s) sin seguir
```

(Salida real del 6-oct ~13:30Z. La sección tardó 7,0 s de los 37,2 s del latido.)

- **Las unidades salen de dónde vive el equipo**, no de dos letras escritas: la de la casa (perfil,
  transcripts, temporales) y la del repositorio. Si son la misma, una fila con los dos papeles.
- **El umbral es un producto de dos medidas**, escritas junto a la constante:
  lo que se escribe al día en la unidad (4,8 GB la casa, 1,3 GB los árboles) × **6 días** de margen. Seis
  días porque el latido sólo habla cuando alguien lo corre, y el hueco más largo medido sin que nadie
  corriera nada es de 136 h (5,7 días). Sale 28,8 GB y 7,8 GB.
- **Por debajo, aviso**: lo que queda, los días que da al ritmo medido, que ahí viven los transcripts, lo
  que ocupa lo nuestro y lo que el barrido devolvería.
- **Fail-closed**: si no se puede leer el espacio libre de una unidad, la sección sale «NO PUDE MIRAR»
  (salida 2) aunque la otra se leyera.
- **Lo que no se pudo recorrer se cuenta y se enseña**, y la suma pasa a llamarse «al menos».
- **Los enlaces no se siguen** (junctions incluidas) y se cuentan.

### El barrido: `node scripts/equipo/barrer-jobs.mjs`

| Orden | Qué hace |
|---|---|
| sin argumentos | **Pasada en seco**: qué vaciaría (trabajo, estado, horas, tamaño), qué deja y por qué. No borra |
| `--borrar <huella>` | Vacía exactamente la lista que enseñó la pasada en seco. Con otra huella, o sin ella, no borra y vuelve a enseñar la lista |
| `--horas N` | Con más margen. Menos de 24 se rechaza |

Lo que toca y lo que no, por construcción:

- Sólo el **contenido** de `<jobs>/<id>/tmp`. La carpeta `tmp` se queda.
- Nunca `state.json` ni nada de fuera de un `tmp`. Transcripts y memoria viven en otra carpeta que el
  guion no abre para escribir.
- **No hay un borrado recursivo**: ficheros de uno en uno, carpetas sólo si quedaron vacías.
- Un **enlace** dentro de un `tmp` ni se sigue ni se borra; un `tmp` que es un enlace, o que cuelga de
  uno, no se toca.
- La última actividad es la **más reciente** de: la fecha del `state.json`, su `updatedAt`, cualquier
  fichero del trabajo y su transcript. Si alguna no se deja leer, **no se barre** y se nombra.
- Un trabajo cuyo `state` dice `working` no se barre aunque lleve días callado.

Pasada en seco real, 6-oct ~13:30Z:

```
BARRIDO de `tmp` · C:\Users\Admin\.claude\jobs · 21 trabajo(s) con carpeta tmp · sin actividad en 24 h o más: 0 · PASADA EN SECO: no se ha borrado nada
SE VACIARÍA (0 trabajo(s), 0.0 MB, 0 fichero(s)):
   (nada)
SE DEJA:
   · 15 con actividad reciente (39.4 MB): s3-6octc, s3-6oct, s1-6oct, …
   · 6 ya vacíos
```

Hoy no hay nada que barrer: la limpieza a mano de la mañana se lo llevó todo. El caso con algo que barrer
está en el test, no visto en vivo.

## Tests

`tests/scrum1473-latido-disco-y-barrido.test.mjs` → 12 de 12. Los ficheros de prueba cuelgan de una
carpeta de `os.tmpdir()`, con enlaces de verdad (junction en Windows).

Mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN`, con la base sin mutar en 12/12 y el árbol comiteado
(`bbe2b4a8`). Ocho de ocho en rojo, y el árbol limpio después:

| Mutación | Caen |
|---|---|
| M1 · ninguna unidad avisa, quede lo que quede | 3 |
| M2 · no poder leer el espacio libre deja de cegar | 1 |
| M3 · el recorrido deja de apartar los enlaces | 2 |
| M4 · lo que no se pudo recorrer deja de contarse | 1 |
| M5 · el barrido se lleva a quien tuvo actividad hace un rato | 4 |
| M6 · se puede borrar sin la huella | 1 |
| M7 · el vaciado deja de apartar los enlaces | 1 |
| M8 · de quien no se sabe la actividad, se barre igual | 2 |

## Un error propio

Durante la tanda puse dos horas a ojo en Jira (en este ticket y en SCRUM-1479), ocho y veinte minutos
adelantadas. Están corregidas con el `Date:` de GitHub. La comprobación de arriba no lo impide: las horas
de un comentario de Jira no las mira ningún guard.

## Lo que sigue sin mirar

- Lo que ocupa la unidad de la casa fuera de las cuatro carpetas del equipo: el 99 % de lo ocupado.
- El tamaño de los árboles de git en la otra unidad (2,9 millones de ficheros: ocho minutos de recorrido).
  De esa unidad sólo se da el espacio libre.
- El ritmo real de escritura: los 4,8 y 1,3 GB al día son de UN día. Si cambian, el umbral se queda viejo.
- La memoria de la máquina, que es lo que hoy impide correr la suite completa: no es esta sección.
- La línea de órdenes del barrido (`--horas`, `--borrar`) no tiene test propio: se prueban las funciones
  que llama.

# SCRUM-1473b · El obligatorio cayó en el CI por un test que sólo pasaba en Windows

**Medido contra:** `origin/main` = `f8da1ec83777c4110228e82093047e69a671dfe1` · 2026-10-06T17:06:26Z

A9: aviso → cicatriz S5 «Empujé con «12 de 12 en local» un test que comparaba rutas con el separador de la máquina: en Windows pasaba y en el CI, que es Linux, cayó» — no se pudo comprobar: en esta máquina no hay Linux donde correr un test antes de empujarlo, y censar los 60 tests que usan `path.sep` es otro ticket

## Qué pasó

El PR #2221 se abrió a las 13:47Z, con «12 de 12» en local. Su check obligatorio salió **rojo** a las
14:09Z (run 37473629008, sobre la punta `db94a77986f0d61a087897bef45fecd2d6061388`): 1 test caído, el del
barrido que comprueba que sólo se vacía el contenido de `tmp`. Nadie lo miró hasta las 17:02Z.

**El barrido hacía lo correcto. Lo roto era el test.**

| | En Windows | En Linux (el CI) |
|---|---|---|
| El renglón de la carpeta en la foto | `vieja001\tmp/` | `vieja001/tmp/` |
| El prefijo de «lo de dentro» que el test apartaba | `vieja001\tmp\` | `vieja001/tmp/` |
| ¿El prefijo se lleva también la carpeta? | no | **sí** |

En Linux el test quitaba de «lo esperado» la propia carpeta `tmp`, que es justo la que tiene que quedarse.
La carpeta seguía ahí después de barrer, como manda el ticket, y el test lo daba por cambio.

## Qué cambia

Sólo `tests/scrum1473-latido-disco-y-barrido.test.mjs`. Ni `barrer-jobs.mjs` ni `disco.mjs` se tocan.

- La foto de una carpeta escribe sus rutas **siempre con «/»**. Lo que se compara en Windows es lo mismo
  que compara el CI.
- «Lo de dentro del `tmp`» deja de incluir el renglón de la carpeta.

## Cómo se ha visto

| Paso | Resultado |
|---|---|
| La foto con «/» y el filtro de antes, en Windows | **rojo**, 11 de 12, con el mismo renglón de más que el CI: `+ 'vieja001/tmp/'` |
| Con el filtro arreglado | 12 de 12 |
| El test, la familia del latido y los censos que enumeran `tests/` | 22 ficheros · 239 de 239 · 0 saltados |

**No visto en Linux desde aquí**: lo dirá el check obligatorio de la punta nueva.

## Un error propio

Di por bueno un verde de Windows para un test que hace cuentas con rutas, y no miré el veredicto del CI
antes de irme: el rojo estuvo tres horas sin que nadie lo leyera. Lo segundo ya tiene mecanismo (el aviso
de cierre de SCRUM-1356); lo primero no, y por eso va como cicatriz y no como comprobación.

Medido antes de escribir «no hay Linux»: `wsl.exe` existe pero es sólo el instalador (no lista ninguna
distribución, sale con 1), y Docker no está ni en el PATH ni en su carpeta por defecto. Instalar uno es un
coste nuevo: lo decide el fundador.
