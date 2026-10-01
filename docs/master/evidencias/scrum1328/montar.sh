#!/usr/bin/env bash
# montar.sh <carpeta de destino, FUERA del arbol y SIN espacios en la ruta>
#
# Monta el laboratorio de SCRUM-1328 fuera del repo. Los ficheros que registran tests se guardan aqui
# con `.txt` detras porque `tests/scrum708` caza todo fichero del arbol que registre tests y no corra
# en la tanda; al montarlos recuperan su nombre.
#
#   <destino>/anatomia-tap.mjs · censo-quien-pisa.mjs · sonda-proceso.mjs · mini-tanda.mjs
#   <destino>/repro/{a,b,c}.test.mjs · correr.sh · hijo/suelto.mjs · hijo/anidado.test.mjs
#
# Despues:
#   cd <destino>/repro
#   bash correr.sh sin-hijo opciones base.tap          # linea base: entero
#   bash correr.sh hereda   opciones hereda.tap        # EL ROJO: el hijo hereda NODE_OPTIONS
#   bash correr.sh limpio   opciones limpio.tap        # control: el hijo sin NODE_OPTIONS
#   bash correr.sh contexto opciones contexto.tap      # control: el hijo con la marca de la tanda
#   bash correr.sh hereda   argumentos args.tap        # control: reporters como argumentos
#   node ../anatomia-tap.mjs base.tap hereda.tap limpio.tap contexto.tap args.tap
#   (con HIJO=anidado.test.mjs delante de `bash correr.sh …`, el hijo es OTRO `node --test`)
set -eu
aqui="$(cd "$(dirname "$0")" && pwd)"
dest="${1:?uso: montar.sh <carpeta de destino>}"
case "$dest" in *" "*) echo "CIEGO: la ruta de destino lleva espacios y NODE_OPTIONS la partiria: $dest" >&2; exit 3;; esac
mkdir -p "$dest/repro/hijo"
cp "$aqui/anatomia-tap.mjs" "$aqui/censo-quien-pisa.mjs" "$aqui/sonda-proceso.mjs" "$aqui/mini-tanda.mjs" "$dest/"
cp "$aqui/laboratorio/a.test.mjs.txt" "$dest/repro/a.test.mjs"
cp "$aqui/laboratorio/b.test.mjs.txt" "$dest/repro/b.test.mjs"
cp "$aqui/laboratorio/c.test.mjs.txt" "$dest/repro/c.test.mjs"
cp "$aqui/laboratorio/hijo-suelto.mjs.txt" "$dest/repro/hijo/suelto.mjs"
cp "$aqui/laboratorio/hijo-anidado.test.mjs.txt" "$dest/repro/hijo/anidado.test.mjs"
cp "$aqui/laboratorio/correr.sh" "$dest/repro/correr.sh"
printf 'b.test.mjs\na.test.mjs\n' > "$dest/repro/lista-control.txt"
echo "montado en $dest ($(ls "$dest" "$dest/repro" "$dest/repro/hijo" | grep -c -E '\.(mjs|sh|txt)$') ficheros)"
