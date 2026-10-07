#!/bin/sh
# Regenerate browser and Electron Dock icons from the unmodified artwork.
# Requires ImageMagick.
set -eu
cd "$(dirname "$0")/.."
icon_tmp=$(mktemp -d "${TMPDIR:-/tmp}/kamikami-icons.XXXXXX")
trap 'rm -rf "$icon_tmp"' EXIT HUP INT TERM

# Center the asymmetric K and remove excess background around the artwork.
magick public/kamikami-icon.png -crop 900x900+92+62 +repage "$icon_tmp/cropped.png"
magick -size 900x900 xc:none -fill white \
  -draw 'roundrectangle 0,0 899,899 200,200' "$icon_tmp/mask.png"
magick "$icon_tmp/cropped.png" "$icon_tmp/mask.png" \
  -alpha off -compose CopyOpacity -composite "$icon_tmp/rounded.png"
for size in 32 64 180; do
  magick "$icon_tmp/rounded.png" -resize "${size}x${size}" "public/kamikami-icon-${size}.png"
done

# Dock artwork has a rounded tile and transparent padding on every side.
magick "$icon_tmp/rounded.png" -resize 864x864 \
  -gravity center -background none -extent 1024x1024 public/kamikami-icon-macos.png
