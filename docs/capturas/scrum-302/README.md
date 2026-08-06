# SCRUM-302 (C2) · capturas AB6 de la barra de acciones del albarán

**Medido contra:** `origin/main` = `3788ff840c70e3981d7e132b502bd7ac474a371e` · 2026-08-06T10:27:00+02:00

Banco aislado (`chrome-headless-shell` por CDP + servidor estático efímero sirviendo `public/`),
con los ficheros REALES de la vista y `apiRequest` sustituido. Sin BD, sin auth, sin servidor de la
app, sin producción. El banco no se commitea: vivió en el scratchpad.

**Suelo del banco:** la barra tiene que pintar al menos 3 botones. Si no, **no captura** y sale con
error — una captura de una pantalla vacía no es evidencia de nada.

## Lo que enseñan: una regresión que estaba en main

| fichero | árbol | qué se ve |
|---|---|---|
| `scrum302-antes-borrador-390.png` | `main` (`3788ff8`) | **los TRES botones dicen «[PENDIENTE microcopy oficial]»** |
| `scrum302-antes-emitido-390.png` | `main` (`3788ff8`) | dos de tres, igual |
| `scrum302-despues-borrador-390.png` | esta rama | Emitir · **Descargar PDF** · Editar líneas |
| `scrum302-despues-emitido-390.png` | esta rama | Enviar para firmar · Firmar aquí mismo · Descargar PDF |
| `scrum302-despues-firmado-1280.png` | esta rama | Facturar lo entregado · Descargar PDF · Enviar por WhatsApp |

El «antes» **no es el estado anterior al ticket**: es el estado de `main` de esta mañana. Los
rótulos se aprobaron y se aplicaron el 5-ago; una edición posterior partió el objeto que los
guarda y seis se perdieron por el camino, sin romper nada y sin que ningún test se pusiera rojo.

Las capturas son a 390 (móvil, que es donde vive el operario) y una a 1280. **Matriz de
dispositivos completa: hueco humano declarado** — el banco corre en un tamaño por captura, no
sustituye a probarlo en un teléfono real.
