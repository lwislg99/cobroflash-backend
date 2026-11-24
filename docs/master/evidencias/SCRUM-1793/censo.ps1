param([int]$Desde = 0, [int]$Cuantos = 10, [string]$Salida = 'C:\Users\Public\tmp-jv-j6fg\censo.tsv', [string]$Repo = 'C:\Users\Javier Pereira\cobroflash-jv-j6fg')
# SCRUM-1793 - censo de arboles cobroflash-jv-*, SOLO LECTURA. Una fila TSV por arbol.
$ErrorActionPreference = 'Continue'
$vivas = @('cobroflash-jv-j1in','cobroflash-jv-j1io','cobroflash-jv-j1ip','cobroflash-jv-j4cc','cobroflash-jv-j2eg','cobroflash-jv-j6fg')
$lines = git -C $Repo worktree list --porcelain
$wts = @(); $cur = $null
foreach ($l in $lines) {
  if ($l -like 'worktree *') { if ($cur) { $wts += $cur }; $cur = @{ path = $l.Substring(9); branch = ''; head = ''; locked = $false; prunable = $false } }
  elseif ($l -like 'HEAD *') { $cur.head = $l.Substring(5) }
  elseif ($l -like 'branch *') { $cur.branch = $l.Substring(7) }
  elseif ($l -eq 'detached') { $cur.branch = '(detached)' }
  elseif ($l -like 'locked*') { $cur.locked = $true }
  elseif ($l -like 'prunable*') { $cur.prunable = $true }
}
if ($cur) { $wts += $cur }
$jv = @($wts | Where-Object { (Split-Path $_.path -Leaf) -like 'cobroflash-jv-*' -and (Split-Path (Split-Path $_.path -Parent) -Leaf) -eq 'Javier Pereira' })
if ($Desde -eq 0 -and -not (Test-Path $Salida)) {
  (@('arbol','rama','fuera_de_origin','sucio','node_modules','destino_nm','otros_enlaces','viva','bloqueado','existe','veredicto') -join [char]9) | Out-File -FilePath $Salida -Encoding utf8
}
$fin = [Math]::Min($Desde + $Cuantos, $jv.Count)
for ($i = $Desde; $i -lt $fin; $i++) {
  $w = $jv[$i]; $p = $w.path -replace '/', '\'; $leaf = Split-Path $p -Leaf
  $rama = $w.branch -replace '^refs/heads/', ''
  $existe = Test-Path -LiteralPath $p
  $viva = $vivas -contains $leaf
  $fuera = '?'; $sucio = '?'; $nm = 'no-existe'; $dest = ''; $otros = ''
  if ($existe) {
    $ref = if ($rama -eq '(detached)' -or $rama -eq '') { $w.head } else { $w.branch }
    $o = git -C $p log $ref --not --remotes --oneline 2>&1; if ($LASTEXITCODE -eq 0) { $fuera = @($o | Where-Object { $_ }).Count } else { $fuera = 'ERR' }
    $s = git -C $p status --porcelain 2>&1; if ($LASTEXITCODE -eq 0) { $sucio = @($s | Where-Object { $_ }).Count } else { $sucio = 'ERR' }
    $nmp = Join-Path $p 'node_modules'
    if (Test-Path -LiteralPath $nmp) {
      $it = Get-Item -LiteralPath $nmp -Force
      if ($it.LinkType) { $nm = $it.LinkType; $dest = ($it.Target -join ';') } else {
        $nm = 'carpeta'
        $int = @(Get-ChildItem -LiteralPath $nmp -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
        $sc = @(Get-ChildItem -LiteralPath $nmp -Force -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '@*' -or $_.Name -eq '.prisma' } | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } })
        $n = $int.Count + $sc.Count; if ($n -gt 0) { $dest = "enlaces-dentro:$n" }
      }
    }
    $otros = (@(Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'node_modules' -and ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | ForEach-Object { $_.Name }) -join ';')
  }
  $mot = @()
  if ($viva) { $mot += 'sesion viva' }
  if ($w.locked) { $mot += 'bloqueado (locked)' }
  if (-not $existe) { $mot += 'carpeta inexistente (la quita prune)' }
  if ($fuera -ne 0) { $mot += "commits fuera de origin: $fuera" }
  if ($sucio -ne 0) { $mot += "sucio: $sucio" }
  if ($dest -like 'enlaces-dentro*') { $mot += 'node_modules propio con enlaces dentro' }
  if ($otros) { $mot += "otro enlace en la raiz: $otros" }
  $ver = if ($mot.Count -eq 0) { 'BORRABLE' } else { 'NO borrado: ' + ($mot -join ' + ') }
  "$leaf`t$rama`t$fuera`t$sucio`t$nm`t$dest`t$otros`t$viva`t$($w.locked)`t$existe`t$ver" | Out-File -FilePath $Salida -Encoding utf8 -Append
}
"poblacion_jv=$($jv.Count) hechos=$Desde..$($fin-1)"
