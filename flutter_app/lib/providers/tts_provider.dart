import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

enum TtsState { playing, paused, stopped }

// Map AI response language names to BCP-47 language codes for TTS
const Map<String, String> kLanguageToBcp47 = {
  'English': 'en-US',
  'Hindi': 'hi-IN',
  'Bengali': 'bn-IN',
  'Tamil': 'ta-IN',
  'Telugu': 'te-IN',
  'Kannada': 'kn-IN',
  'Malayalam': 'ml-IN',
  'Marathi': 'mr-IN',
  'Gujarati': 'gu-IN',
  'Punjabi': 'pa-IN',
  'Odia': 'or-IN',
  'Assamese': 'as-IN',
  'Urdu': 'ur-PK',
  'Arabic': 'ar-SA',
  'French': 'fr-FR',
  'Spanish': 'es-ES',
  'German': 'de-DE',
  'Japanese': 'ja-JP',
  'Korean': 'ko-KR',
  'Chinese': 'zh-CN',
  'Portuguese': 'pt-BR',
  'Russian': 'ru-RU',
  'Dutch': 'nl-NL',
  'Turkish': 'tr-TR',
  'Vietnamese': 'vi-VN',
  'Thai': 'th-TH',
  'Indonesian': 'id-ID',
  'Polish': 'pl-PL',
  'Swedish': 'sv-SE',
};

class TtsProvider extends ChangeNotifier {
  final FlutterTts _tts = FlutterTts();
  TtsState _state = TtsState.stopped;
  String _currentText = '';

  TtsState get state => _state;
  bool get isPlaying => _state == TtsState.playing;
  bool get isPaused => _state == TtsState.paused;

  TtsProvider() {
    _tts.setCompletionHandler(() {
      _state = TtsState.stopped;
      notifyListeners();
    });
    _tts.setErrorHandler((msg) {
      _state = TtsState.stopped;
      notifyListeners();
    });
    _tts.setCancelHandler(() {
      _state = TtsState.stopped;
      notifyListeners();
    });
  }

  Future<void> speak({
    required String text,
    required String languageCode,
    double volume = 1.0,
    double pitch = 1.0,
    double rate = 0.5,
    String? aiLanguage,
  }) async {
    final cleaned = _cleanText(text);
    _currentText = cleaned;
    
    // Use aiLanguage to map to BCP-47 code if provided, otherwise use languageCode directly
    final finalLanguageCode = aiLanguage != null 
        ? kLanguageToBcp47[aiLanguage] ?? languageCode 
        : languageCode;
    
    await _tts.setLanguage(finalLanguageCode);
    await _tts.setVolume(volume);
    await _tts.setPitch(pitch);
    await _tts.setSpeechRate(rate);
    await _tts.speak(cleaned);
    _state = TtsState.playing;
    notifyListeners();
  }

  Future<void> stop() async {
    await _tts.stop();
    _state = TtsState.stopped;
    notifyListeners();
  }

  Future<void> pause() async {
    await _tts.pause();
    _state = TtsState.paused;
    notifyListeners();
  }

  Future<void> resume() async {
    if (_currentText.isNotEmpty) {
      await _tts.speak(_currentText);
      _state = TtsState.playing;
      notifyListeners();
    }
  }

  String _cleanText(String text) {
    // Remove markdown syntax but keep line breaks for natural flow
    var cleaned = text
        // Remove bold markdown
        .replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1')
        .replaceAll(RegExp(r'\*(.+?)\*'), r'$1')
        // Remove italic markdown
        .replaceAll(RegExp(r'__(.+?)__'), r'$1')
        .replaceAll(RegExp(r'_(.+?)_'), r'$1')
        // Remove header markdown
        .replaceAll(RegExp(r'#+\s'), '')
        // Remove inline code
        .replaceAll(RegExp(r'`(.+?)`'), r'$1')
        // Remove code blocks
        .replaceAll(RegExp(r'```[\s\S]*?```'), '')
        // Remove links
        .replaceAll(RegExp(r'\[(.+?)\]\(.+?\)'), r'$1')
        // Remove images
        .replaceAll(RegExp(r'!\[.+?\]\(.+?\)'), '')
        // Remove blockquotes
        .replaceAll(RegExp(r'>+\s'), '')
        // Remove LaTeX artifacts
        .replaceAll('\\frac{', '(')
        .replaceAll('\\sqrt{', 'sqrt(')
        .replaceAll('\\(', '')
        .replaceAll('\\)', '')
        .replaceAll('\\[', '')
        .replaceAll('\\]', '')
        // Remove display math delimiters
        .replaceAll(r'$$', '')
        // Remove inline math delimiters
        .replaceAll(r'$', '')
        // Remove stray backslashes
        .replaceAll('\\', '')
        .trim();
    
    return cleaned;
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }
}
