class Note {
  final String id;
  String content;
  String subject;
  final DateTime savedAt;

  Note({
    required this.id,
    required this.content,
    required this.subject,
    required this.savedAt,
  });

  String get title {
    final stripped = content.replaceAll(RegExp(r'[#*_`\[\]\(\)>]'), '').trim();
    if (stripped.length <= 40) return stripped;
    return '${stripped.substring(0, 40)}...';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'content': content,
        'subject': subject,
        'savedAt': savedAt.toIso8601String(),
      };

  factory Note.fromJson(Map<String, dynamic> json) => Note(
        id: json['id'] as String,
        content: json['content'] as String,
        subject: json['subject'] as String,
        savedAt: DateTime.parse(json['savedAt'] as String),
      );

  Note copyWith({String? content, String? subject}) => Note(
        id: id,
        content: content ?? this.content,
        subject: subject ?? this.subject,
        savedAt: savedAt,
      );
}
