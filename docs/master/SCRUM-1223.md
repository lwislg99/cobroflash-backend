# SCRUM-1223 · El consejero de producción sigue rechazando `DROP DEFAULT`, `DROP NOT NULL` y `UPDATE`, pero ahora dice la verdad sobre por qué

**Medido contra:** `origin/main` = `76db59a052ccf80f6bb3b6e5dc6104ad6224c583` · 2026-09-28T16:09:39Z

J6 (jv-j6). Es la misma familia que SCRUM-1214, por el otro lado: allí eran **etiquetas falsas
sobre sentencias PERMITIDAS**; aquí son **motivos falsos o vagos sobre sentencias RECHAZADAS**.
Toca `scripts/_clasificador-sql.mjs`, un test nuevo (`tests/scrum1223-motivos-de-rechazo.test.mjs`)
y **tres filas** de la línea base de `tests/scrum1214-clasificador-apretado.test.mjs` (sólo la
etiqueta; el veredicto sigue en `RECHAZADA`).

## Lo que decía, y lo que dice

| sentencia | antes | ahora | veredicto |
|---|---|---|---|
| `ALTER COLUMN … DROP DEFAULT` | `DROP` · «contiene DROP: destruye datos» | `ALTER COLUMN … DROP DEFAULT` · «no borra datos, cambia qué reciben las filas NUEVAS (SCRUM-797). Esta lista no la admite…» | **RECHAZADA**, igual |
| `ALTER COLUMN … DROP NOT NULL` | `DROP` · el mismo | `ALTER COLUMN … DROP NOT NULL` · «no borra datos, pero deja entrar NULL donde antes no podía…» | **RECHAZADA**, igual |
| `UPDATE …` | `DESCONOCIDA` · «forma no reconocida» | `UPDATE` · «modifica filas que ya existen…» | **RECHAZADA**, igual |

🔴 **Se corrige el MOTIVO, jamás el veredicto.** El motivo específico sólo sale cuando **todas** las
acciones del `ALTER` son de esas dos formas. Si en el mismo `ALTER` va un `DROP COLUMN` o un cambio
de `TYPE`, manda el motivo de lo peligroso, y hay test para los dos casos.

## Rojo, verde y lo que no se mueve

- **ROJO**, con el clasificador sin tocar: 4 de 6 en rojo, justo los de lo que se corrige. Los 2 de
  control ya pasaban: la destrucción real sigue diciendo «destruye datos», y la mezcla peligrosa
  manda.
- **VERDE:** 6/6 en `scrum1223`, más 16 ficheros de test, **151/151**. Esos 16 son `scrum1214`, los
  guards de SUITE `scrum237` y `scrum976` y todos los que usan el clasificador o el aplicador.
  `scrum237`: 872 negaciones, **NINGUNO 0**; las 3 negaciones nuevas salen FUERTE, porque cada una
  lleva su positivo con el mismo token.
- **La línea base de 1214 hizo su trabajo:** en cuanto cambió la primera etiqueta, saltó con «cambió
  la ETIQUETA». Se actualizaron sólo esas tres filas, con un comentario en cada una.
- **Sobre el SQL real:** 117 versiones históricas de `docs/sql/*.sql` más los 58 ficheros de HEAD,
  417 sentencias. **Cambian 13, y las 13 siguen rechazadas:** 11 `UPDATE` reales (limpieza de
  SCRUM-825 y backfills) dejan de salir como «DESCONOCIDA», y 2 son el `DROP DEFAULT` de SCRUM-797.
  **Ningún fichero cambia de veredicto global.**
- **Mutaciones**, cazadas las dos, con el sha256 del clasificador restaurado igual que antes
  (`369945c34eb0b4af`):
  - desactivar el motivo específico de `DROP` → caen 3 tests;
  - desactivar el reconocimiento de `UPDATE` → caen 2.
  (La primera pasada de la segunda salió CIEGA: el ancla no casó por el escape del shell. Se repitió
  desde un fichero antes de contarla.)

## Lo que NO se ha hecho, a propósito

- **No se admite `DROP DEFAULT` en producción** por el hecho de que dev lo admita: sería otra
  decisión, del fundador. Sigue siendo una de las cuatro diferencias vivas con su ficha
  (`docs/master/SCRUM-1214.md`).
- `INSERT` y el resto del DML siguen saliendo como «DESCONOCIDA»: el ticket nombraba `UPDATE`, y
  ampliar la lista de nombres es otro paso.
- No se unifica con la lista de dev.
