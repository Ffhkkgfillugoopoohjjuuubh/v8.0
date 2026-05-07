import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsProvider extends ChangeNotifier {
  final SharedPreferences _prefs;

  SettingsProvider(this._prefs) {
    _load();
  }

  String _appLanguage = 'en';
  String _aiResponseLanguage = 'English';
  String _voiceLanguage = 'en-US';
  double _fontSize = 16.0;
  double _volume = 1.0;
  double _pitch = 1.0;
  double _speechRate = 0.5;
  bool _darkMode = false;

  String get appLanguage => _appLanguage;
  String get aiResponseLanguage => _aiResponseLanguage;
  String get voiceLanguage => _voiceLanguage;
  double get fontSize => _fontSize;
  double get volume => _volume;
  double get pitch => _pitch;
  double get speechRate => _speechRate;
  bool get darkMode => _darkMode;

  void _load() {
    _appLanguage = _prefs.getString('appLanguage') ?? 'en';
    _aiResponseLanguage = _prefs.getString('aiResponseLanguage') ?? 'English';
    _voiceLanguage = _prefs.getString('voiceLanguage') ?? 'en-US';
    _fontSize = _prefs.getDouble('fontSize') ?? 16.0;
    _volume = _prefs.getDouble('volume') ?? 1.0;
    _pitch = _prefs.getDouble('pitch') ?? 1.0;
    _speechRate = _prefs.getDouble('speechRate') ?? 0.5;
    _darkMode = _prefs.getBool('darkMode') ?? false;
  }

  Future<void> setAppLanguage(String val) async {
    _appLanguage = val;
    await _prefs.setString('appLanguage', val);
    notifyListeners();
  }

  Future<void> setAiResponseLanguage(String val) async {
    _aiResponseLanguage = val;
    await _prefs.setString('aiResponseLanguage', val);
    notifyListeners();
  }

  Future<void> setVoiceLanguage(String val) async {
    _voiceLanguage = val;
    await _prefs.setString('voiceLanguage', val);
    notifyListeners();
  }

  Future<void> setFontSize(double val) async {
    _fontSize = val;
    await _prefs.setDouble('fontSize', val);
    notifyListeners();
  }

  Future<void> setVolume(double val) async {
    _volume = val;
    await _prefs.setDouble('volume', val);
    notifyListeners();
  }

  Future<void> setPitch(double val) async {
    _pitch = val;
    await _prefs.setDouble('pitch', val);
    notifyListeners();
  }

  Future<void> setSpeechRate(double val) async {
    _speechRate = val;
    await _prefs.setDouble('speechRate', val);
    notifyListeners();
  }

  Future<void> setDarkMode(bool val) async {
    _darkMode = val;
    await _prefs.setBool('darkMode', val);
    notifyListeners();
  }
}

const List<Map<String, String>> kSupportedLanguages = [
  {'code': 'en', 'name': 'English'},
  {'code': 'hi', 'name': 'Hindi'},
  {'code': 'bn', 'name': 'Bengali'},
  {'code': 'ta', 'name': 'Tamil'},
  {'code': 'te', 'name': 'Telugu'},
  {'code': 'kn', 'name': 'Kannada'},
  {'code': 'ml', 'name': 'Malayalam'},
  {'code': 'mr', 'name': 'Marathi'},
  {'code': 'gu', 'name': 'Gujarati'},
  {'code': 'pa', 'name': 'Punjabi'},
  {'code': 'or', 'name': 'Odia'},
  {'code': 'as', 'name': 'Assamese'},
  {'code': 'ur', 'name': 'Urdu'},
  {'code': 'ar', 'name': 'Arabic'},
  {'code': 'fr', 'name': 'French'},
  {'code': 'es', 'name': 'Spanish'},
  {'code': 'de', 'name': 'German'},
  {'code': 'ja', 'name': 'Japanese'},
  {'code': 'ko', 'name': 'Korean'},
  {'code': 'zh', 'name': 'Chinese'},
  {'code': 'pt', 'name': 'Portuguese'},
  {'code': 'ru', 'name': 'Russian'},
  {'code': 'nl', 'name': 'Dutch'},
  {'code': 'tr', 'name': 'Turkish'},
  {'code': 'vi', 'name': 'Vietnamese'},
  {'code': 'th', 'name': 'Thai'},
  {'code': 'id', 'name': 'Indonesian'},
  {'code': 'pl', 'name': 'Polish'},
  {'code': 'sv', 'name': 'Swedish'},
];

const List<String> kAiResponseLanguages = [
  'English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam',
  'Marathi', 'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Arabic',
  'French', 'Spanish', 'German', 'Japanese', 'Korean', 'Chinese',
  'Portuguese', 'Russian', 'Dutch', 'Turkish', 'Vietnamese', 'Thai',
  'Indonesian', 'Polish', 'Swedish',
];

const List<Map<String, String>> kVoiceLanguages = [
  {'code': 'en-US', 'name': 'English (US)'},
  {'code': 'en-IN', 'name': 'English (India)'},
  {'code': 'hi-IN', 'name': 'Hindi'},
  {'code': 'bn-IN', 'name': 'Bengali'},
  {'code': 'ta-IN', 'name': 'Tamil'},
  {'code': 'te-IN', 'name': 'Telugu'},
  {'code': 'kn-IN', 'name': 'Kannada'},
  {'code': 'ml-IN', 'name': 'Malayalam'},
  {'code': 'mr-IN', 'name': 'Marathi'},
  {'code': 'gu-IN', 'name': 'Gujarati'},
  {'code': 'pa-IN', 'name': 'Punjabi'},
  {'code': 'ur-PK', 'name': 'Urdu'},
  {'code': 'ar-SA', 'name': 'Arabic'},
  {'code': 'fr-FR', 'name': 'French'},
  {'code': 'es-ES', 'name': 'Spanish'},
  {'code': 'de-DE', 'name': 'German'},
  {'code': 'ja-JP', 'name': 'Japanese'},
  {'code': 'ko-KR', 'name': 'Korean'},
  {'code': 'zh-CN', 'name': 'Chinese (Simplified)'},
  {'code': 'pt-BR', 'name': 'Portuguese (Brazil)'},
  {'code': 'ru-RU', 'name': 'Russian'},
  {'code': 'nl-NL', 'name': 'Dutch'},
  {'code': 'tr-TR', 'name': 'Turkish'},
  {'code': 'vi-VN', 'name': 'Vietnamese'},
  {'code': 'th-TH', 'name': 'Thai'},
  {'code': 'id-ID', 'name': 'Indonesian'},
  {'code': 'pl-PL', 'name': 'Polish'},
  {'code': 'sv-SE', 'name': 'Swedish'},
];
