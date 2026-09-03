# SCRUM-709 · La microcopy deja de tener un punto único de escritura

**Medido contra:** `origin/main` = `336e026e6a14274676881ff1e247eab66ef06d2a` · 2026-09-03T15:02:49+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-709-microcopy-por-fichero`

**LA VÍCTIMA: la PR que no entra.** La #982 se quedó bloqueada con la suite verde —4872 pass, 0
fail— por UN fichero de documentación. Octava colisión en dos días, y las ocho se resolvieron igual:
conservar los dos addenda. Un conflicto cuya resolución es siempre la misma no informa de nada: es
una factura que se paga **por par de ramas**. Cuatro sesiones aprobando el mismo día son seis
conflictos garantizados. Tercer punto único de escritura compartido de la casa, tras SCRUM-662 y
SCRUM-670.

**EL BARRIDO DE LECTORES SE HIZO PRIMERO, Y MI PRIMER BARRIDO ESTABA ROTO.** Buscar por nombre de
fichero encontró once menciones pero **no encontró el guard de SCRUM-387**, que era el control
positivo. El motivo importa: ese guard **no nombra el fichero**. Exige que una marca de «aprobado
por el fundador» cite un `SCRUM-<n>` **o un `docs/…` cualquiera** en el mismo bloque de comentario.
Es decir, no le pide nada a ese fichero en concreto, y mover el registro no lo rompe — **siempre que
lo citado siga existiendo**. Por eso el registro viejo se **congela y no se borra**.

**Lo que pide cada lector, que no es lo mismo para todos:**

| Lector | Qué le pide al fichero | ¿Le afecta la mudanza? |
|---|---|---|
| `tests/scrum387-procedencia-aprobacion.test.mjs` | Nada de ese fichero: que la cita sea rastreable (`SCRUM-<n>` o `docs/…`) | No, mientras lo citado exista |
| `tests/scrum654-dictado-sin-conexion.test.mjs` | Que **exista** y **contenga** un texto literal | No: se congela entero |
| `tests/scrum402`, `tests/scrum579` | Sólo lo mencionan en comentarios | No |
| 3 ficheros de `public/` y 1 de `src/` | Lo citan como procedencia en comentarios | No |
| 8 entradas de `docs/master/` | Lo citan como referencia histórica | No |

**LA SALIDA:** `docs/microcopy/AAAA-MM-DD-SCRUM-<n>-<ranura>.md`, una aprobación por fichero. Dos
sesiones que escriben ficheros distintos no chocan nunca. El registro anterior queda **congelado,
entero y sin tocar un literal**, con una cabecera que dice qué lo supera y dónde mirar — mismo
criterio que `MIGRATIONS_PENDING.md`: era cierto cuando se escribió.

**🔴 EL ÍNDICE A MANO NO EXISTE, y hay un guard que lo impide.** El listado del directorio ES el
índice. El `README.md` explica la convención y **no se toca al aprobar**. Y no es una promesa: un
control recorre cada fichero del directorio entero y cae si uno nombra a otro. **Ese control me cazó
a mí**: el README ponía como ejemplo el nombre de una aprobación real, que es indistinguible de un
índice de una línea —la siguiente sesión añade la suya al lado—. El ejemplo pasó a un ticket que no
puede existir.

**EL ROJO QUE IMPORTA, con git de verdad:** dos ramas aprueban el mismo día en un repo de usar y
tirar. Los dos ficheros propios **no chocan** y **los dos sobreviven** a la fusión; y en la MISMA
fusión, el fichero único **sí choca**, y es el único en conflicto. Una prueba que pasara con los dos
mecanismos no probaría ninguno.

**Suelo y controles:** el buscador `aprobacionesDeMicrocopy()` **lanza** si no encuentra nada —cero
es «no supe mirar», no «no hay aprobaciones»— y llega a los **dos** sitios; una aprobación inventada
**no** se encuentra; y el control positivo enumera las **6** citas a documentos dentro de las **39**
marcas de aprobación de `src/` y `public/` y comprueba que **todas resuelven**, con suelo por si el
barrido viera pocas.

**⛔ No cambió ni un literal aprobado.** Esto mueve dónde vive el registro, no lo que dice.
