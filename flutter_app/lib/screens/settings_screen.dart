import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/notes_provider.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionHeader(title: 'Language & Localization'),
          _DropdownTile(
            icon: Icons.language,
            title: 'App Language',
            subtitle: 'UI display language',
            value: settings.appLanguage,
            items: kSupportedLanguages.map((l) => DropdownMenuItem(
              value: l['code']!,
              child: Text(l['name']!),
            )).toList(),
            onChanged: (v) => settings.setAppLanguage(v!),
          ),
          _DropdownTile(
            icon: Icons.translate,
            title: 'AI Response Language',
            subtitle: 'Language for AI answers',
            value: settings.aiResponseLanguage,
            items: kAiResponseLanguages.map((l) => DropdownMenuItem(
              value: l,
              child: Text(l),
            )).toList(),
            onChanged: (v) => settings.setAiResponseLanguage(v!),
          ),
          _DropdownTile(
            icon: Icons.record_voice_over,
            title: 'Voice Language',
            subtitle: 'TTS language for read aloud',
            value: settings.voiceLanguage,
            items: kVoiceLanguages.map((l) => DropdownMenuItem(
              value: l['code']!,
              child: Text(l['name']!),
            )).toList(),
            onChanged: (v) => settings.setVoiceLanguage(v!),
          ),
          const SizedBox(height: 16),
          _SectionHeader(title: 'Appearance'),
          SwitchListTile(
            secondary: Icon(
              settings.darkMode ? Icons.dark_mode : Icons.light_mode,
              color: colorScheme.primary,
            ),
            title: const Text('Dark Mode'),
            subtitle: Text(settings.darkMode ? 'Dark theme active' : 'Light theme active'),
            value: settings.darkMode,
            onChanged: settings.setDarkMode,
          ),
          _SliderTile(
            icon: Icons.text_fields,
            title: 'Font Size',
            value: settings.fontSize,
            min: 14,
            max: 30,
            divisions: 16,
            label: '${settings.fontSize.round()}px',
            onChanged: settings.setFontSize,
          ),
          const SizedBox(height: 16),
          _SectionHeader(title: 'Text-to-Speech'),
          _SliderTile(
            icon: Icons.volume_up,
            title: 'Volume',
            value: settings.volume,
            min: 0,
            max: 1,
            divisions: 10,
            label: '${(settings.volume * 100).round()}%',
            onChanged: settings.setVolume,
          ),
          _SliderTile(
            icon: Icons.graphic_eq,
            title: 'Pitch',
            value: settings.pitch,
            min: 0.5,
            max: 2.0,
            divisions: 15,
            label: settings.pitch.toStringAsFixed(1),
            onChanged: settings.setPitch,
          ),
          _SliderTile(
            icon: Icons.speed,
            title: 'Speech Rate',
            value: settings.speechRate,
            min: 0.1,
            max: 1.0,
            divisions: 9,
            label: settings.speechRate.toStringAsFixed(1),
            onChanged: settings.setSpeechRate,
          ),
          const SizedBox(height: 16),
          _SectionHeader(title: 'Data'),
          ListTile(
            leading: Icon(Icons.delete_outline, color: colorScheme.error),
            title: const Text('Clear All Notes'),
            subtitle: const Text('Permanently delete all saved notes'),
            onTap: () => _confirmClearAll(context),
          ),
          const SizedBox(height: 16),
          _SectionHeader(title: 'About'),
          ListTile(
            leading: Icon(Icons.info_outline, color: colorScheme.primary),
            title: const Text('App Version'),
            subtitle: const Text('Echo AI v1.0.0'),
          ),
          ListTile(
            leading: Icon(Icons.auto_stories, color: colorScheme.primary),
            title: const Text('Echo AI'),
            subtitle: const Text('Your Smart Study Companion\nPowered by Groq AI'),
          ),
          // AdMob placeholder comment
          // TODO: Add AdMob banner ad here when ready
          // AdWidget(ad: bannerAd), 
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Future<void> _confirmClearAll(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear All Notes'),
        content: const Text('This will permanently delete all your notes. This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text('Delete All', style: TextStyle(color: Theme.of(context).colorScheme.onError)),
          ),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await context.read<NotesProvider>().clearAll();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notes deleted')),
      );
    }
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).colorScheme.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _SliderTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final double value;
  final double min;
  final double max;
  final int divisions;
  final String label;
  final ValueChanged<double> onChanged;

  const _SliderTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.label,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: colorScheme.primary, size: 22),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: Text(title, style: const TextStyle(fontSize: 14)),
          ),
          Expanded(
            child: Slider(
              value: value,
              min: min,
              max: max,
              divisions: divisions,
              label: label,
              onChanged: onChanged,
            ),
          ),
          SizedBox(
            width: 48,
            child: Text(label, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _DropdownTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _DropdownTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(icon, color: colorScheme.primary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: DropdownButton<String>(
        value: value,
        underline: const SizedBox(),
        items: items,
        onChanged: onChanged,
        alignment: Alignment.centerRight,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 0),
    );
  }
}
