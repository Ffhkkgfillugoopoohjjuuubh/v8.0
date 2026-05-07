import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/settings_provider.dart';
import '../providers/notes_provider.dart';
import '../providers/tts_provider.dart';
import '../services/groq_service.dart';
import '../services/ocr_service.dart';
import 'quiz_screen.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final List<File> _images = [];
  String _currentPageContext = '';
  final List<Map<String, String>> _chatHistory = [];
  final TextEditingController _promptController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isOcrLoading = false;
  bool _isAiLoading = false;
  final ImagePicker _picker = ImagePicker();
  String _aiResponseLanguage = 'English';

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final ctx = prefs.getString('lastPageContext') ?? '';
    final histJson = prefs.getString('lastChatHistory') ?? '[]';
    final lang = prefs.getString('lastAiLanguage') ?? 'English';
    if (mounted) {
      setState(() {
        _currentPageContext = ctx;
        _aiResponseLanguage = lang;
        try {
          final List<dynamic> hist = jsonDecode(histJson);
          _chatHistory.addAll(hist.map((e) => Map<String, String>.from(e)));
        } catch (_) {}
      });
    }
  }

  Future<void> _persistSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('lastPageContext', _currentPageContext);
    // Only keep last 20 messages to avoid large storage
    final toSave = _chatHistory.length > 20
        ? _chatHistory.sublist(_chatHistory.length - 20)
        : _chatHistory;
    await prefs.setString('lastChatHistory', jsonEncode(toSave));
    await prefs.setString('lastAiLanguage', _aiResponseLanguage);
  }

  Future<void> _pickImages(ImageSource source) async {
    try {
      if (source == ImageSource.gallery) {
        final images = await _picker.pickMultiImage();
        if (images.isEmpty) return;
        final canAdd = 10 - _images.length;
        if (canAdd <= 0) {
          _showError('Maximum 10 images allowed.');
          return;
        }
        final limited = images.take(canAdd).toList();
        setState(() {
          _images.addAll(limited.map((x) => File(x.path)));
        });
      } else {
        if (_images.length >= 10) {
          _showError('Maximum 10 images allowed.');
          return;
        }
        final img = await _picker.pickImage(source: ImageSource.camera, imageQuality: 90);
        if (img == null) return;
        setState(() => _images.add(File(img.path)));
      }
      await _runOcr();
    } catch (e) {
      _showError('Could not pick image: $e');
    }
  }

  Future<void> _runOcr() async {
    if (_images.isEmpty) return;
    setState(() => _isOcrLoading = true);
    try {
      final text = await OcrService.extractTextFromImages(_images);
      setState(() => _currentPageContext = text);
      await _persistSession();
    } catch (e) {
      _showError('Text extraction failed. Please try again.');
    } finally {
      setState(() => _isOcrLoading = false);
    }
  }

  Future<void> _sendPrompt() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;
    if (_currentPageContext.isEmpty && _chatHistory.isEmpty) {
      _showError('Please add images first or start a conversation.');
      return;
    }

    _promptController.clear();
    setState(() {
      _chatHistory.add({'role': 'user', 'content': prompt});
      _isAiLoading = true;
    });
    _scrollToBottom();

    try {
      final hasMath = GroqService.detectsMath(_currentPageContext + prompt);
      final systemPrompt = GroqService.buildSystemPrompt(
        language: _aiResponseLanguage,
        hasMath: hasMath,
      );

      final messages = <Map<String, String>>[
        {'role': 'system', 'content': systemPrompt},
        if (_currentPageContext.isNotEmpty)
          {
            'role': 'user',
            'content': 'Here is the scanned page content to work with:\n\n$_currentPageContext',
          },
        if (_currentPageContext.isNotEmpty)
          {
            'role': 'assistant',
            'content': 'I have read and understood the page content. I am ready to help you with it.',
          },
        ..._chatHistory,
      ];

      final response = await GroqService.chat(messages: messages);
      setState(() {
        _chatHistory.add({'role': 'assistant', 'content': response});
      });
      await _persistSession();
      _scrollToBottom();
    } on GroqException catch (e) {
      setState(() {
        _chatHistory.add({
          'role': 'assistant',
          'content': e.isAuthError
              ? '⚠️ **API Key Error**\n\n${e.message}\n\nPlease check your API key configuration.'
              : '⚠️ **Connection Error**\n\n${e.message}',
        });
      });
    } finally {
      setState(() => _isAiLoading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700),
    );
  }

  void _clearSession() {
    setState(() {
      _images.clear();
      _currentPageContext = '';
      _chatHistory.clear();
    });
    _persistSession();
  }

  Future<void> _showQuizDialog() async {
    if (_currentPageContext.isEmpty) {
      _showError('Please scan a page first to generate a quiz.');
      return;
    }
    int numQuestions = 5;
    int timeLimit = 10;
    final subjectController = TextEditingController(text: 'General');

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.quiz_outlined),
              SizedBox(width: 8),
              Text('Generate Quiz'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Questions: $numQuestions', style: const TextStyle(fontWeight: FontWeight.w600)),
              Slider(
                value: numQuestions.toDouble(),
                min: 1,
                max: 15,
                divisions: 14,
                label: numQuestions.toString(),
                onChanged: (v) => setDialogState(() => numQuestions = v.round()),
              ),
              const SizedBox(height: 4),
              Text('Time limit: $timeLimit minutes', style: const TextStyle(fontWeight: FontWeight.w600)),
              Slider(
                value: timeLimit.toDouble(),
                min: 5,
                max: 60,
                divisions: 11,
                label: '$timeLimit min',
                onChanged: (v) => setDialogState(() => timeLimit = v.round()),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: subjectController,
                decoration: const InputDecoration(
                  labelText: 'Subject / Topic',
                  hintText: 'e.g. Mathematics, Physics...',
                  isDense: true,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton.icon(
              onPressed: () {
                final subject = subjectController.text.trim().isEmpty
                    ? 'General'
                    : subjectController.text.trim();
                Navigator.pop(ctx);
                _generateQuiz(numQuestions, timeLimit, subject);
              },
              icon: const Icon(Icons.auto_awesome, size: 16),
              label: const Text('Generate'),
            ),
          ],
        ),
      ),
    );
    subjectController.dispose();
  }

  Future<void> _generateQuiz(int numQ, int timeLimit, String subject) async {
    setState(() => _isAiLoading = true);
    try {
      final quizPrompt = '''Generate a multiple-choice quiz with exactly $numQ questions based on the following content.
Subject: $subject

Content:
$_currentPageContext

Return ONLY a valid JSON array. Each object must have exactly these fields:
- "question": string
- "options": array of 4 strings  
- "correctIndex": integer 0-3
- "explanation": string (why the answer is correct)

Example: [{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]

Return ONLY the JSON array, no other text.''';

      final response = await GroqService.chat(
        messages: [
          {'role': 'system', 'content': 'You are a quiz generator. Always return only valid JSON arrays.'},
          {'role': 'user', 'content': quizPrompt},
        ],
        temperature: 0.4,
        maxTokens: 4096,
      );

      final jsonMatch = RegExp(r'\[[\s\S]*\]').firstMatch(response);
      if (jsonMatch == null) throw Exception('No valid quiz JSON found in response');

      final List<dynamic> rawQuestions = jsonDecode(jsonMatch.group(0)!);

      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => QuizScreen(
            questionsJson: rawQuestions,
            timeLimitMinutes: timeLimit,
            subject: subject,
            aiLanguage: _aiResponseLanguage,
          ),
        ),
      );
    } on GroqException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Failed to generate quiz. Please try again.');
    } finally {
      setState(() => _isAiLoading = false);
    }
  }

  @override
  void dispose() {
    _promptController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    final colorScheme = Theme.of(context).colorScheme;
    final fontSize = settings.fontSize;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Echo AI Scanner', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _aiResponseLanguage,
                icon: const SizedBox.shrink(),
                dropdownColor: colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                items: kAiResponseLanguages
                    .map((lang) => DropdownMenuItem(
                          value: lang,
                          child: Text(lang, style: const TextStyle(fontSize: 13)),
                        ))
                    .toList(),
                hint: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.translate, size: 16),
                    const SizedBox(width: 4),
                    Text(_aiResponseLanguage, style: const TextStyle(fontSize: 13)),
                  ],
                ),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _aiResponseLanguage = val);
                    _persistSession();
                  }
                },
              ),
            ),
          ),
          if (_chatHistory.isNotEmpty || _currentPageContext.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.refresh_outlined),
              tooltip: 'New Session',
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('New Session'),
                    content: const Text('Clear current session and start fresh?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                      ElevatedButton(onPressed: () { Navigator.pop(ctx); _clearSession(); }, child: const Text('Clear')),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
      body: Column(
        children: [
          if (_images.isNotEmpty) _buildImageStrip(),
          if (_isOcrLoading)
            LinearProgressIndicator(
              backgroundColor: colorScheme.surfaceContainerHighest,
              color: colorScheme.primary,
            ),
          if (_isOcrLoading)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: colorScheme.primaryContainer.withOpacity(0.3),
              child: Row(
                children: [
                  const SizedBox(width: 4),
                  Text(
                    'Extracting text from ${_images.length} image(s)...',
                    style: TextStyle(fontSize: 12, color: colorScheme.onPrimaryContainer),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _chatHistory.isEmpty && _currentPageContext.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                    itemCount: _chatHistory.length + (_isAiLoading ? 1 : 0),
                    itemBuilder: (ctx, idx) {
                      if (_isAiLoading && idx == _chatHistory.length) {
                        return _buildThinkingIndicator(colorScheme);
                      }
                      final msg = _chatHistory[idx];
                      return _ChatBubble(
                        message: msg,
                        fontSize: fontSize,
                        aiLanguage: _aiResponseLanguage,
                        onAddToNote: msg['role'] == 'assistant'
                            ? () => _addToNote(msg['content']!)
                            : null,
                      );
                    },
                  ),
          ),
          if (_currentPageContext.isNotEmpty) _buildContextBar(colorScheme),
          _buildBottomBar(colorScheme),
        ],
      ),
    );
  }

  Widget _buildThinkingIndicator(ColorScheme cs) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: cs.primaryContainer, shape: BoxShape.circle),
            child: Icon(Icons.auto_stories, size: 18, color: cs.primary),
          ),
          const SizedBox(width: 10),
          Text('Echo AI is thinking...', style: TextStyle(color: cs.outline, fontStyle: FontStyle.italic)),
          const SizedBox(width: 10),
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: cs.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.document_scanner_rounded, size: 52, color: colorScheme.primary),
            ),
            const SizedBox(height: 24),
            Text(
              'Scan to Learn',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
            ),
            const SizedBox(height: 8),
            Text(
              'Take a photo of any textbook page\nor document to get started.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6), fontSize: 15, height: 1.5),
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton.icon(
                  onPressed: () => _pickImages(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_rounded),
                  label: const Text('Camera'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14)),
                ),
                const SizedBox(width: 12),
                FilledButton.tonalIcon(
                  onPressed: () => _pickImages(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text('Gallery'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14)),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Try asking:', style: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.primary)),
                  const SizedBox(height: 8),
                  ...[
                    '"Explain this in simple Hindi"',
                    '"Solve all math problems step by step"',
                    '"Generate a quiz from this chapter"',
                    '"Summarize the key points"',
                  ].map((s) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.arrow_right, color: colorScheme.secondary, size: 18),
                        const SizedBox(width: 4),
                        Expanded(child: Text(s, style: TextStyle(color: colorScheme.onSurface.withOpacity(0.8), fontSize: 13))),
                      ],
                    ),
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImageStrip() {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      height: 84,
      color: colorScheme.surfaceContainerLow,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _images.length + (_images.length < 10 ? 1 : 0),
        itemBuilder: (ctx, idx) {
          if (idx == _images.length) {
            return GestureDetector(
              onTap: _showImageSourcePicker,
              child: Container(
                width: 68,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: colorScheme.outline, style: BorderStyle.solid, width: 1.5),
                  borderRadius: BorderRadius.circular(10),
                  color: colorScheme.surfaceContainerHighest,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_photo_alternate_outlined, color: colorScheme.primary, size: 22),
                    const SizedBox(height: 2),
                    Text('Add', style: TextStyle(fontSize: 10, color: colorScheme.primary, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            );
          }
          return Stack(
            children: [
              Container(
                width: 68,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  image: DecorationImage(
                    image: FileImage(_images[idx]),
                    fit: BoxFit.cover,
                  ),
                  border: Border.all(color: colorScheme.outlineVariant),
                ),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    color: Colors.black54,
                    child: Text('${idx + 1}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
              Positioned(
                top: -2,
                right: 6,
                child: GestureDetector(
                  onTap: () {
                    setState(() => _images.removeAt(idx));
                    if (_images.isEmpty) {
                      setState(() => _currentPageContext = '');
                    } else {
                      _runOcr();
                    }
                  },
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                    child: const Icon(Icons.close, size: 12, color: Colors.white),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildContextBar(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: colorScheme.tertiaryContainer.withOpacity(0.4),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline, size: 14, color: colorScheme.tertiary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '${_currentPageContext.length} characters extracted · ${_images.length} image(s)',
              style: TextStyle(fontSize: 12, color: colorScheme.onTertiaryContainer, fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          TextButton.icon(
            onPressed: _isAiLoading ? null : _showQuizDialog,
            icon: const Icon(Icons.quiz_outlined, size: 14),
            label: const Text('Quiz', style: TextStyle(fontSize: 12)),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(top: BorderSide(color: colorScheme.outlineVariant, width: 0.5)),
      ),
      child: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (_images.isEmpty)
              IconButton(
                onPressed: _showImageSourcePicker,
                icon: Icon(Icons.add_photo_alternate_outlined, color: colorScheme.primary),
                tooltip: 'Add photos',
              ),
            Expanded(
              child: TextField(
                controller: _promptController,
                maxLines: 4,
                minLines: 1,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: _currentPageContext.isEmpty
                      ? 'Add images then ask a question...'
                      : 'Ask about this page...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _isAiLoading ? null : _sendPrompt,
              style: FilledButton.styleFrom(
                shape: const CircleBorder(),
                padding: const EdgeInsets.all(13),
                minimumSize: Size.zero,
              ),
              child: _isAiLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  void _showImageSourcePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded),
              title: const Text('Take a photo'),
              onTap: () { Navigator.pop(ctx); _pickImages(ImageSource.camera); },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Choose from gallery'),
              subtitle: const Text('Select up to 10 images'),
              onTap: () { Navigator.pop(ctx); _pickImages(ImageSource.gallery); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _addToNote(String content) async {
    String subject = 'General';
    final controller = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save to Notebook'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter a subject or topic for this note:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Subject / Topic',
                hintText: 'e.g. Physics - Newton\'s Laws',
              ),
              autofocus: true,
              onChanged: (v) => subject = v,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              final finalSubject = controller.text.trim().isEmpty ? 'General' : controller.text.trim();
              context.read<NotesProvider>().addNote(content: content, subject: finalSubject);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('✓ Saved to Notebook!'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
  }
}

class _ChatBubble extends StatelessWidget {
  final Map<String, String> message;
  final double fontSize;
  final String aiLanguage;
  final VoidCallback? onAddToNote;

  const _ChatBubble({
    required this.message,
    required this.fontSize,
    required this.aiLanguage,
    this.onAddToNote,
  });

  @override
  Widget build(BuildContext context) {
    final isUser = message['role'] == 'user';
    final colorScheme = Theme.of(context).colorScheme;
    final content = message['content'] ?? '';

    if (isUser) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Align(
          alignment: Alignment.centerRight,
          child: Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              color: colorScheme.primary,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(4),
              ),
            ),
            child: Text(
              content,
              style: TextStyle(color: colorScheme.onPrimary, fontSize: fontSize, height: 1.4),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.auto_stories_rounded, size: 15, color: colorScheme.primary),
              ),
              const SizedBox(width: 8),
              Text(
                'Echo AI',
                style: TextStyle(fontSize: 12, color: colorScheme.primary, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerLow,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(20),
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
              border: Border.all(color: colorScheme.outlineVariant, width: 0.5),
            ),
            child: MarkdownBody(
              data: content,
              selectable: true,
              styleSheet: MarkdownStyleSheet(
                p: TextStyle(fontSize: fontSize, color: colorScheme.onSurface, height: 1.6),
                h1: TextStyle(fontSize: fontSize + 6, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                h2: TextStyle(fontSize: fontSize + 4, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                h3: TextStyle(fontSize: fontSize + 2, fontWeight: FontWeight.w600, color: colorScheme.onSurface),
                strong: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                em: TextStyle(fontStyle: FontStyle.italic, color: colorScheme.onSurface),
                code: TextStyle(
                  fontFamily: 'monospace',
                  backgroundColor: colorScheme.surfaceContainerHighest,
                  fontSize: fontSize - 1,
                  color: colorScheme.secondary,
                ),
                blockquoteDecoration: BoxDecoration(
                  border: Border(left: BorderSide(color: colorScheme.primary, width: 3)),
                  color: colorScheme.primaryContainer.withOpacity(0.3),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 4,
            children: [
              _ActionChip(
                icon: Icons.volume_up_outlined,
                label: 'Read',
                onPressed: () {
                  final tts = context.read<TtsProvider>();
                  final settings = context.read<SettingsProvider>();
                  tts.speak(
                    text: content,
                    languageCode: settings.voiceLanguage,
                    volume: settings.volume,
                    pitch: settings.pitch,
                    rate: settings.speechRate,
                  );
                },
              ),
              if (onAddToNote != null)
                _ActionChip(
                  icon: Icons.bookmark_add_outlined,
                  label: 'Save',
                  onPressed: onAddToNote!,
                ),
              _ActionChip(
                icon: Icons.copy_outlined,
                label: 'Copy',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: content));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard'), duration: Duration(seconds: 2)),
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  const _ActionChip({required this.icon, required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          border: Border.all(color: colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(16),
          color: colorScheme.surfaceContainerLowest,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: colorScheme.secondary),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 11, color: colorScheme.secondary, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
