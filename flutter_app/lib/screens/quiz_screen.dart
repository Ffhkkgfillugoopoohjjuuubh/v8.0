import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/quiz.dart';
import '../providers/settings_provider.dart';
import '../services/groq_service.dart';

class QuizScreen extends StatefulWidget {
  final List<dynamic> questionsJson;
  final int timeLimitMinutes;
  final String subject;
  final String aiLanguage;

  const QuizScreen({
    super.key,
    required this.questionsJson,
    required this.timeLimitMinutes,
    required this.subject,
    required this.aiLanguage,
  });

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  late List<QuizQuestion> _questions;
  late int _secondsLeft;
  Timer? _timer;
  bool _submitted = false;
  bool _isGrading = false;
  String _gradingResult = '';
  int _currentQuestionIndex = 0;

  @override
  void initState() {
    super.initState();
    _questions = widget.questionsJson
        .map((e) => QuizQuestion.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    _secondsLeft = widget.timeLimitMinutes * 60;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 0) {
        t.cancel();
        if (!_submitted) _submitQuiz();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _submitQuiz() async {
    if (_submitted) return;
    _timer?.cancel();
    setState(() {
      _submitted = true;
      _isGrading = true;
    });

    final score = _questions.where((q) => q.isCorrect).length;
    final total = _questions.length;
    final percentage = (score / total * 100).round();

    // Build grading summary for AI
    final summary = _questions.asMap().entries.map((e) {
      final q = e.value;
      final userAns = q.selectedIndex != null ? q.options[q.selectedIndex!] : 'Not answered';
      final correct = q.options[q.correctIndex];
      return 'Q${e.key + 1}: ${q.question}\n  User: $userAns\n  Correct: $correct\n  Result: ${q.isCorrect ? "Correct" : "Wrong"}';
    }).join('\n\n');

    try {
      final settings = context.read<SettingsProvider>();
      final gradingPrompt = '''
The student scored $score/$total ($percentage%) on a quiz about "${widget.subject}".

Here are the results:
$summary

Please provide:
1. A brief overall assessment of the student's performance (2-3 sentences)
2. Which topics they need to review
3. One encouraging motivational message

Respond in ${settings.aiResponseLanguage}.''';

      final response = await GroqService.chat(
        messages: [
          {'role': 'system', 'content': 'You are a helpful teacher providing quiz feedback.'},
          {'role': 'user', 'content': gradingPrompt},
        ],
        maxTokens: 512,
      );
      setState(() => _gradingResult = response);
    } on GroqException catch (e) {
      setState(() => _gradingResult = e.message);
    } finally {
      setState(() => _isGrading = false);
    }
  }

  String get _timerDisplay {
    final m = _secondsLeft ~/ 60;
    final s = _secondsLeft % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Color get _timerColor {
    if (_secondsLeft < 60) return Colors.red;
    if (_secondsLeft < 180) return Colors.orange;
    return Colors.green;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.subject),
        actions: [
          if (!_submitted)
            Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _timerColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _timerColor),
              ),
              child: Row(
                children: [
                  Icon(Icons.timer, size: 16, color: _timerColor),
                  const SizedBox(width: 4),
                  Text(
                    _timerDisplay,
                    style: TextStyle(color: _timerColor, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
            ),
        ],
      ),
      body: _submitted ? _buildResults() : _buildQuiz(),
    );
  }

  Widget _buildQuiz() {
    final colorScheme = Theme.of(context).colorScheme;
    final q = _questions[_currentQuestionIndex];
    final total = _questions.length;

    return Column(
      children: [
        // Progress
        LinearProgressIndicator(
          value: (_currentQuestionIndex + 1) / total,
          minHeight: 4,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text(
                'Question ${_currentQuestionIndex + 1} of $total',
                style: TextStyle(color: colorScheme.outline, fontSize: 13),
              ),
              const Spacer(),
              Text(
                '${_questions.where((q) => q.selectedIndex != null).length} answered',
                style: TextStyle(color: colorScheme.primary, fontSize: 13),
              ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      q.question,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ...List.generate(q.options.length, (idx) {
                  final isSelected = q.selectedIndex == idx;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      onTap: () => setState(() => q.selectedIndex = idx),
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? colorScheme.primary : colorScheme.outline,
                            width: isSelected ? 2 : 1,
                          ),
                          color: isSelected ? colorScheme.primaryContainer : colorScheme.surface,
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected ? colorScheme.primary : colorScheme.surfaceContainerHighest,
                              ),
                              child: Center(
                                child: Text(
                                  String.fromCharCode(65 + idx),
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isSelected ? colorScheme.onPrimary : colorScheme.onSurface,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(q.options[idx], style: const TextStyle(fontSize: 15)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
        // Navigation
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (_currentQuestionIndex > 0)
                  OutlinedButton.icon(
                    onPressed: () => setState(() => _currentQuestionIndex--),
                    icon: const Icon(Icons.arrow_back),
                    label: const Text('Prev'),
                  ),
                const Spacer(),
                if (_currentQuestionIndex < _questions.length - 1)
                  FilledButton.icon(
                    onPressed: () => setState(() => _currentQuestionIndex++),
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('Next'),
                  )
                else
                  FilledButton.icon(
                    onPressed: _submitQuiz,
                    icon: const Icon(Icons.check_circle),
                    label: const Text('Submit'),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResults() {
    final colorScheme = Theme.of(context).colorScheme;
    final score = _questions.where((q) => q.isCorrect).length;
    final total = _questions.length;
    final percentage = (score / total * 100).round();

    Color scoreColor;
    String scoreLabel;
    if (percentage >= 80) {
      scoreColor = Colors.green;
      scoreLabel = 'Excellent!';
    } else if (percentage >= 60) {
      scoreColor = Colors.orange;
      scoreLabel = 'Good Job!';
    } else {
      scoreColor = colorScheme.error;
      scoreLabel = 'Keep Practicing!';
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Score card
          Card(
            color: scoreColor.withOpacity(0.1),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(scoreLabel, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: scoreColor)),
                  const SizedBox(height: 12),
                  Text(
                    '$score / $total',
                    style: TextStyle(fontSize: 48, fontWeight: FontWeight.w800, color: scoreColor),
                  ),
                  Text(
                    '$percentage%',
                    style: TextStyle(fontSize: 20, color: scoreColor.withOpacity(0.8)),
                  ),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: score / total,
                    color: scoreColor,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // AI feedback
          if (_isGrading)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Row(
                  children: [
                    CircularProgressIndicator(strokeWidth: 2),
                    SizedBox(width: 16),
                    Text('Getting AI feedback...'),
                  ],
                ),
              ),
            )
          else if (_gradingResult.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.auto_awesome, color: colorScheme.primary, size: 18),
                        const SizedBox(width: 8),
                        Text('AI Feedback', style: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.primary)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(_gradingResult),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),

          // Per-question review
          Text('Review Answers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colorScheme.onSurface)),
          const SizedBox(height: 12),
          ..._questions.asMap().entries.map((entry) {
            final idx = entry.key;
            final q = entry.value;
            final isCorrect = q.isCorrect;
            final notAnswered = q.selectedIndex == null;
            final bgColor = notAnswered
                ? colorScheme.surfaceContainerHighest
                : isCorrect
                    ? Colors.green.withOpacity(0.1)
                    : colorScheme.error.withOpacity(0.1);
            final borderColor = notAnswered
                ? colorScheme.outline
                : isCorrect
                    ? Colors.green
                    : colorScheme.error;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: borderColor),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        notAnswered
                            ? Icons.remove_circle_outline
                            : isCorrect
                                ? Icons.check_circle
                                : Icons.cancel,
                        color: borderColor,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text('Q${idx + 1}', style: TextStyle(fontWeight: FontWeight.bold, color: borderColor)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(q.question, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  if (!notAnswered)
                    Text(
                      'Your answer: ${q.options[q.selectedIndex!]}',
                      style: TextStyle(color: isCorrect ? Colors.green[700] : colorScheme.error),
                    ),
                  Text(
                    'Correct: ${q.options[q.correctIndex]}',
                    style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                  ),
                  if (q.explanation.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      q.explanation,
                      style: TextStyle(fontSize: 13, color: colorScheme.onSurface.withOpacity(0.7)),
                    ),
                  ],
                ],
              ),
            );
          }),
          const SizedBox(height: 24),
          Center(
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to Scanner'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
