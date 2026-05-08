import 'dart:convert';
import 'package:http/http.dart' as http;

const String _kGroqApiKey = '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';
const String _kGroqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
const String _kGroqModel = 'openai/gpt-oss-120b';

class GroqException implements Exception {
  final String message;
  final bool isAuthError;
  GroqException(this.message, {this.isAuthError = false});
}

class GroqService {
  static Future<String> chat({
    required List<Map<String, String>> messages,
    double temperature = 0.7,
    int maxTokens = 2048,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(_kGroqEndpoint),
        headers: {
          'Authorization': 'Bearer $_kGroqApiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'model': _kGroqModel,
          'messages': messages,
          'temperature': temperature,
          'max_tokens': maxTokens,
        }),
      ).timeout(const Duration(seconds: 60));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['choices'][0]['message']['content']?.toString() ?? '';
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        throw GroqException(
          'API key is invalid or expired. Please check your settings.',
          isAuthError: true,
        );
      } else if (response.statusCode == 429) {
        throw GroqException('Rate limit reached. Please wait a moment and try again.');
      } else {
        final body = jsonDecode(response.body);
        final errMsg = body['error']?['message']?.toString() ?? 'Unknown error';
        throw GroqException('API Error: $errMsg');
      }
    } on GroqException {
      rethrow;
    } catch (e) {
      throw GroqException(
        'Cannot connect to AI service. Please check your internet connection.',
      );
    }
  }

  static String buildSystemPrompt({
    required String language,
    required bool hasMath,
    bool formalStyle = false,
    String? additionalInstructions,
  }) {
    final styleInstructions = formalStyle
        ? 'Use formal academic language. Translate ALL terms, including scientific ones, into $language.'
        : 'Use casual, everyday spoken words. Keep ALL scientific and technical terms in ENGLISH (written in English letters). Never translate scientific terms. All other words must be in $language.';

    return r'''You are Echo AI, a brilliant, patient teacher.
You MUST write your ENTIRE answer in ''' + language + r'''.
''' + styleInstructions + r'''

YOUR ANSWER MUST BE STRUCTURED LIKE THIS:

Give the direct answer or explanation in the FIRST sentence.

Then explain the concept in clear, numbered steps.

For any math or physics problem on the page, solve it step-by-step.

End with a short summary and one encouraging question.

FORMAT:

Use bold for important words.

Use bullet points for lists.

Keep paragraphs short.

NEVER use LaTeX. NEVER use \frac, \sqrt, $$, $.

NEVER write dollar signs or backslashes in your answer.

Write fractions as (a)/(b) with parentheses.

Write square roots as sqrt(x).

Write powers as x^2.

If the user is working from a textbook page you have seen, use that page context to answer.
''';
  }

  static bool detectsMath(String text) {
    final mathPattern = RegExp(
      r'(\d+[\+\-\*\/\=\^\%]\d+|sqrt|sin|cos|tan|log|dx|dy|integral|equation|formula|solve|calculate|find\s+\w+|velocity|acceleration|force|energy|work|power|pressure|volume|area|perimeter|\bx\b|\by\b)',
      caseSensitive: false,
    );
    return mathPattern.hasMatch(text);
  }
}
