param(
  [string]$SourcePath = 'C:\Users\davyk\Pictures\taze ai2.png',
  [string]$BrandTitle = 'Taze'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$imagesDir = Join-Path $repoRoot 'assets\images'
$storeDir = Join-Path $repoRoot 'assets\store'

foreach ($dir in @($imagesDir, $storeDir)) {
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

function New-Color([string]$hex) {
  $clean = $hex.TrimStart('#')
  if ($clean.Length -eq 6) {
    return [System.Drawing.Color]::FromArgb(
      255,
      [Convert]::ToInt32($clean.Substring(0, 2), 16),
      [Convert]::ToInt32($clean.Substring(2, 2), 16),
      [Convert]::ToInt32($clean.Substring(4, 2), 16)
    )
  }

  if ($clean.Length -eq 8) {
    return [System.Drawing.Color]::FromArgb(
      [Convert]::ToInt32($clean.Substring(0, 2), 16),
      [Convert]::ToInt32($clean.Substring(2, 2), 16),
      [Convert]::ToInt32($clean.Substring(4, 2), 16),
      [Convert]::ToInt32($clean.Substring(6, 2), 16)
    )
  }

  throw "Ongeldige kleurwaarde: $hex"
}

function Set-HighQualityDrawing([System.Drawing.Graphics]$graphics) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function New-Canvas([int]$width, [int]$height) {
  return New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Draw-ImageCover(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$image,
  [float]$x,
  [float]$y,
  [float]$width,
  [float]$height
) {
  $ratio = [Math]::Max($width / $image.Width, $height / $image.Height)
  $drawWidth = $image.Width * $ratio
  $drawHeight = $image.Height * $ratio
  $drawX = $x + (($width - $drawWidth) / 2)
  $drawY = $y + (($height - $drawHeight) / 2)
  $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
}

function Draw-ImageContain(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$image,
  [float]$x,
  [float]$y,
  [float]$width,
  [float]$height
) {
  $ratio = [Math]::Min($width / $image.Width, $height / $image.Height)
  $drawWidth = $image.Width * $ratio
  $drawHeight = $image.Height * $ratio
  $drawX = $x + (($width - $drawWidth) / 2)
  $drawY = $y + (($height - $drawHeight) / 2)
  $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
}

function Draw-SoftGlow(
  [System.Drawing.Graphics]$graphics,
  [float]$x,
  [float]$y,
  [float]$size,
  [System.Drawing.Color]$color
) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($x, $y, $size, $size)
  $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
  $brush.CenterColor = $color
  $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $color))
  $graphics.FillEllipse($brush, $x, $y, $size, $size)
  $brush.Dispose()
  $path.Dispose()
}

function Draw-RoundedRect(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.RectangleF]$rect,
  [float]$radius,
  [System.Drawing.Color]$fillColor,
  [System.Drawing.Color]$borderColor
) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $fill = New-Object System.Drawing.SolidBrush($fillColor)
  $border = New-Object System.Drawing.Pen($borderColor, 2)
  $graphics.FillPath($fill, $path)
  $graphics.DrawPath($border, $path)
  $border.Dispose()
  $fill.Dispose()
  $path.Dispose()
}

$brandDark = New-Color '#04131F'
$brandDarkSoft = New-Color '#0A2233'
$brandTeal = New-Color '#1BE7FF'
$brandCyan = New-Color '#8AF7FF'
$brandLine = New-Color '#2A5366'
$brandWhite = [System.Drawing.Color]::White
$brandMuted = New-Color '#CBEAF1'

$fallbackSourcePath = 'C:\Users\davyk\Pictures\Taze ai.png'
if (-not (Test-Path -LiteralPath $SourcePath) -and (Test-Path -LiteralPath $fallbackSourcePath)) {
  $SourcePath = $fallbackSourcePath
}

$sourceFullPath = Resolve-Path -LiteralPath $SourcePath
$source = [System.Drawing.Image]::FromFile($sourceFullPath)

try {
  $icon = New-Canvas 1024 1024
  $graphics = [System.Drawing.Graphics]::FromImage($icon)
  Set-HighQualityDrawing $graphics
  Draw-ImageCover $graphics $source 0 0 1024 1024
  $graphics.Dispose()
  Save-Png $icon (Join-Path $imagesDir 'icon.png')

  $favicon = New-Canvas 256 256
  $graphics = [System.Drawing.Graphics]::FromImage($favicon)
  Set-HighQualityDrawing $graphics
  Draw-ImageCover $graphics $source 0 0 256 256
  $graphics.Dispose()
  Save-Png $favicon (Join-Path $imagesDir 'favicon.png')

  $splash = New-Canvas 1024 1024
  $graphics = [System.Drawing.Graphics]::FromImage($splash)
  Set-HighQualityDrawing $graphics
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-ImageContain $graphics $source 112 132 800 800
  $graphics.Dispose()
  Save-Png $splash (Join-Path $imagesDir 'splash-icon.png')

  $adaptiveBackground = New-Canvas 512 512
  $graphics = [System.Drawing.Graphics]::FromImage($adaptiveBackground)
  Set-HighQualityDrawing $graphics
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Rectangle]::new(0, 0, 512, 512)),
    $brandDark,
    $brandDarkSoft,
    90
  )
  $graphics.FillRectangle($brush, 0, 0, 512, 512)
  $brush.Dispose()
  Draw-SoftGlow $graphics -72 108 340 ([System.Drawing.Color]::FromArgb(70, $brandTeal))
  Draw-SoftGlow $graphics 250 256 220 ([System.Drawing.Color]::FromArgb(60, $brandCyan))
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, $brandCyan), 2)
  $graphics.DrawArc($pen, 30, 280, 200, 120, 205, 120)
  $graphics.DrawArc($pen, 160, 60, 330, 220, 215, 110)
  $graphics.DrawArc($pen, 280, 280, 160, 120, 250, 90)
  $pen.Dispose()
  $graphics.Dispose()
  Save-Png $adaptiveBackground (Join-Path $imagesDir 'android-icon-background.png')

  $adaptiveForeground = New-Canvas 432 432
  $graphics = [System.Drawing.Graphics]::FromImage($adaptiveForeground)
  Set-HighQualityDrawing $graphics
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-ImageContain $graphics $source 24 24 384 384
  $graphics.Dispose()
  Save-Png $adaptiveForeground (Join-Path $imagesDir 'android-icon-foreground.png')

  $monochrome = New-Canvas 432 432
  $graphics = [System.Drawing.Graphics]::FromImage($monochrome)
  Set-HighQualityDrawing $graphics
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $roundedRect = [System.Drawing.RectangleF]::new(66, 66, 300, 300)
  Draw-RoundedRect $graphics $roundedRect 70 ([System.Drawing.Color]::Transparent) $brandWhite
  $font = New-Object System.Drawing.Font('Segoe UI', 190, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $textRect = [System.Drawing.RectangleF]::new(0, 110, 432, 200)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = New-Object System.Drawing.SolidBrush($brandWhite)
  $graphics.DrawString('T', $font, $brush, $textRect, $format)
  $brush.Dispose()
  $format.Dispose()
  $font.Dispose()
  $graphics.Dispose()
  Save-Png $monochrome (Join-Path $imagesDir 'android-icon-monochrome.png')

  $storeIcon = New-Canvas 512 512
  $graphics = [System.Drawing.Graphics]::FromImage($storeIcon)
  Set-HighQualityDrawing $graphics
  Draw-ImageCover $graphics $source 0 0 512 512
  $graphics.Dispose()
  Save-Png $storeIcon (Join-Path $storeDir 'google-play-icon-512.png')

  $featureGraphic = New-Canvas 1024 500
  $graphics = [System.Drawing.Graphics]::FromImage($featureGraphic)
  Set-HighQualityDrawing $graphics
  $featureBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Rectangle]::new(0, 0, 1024, 500)),
    $brandDark,
    $brandDarkSoft,
    0
  )
  $graphics.FillRectangle($featureBrush, 0, 0, 1024, 500)
  $featureBrush.Dispose()

  Draw-SoftGlow $graphics -120 -10 440 ([System.Drawing.Color]::FromArgb(78, $brandTeal))
  Draw-SoftGlow $graphics 520 40 380 ([System.Drawing.Color]::FromArgb(52, $brandCyan))
  Draw-SoftGlow $graphics 730 220 260 ([System.Drawing.Color]::FromArgb(46, $brandTeal))

  $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(36, $brandLine), 1)
  for ($x = 0; $x -lt 1024; $x += 64) {
    $graphics.DrawLine($gridPen, $x, 0, $x, 500)
  }
  for ($y = 0; $y -lt 500; $y += 64) {
    $graphics.DrawLine($gridPen, 0, $y, 1024, $y)
  }
  $gridPen.Dispose()

  $eyebrowFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleFont = New-Object System.Drawing.Font('Segoe UI', 54, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $eyebrowBrush = New-Object System.Drawing.SolidBrush($brandTeal)
  $titleBrush = New-Object System.Drawing.SolidBrush($brandWhite)
  $bodyBrush = New-Object System.Drawing.SolidBrush($brandMuted)

  $graphics.DrawString('GOOGLE PLAY READY', $eyebrowFont, $eyebrowBrush, 88, 110)
  $graphics.DrawString($BrandTitle, $titleFont, $titleBrush, 88, 148)

  $copyRect = [System.Drawing.RectangleF]::new(88, 228, 430, 132)
  $copyFormat = New-Object System.Drawing.StringFormat
  $copyFormat.Alignment = [System.Drawing.StringAlignment]::Near
  $copyFormat.LineAlignment = [System.Drawing.StringAlignment]::Near
  $graphics.DrawString(
    'Slim voorraadbeheer voor food, retail en distributie met AI-scans, houdbaarheid en realtime inzichten.',
    $bodyFont,
    $bodyBrush,
    $copyRect,
    $copyFormat
  )

  $eyebrowFont.Dispose()
  $titleFont.Dispose()
  $bodyFont.Dispose()
  $eyebrowBrush.Dispose()
  $titleBrush.Dispose()
  $bodyBrush.Dispose()
  $copyFormat.Dispose()

  $logoCard = [System.Drawing.RectangleF]::new(640, 58, 286, 286)
  $logoCardFill = [System.Drawing.Color]::FromArgb(34, $brandWhite)
  $logoCardBorder = [System.Drawing.Color]::FromArgb(88, $brandCyan)
  Draw-RoundedRect $graphics $logoCard 50 $logoCardFill $logoCardBorder
  Draw-ImageContain $graphics $source 652 70 262 262

  $pillRect = [System.Drawing.RectangleF]::new(88, 372, 300, 54)
  $pillFill = [System.Drawing.Color]::FromArgb(40, $brandTeal)
  $pillBorder = [System.Drawing.Color]::FromArgb(60, $brandCyan)
  Draw-RoundedRect $graphics $pillRect 27 $pillFill $pillBorder
  $pillFont = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $pillBrush = New-Object System.Drawing.SolidBrush($brandWhite)
  $pillFormat = New-Object System.Drawing.StringFormat
  $pillFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $pillFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString('Camera | Barcode | AI | Alerts', $pillFont, $pillBrush, $pillRect, $pillFormat)
  $pillFont.Dispose()
  $pillBrush.Dispose()
  $pillFormat.Dispose()

  $graphics.Dispose()
  Save-Png $featureGraphic (Join-Path $storeDir 'google-play-feature-graphic.png')
}
finally {
  $source.Dispose()
}
