# Qué falta para guardar Configuración, cuando está en otra pestaña

Aprobado por el orquestador por delegación del fundador · SCRUM-894 comentario 15672

**Aplicado en el mismo acto** (regla 30). La delegación es la permanente de
`docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy. Esta ficha
**no** lleva la firma del fundador.

## Texto aprobado, literal

> Para guardar, rellena «{rótulo del campo}». Está en la pestaña {pestaña}.

Ejemplo, tal como se pinta: «Para guardar, rellena «NIF/CIF». Está en la pestaña Empresa.»

**Condición de la firma:** `{rótulo del campo}` y `{pestaña}` salen de los rótulos que la pantalla ya
muestra (la etiqueta del campo y el nombre de la pestaña), nunca de nombres internos como `taxId`. Un
campo sin etiqueta visible no recibe texto: solo se abre su pestaña y lo señala el navegador.

## Dónde se pinta

`public/dashboard/js/settingsSubmenus.js` — función `avisoFaltaEnOtraPestana`. La llama
`settingsView.js` en el clic de «Guardar cambios» de Configuración y lo pinta en Peligro bajo el campo
(clase `.aviso-falta-campo`), cuando todo lo obligatorio que falta está en pestañas que no se ven. Lo
lee el profesional, a 360/390 px y en escritorio.

## Qué cambió

Antes no había texto: el navegador frenaba el guardado sin decir nada, porque no puede señalar un campo
oculto. Firmado sin cambios respecto a la propuesta de la sesión (comentario 15671).
