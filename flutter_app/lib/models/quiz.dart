class QuizQuestion {
  final String question;
  final List<String> options;
  final int correctIndex;
  final String explanation;
  String? userAnswer;
  int? selectedIndex;

  QuizQuestion({
    required this.question,
    required this.options,
    required this.correctIndex,
    required this.explanation,
    this.userAnswer,
    this.selectedIndex,
  });

  bool get isCorrect => selectedIndex == correctIndex;

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    final opts = (json['options'] as List?)?.map((e) => e.toString()).toList() ?? [];
    return QuizQuestion(
      question: json['question']?.toString() ?? '',
      options: opts,
      correctIndex: (json['correctIndex'] as num?)?.toInt() ?? 0,
      explanation: json['explanation']?.toString() ?? '',
    );
  }
}

class Quiz {
  final List<QuizQuestion> questions;
  final int timeLimitMinutes;
  final String subject;

  Quiz({
    required this.questions,
    required this.timeLimitMinutes,
    required this.subject,
  });
}
