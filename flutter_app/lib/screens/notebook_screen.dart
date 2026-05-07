import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/note.dart';
import '../providers/notes_provider.dart';
import 'note_detail_screen.dart';

class NotebookScreen extends StatefulWidget {
  const NotebookScreen({super.key});

  @override
  State<NotebookScreen> createState() => _NotebookScreenState();
}

class _NotebookScreenState extends State<NotebookScreen> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final notesProvider = context.watch<NotesProvider>();
    final allNotes = notesProvider.notes;

    final filtered = _searchQuery.isEmpty
        ? allNotes
        : allNotes
            .where((n) =>
                n.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                n.subject.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                n.content.toLowerCase().contains(_searchQuery.toLowerCase()))
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notebook'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search notes...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
        ),
      ),
      body: filtered.isEmpty
          ? _buildEmptyState(allNotes.isEmpty)
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, idx) => _NoteCard(note: filtered[idx]),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createNote(context),
        icon: const Icon(Icons.add),
        label: const Text('New Note'),
      ),
    );
  }

  Widget _buildEmptyState(bool isEmpty) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isEmpty ? Icons.book_outlined : Icons.search_off,
            size: 72,
            color: colorScheme.primary.withOpacity(0.4),
          ),
          const SizedBox(height: 16),
          Text(
            isEmpty ? 'Your Notebook is Empty' : 'No notes found',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
          ),
          const SizedBox(height: 8),
          Text(
            isEmpty
                ? 'Save AI responses from the Scanner\nor create a note manually.'
                : 'Try a different search term.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colorScheme.onSurface.withOpacity(0.6)),
          ),
        ],
      ),
    );
  }

  Future<void> _createNote(BuildContext context) async {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const NoteDetailScreen(note: null),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final Note note;
  const _NoteCard({required this.note});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final dateStr = DateFormat('MMM d, y').format(note.savedAt);

    return Dismissible(
      key: Key(note.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: colorScheme.error,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(Icons.delete_outline, color: colorScheme.onError),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Note'),
            content: const Text('Are you sure you want to delete this note?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(backgroundColor: colorScheme.error),
                child: Text('Delete', style: TextStyle(color: colorScheme.onError)),
              ),
            ],
          ),
        );
      },
      onDismissed: (_) => context.read<NotesProvider>().deleteNote(note.id),
      child: Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => NoteDetailScreen(note: note)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        note.title,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (note.subject.isNotEmpty && note.subject != 'General')
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          note.subject,
                          style: TextStyle(
                            fontSize: 11,
                            color: colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  note.content,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    color: colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.calendar_today_outlined, size: 12, color: colorScheme.outline),
                    const SizedBox(width: 4),
                    Text(
                      dateStr,
                      style: TextStyle(fontSize: 12, color: colorScheme.outline),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.text_fields_outlined, size: 12, color: colorScheme.outline),
                    const SizedBox(width: 4),
                    Text(
                      '${note.content.length} chars',
                      style: TextStyle(fontSize: 12, color: colorScheme.outline),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
