# SCRUM-985 · el tooltip del botón de importar clientes dice solo CSV

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-985 comentario 16104.

## El literal, tal cual se pinta

Tooltip (`title`) del botón «⬆ Importar CSV» de la lista de clientes
(`public/dashboard/js/customersView.js`, `importBtn.title`):

    Importar clientes desde un fichero CSV

## Qué cambió respecto a lo que había, y por qué

Antes terminaba en «… CSV o Excel». El importador (`csvImport.js`) solo acepta `.csv` y `.txt` y no
hay ningún lector de hojas de cálculo en `src/` ni en `package.json`: un profesional con su lista en
un `.xlsx` llegaba al modal y no podía subirla. El texto es el mismo menos las tres palabras que
prometían lo que no se lee. No se escribe ninguna palabra nueva.

Leer `.xlsx` de verdad NO entra aquí: pide una librería nueva y eso lo decide el fundador (regla 36).

## Lo que queda sin firmar

Nada. La única frase que sigue nombrando Excel en `public/` es la de `csvImport.js` («Sube el .csv
que exporta tu Excel»), donde Excel es el programa de origen del fichero, no un formato aceptado; ya
estaba en pantalla y no cambia.
