# SCRUM-937 · el NIF del proveedor en el modal del gasto

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-937 comentario 15873.

**Aplicado en el mismo acto** (regla 30), en la mitad de pantalla (SCRUM-937b). La delegación es la
permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de
microcopy. Esta ficha **no** lleva la firma del fundador. Textos propuestos por la Sesión 1.

## Texto aprobado, literal

A · ayuda bajo el campo NIF, visible SOLO mientras no hay proveedor elegido:

> Elige antes el proveedor: el NIF se guarda en su ficha.

B · aviso tras guardar, cuando la respuesta trae `destinoDelNif = 'sin_proveedor'`:

> Gasto guardado. El NIF no se ha guardado: para guardarlo, el gasto necesita un proveedor.

## Dónde se pinta

`public/dashboard/js/expensesView.js`, modal «Nuevo gasto» / «Editar gasto» (también se abre desde la
ficha del Trabajo):

- A — constante `AYUDA_NIF_SIN_PROVEEDOR`, en `<p id="exp-nif-ayuda" class="gasto-nif-ayuda">` debajo
  del NIF. Mientras se ve, el NIF es de solo lectura.
- B — constante `AVISO_NIF_SIN_PROVEEDOR`, con `showToast(…, 'warn')` (ámbar) nada más cerrar el modal,
  en el alta (POST) y en la edición (PUT).

## Qué cambió

Antes no había texto: el NIF se podía teclear sin proveedor y el servidor lo descartaba en silencio
(el 201 no lo decía hasta el #1499, y la pantalla seguía sin decirlo).

B se firmó con un cambio sobre la propuesta («…porque el gasto no tiene proveedor» → «…: para
guardarlo, el gasto necesita un proveedor»): un aviso que dice qué ha fallado sin decir qué hacer deja
al profesional parado.

## Lo que queda sin firmar, o firmado y sin construir

- **C** («Gasto guardado. Este proveedor ya tenía otro NIF en su ficha y se ha mantenido.») está firmado
  en el mismo comentario, pero **no se construye**: desde el modal no se alcanza (con un proveedor que
  tiene NIF, el campo se rellena y queda de solo lectura). Si aparece un camino desde la pantalla, pasa a
  ser obligatorio.
