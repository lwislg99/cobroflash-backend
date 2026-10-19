# SCRUM-1516b · EL ROJO PRIMERO, con violaciones REALES del tipo que el test dice prevenir.
# Uso (PowerShell 5.1, desde la raíz de un worktree con node_modules y el árbol COMMITEADO):
#   powershell -File docs/master/evidencias/SCRUM-1516b/rojo-primero.ps1 <carpeta de salidas, FUERA del árbol>
# Cada inyección: se aplica, se enseña su `git diff --numstat` (que se aplicó), se compila, se corre el test,
# y se revierte con `git restore --source=HEAD`; al final, `git status --porcelain` tiene que salir vacío.
#   A · la ficha del gasto pierde el filtro de comercio  → el eje del COMERCIO tiene que caer nombrándola
#   B · el PDF del presupuesto pierde la puerta del Técnico (SCRUM-1555) → el eje del ROL tiene que caer
#   C · se declara una ruta que no cruza                  → «declaradas que ya NO salen» (la mitad que no baja en silencio)
#   D · el suelo de población sube uno                    → «el censo vio N rutas y el suelo es N+1»
param([Parameter(Mandatory = $true)][string]$Salidas)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$TEST = 'tests/scrum1516b-frontera-en-el-obligatorio.test.mjs'
if ((git status --porcelain) -ne $null) { Write-Output 'CIEGO: el árbol tiene cambios sin commitear; commitea antes de inyectar (A23 #9)'; exit 2 }
New-Item -ItemType Directory -Force $Salidas | Out-Null

function Cambiar([string]$fichero, [string]$de, [string]$a) {
  $p = (Resolve-Path $fichero).Path
  $t = [IO.File]::ReadAllText($p)
  if (-not $t.Contains($de)) { $de = $de.Replace("`n", "`r`n"); $a = $a.Replace("`n", "`r`n") }
  if (([regex]::Matches($t, [regex]::Escape($de))).Count -ne 1) { throw "la inyección no casa UNA vez en $fichero" }
  [IO.File]::WriteAllText($p, $t.Replace($de, $a), $utf8)
}
function Correr([string]$nombre, [bool]$compilar) {
  git diff --numstat | Out-File -Encoding utf8 (Join-Path $Salidas "$nombre-numstat.txt")
  if ($compilar) { node node_modules/typescript/bin/tsc -p . | Out-Null }
  node --test --test-force-exit $TEST 2>&1 | Out-File -Encoding utf8 (Join-Path $Salidas "$nombre-test.txt")
  $codigo = $LASTEXITCODE
  git restore --source=HEAD --staged --worktree -- .
  if ($compilar) { node node_modules/typescript/bin/tsc -p . | Out-Null }
  Write-Output "$nombre · test sale $codigo (se espera 1) · numstat: $((Get-Content (Join-Path $Salidas "$nombre-numstat.txt")) -join ' | ')"
}

Cambiar 'src/modules/expenses/domain/expenses.service.ts' "  const fila = await prisma.expense.findFirst({`n    where: { id, merchantId }," "  const fila = await prisma.expense.findFirst({`n    where: { id },"
Correr 'A-gasto-sin-comercio' $true
Cambiar 'src/modules/system/app/routes/quotesAdmin.routes.ts' "router.get('/:id/pdf', async (req, res) => {" "router.get('/:id/pdf', async (req, res) => { const puedeVerElPresupuesto = async () => true;"
Correr 'B-pdf-sin-puerta-del-tecnico' $true
Cambiar $TEST "  ['GET /admin/billing/plans'," "  ['GET /admin/una-que-ya-no-cruza', 'inyección roja de 1516b: una declarada que ya no sale tiene que tumbar el test'],`n  ['GET /admin/billing/plans',"
Correr 'C-declarada-que-no-sale' $false
Cambiar $TEST "  rol: 78," "  rol: 79,"
Correr 'D-suelo-de-mas' $false
Write-Output "estado final del árbol (vacío = limpio): [$((git status --porcelain) -join ' ')]"
