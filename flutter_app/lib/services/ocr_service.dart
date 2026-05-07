import 'dart:io';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

class OcrService {
  static Future<String> extractTextFromImages(List<File> images) async {
    final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
    final buffer = StringBuffer();

    for (int i = 0; i < images.length; i++) {
      final inputImage = InputImage.fromFile(images[i]);
      try {
        final result = await textRecognizer.processImage(inputImage);
        if (result.text.isNotEmpty) {
          if (i > 0) buffer.writeln('\n--- Page ${i + 1} ---\n');
          buffer.writeln(result.text);
        }
      } catch (e) {
        buffer.writeln('[Could not extract text from image ${i + 1}]');
      }
    }

    await textRecognizer.close();
    return buffer.toString().trim();
  }
}
