#!/bin/bash
# Run this script once after cloning to generate launcher icons from a single source.
# Requires: flutter pub add --dev flutter_launcher_icons

echo "Adding flutter_launcher_icons dev dependency..."
flutter pub add --dev flutter_launcher_icons

# Create a simple icon config in pubspec (add manually or use below):
cat >> pubspec.yaml << 'EOF'

flutter_icons:
  android: true
  ios: false
  image_path: "assets/images/icon.png"
  adaptive_icon_background: "#6750A4"
  adaptive_icon_foreground: "assets/images/icon_fg.png"
EOF

echo "Place a 1024x1024 icon.png in assets/images/ then run:"
echo "  flutter pub run flutter_launcher_icons"
