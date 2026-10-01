# SCRUM-1350 · El latido: lo que ya se sabía en otro sitio, delante de quien reparte

**Medido contra:** `origin/main` = `48babd04d40667a9ec8fbeb6e02b9e44dbf0585b` · 2026-10-01T11:11:42Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5 (`scripts/equipo/**`). No toca producto, ni settings, ni hooks.

## Lo que pasó

El 29-sep-2026 se abrieron diez PR con el check obligatorio en rojo y el auto-merge armado. Estuvieron
dos días así. La hipótesis era que se habían «podrido esperando». Medido el 1-oct sobre los logs del
obligatorio de los 14 PR en rojo (y las DOS corridas de los 7 que tenían dos):

| Pregunta | Respuesta |
|---|---|
| ¿Podredumbre o fallo propio? | 10 de 10 nacieron rojos, en su primera corrida. 0 por podredumbre |
| ¿Qué añadió la espera? | un plazo de calendario vencido (`scrum55`/`scrum128`, 30-sep) y conflictos |
| ¿Cuánto aguanta un PR abierto? | por conflicto, mediana ≈ 1,5 días (6 de 12 chocan; 0,5 · 7,3 · 28,8 · 33,3 · 35,6 · 36,8 h). Por tests rotos por la fusión: 0 de 7 en 33 h |
| ¿Cuándo se abrieron? | entre las 09:54Z y las 17:54Z; siete en los últimos 90 min de la jornada |

## Por qué no avisó nadie: sí avisaron

| Mecanismo | Qué hizo con los diez | Dónde lo dejó |
|---|---|---|
| `vigia-atascados` (cron 3 h; hueco real mediano 4,9 h) | los clasificó ROJO-OBLIGATORIO el 29-sep a las 17:06Z y 21:35Z, y «cruza 24 h» el 30 | issue #1241 (36 comentarios), con mención al fundador |
| `avisador-rojo` (inmediato) | despertó a `@claude` en los diez, 13-30 min tras abrirse; hay diagnóstico | un comentario en cada PR. El arreglo no se empujó (`NO-EMPUJA-CIEGO`, `SIGUE-ROJO`) o no arrancó (tope 6/h), y después ni reintento ni escalado |

Los detectores acertaron y publicaron donde no entra ni el orquestador ni ninguna sesión. Para quien
tiene que actuar, el efecto es el de un detector ciego. **Faltaba el canal, no el detector.**

## Lo que entra

`scripts/equipo/latido.mjs` — no detecta nada nuevo: reúne. Importa los clasificadores de
`scripts/vigia-atascados.mjs` (`esAsuntoDelVigia`, `causaDelAtasco`, `checksObligatoriosDeReglas`,
`ultimaEjecucionPorCheck`) en vez de copiarlos.

| Orden | Qué dice |
|---|---|
| `node scripts/equipo/latido.mjs` | cinco secciones: PR · SESIONES · TRASPASO · MAIN · DESPLIEGUE |
| `… latido.mjs repartos` | quién mandó qué a quién, sacado de los transcripts |
| `… latido.mjs cierre` | el obligatorio del último push de la rama en que estás |

| Sección | Avisa de | De dónde sale el umbral |
|---|---|---|
| PR | obligatorio rojo ≥ 2 h, con los tests que cayeron · punta sin check, con la edad del push · conflicto | la gracia de 10 min es la del vigía |
| SESIONES | bloqueada, con lo que espera (`needs`/`detail`) · la que ya no trabaja con un PR suyo rojo **o sin veredicto** | `children` del `state.json` de cada trabajo |
| TRASPASO | no existe, o es anterior al arranque de esa sesión (el fichero se reutiliza entre relevos) | — |
| MAIN | obligatorio en rojo · ninguno de los últimos 20 commits con veredicto | 60 corridas de main: el obligatorio da veredicto en el 43 % de los commits y es verde en 25 de 26; el color de la corrida sale rojo el 85 % de las veces que termina |
| DESPLIEGUE | `in_progress` > 10 min | 100 despliegues (29-sep → 1-oct): mediana 1,6 min; 10 min es 6× |

Salida: 0 nada · 1 hay algo · 2 alguna sección no pudo mirar (y el 2 gana al 1).

## Dos mediciones que cambian lo que creíamos

**El despliegue no tarda 25 minutos.** Mediana 1,6 · 1,7 · 1,4 min los tres días. Los 10 despliegues
superados y los 6 de más de 15 min son todos del 29-sep entre las 15:53Z y las 17:05Z, alrededor de
`9977c40f`, que nunca llegó a `success`: un despliegue atascado y la cola detrás, no un régimen. El
1-oct, con 38 despliegues (más que el 29), cero retrasos.

**El libro de repartos ya existe.** Un `SendMessage` queda en el `.jsonl` de quien lo MANDA, como
`tool_use` con hora, destinatario y texto. Contado en los transcripts de hoy: 58 mensajes en 12 h, 29
del orquestador. Lo que no queda en ningún sitio es si el otro lo leyó.

## Mis errores

1. **Medí un instante y lo llamé mecanismo.** Miré #1990 dos minutos después de un push de `yaqu-bot`,
   vi «sin checks» y concluí que el push del bot deja el PR mudo. Era falso: sus checks arrancaron a
   los 111 segundos. Mi push «de arreglo» canceló esa corrida. → comprobación: la sección PR no avisa
   de «sin check» sin la edad del push (test «sin check NO es lo mismo que aún no ha arrancado»).
2. **Empujé a una rama que no era mía** (#1998, de S3) antes de que nadie me dijera de quién era: la
   tomé por «mecánica del bucle». No hubo daño —S3 lo aprovechó—, pero #1991 me lo rechazó git porque
   S3 estaba empujando a la vez. → no convertible aquí: el dueño de una rama no está en ningún fichero
   que un guard pueda leer; lo dirá `scripts/carriles.mjs` cuando entre SCRUM-1295.
3. **Conté 116 mensajes que eran 58**: el mismo transcript leído por dos rutas (`D--…` y `d--…`). Lo
   delató la población, que no cuadraba con los 7 que yo había mandado. → arreglado; va por id.

## Lo que NO hace, y de quién es

- `cierre` es una comprobación que la sesión tiene que **lanzar**. Obligarla (hook de `Stop`, o que
  `relevar` la exija) toca `settings.json` y hooks: S0 y el fundador. Queda propuesto, no armado. Lo
  que la suple hoy es la sección SESIONES, que ve el rojo desde el lado del orquestador.
- No corre solo. Lo lanza el orquestador al empezar su turno, desde un árbol al día.
- El meta-guard sigue inestable en main tras SCRUM-1321: 7 verdes y 6 rojos en 14 commits con jobs
  del 1-oct, alternando (rojo 03:49Z, verde 03:54Z, rojo 05:36Z, verde 06:18Z, rojo 06:26Z, rojo
  06:46Z, verde 07:04Z, rojo 07:19Z, verde 07:25Z). Es SCRUM-1100, no esto.

## Comprobado

- `tests/scrum1350-latido.test.mjs`: 15 casos. Cada sección con su rojo, su negativo y su ciego.
- 10 mutaciones a mano, una por pieza (umbral de 2 h, ciego gana a aviso, PR ciega, bloqueadas, nadie
  vuelve, traspaso anterior, no-pude ≠ no-existe, main rojo, despliegue atascado, sin resumen ≠ cero
  fallos): las 10 caen. No se declaran en `MUTACIONES_QUE_ME_TUMBAN`: cada una se paga en el CI de
  todos (SCRUM-935).
- Contra el mundo, 1-oct 11:14Z: 14 PR abiertos, 3 avisos (#2054 y #2049 rojos de 5 y 8 h con sus
  tests; #2051 en conflicto), dos sesiones bloqueadas con lo que esperaban, main con su último verde
  y 4 commits detrás, despliegue en `success`.
