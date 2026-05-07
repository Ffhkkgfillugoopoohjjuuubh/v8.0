import 'package:flutter/material.dart';

class LanguagePickerDialog extends StatefulWidget {
  final String title;
  final String currentValue;
  final List<Map<String, String>> languages;

  const LanguagePickerDialog({
    super.key,
    required this.title,
    required this.currentValue,
    required this.languages,
  });

  @override
  State<LanguagePickerDialog> createState() => _LanguagePickerDialogState();
}

class _LanguagePickerDialogState extends State<LanguagePickerDialog> {
  String _search = '';
  final TextEditingController _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.languages
        .where((l) =>
            l['name']!.toLowerCase().contains(_search.toLowerCase()) ||
            l['code']!.toLowerCase().contains(_search.toLowerCase()))
        .toList();

    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: double.maxFinite,
        height: 400,
        child: Column(
          children: [
            TextField(
              controller: _ctrl,
              decoration: const InputDecoration(
                hintText: 'Search...',
                prefixIcon: Icon(Icons.search, size: 18),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (ctx, idx) {
                  final lang = filtered[idx];
                  final isSelected = lang['code'] == widget.currentValue ||
                      lang['name'] == widget.currentValue;
                  return ListTile(
                    dense: true,
                    title: Text(lang['name']!),
                    trailing: isSelected
                        ? Icon(Icons.check, color: Theme.of(context).colorScheme.primary)
                        : null,
                    selected: isSelected,
                    onTap: () => Navigator.pop(context, lang['code'] ?? lang['name']),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ],
    );
  }
}
