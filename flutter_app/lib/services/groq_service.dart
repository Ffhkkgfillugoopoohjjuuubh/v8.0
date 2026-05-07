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
    String? additionalInstructions,
  }) {
    final mathInstructions = hasMath
        ? '''
When mathematical or physics problems are detected in the content:
- Solve EVERY problem completely, step by step.
- Show the formula, substitute values, show each solving step clearly.
- Write the final answer in bold (using **answer**).
- Write fractions as (numerator)/(denominator), e.g. (3)/(4).
- Write square root as sqrt(), e.g. sqrt(16) = 4.
- Do NOT use LaTeX or complex math notation.
- If a problem is ambiguous, explain the concept and state why it cannot be solved precisely.
'''
        : '';

    return '''You are Echo AI, an expert educational assistant.

RESPONSE LANGUAGE: Always respond in $language. Use the casual, everyday form of the language. 
For Indian languages, keep scientific terms, equations, and technical units in English.

FORMATTING RULES:
- Use plain text with markdown for structure (bold, lists, headers).
- Do NOT use LaTeX. Write math in plain text format.
- Fractions: write as (a)/(b). Square roots: write as sqrt(x).
- Use **bold** for important terms and final answers.
- Use numbered lists for steps.
- Keep responses clear, concise, and educational.

$mathInstructions
${additionalInstructions ?? ''}

Always be helpful, encouraging, and accurate. If unsure, say so clearly.''';
  }

  static bool detectsMath(String text) {
    final mathPattern = RegExp(
      r'(\d+[\+\-\*\/\=\^\%]\d+|sqrt|sin|cos|tan|log|dx|dy|integral|equation|formula|solve|calculate|find\s+\w+|velocity|acceleration|force|energy|work|power|pressure|volume|area|perimeter|\bx\b|\by\b)',
      caseSensitive: false,
    );
    return mathPattern.hasMatch(text);
  }
}
