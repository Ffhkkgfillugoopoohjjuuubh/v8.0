# Echo AI - Educational AI App

A complete Flutter app for education with OCR, multilingual AI assistance, quiz generation, and text-to-speech.

## Features

- **Scanner Tab**: Photograph textbook pages (up to 10), extract text via ML Kit OCR, ask AI questions in any language
- **Notebook Tab**: Save AI responses as notes, edit with AI assistance
- **Settings Tab**: 29 UI languages, AI response language, voice language, font/TTS controls
- **Quiz Generation**: Generate timed multiple-choice quizzes from scanned content
- **Read Aloud**: TTS with stop/pause/resume, configurable speed, pitch, and volume
- **Math/Physics Solving**: Automatic step-by-step problem solving when math is detected

## Requirements

- Flutter SDK 3.10.0+
- Dart SDK 3.0.0+
- Android SDK API 24+ (Android 7.0+)
- NDK 27.0.12077973

## Setup & Build

```bash
# Install dependencies
flutter pub get

# Run in debug mode
flutter run

# Build release APK
flutter build apk --release

# Build release APK (split by ABI for smaller size)
flutter build apk --release --split-per-abi
```

## Configuration

All configuration is in `lib/services/groq_service.dart`:
- `_kGroqApiKey` — Your Groq API key
- `_kGroqEndpoint` — API endpoint
- `_kGroqModel` — AI model to use

## Project Structure

```
lib/
├── main.dart                   # App entry point, theme, providers
├── l10n/                       # Localization files (29 languages)
├── models/
│   ├── note.dart               # Note model
│   └── quiz.dart               # Quiz/Question models
├── providers/
│   ├── settings_provider.dart  # App settings (language, TTS, theme)
│   ├── notes_provider.dart     # Notes CRUD with JSON persistence
│   └── tts_provider.dart       # TTS state management
├── screens/
│   ├── splash_screen.dart      # Animated splash
│   ├── main_scaffold.dart      # Bottom nav + TTS status chip
│   ├── scanner_screen.dart     # OCR + Groq AI chat
│   ├── notebook_screen.dart    # Notes list
│   ├── note_detail_screen.dart # Note editor + AI assistant
│   ├── settings_screen.dart    # All settings
│   └── quiz_screen.dart        # Quiz with timer + grading
└── services/
    ├── groq_service.dart        # Groq API client + system prompts
    └── ocr_service.dart         # ML Kit OCR wrapper
```

## AdMob

AdMob integration is **not included** in this build. Placeholder comments are left in:
- `android/app/src/main/AndroidManifest.xml`
- `android/app/build.gradle`
- `lib/screens/settings_screen.dart`

To add AdMob, uncomment those sections and add `google_mobile_ads` to pubspec.yaml.

## Localization

The app supports 29 languages. The full localization scaffold is in `lib/l10n/`. To add more languages, create `app_localizations_XX.dart` and register it in `app_localizations.dart`.

## Troubleshooting

- **OCR not working**: Ensure `google_mlkit_text_recognition` is properly installed and camera/storage permissions are granted.
- **Build fails with NDK error**: Set `ndkVersion "27.0.12077973"` in `android/app/build.gradle` and install that NDK version via Android Studio SDK Manager.
- **TTS not speaking**: Check that the selected voice language is installed on the device (Settings → Language & Input → Text-to-speech).
