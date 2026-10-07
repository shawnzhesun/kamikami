#!/bin/sh
# Regenerate browser and Electron Dock icons from the prepared RGBA master.
# The master already includes macOS rounding and padding; do not crop it again.
# Requires ImageMagick.
set -eu
cd "$(dirname "$0")/.."
for size in 32 64 180; do
  magick public/kamikami-icon.png -resize "${size}x${size}" "public/kamikami-icon-${size}.png"
done

# Preserve the supplied Dock master exactly, including its subtle shadow.
cp public/kamikami-icon.png public/kamikami-icon-macos.png
# public/kamikami-icon.icns is supplied alongside the master in the icon package.
