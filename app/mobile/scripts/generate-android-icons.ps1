param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectRoot 'assets'
$resDir = Join-Path $projectRoot 'android\app\src\main\res'
$sourceCopy = Join-Path $assetsDir 'spur-icon-source.png'
$iconPath = Join-Path $assetsDir 'icon.png'

Copy-Item -LiteralPath $Source -Destination $sourceCopy -Force

$sourceImage = [System.Drawing.Image]::FromFile($sourceCopy)
$cropSize = [Math]::Min($sourceImage.Width, $sourceImage.Height)
$cropX = [int](($sourceImage.Width - $cropSize) / 2)
$cropY = [int](($sourceImage.Height - $cropSize) / 2)
$square = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($square)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage(
  $sourceImage,
  (New-Object System.Drawing.Rectangle 0, 0, 1024, 1024),
  $cropX,
  $cropY,
  $cropSize,
  $cropSize,
  [System.Drawing.GraphicsUnit]::Pixel
)
$graphics.Dispose()
$sourceImage.Dispose()
$square.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)

function New-RoundedPath([int]$size, [int]$radius) {
  $diameter = $radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
  $path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
  $path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-LauncherIcon([int]$size, [string]$density, [bool]$round) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  if ($round) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $size, $size)
  } else {
    $path = New-RoundedPath $size ([Math]::Max(1, [int]($size * 0.16)))
  }

  $g.SetClip($path)
  $g.DrawImage($square, 0, 0, $size, $size)
  $path.Dispose()
  $g.Dispose()

  $folder = Join-Path $resDir "mipmap-$density"
  $name = if ($round) { 'ic_launcher_round.webp' } else { 'ic_launcher.webp' }
  $bitmap.Save((Join-Path $folder $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$sizes = [ordered]@{
  mdpi = 48
  hdpi = 72
  xhdpi = 96
  xxhdpi = 144
  xxxhdpi = 192
}

foreach ($entry in $sizes.GetEnumerator()) {
  Save-LauncherIcon $entry.Value $entry.Key $false
  Save-LauncherIcon $entry.Value $entry.Key $true
}

$square.Dispose()
Write-Output "Generated Android icons from $sourceCopy"
