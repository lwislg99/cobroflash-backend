#!/usr/bin/env bash
# docs/master/evidencias/SCRUM-1539/banco-ramas-borrables.sh — SCRUM-1539
#
# El mismo patrón de la carrera de scrum804b, en `scripts/verificacion-s5/ramas-borrables.mjs`:
# «qué ramas existen» lo lee del REMOTO (ahora) y «cuáles están mergeadas» de las refs LOCALES (del
# último fetch), y las casa por NOMBRE. Este banco fabrica un remoto de juguete donde una rama ya
# mergeada recibe un commit nuevo DESPUÉS del último fetch, y corre el guion EN SECO (nunca
# `--ejecutar`). No toca el repositorio de verdad: todo vive en la carpeta que se le pasa.
#
#   bash banco-ramas-borrables.sh <carpeta vacía fuera del árbol> <raíz del árbol>
set -u
T="$1"; RAIZ="$2"
GUION="$RAIZ/scripts/verificacion-s5/ramas-borrables.mjs"
rm -rf "$T"; mkdir -p "$T"
g() { git -c user.name=banco -c user.email=banco@invalid -c commit.gpgsign=false "$@"; }

g init -q --bare -b main "$T/remoto.git"
g clone -q "$T/remoto.git" "$T/a" 2>/dev/null
cd "$T/a" || exit 3
g checkout -q -b main 2>/dev/null
echo 0 > f; g add f; g commit -q -m inicial; g push -q origin main
# Seis ramas mergeadas por su propio commit de merge, y una que entra sin que ningún merge la nombre
# (para que el control «el reparto separa de verdad» del guion no salte por otra cosa).
for n in 1 2 3 4 5 6; do
  g checkout -q -b "scrum-$n-rama" main; echo "$n" > "f$n"; g add "f$n"; g commit -q -m "obra $n"
  g push -q origin "scrum-$n-rama"
  g checkout -q main; g merge -q --no-ff -m "Merge pull request #$n from banco/scrum-$n-rama" "scrum-$n-rama"
done
g checkout -q -b scrum-7-absorbida main; g push -q origin scrum-7-absorbida; g checkout -q main
g push -q origin main
g fetch -q --prune origin

echo "== ANTES (control): el clon A está al día. ¿scrum-3-rama sale borrable y es verdad?"
node "$GUION" > "$T/antes.txt" 2>&1; echo "EXIT_GUION=$?"
grep -c '^  scrum-3-rama$' "$T/antes.txt" | sed 's/^/lineas «  scrum-3-rama» en BORRABLES: /'
echo "commits de scrum-3-rama en el REMOTO que no están en main: $(g ls-remote origin refs/heads/scrum-3-rama | cut -f1 | xargs -I{} git -C "$T/remoto.git" rev-list --count {} ^main)"

# Otra persona empuja obra NUEVA a scrum-3-rama. El clon A no hace fetch.
g clone -q "$T/remoto.git" "$T/b" 2>/dev/null
( cd "$T/b" && g checkout -q scrum-3-rama && echo nueva > obra-nueva && g add obra-nueva && g commit -q -m "obra nueva SIN mergear" && g push -q origin scrum-3-rama )

echo "== DESPUÉS: el remoto ha avanzado, A NO ha hecho fetch."
node "$GUION" > "$T/despues.txt" 2>&1; echo "EXIT_GUION=$?"
grep -c '^  scrum-3-rama$' "$T/despues.txt" | sed 's/^/lineas «  scrum-3-rama» en BORRABLES: /'
grep -E '^CONTROL|^BORRABLES|^ramas vivas' "$T/despues.txt"
echo "commits de scrum-3-rama en el REMOTO que no están en main: $(g ls-remote origin refs/heads/scrum-3-rama | cut -f1 | xargs -I{} git -C "$T/remoto.git" rev-list --count {} ^main)"

echo "== CONTRAPRUEBA: con un fetch delante, ¿deja de salir?"
g fetch -q --prune origin
node "$GUION" > "$T/con-fetch.txt" 2>&1; echo "EXIT_GUION=$?"
grep -c '^  scrum-3-rama$' "$T/con-fetch.txt" | sed 's/^/lineas «  scrum-3-rama» en BORRABLES: /'
