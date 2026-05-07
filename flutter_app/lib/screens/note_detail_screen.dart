import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:provider/provider.dart';
import '../models/note.dart';
import '../providers/notes_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/tts_provider.dart';
import '../services/groq_service.dart';

class NoteDetailScreen extends StatefulWidget {
  final Note? note;
  const NoteDetailScreen({super.key, required this.note});

  @override
  State<NoteDetailScreen> createState() => _NoteDetailScreenState();
}

class _NoteDetailScreenState extends State<NoteDetailScreen> {
  late TextEditingController _contentController;
  late TextEditingController _subjectController;
  bool _isEditing = false;
  bool _isAiLoading = false;
  bool _isNew = false;
  final TextEditingController _aiPromptController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _isNew = widget.note == null;
    _contentController = TextEditingController(text: widget.note?.content ?? '');
    _subjectController = TextEditingController(text: widget.note?.subject ?? 'General');
    if (_isNew) _isEditing = true;
  }

  @override
  void dispose() {
    _contentController.dispose();
    _subjectController.dispose();
    _aiPromptController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final content = _contentController.text.trim();
    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Note cannot be empty')),
      );
      return;
    }
    final subject = _subjectController.text.trim().isEmpty ? 'General' : _subjectController.text.trim();
    final notesProvider = context.read<NotesProvider>();
    if (_isNew) {
      await notesProvider.addNote(content: content, subject: subject);
      if (mounted) Navigator.pop(context);
    } else {
      final updated = widget.note!.copyWith(content: content, subject: subject);
      await notesProvider.updateNote(updated);
      setState(() => _isEditing = false);
    }
  }

  Future<void> _aiAssist() async {
    final prompt = _aiPromptController.text.trim();
    if (prompt.isEmpty) return;
    if (_contentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add some content first')),
      );
      return;
    }

    setState(() => _isAiLoading = true);
    _aiPromptController.clear();

    try {
      final settings = context.read<SettingsProvider>();
      final response = await GroqService.chat(
        messages: [
          {
            'role': 'system',
            'content': GroqService.buildSystemPrompt(
              language: settings.aiResponseLanguage,
              hasMath: GroqService.detectsMath(_contentController.text),
            ),
          },
          {
            'role': 'user',
            'content': 'Here is my note:\n\n${_contentController.text}\n\nInstruction: $prompt',
          },
        ],
      );
      setState(() {
        _contentController.text = response;
        _isEditing = true;
      });
    } on GroqException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      setState(() => _isAiLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final settings = context.watch<SettingsProvider>();
    final tts = context.watch<TtsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _subjectController,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          decoration: const InputDecoration(
            hintText: 'Subject / Topic',
            border: InputBorder.none,
            isDense: true,
            contentPadding: EdgeInsets.zero,
            filled: false,
          ),
        ),
        actions: [
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.volume_up_outlined),
              tooltip: 'Read Aloud',
              onPressed: () {
                tts.speak(
                  text: _contentController.text,
                  languageCode: settings.voiceLanguage,
                  volume: settings.volume,
                  pitch: settings.pitch,
                  rate: settings.speechRate,
                );
              },
            ),
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.copy_outlined),
              tooltip: 'Copy',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _contentController.text));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied!')),
                );
              },
            ),
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit',
              onPressed: () => setState(() => _isEditing = true),
            ),
          if (_isEditing)
            TextButton(
              onPressed: _save,
              child: const Text('Save'),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _isEditing
                  ? TextField(
                      controller: _contentController,
                      maxLines: null,
                      style: TextStyle(fontSize: settings.fontSize),
                      decoration: const InputDecoration(
                        hintText: 'Write your note here...',
                        border: InputBorder.none,
                        filled: false,
                      ),
                      autofocus: _isNew,
                    )
                  : MarkdownBody(
                      data: _contentController.text,
                      styleSheet: MarkdownStyleSheet(
                        p: TextStyle(fontSize: settings.fontSize),
                      ),
                    ),
            ),
          ),
          // AI Assistant bar
          _buildAiBar(colorScheme),
        ],
      ),
    );
  }

  Widget _buildAiBar(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 14, color: colorScheme.primary),
                const SizedBox(width: 4),
                Text(
                  'AI Assistant',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _aiPromptController,
                    decoration: InputDecoration(
                      hintText: 'e.g. "Simplify this" or "Expand this"',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
                      isDense: true,
                    ),
                    onSubmitted: (_) => _aiAssist(),
                  ),
                ),
                const SizedBox(width: 8),
                _isAiLoading
                    ? const SizedBox(
                        width: 36,
                        height: 36,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : FilledButton(
                        onPressed: _aiAssist,
                        style: FilledButton.styleFrom(
                          shape: const CircleBorder(),
                          padding: const EdgeInsets.all(10),
                        ),
                        child: const Icon(Icons.auto_awesome, size: 18),
                      ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
