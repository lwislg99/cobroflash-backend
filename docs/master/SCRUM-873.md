# SCRUM-873 · NO lo he reproducido, y el ticket NO se cierra — esto es lo descartado, con su número

**Medido contra:** `origin/main` = `e778e7b232c99b5b46ce44b6c4c90d526b67b175` · 2026-09-16T09:32:02Z
**Rama:** `scrum-873-el-intermitente-de-206b` · **Carril:** instrumentos · proceso
**Gate:** sin gate — esta tarea **sólo mide**: no toca `src/`, ni `tests/scrum206b`, ni la tanda.

> 🔴 **EL TICKET NO SE CIERRA.** No he conseguido reproducir el intermitente. Un «a mí no me pasa»
> no es una medición, así que lo que sigue es la caracterización que sí tengo y la lista de lo
> descartado, cada cosa con su cifra.

---

## 0 · Obligación 0

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-873(-|$)"  ->  NINGUNA
git log origin/main --oneline -i --grep="scrum-873"                 ->  vacío
docs/master/SCRUM-873.md                                            ->  no existía
```

**Caso (a): nunca se empujó.**

⚠️ **Y el encargo llegó CORTADO a media palabra** en su último aviso —«SCRUM-804 dio 2 rojos
(«149 ramas contra 150»), aislado p»— aunque traía el marcador de fin. No he adivinado lo que
faltaba: era un aviso sobre OTRO intermitente, ajeno a ①②③, así que se siguió y se pidió la línea
entera. Queda dicho porque un encargo cortado es un encargo sin sus últimas condiciones.

## 1 · ① La caracterización: **NO falla solo**

| escenario | pasadas | rojos |
|---|---|---|
| `scrum206b` solo, en mi árbol | **40** | **0** |
| `scrum206b` solo, en árbol aislado en `origin/main` | 10 | 0 |
| con **6 obreros** parseando `src/` y `tests/` a la vez | 20 | **0** |

**N = 40 y está justificado:** si el fallo tuviera una tasa del 10 % corriendo solo, la
probabilidad de no verlo en 40 pasadas es `0,9^40 ≈ 1,5 %`. Con 0 de 40 se puede afirmar que
**no falla por sí mismo**: necesita algo más que no está en la tanda de un solo fichero.

Una pasada cuesta **1,3 s**, así que 40 son 52 segundos: no había motivo para quedarse en dos.

## 2 · ② La hipótesis del barredor: **NO confirmada, y tampoco tumbada** — y el motivo importa

El fichero **sí es un barredor del árbol**, como decía la hipótesis: `fuentesTs` hace
`readdirSync` recursivo sobre `src/` y luego lee y parsea cada `.ts`. Y hay una fragilidad a la
vista, que **se anota aunque no sea la causa observada**:

```js
readdirSync(...)          // recoge TODAS las rutas
...
readFileSync(ruta, 'utf8')  // SIN try/catch: si el fichero ya no está, ENOENT
```

**Intenté reproducirlo por ahí y no pude — pero el 0/20 NO vale**, y eso es lo que hay que decir:

> 🔴 **MI EXPERIMENTO NO PODÍA GANAR.** Puse un `.ts` transitorio bajo `src/` que aparecía y
> desaparecía mientras el test barría, y salieron **0 rojos de 20**. Antes de apuntarme el
> descarte, medí el **suelo del propio experimento**: en **71 barridos durante 8 s**, la carrera
> «listado y luego ausente» ocurrió **0 veces**. O sea que el 0/20 no distingue «la hipótesis es
> falsa» de «mi banco no sabe provocarla». **Un negativo sobre un experimento imposible no es un
> descarte: es un cero sin población.**

Por qué no ocurre: entre listar una ruta y leerla pasan microsegundos, y mi escritor alternaba
cada 15 ms — el fichero estaba presente para las dos operaciones o ausente para las dos.

**Lo que queda por probar de esta hipótesis**, y es lo siguiente que haría: no el fichero que
DESAPARECE, sino el que se está **reescribiendo** — `writeFileSync` no es atómico, así que un
lector puede ver contenido truncado y el AST sacar otro veredicto sin que nada reviente. Eso sí
encaja con un rojo intermitente que no es un crash.

## 3 · Lo descartado, cada cosa con su número

| candidato | medición | veredicto |
|---|---|---|
| que falle solo | 40 pasadas | **0 rojos** — no es |
| que dependa de carga de CPU/E-S | 20 pasadas con 6 obreros | **0 rojos** — no es |
| fichero que aparece y desaparece bajo `src/` | 20 pasadas + **suelo del experimento** | **inconcluso**: la carrera no llegó a ocurrir (0 de 71 barridos) |
| que sea el árbol aislado | 10 pasadas en worktree limpio | 0 rojos |

## 4 · Límites declarados

1. **No lo he reproducido, y por eso el ticket sigue abierto.** Lo que hay descarta dos causas y
   deja una tercera a medio probar.
2. **No he corrido la tanda ENTERA en bucle**, que es donde se vio. Con 40 minutos por pasada y
   seis sesiones compartiendo máquina, eso es una tarde y no cabía aquí — pero es lo que
   contestaría «¿cae siempre en el mismo punto?», que sigue **sin contestar**.
3. **El censo de escritores es grueso:** 35 ficheros de `tests/` escriben Y nombran una ruta de
   `src/`, pero mi detector no distingue «escribe EN `src/`» de «escribe en un temporal y además
   menciona una ruta de `src/`». El sospechoso real está ahí dentro y hay que afinarlo.
4. **Todo el experimento se hizo en un worktree aislado**, y a propósito: un fichero transitorio
   dentro del `src/` del árbol compartido le habría inventado un rojo a las otras cinco sesiones
   — que es exactamente el defecto que este ticket persigue.

## 5 · Lo que NO se ha tocado

`src/` · `tests/scrum206b` · ningún test · la tanda · ningún proceso ajeno · el árbol compartido.
Esta tarea sólo mide.
