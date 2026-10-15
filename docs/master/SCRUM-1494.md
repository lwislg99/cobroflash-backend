# SCRUM-1494 · PASO 0 del 15-oct: el cuelgue del job de zona NO aparece hoy (Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:11:46Z

**Sólo medición. No se construye nada**, porque el defecto no se reproduce en la ventana de hoy (A2).

Sonda de solo lectura (`gh api`, en el temporal del job `2558c165`): los jobs cuyo nombre contiene «zona» en las
**80 últimas corridas** del workflow `CI`, creadas entre el 2026-10-14T09:15:36Z y el 2026-10-15T16:09:11Z.

| | jobs de zona |
|---|---|
| total | 58 |
| `success` | 35 |
| `failure` | 6 |
| `cancelled` | 12 (**ninguno** a ≥ 44 min: se cortaron antes, por un empujón nuevo) |
| sin terminar | 5 |
| **al techo (≥ 44 min)** | **0** |
| terminados, duración | de 12,7 a 22,2 min |
| entre 20 y 44 min | 15 |

**Control positivo de la sonda:** dos de los 8 runs del ticket (`37470969758`, `37511808504`) salen `cancelled` a
45,3 y 45,9 min. Si hoy hubiera alguno al techo, la sonda lo vería.

**Lo que esto NO dice:**
- No dice que esté arreglado: no sé qué lo trajo el 6-oct ni qué lo quitó. Si fue un fichero de test que se colgaba
  y después se cambió, puede volver con otro.
- Los terminados ahora tardan hasta 22,2 min; el 6-oct, 11-17. Puede ser más tests o máquinas más lentas. No lo he
  separado.
- La propuesta del ticket (un límite por fichero en `run()` de `scripts/_trinquete-de-zona-hijo.mjs`, para que un
  cuelgue salga NOMBRADO y no se coma 45 min) sigue teniendo sentido como seguro. Pero hoy no hay un rojo con el que
  verla caer, y la aceptación 1 pide un caso sembrado. Construirla o no lo decide el orquestador.