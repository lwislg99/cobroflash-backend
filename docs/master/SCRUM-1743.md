# SCRUM-1743 — El runner de la tanda por tramos se niega a ir encadenado: un `--tramo` por comando del arnés

**Puesto:** J6 (jv-j6eg) · **Rama:** `scrum-1743-un-tramo-por-comando` · 18-nov-2026
**Medido contra:** `origin/main` = `35153debff1a7adbb5a1176262c57f2a456d2632` · 2026-11-18T04:32:42Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1743-un-tramo-por-comando.test.mjs`
Mutaciones: las dos de `MUTACIONES_QUE_ME_TUMBAN`, corridas con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia: 3 pasan, 0 caen, 0 saltan): **2 de 2 tumban su caso**, 0 colaterales. Quitar la hora de creación de la comparación tumba «raíz DISTINTA (mismo pid, otra hora…)»; anular el `if (repetida)` tumba «EL CASO». Fuente restaurado, comprobado después con `grep -c` de las dos anclas (1 y 1) y `git status`.

## Decisiones

- **c.21992** (orquestador J): GO a (A) y el fichero `scripts/tanda-entera-por-tramos.mjs` asignado a J6. Antes de construir, medir el `ppid`.
- **c.21996** (esta sesión): la medición. El `ppid` NO es estable dentro de un `for` desde Git Bash: 11 de 11 llamadas con padre distinto, porque cada `node` sale de un bash recién forkeado. Lo estable es la **raíz del comando**, el primer ancestro cuyo padre es `claude.exe`. Población: 7 comandos del arnés (5 Bash, 2 PowerShell), 15 llamadas, bucles de 5 y 3 vueltas, una sesión, Claude Code 2.1.327. Reutilización de PID medida: el 19380 fue un node y 22 s después un bash de otro comando.
- **c.21998** (orquestador J): GO a (A′), con seis condiciones. Esta entrega las cumple así:

| condición / aceptación (literal resumido) | dónde se ve |
|---|---|
| pid + hora de creación de la raíz | `scripts/tanda-entera-por-tramos.mjs`, `comprobarRaiz` (`raiz-tramo-<i>.json` en el directorio de la pasada) · caso «raíz DISTINTA (mismo pid, otra hora de creación…)» |
| dos `--tramo` con el mismo padre: el segundo sale 2 y el mensaje; con el arreglo quitado, el test cae | `tests/scrum1743-un-tramo-por-comando.test.mjs`, «EL CASO»; rojo primero (abajo) y mutación nº 2 |
| un tramo suelto en su comando sigue saliendo 0 | el mismo caso, su primera llamada (CONTROL) |
| sin `claude.exe` → 0 y un CIEGO que se ve en la salida y en el TAP | caso «sin claude.exe…»: la línea se exige en la salida y se publica con `t.diagnostic` |
| cabecera del runner con el reaper y el ticket | `scripts/tanda-entera-por-tramos.mjs`, bloque «🔴 SCRUM-1743» de la cabecera |
| coste CIM medido sobre tramos reales | abajo, «Coste» |
| §7 de `trampas-del-entorno.md` | **NO HECHO, fuera de carril**: el texto se propuso a la S0 en c.21996 |

## Rojo primero

Con el test escrito y el runner sin tocar: 3 tests, **1 pass y 2 fail** («EL CASO» y «sin claude.exe»). El de raíz distinta pasa también sin el arreglo, porque hoy nada bloquea. Con el arreglo: 3 de 3.

## Lo que también cambió: `tests/scrum1244c-tanda-entera-por-tramos.test.mjs`

Con el arreglo y la cadena REAL, dos casos de 1244c cayeron con el mensaje de 1743 (raíz pid 12864): ese test lanza `--tramo 1/2` y `--tramo 2/2` desde el mismo proceso. Era la detección funcionando de verdad, no un defecto. Su `correr` simula ahora un comando distinto en cada llamada (`TANDA_TRAMOS_CADENA`), que es lo que el test describe: «cada tramo en su comando». Sus asertos no cambian. Después: 9 de 9 entre los dos ficheros.

## Control positivo en vivo (cadena real, sin simular)

En UN comando del arnés, `--tramo 2/15` y después `--tramo 3/15`: el 2 salió con 0 (732 tests) y el 3 **salió con 2 sin correr nada**, con el mensaje y la raíz real (pid 4856, creada 2026-11-18T04:42:00.1443230Z). Después, el 3 en su propio comando corrió normal.

## Coste

Una consulta `Get-CimInstance Win32_Process` por tramo, leída por la línea «raíz del comando comprobada en N ms» de cada tramo real de la pasada. **Población: 15 de 15 tramos** → entre 388 y 491 ms, con mediana de 409 ms. Los tramos duraron entre 18 s y 3 min 16 s.

## Tanda

- **Dirigida:** `scrum1743` y `scrum1244c` → 9 de 9. Guards de registro: ver la entrega.
- **Suite por tramos**, un tramo por comando y en primer plano, sobre el árbol de la rama (main `35153deb` + este cambio): **15 de 15 tramos vistos · 1.696 ficheros · 13.762 tests · 13.562 pass · 19 fail** → ROJO.
  - 1 es mío y se cierra con este registro: SCRUM-854 «esta rama, si toca código, trae su entrada de registro».
  - Los otros 18 no nombran el runner. Los únicos tests que lo nombran son `scrum1244c` y `scrum1743`.
    - 2 de SCRUM-1298b (el latido mide el árbol principal): los mismos que el ticket ya vio el 16-nov en el tramo 3, antes de este cambio.
    - 11 de cliente o generador de Prisma: 6 del tramo 8 (SCRUM-235, 244 y el censo de producción), 2 de SCRUM-461, 1 de SCRUM-498 y 2 de SCRUM-733. Que el de 733 sea por el cliente lo deduzco de su nombre, no lo he leído. El guard de A1 dice que el cliente compartido no trae el modelo `FiscalPlazoEstado`. El `node_modules` de este árbol cuelga del compartido por junction, así que NO regeneré (A1). Se lo dije al orquestador.
    - 1 de SCRUM-351 (sin `node_modules` en ningún ancestro).
    - 4 de scrum932 (el cargador de credenciales).
  - **No medí estos 18 sobre `main` sin mi cambio**: digo que no son míos porque no tocan el runner, no porque los haya visto rojos en main.

A9 (error mío): el primer driver de mutación le pasó a `correr` la ruta con `tests/` delante. La casa contestó CIEGA («no aparece EN VERDE en la pasada limpia»), no un falso veredicto. Al corregir el nombre salieron 2 de 2. Antes, una sonda de PowerShell con comillas anidadas no corrió (c.21996). Las dos están en la familia de mis cicatrices de comillas y rutas. La comprobación de esta entrega es el test de arriba.
