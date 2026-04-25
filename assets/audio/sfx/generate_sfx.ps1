# DOMINO Quest - Original SFX generator (CC0 / public domain)
# Generates 7 short retro-RPG-style SE wav files using only square / triangle
# / noise oscillators with simple envelopes. No external audio assets.

$ErrorActionPreference = "Stop"
$SR = 22050
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Wav([string]$name, [double[]]$samples) {
  $path = Join-Path $here $name
  $n = $samples.Length
  $byteCount = $n * 2
  $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Create)
  $bw = New-Object System.IO.BinaryWriter($fs)
  # RIFF header
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $bw.Write([uint32](36 + $byteCount))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $bw.Write([uint32]16)        # subchunk1 size
  $bw.Write([uint16]1)         # PCM
  $bw.Write([uint16]1)         # mono
  $bw.Write([uint32]$SR)       # sample rate
  $bw.Write([uint32]($SR * 2)) # byte rate
  $bw.Write([uint16]2)         # block align
  $bw.Write([uint16]16)        # bits per sample
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $bw.Write([uint32]$byteCount)
  foreach ($s in $samples) {
    $v = [int]([math]::Max(-1.0, [math]::Min(1.0, $s)) * 32760)
    $bw.Write([int16]$v)
  }
  $bw.Flush(); $bw.Close(); $fs.Close()
  Write-Host "wrote $name ($n samples)"
}

function Env-AD([int]$n, [double]$attack, [double]$release) {
  $a = [math]::Max(1, [int]($SR * $attack))
  $r = [math]::Max(1, [int]($SR * $release))
  $out = New-Object 'double[]' $n
  for ($i = 0; $i -lt $n; $i++) {
    if ($i -lt $a)        { $out[$i] = $i / $a }
    elseif ($i -gt ($n - $r)) { $out[$i] = [math]::Max(0.0, ($n - $i) / $r) }
    else                  { $out[$i] = 1.0 }
  }
  return ,$out
}

function Square([double]$freq, [int]$n, [double]$duty) {
  $period = $SR / $freq
  $out = New-Object 'double[]' $n
  for ($i = 0; $i -lt $n; $i++) {
    $p = ($i % $period) / $period
    $out[$i] = if ($p -lt $duty) { 1.0 } else { -1.0 }
  }
  return ,$out
}

function Slide-Square([double]$f0, [double]$f1, [int]$n) {
  $out = New-Object 'double[]' $n
  $phase = 0.0
  for ($i = 0; $i -lt $n; $i++) {
    $t = if ($n -le 1) { 0.0 } else { $i / ($n - 1.0) }
    $f = $f0 + ($f1 - $f0) * $t
    $phase += 2.0 * [math]::PI * $f / $SR
    $out[$i] = if ([math]::Sin($phase) -gt 0) { 1.0 } else { -1.0 }
  }
  return ,$out
}

function Slide-Triangle([double]$f0, [double]$f1, [int]$n) {
  $out = New-Object 'double[]' $n
  $phase = 0.0
  for ($i = 0; $i -lt $n; $i++) {
    $t = if ($n -le 1) { 0.0 } else { $i / ($n - 1.0) }
    $f = $f0 + ($f1 - $f0) * $t
    $phase += 2.0 * [math]::PI * $f / $SR
    $out[$i] = (2.0 / [math]::PI) * [math]::Asin([math]::Sin($phase))
  }
  return ,$out
}

$rng = New-Object System.Random 20260425
function Noise([int]$n) {
  $out = New-Object 'double[]' $n
  for ($i = 0; $i -lt $n; $i++) { $out[$i] = ($rng.NextDouble() * 2.0) - 1.0 }
  return ,$out
}

function Apply-Env([double[]]$track, [double[]]$env) {
  $n = $track.Length
  $out = New-Object 'double[]' $n
  for ($i = 0; $i -lt $n; $i++) { $out[$i] = $track[$i] * $env[$i] }
  return ,$out
}

function Gain([double[]]$track, [double]$g) {
  $n = $track.Length
  $out = New-Object 'double[]' $n
  for ($i = 0; $i -lt $n; $i++) { $out[$i] = $track[$i] * $g }
  return ,$out
}

function Mix2([double[]]$a, [double[]]$b) {
  $n = [math]::Max($a.Length, $b.Length)
  $out = New-Object 'double[]' $n
  $m = 0.0
  for ($i = 0; $i -lt $n; $i++) {
    $va = if ($i -lt $a.Length) { $a[$i] } else { 0.0 }
    $vb = if ($i -lt $b.Length) { $b[$i] } else { 0.0 }
    $v = $va + $vb
    $out[$i] = $v
    $av = [math]::Abs($v)
    if ($av -gt $m) { $m = $av }
  }
  if ($m -gt 1.0) {
    for ($i = 0; $i -lt $n; $i++) { $out[$i] = $out[$i] / $m }
  }
  return ,$out
}

# 1. dialogue_normal
$n = [int]($SR * 0.045)
$s = Square 620 $n 0.5
$s = Apply-Env $s (Env-AD $n 0.002 0.030)
$s = Gain $s 0.55
Write-Wav "dialogue_normal.wav" $s

# 2. dialogue_dark
$n = [int]($SR * 0.060)
$base = Square 180 $n 0.3
$nz = Gain (Noise $n) 0.18
$s = Mix2 $base $nz
$s = Apply-Env $s (Env-AD $n 0.003 0.045)
$s = Gain $s 0.6
Write-Wav "dialogue_dark.wav" $s

# 3. dialogue_bright
$n = [int]($SR * 0.040)
$s = Square 1080 $n 0.5
$s = Apply-Env $s (Env-AD $n 0.001 0.028)
$s = Gain $s 0.5
Write-Wav "dialogue_bright.wav" $s

# 4. ui_warning
$n = [int]($SR * 0.42)
$a = Square 220 $n 0.5
$b = Square 225 $n 0.5
$s = Mix2 $a $b
$nz = Gain (Noise $n) 0.08
$s = Mix2 $s $nz
$seg = [int]($n / 6)
$env = New-Object 'double[]' $n
for ($i = 0; $i -lt $n; $i++) {
  $phase = ([int]($i / $seg)) % 2
  $env[$i] = if ($phase -eq 0) { 1.0 } else { 0.15 }
}
$s = Apply-Env $s $env
$s = Apply-Env $s (Env-AD $n 0.005 0.05)
$s = Gain $s 0.5
Write-Wav "ui_warning.wav" $s

# 5. ui_cursor
$n = [int]($SR * 0.035)
$s = Square 880 $n 0.5
$s = Apply-Env $s (Env-AD $n 0.001 0.022)
$s = Gain $s 0.45
Write-Wav "ui_cursor.wav" $s

# 6. ui_confirm (rising pikon)
$n = [int]($SR * 0.14)
$s = Slide-Square 620 1240 $n
$s = Apply-Env $s (Env-AD $n 0.003 0.08)
$s = Gain $s 0.55
Write-Wav "ui_confirm.wav" $s

# 7. ui_cancel (falling pokoh)
$n = [int]($SR * 0.13)
$s = Slide-Triangle 420 200 $n
$s = Apply-Env $s (Env-AD $n 0.004 0.09)
$s = Gain $s 0.55
Write-Wav "ui_cancel.wav" $s

Write-Host "All SFX generated."
