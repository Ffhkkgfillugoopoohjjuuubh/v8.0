import 'package:shared_preferences/shared_preferences.dart';

/// Simple key-value cache backed by SharedPreferences.
class CacheService {
  static const String _keyPageContext = 'cache_page_context';
  static const String _keyLastImages = 'cache_last_images';

  static Future<void> savePageContext(String text) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyPageContext, text);
  }

  static Future<String> loadPageContext() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyPageContext) ?? '';
  }

  static Future<void> clearPageContext() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyPageContext);
  }
}
