# SCRUM-832 · lo que se dice cuando una ficha ya no está

**Aprobados por el FUNDADOR el 9-sep-2026.**

## Los textos, literales

> Ese presupuesto ya no existe.

> Ese trabajo ya no existe.

> Esa factura ya no existe.

> Ese albarán ya no existe.

> Ese cliente ya no existe.

Los cinco con **punto final**, que es parte del literal.

## Dónde se pintan

`public/dashboard/js/app.js` → `DETALLES`, y los pinta `abrirFichaDesdeHash` cuando el router
intenta restaurar una ficha desde el hash —el camino del **botón atrás** y el del **enlace
compartido**— y el id no vale. El usuario vuelve a **su lista**, no a una página de error.

## 🔒 Por qué los cinco valen para DOS situaciones distintas, y es a propósito

El mismo texto se usa cuando el id **no existe** y cuando el id **es de otro negocio**. No es una
simplificación: es el requisito.

> «Dos respuestas distintas a "no existe" y "no es tuyo" convierten la lista de ids en un
> directorio de la competencia.»

Si se distinguieran, cualquiera podría recorrer números y averiguar **qué documentos hay en otros
merchants** sin llegar a ver ninguno. Es fuga de tenencia (regla 2) aunque no se enseñe un solo
dato. Por eso el router **no mira el código del error** —404, 403 o el que sea—: sólo si la
petición salió bien.

Lo vigila `tests/scrum832-atras-vuelve-a-la-lista.test.mjs`, y compara **el texto**, no sólo el
destino: mismo sitio con mensajes distintos sería la fuga más fácil de escribir.

## Qué había antes

Nada: el caso no existía. Abrir una ficha no dejaba rastro en el historial, así que no había
ningún camino que pudiera llegar con un id inválido. El aviso nace con el mecanismo que lo hace
posible.
