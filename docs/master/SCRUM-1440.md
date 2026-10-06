# SCRUM-1440 · Presupuesto rápido en móvil: «Enviar por WhatsApp» siempre a la vista

**Medido contra:** `origin/main` = `9bbc68c57142fe67b6448988614ac41f0f50521e` · 2026-10-02T17:16:27Z
A9: sin fallo que generalice — el descuido fue de alcance de una medición (ver «Errores propios») y se corrigió midiendo; no hay guard que obligue a volver sobre un límite declarado

Carril S2 (`public/dashboard/css/styles.css`, bloque `.qq-modal`) · rama `scrum-1440-enviar-siempre-a-la-vista` · sesión `s2-2octe`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar. Un componente (el modal del presupuesto rápido). Sin color, sombra ni fuente nuevos: fondo de `.modal` y raya `--neutral-200`. Capturas antes/después hechas a 390×844 y miradas; no se guardan en el repo.

## El defecto, medido

Ejecutado en yaqu.app (build `c8bc581c`, cuenta QA, Chromium sin cabeza, sólo mirar). El pie del modal iba DENTRO de lo que se desplaza: `.modal` lleva `overflow-y: auto` y `max-height: 90vh`, con cabecera, cuerpo y pie dentro.

| Ventana | Modo | Contenido / cabe (px) | «Enviar» antes (y) | ¿En pantalla antes? | «Enviar» después (y) | ¿Después? |
| --- | --- | --- | --- | --- | --- | --- |
| 390×844 | Un precio | 652 / 652 | 728–772 | sí | 728–772 | sí |
| 390×844 | 3 opciones | 896 / 760 | 865–909 | **no** | 728–772 | sí |
| 360×640 | Un precio | 652 / 576 | 600–644 | **no** | 524–568 | sí |
| 360×640 | 3 opciones | 896 / 576 | 768–812 | **no** | 524–568 | sí |
| 390×500 · teclado emulado | Un precio | 652 / 450 | 586–630 | **no** | 384–428 | sí |
| 390×500 · teclado emulado | 3 opciones | 896 / 450 | 652–696 | **no** | 384–428 | sí |
| 360×400 · teclado emulado | Un precio | 652 / 360 | 576–620 | **no** | 284–328 | sí |
| 360×400 · teclado emulado | 3 opciones | 896 / 360 | 642–686 | **no** | 284–328 | sí |
| 1280×900 | Un precio | cabe | 683–719 | sí | 689–725 | sí |
| 1280×900 | 3 opciones | cabe | 796–832 | sí | 803–839 | sí |

«En pantalla» = el botón entero dentro de la ventana Y lo que hay en su centro es el botón (`elementFromPoint`), no otra cosa encima.

«Después» = con el `styles.css` de esta rama servido por la sonda sobre su GET; todo lo demás, producción.

## El arreglo

`.qq-modal .modal-footer { position: sticky; bottom: 0 }`, con fondo opaco (el de `.modal`) y una raya arriba. El pie se queda pegado abajo y el contenido se desplaza por detrás. Sólo este modal: los otros nueve pies del panel no se tocan. El apilado de los dos botones en móvil (SCRUM-384) no se toca.

## Lo que cuesta, medido

- El modal crece 13 px (12 de relleno sobre los botones y 1 de raya), también en escritorio.
- Con el pie fijo queda menos sitio para los campos cuando la ventana es baja. Alto entre el primer campo y el pie: a 390×500, 230 px en «Un precio»; a 360×400, 140 px. Antes era más (359 y 269) porque el pie no ocupaba sitio: estaba fuera. Los campos se alcanzan desplazando.

## Verificado

- Navegador: la tabla de arriba, diez de diez con el botón en pantalla y pulsable.
- `tests/scrum1440-enviar-siempre-a-la-vista.test.mjs`: guard sobre el fuente (la regla existe, es `sticky`, es opaca), con suelo y control. No dibuja.

## Límites

- **«Teclado emulado» es una ventana encogida**, que es lo que hace Android. No es un teclado de verdad. En iOS el teclado tapa sin encoger la ventana: ahí el pie pegado quedaría DEBAJO del teclado, igual que hoy. No medido.
- No medido en un móvil real.
- A 360×400 quedan 140 px para los campos en «Un precio»: se puede usar, pero es estrecho. Desapilar los botones en ventanas bajas lo aliviaría y toca el diseño fijado por SCRUM-384: no se ha hecho.
- No se ha comprobado con el aviso de error del pie a la vista (`#qq-alert`), que lo hace más alto.

## Errores propios de esta tanda

- El defecto lo medí «de refilón» mientras medía otra cosa, y lo declaré sólo para «3 opciones» a 390×844. Al medirlo a propósito salió también en «Un precio» a 360×640. Un límite que declaro en una medición es la siguiente medición, no una nota.
