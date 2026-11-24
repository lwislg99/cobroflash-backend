param([int]$Desde = 0, [int]$Cuantos = 1, [string]$Lista = 'C:\Users\Public\tmp-jv-j6fg\borrables.txt', [string]$Log = 'C:\Users\Public\tmp-jv-j6fg\borrado.tsv', [string]$Repo = 'C:\Users\Javier Pereira\cobroflash-jv-j6fg')
# SCRUM-1793 - borra arboles de la lista: enlace sin seguirlo -> git worktree remove SIN --force -> carpeta vacia.
$ErrorActionPreference = 'Continue'
$compartido = 'C:\Users\Javier Pereira\cobroflash-backend\node_modules'
$BASE = 284; $BASEP = 7
function Get-Cuenta { @((Get-ChildItem -LiteralPath $compartido -Force | Measure-Object).Count, (Get-ChildItem -LiteralPath (Join-Path $compartido '@prisma') -Force | Measure-Object).Count) }
$todos = @(Get-Content $Lista | Where-Object { $_ })
$fin = [Math]::Min($Desde + $Cuantos, $todos.Count)
$hechos = 0
for ($i = $Desde; $i -lt $fin; $i++) {
  $leaf = $todos[$i]
  if ($leaf -notlike 'cobroflash-jv-*') { "$leaf`tSALTADO: no es cobroflash-jv-" | Out-File $Log -Encoding utf8 -Append; continue }
  $p = Join-Path 'C:\Users\Javier Pereira' $leaf
  # re-comprobacion justo antes de borrar
  $ref = (git -C $p symbolic-ref -q HEAD); if (-not $ref) { $ref = 'HEAD' }
  $fuera = @(git -C $p log $ref --not --remotes --oneline 2>&1 | Where-Object { $_ }).Count; $okLog = $LASTEXITCODE
  $sucio = @(git -C $p status --porcelain 2>&1 | Where-Object { $_ }).Count; $okSt = $LASTEXITCODE
  if ($okLog -ne 0 -or $okSt -ne 0 -or $fuera -ne 0 -or $sucio -ne 0) { "$leaf`tNO borrado: al re-comprobar fuera=$fuera sucio=$sucio rc=$okLog/$okSt" | Out-File $Log -Encoding utf8 -Append; continue }
  $nm = Join-Path $p 'node_modules'; $paso1 = 'sin-enlace'
  if (Test-Path -LiteralPath $nm) {
    $it = Get-Item -LiteralPath $nm -Force
    if ($it.LinkType -eq 'Junction' -or $it.LinkType -eq 'SymbolicLink') {
      $tipo = [string]$it.LinkType; [System.IO.Directory]::Delete($nm)
      if (Test-Path -LiteralPath $nm) { "$leaf`tNO borrado: el enlace sigue tras Directory.Delete" | Out-File $Log -Encoding utf8 -Append; continue }
      $paso1 = "enlace-quitado($tipo)"
    } else { $paso1 = 'copia-propia' }
  }
  $out = (git -C $Repo worktree remove $p 2>&1) -join ' '; $rc = $LASTEXITCODE
  if ($rc -ne 0) { "$leaf`tNO borrado: git worktree remove rc=$rc $out ($paso1)" | Out-File $Log -Encoding utf8 -Append; continue }
  $paso3 = 'sin-carpeta'
  if (Test-Path -LiteralPath $p) {
    if (@(Get-ChildItem -LiteralPath $p -Force).Count -eq 0) { [System.IO.Directory]::Delete($p); $paso3 = 'carpeta-vacia-quitada' } else { $paso3 = 'QUEDA-CARPETA-CON-CONTENIDO' }
  }
  "$leaf`tBORRADO`t$paso1`t$paso3" | Out-File $Log -Encoding utf8 -Append
  $hechos++
  if ((($i - $Desde + 1) % 25) -eq 0 -or $i -eq $fin - 1) {
    $c = Get-Cuenta
    "CONTROL tras $leaf : compartido=$($c[0]) @prisma=$($c[1])" | Out-File $Log -Encoding utf8 -Append
    if ($c[0] -lt $BASE -or $c[1] -lt $BASEP) { "PARADA: el compartido ha bajado ($($c[0])/$($c[1]) frente a $BASE/$BASEP)" | Out-File $Log -Encoding utf8 -Append; "PARADA $($c[0]) $($c[1])"; exit 3 }
  }
}
"hechos=$hechos rango=$Desde..$($fin-1) de $($todos.Count)"
