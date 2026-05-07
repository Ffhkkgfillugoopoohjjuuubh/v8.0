import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

enum TtsState { playing, paused, stopped }

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
  }) async {
    final cleaned = _cleanText(text);
    _currentText = cleaned;
    await _tts.setLanguage(languageCode);
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
    // Remove markdown syntax but keep line breaks
    return text
        .replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'\1')
        .replaceAll(RegExp(r'\*(.+?)\*'), r'\1')
        .replaceAll(RegExp(r'__(.+?)__'), r'\1')
        .replaceAll(RegExp(r'_(.+?)_'), r'\1')
        .replaceAll(RegExp(r'#+\s'), '')
        .replaceAll(RegExp(r'`(.+?)`'), r'\1')
        .replaceAll(RegExp(r'```[\s\S]*?```'), '')
        .replaceAll(RegExp(r'\[(.+?)\]\(.+?\)'), r'\1')
        .replaceAll(RegExp(r'!\[.+?\]\(.+?\)'), '')
        .replaceAll(RegExp(r'>+\s'), '')
        .trim();
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }
}
