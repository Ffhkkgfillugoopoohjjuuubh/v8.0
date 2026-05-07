import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../models/note.dart';

class NotesProvider extends ChangeNotifier {
  List<Note> _notes = [];
  bool _loaded = false;

  List<Note> get notes => List.unmodifiable(_notes);

  Future<String> get _notesFilePath async {
    final dir = await getApplicationDocumentsDirectory();
    return '${dir.path}/echo_notes.json';
  }

  Future<void> loadNotes() async {
    if (_loaded) return;
    try {
      final path = await _notesFilePath;
      final file = File(path);
      if (await file.exists()) {
        final content = await file.readAsString();
        final List<dynamic> data = jsonDecode(content);
        _notes = data.map((e) => Note.fromJson(e)).toList();
        _notes.sort((a, b) => b.savedAt.compareTo(a.savedAt));
      }
    } catch (_) {}
    _loaded = true;
    notifyListeners();
  }

  Future<void> _persist() async {
    try {
      final path = await _notesFilePath;
      final file = File(path);
      await file.writeAsString(jsonEncode(_notes.map((n) => n.toJson()).toList()));
    } catch (_) {}
  }

  Future<void> addNote({
    required String content,
    required String subject,
  }) async {
    final note = Note(
      id: const Uuid().v4(),
      content: content,
      subject: subject,
      savedAt: DateTime.now(),
    );
    _notes.insert(0, note);
    await _persist();
    notifyListeners();
  }

  Future<void> updateNote(Note note) async {
    final idx = _notes.indexWhere((n) => n.id == note.id);
    if (idx != -1) {
      _notes[idx] = note;
      await _persist();
      notifyListeners();
    }
  }

  Future<void> deleteNote(String id) async {
    _notes.removeWhere((n) => n.id == id);
    await _persist();
    notifyListeners();
  }

  Future<void> clearAll() async {
    _notes.clear();
    await _persist();
    notifyListeners();
  }
}
