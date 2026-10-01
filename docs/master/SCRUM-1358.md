# SCRUM-1358 · `main` en rojo: dos entradas declaradas que otro PR ya había arreglado

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T11:59:52Z

A9: aviso → A10 «Una dependencia entre dos PR escrita en el prompt de UNA sesión no existe para la otra: o es un guard, o no es nada.» — no se pudo comprobar: el guard que existe (`tests/scrum1349-entorno-prestado-solo-baja.test.mjs`) SÍ lo cazó, pero en `main`, después de entrar los dos; que un PR sepa de otro PR abierto que toca lo mismo no está en ningún fichero que un test pueda leer antes de la fusión.

Carril S5 (las dos entradas llevan `dueno: S5`; las arregló #1990, que es de S5).

## Lo que pasó

| Cuándo | Qué |
|---|---|
| SCRUM-1349 (`5aec854a`, S3) | declara `scrum928` y `scrum976` en `scripts/_entorno-prestado-declarados.json`, con el motivo «lo arregla el PR #1990, que al entrar tiene que borrar esta entrada» |
| #1990 (SCRUM-1289, S5), 1-oct 11:33Z | arregla los dos tests. No borra las entradas: su rama no tenía el fichero |
| `main` con los dos dentro | el trinquete «solo baja» ve dos declaradas que ya no se acusan y cae. Con él, el obligatorio de todos los PR de los dos equipos |

Cada PR era verde contra su base. Lo rojo era la suma.

## Lo que entra

Se borran las dos entradas de `scripts/_entorno-prestado-declarados.json`. Nada más. Lo pide el propio guard, y la lista solo baja.

## Comprobado

| Árbol | `tests/scrum1349-entorno-prestado-solo-baja.test.mjs` |
|---|---|
| `7a30dbb0` tal cual | 8 tests, 6 pasan, 2 caen: «EL TRINQUETE PUEDE APRETAR Y NO SE HA APRETADO: …scrum928…: declaradas 1, hoy 0 · …scrum976…: declaradas 1, hoy 0» y su control positivo |
| `7a30dbb0` + este cambio | 8 tests, 8 pasan |

No he corrido la tanda completa en local (1,5-2 GB libres de 15,9; hoy el sistema ha matado tandas a otras sesiones). El veredicto es el del CI de este PR.

## Mis errores

1. **Estaba en MI traspaso y no lo hice.** `project_s5_traspaso.md` decía: «Si S3 mergea SCRUM-1349 y su trinquete sale rojo en main: borrar las entradas de scrum928 y scrum976». Lo leí al arrancar y empecé por otra cosa. La condición ya era cierta: bastaba correr un test para saberlo. Una nota condicional («si sale rojo…») que nadie evalúa es una nota.
2. **Di por reproducido lo que no había reproducido.** La primera vez el test «cayó» en mi árbol y lo tomé por el rojo de `main`. Caía por otra cosa: árbol recién creado, sin `node_modules`, `Cannot find module 'typescript'`. Lo delató que seguía cayendo DESPUÉS del arreglo. Un rojo se lee antes de creérselo: el mismo «✖» dice dos cosas distintas.
3. **Un `Select-String` vacío no era «nadie toca el fichero»**: la primera consulta a los PR abiertos falló por comillas y el bucle no corrió. La repetí contando la población (12 PR mirados, 0 tocan el fichero).

## Lo que queda propuesto, no hecho

Que el trinquete, al caer por «declarada y ya arreglada», diga qué commit DECLARÓ la entrada y cuál dejó de acusarla (`git log` de cada fichero): hoy dice «bórrala» y no dice que el conflicto nace de dos ramas, así que nadie sabe que le toca. El test es de S3 (SCRUM-1349): se le propone, no se toca aquí.
