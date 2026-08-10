# SCRUM-242 · El RUNBOOK de restauración

# 🔴 NO SE PUEDE PROBAR AQUÍ: no hay forma de crear una base desechable.

**Fecha:** 10-ago-2026 · **Carril:** infraestructura · **Medido contra:** `origin/main` = `3f9585c29af64ed5b326cd89ccd10cd4f83c4c31`

Y como **un runbook no probado es otra promesa escrita** —la frase del encargo—, **no se ha
escrito el procedimiento**. Lo que sí se entrega es la otra mitad del punto 3: **retirar la promesa
falsa** y **el guard que impide que vuelva**.

---

## Por qué el paso 2 no es posible, medido

| Vía | Resultado |
|---|---|
| `psql`, `pg_ctl`, `initdb` | **no instalados** |
| `docker`, `docker-compose`, `podman` | **no instalados** |
| Postgres escuchando en local | **puerto 5432 cerrado** |
| Convención de BD desechable en el repo | **no existe** — el proyecto conoce **tres** bases: prod, staging y la dev de Javier |
| ¿Algún test crea la suya? | **ninguno.** Los 51 gateados corren **contra staging** |

Las únicas bases alcanzables son **producción, staging y la de otro carril**, y las tres están
prohibidas para esto. Cambiar `provider` en `prisma/schema.prisma` para restaurar contra SQLite
sería tocar el schema — dominio exclusivo del fundador y STOP.

**Así que no hay dónde volcar y restaurar sin tocar una base real. Ése es el resultado del paso 2.**

## Lo que sí se entrega

### 1 · La promesa falsa, retirada

`backup-dump.mjs` decía que el dump lógico era «restaurable con este mismo script en un entorno
limpio — **ver RUNBOOK al final**». Medido: **ese RUNBOOK nunca existió** (una sola mención en el
fichero: la promesa) y `docs/RUNBOOKS.md` tampoco tiene procedimiento.

Y la promesa era **doble**, porque el script **no restaura**: sus dos modos son volcar y
`--restore-test`, y **ninguno escribe de vuelta**. `--restore-test` *verifica* —descifra, valida el
tag GCM y compara conteos—, que no es lo mismo.

La cabecera ahora dice **el estado real**: para el formato lógico —el que saldría en Railway,
porque su imagen de Node no trae `pg_dump`— **no hay procedimiento escrito ni código que lo haga**.

> Quitar la promesa **no reduce la recuperabilidad**: no había ninguna. Quita una **tranquilidad
> falsa**, que es peor, porque quien leía esa línea no buscaba el runbook hasta necesitarlo — y a
> un runbook se llega a las tres de la mañana con la base caída.

### 2 · El guard: un script no nombra un documento que no existe

Hermano exacto de SCRUM-391 —«una constancia no nombra lo que no está»— **aplicado a los scripts**.

**Censo:** 15 referencias a documento en `scripts/`, en 20+ ficheros.

**Y una exclusión que NO es una exención:** un script puede nombrar un documento **que él mismo
escribe** — `voice-eval.mjs` nombra su `RESULTS.md` y lo genera con `writeFileSync`. Eso es una
salida, no una promesa. Se deriva de que **la escritura esté en el propio script**: nadie lo exime
por su nombre, y el día que deje de escribirlo pasará a exigirse que exista. Sin esta derivación el
guard nacía con un rojo en falso, y un guard con rojos en falso acaba silenciado.

**Lo que este guard NO puede vigilar, dicho:** la promesa **en prosa** («ver RUNBOOK al final») no
es una ruta, y separarla de una mención necesitaría una marca — o sea, una lista de excepciones con
otro nombre. Ésa se arregló **a mano** al medirla; el guard impide que vuelva la clase comprobable.

### Verificado en rojo, por `$?`

| # | Qué se rompe | `$?` |
|---|---|---|
| 1 | Un script nombra `docs/RUNBOOK_RESTAURACION.md`, que no existe | **1**, nombrando script y ruta |
| 2 | SUELO: el extractor deja de ver referencias | **1** — «solo 0 referencias» |

Y dos suelos más, porque el cero puede venir de dos sitios: si **todas** las referencias quedaran
clasificadas como «salida del script», la exclusión se estaría comiendo el guard entero — también
falla.

## Lo que queda, y es del fundador

1. **Validar la política de backups de Railway.** Sigue `[VALIDAR]` en el máster y **no se puede
   medir desde el repositorio**. Es lo más barato y puede cambiar el diagnóstico entero.
2. **Una base desechable** —o el permiso para crear una— para poder escribir el runbook **y
   probarlo**. Sin eso, cualquier procedimiento que se escriba es una promesa más.
3. Lo de SCRUM-242: qué dispara el backup, dónde vive la copia, cuánta retención. **Con coste
   delante (regla 36).**

> **Y el orden importa:** automatizar copias que nadie sabe restaurar produce carpetas que
> tranquilizan y no sirven. El runbook va antes — pero el runbook necesita una base donde probarlo,
> y ése es hoy el bloqueo.

Ficheros: `scripts/backup-dump.mjs` (la promesa retirada) ·
`tests/scrum242-scripts-no-prometen-documentos.test.mjs` (3, nuevo).
