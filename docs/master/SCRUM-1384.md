# SCRUM-1384 · El experimento tenía la respuesta y nadie la leyó

**Rama:** `scrum-1384-resultado-que-nadie-leyo` · **Carril:** S5 (relevo de s5-1octd) · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:19:42Z

A9: aviso → A10 «Lanzar una medición no es tenerla: un resultado que nadie va a leer caduca con sus artefactos.» — no se pudo comprobar: la comprobación que lo impediría (que el latido nombre toda rama `exp-*` cuyo run terminado no esté citado en ningún registro de `main`) está propuesta al orquestador y sin construir; hasta entonces es un aviso

Este PR sólo añade esa línea a A10 y este registro. No toca `ci.yml`, ni el script `test` de
`package.json`, ni el flag.

## Qué pasó

- El 1-oct s5-1octd abrió SCRUM-1384 y lanzó un experimento para contestar su hipótesis: rama
  `exp-1384-informe-truncado`, run `36873018664`, a las 14:00:51Z. Se quedó sin cuota antes de leerlo.
- Los doce artefactos del run caducan a los tres días. El ticket estuvo un día sin un solo comentario.
- Lo leyó el equipo de Javier, en sólo lectura, y lo salvó en `main`: `docs/master/SCRUM-1339.md`,
  apartado ⑦, y `docs/master/evidencias/SCRUM-1339/e-exp1384.tsv`.
- El 2-oct a las 11:18Z escribí el resultado en el ticket (comentario 18111) y una corrección mía un
  minuto después (18112).

## El resultado (copiado de `e-exp1384.tsv`, medido el 1/2-oct por el equipo de Javier; NO remedido)

| brazo | tandas medibles | con casos ausentes | `# tests` |
|---|---|---|---|
| con `--test-force-exit` | 6 de 6 | 4 | 9.838 · 9.820 · 9.837 · 9.812 · 9.838 · 9.828 |
| sin `--test-force-exit` | 6 de 6 | 0 | 9.838 las seis |

Pierden `scrum834`, `scrum1262`, `scrum524b` y `scrum888g`, siempre la cola del fichero.
Límite: seis tandas por brazo, un árbol, una tarde.

## Lo que encontré al comprobar el encargo contra el árbol

| Encargo | Estado medido el 2-oct, 11:20Z |
|---|---|
| Comprobación «todo test de nombre literal aparece en el TAP» | Ya está en `main`: `scripts/senal-de-nombres.mjs` (SCRUM-1339d, `dbd703f8`), paso propio de `ci.yml`. Avisa, no bloquea. Cuenta aparte los nombres construidos. No se construye otra |
| Medir qué costaría quitar el flag | Ya medido por el equipo de Javier: SCRUM-1405, PR #2131, ABIERTO (no en `main`) |
| #2090, #2093, #2102, #2104 | Los cuatro MERGED |
| Borrador como motivo legítimo en `pr-automatico.yml` | MERGED (#2105, SCRUM-1382) a las 14:03:43Z del 1-oct |

## Por qué no se construye un segundo detector

La señal por nombres de `main` (`scripts/_senal-de-nombres.mjs`) lleva dentro el plan para volver a
decidir si bloquea: `UMBRAL_DE_BLOQUEO = 0.05`, `VENTANA_DE_RUNS = 50`, `FECHA_TOPE = '2026-10-15'`
(SCRUM-1339 c.17935). Con `--tasa` dice si la tasa de runs con nombres ausentes está por debajo del
5 % sobre 50 runs medidos.

**No bloquea sola.** Leído en el código el 2-oct-2026: esas constantes sólo se usan para calcular y
escribir la tasa (`tasaDeRegistros`, `lineaDeTasa`); el guion sale 0 siempre. Que pase a bloquear es
una decisión que alguien tiene que tomar con esa cifra delante, antes del 15-oct.

Lo que se deduce para el reparto: el detector ya existe y ya tiene su criterio de bloqueo. Mientras
el flag siga puesto la tasa no va a bajar del umbral, así que el trabajo pendiente es la causa
(SCRUM-1405, decisión del fundador), no otro detector.

**La única diferencia de conducta con los dos ficheros de s5-1octd** (`scripts/tests-que-no-llegaron.mjs`
y `scripts/_tests-que-no-llegaron.mjs`, nunca comiteados): hacían la misma pregunta, pero salían 1
si faltaba algún test (bloqueaban) y 2 si no sabían mirar. El de `main` avisa y sale 0. Si alguien se
pregunta por qué no bloquea: fue decisión de SCRUM-1339 c.17935, no un olvido.

## Lo que NO he comprobado

- **El efecto de #2105 sobre #2001.** La última corrida del abridor en la rama de #2001 es la
  `36873377388`, de las 14:03:36Z del 1-oct: siete segundos ANTES del merge, y roja. Desde entonces
  nadie ha empujado a esa rama. Que #2001 deje de salir rojo no está visto; se verá con su próximo
  empujón, que es de la S0.
- No he bajado los doce TAP ni he vuelto a correr `e-exp1384.mjs`.
- En el árbol `wt-s5-1364` quedan dos ficheros sin seguir de s5-1octd
  (`scripts/tests-que-no-llegaron.mjs` y `scripts/_tests-que-no-llegaron.mjs`): el principio de la
  comprobación que 1339d ya entregó. El orquestador ha dicho que se borren; a la hora de este
  commit siguen en el disco, sin tocar.

## Mi error

En el comentario 18111 escribí que lo siguiente era medir el coste de quitar el flag, sin mirar antes
si ya estaba medido. Lo estaba (SCRUM-1405). Corregido en el 18112.
