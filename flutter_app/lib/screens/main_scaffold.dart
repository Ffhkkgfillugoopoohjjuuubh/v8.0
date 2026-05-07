import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tts_provider.dart';
import 'scanner_screen.dart';
import 'notebook_screen.dart';
import 'settings_screen.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    ScannerScreen(),
    NotebookScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final tts = context.watch<TtsProvider>();

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          if (tts.isPlaying || tts.isPaused)
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 16,
              right: 16,
              child: _TtsStatusChip(tts: tts),
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.document_scanner_outlined),
            selectedIcon: Icon(Icons.document_scanner),
            label: 'Scanner',
          ),
          NavigationDestination(
            icon: Icon(Icons.book_outlined),
            selectedIcon: Icon(Icons.book),
            label: 'Notebook',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

class _TtsStatusChip extends StatelessWidget {
  final TtsProvider tts;
  const _TtsStatusChip({required this.tts});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(24),
      color: colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              tts.isPlaying ? Icons.volume_up : Icons.pause,
              color: colorScheme.onPrimaryContainer,
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              tts.isPlaying ? 'Reading aloud...' : 'Paused',
              style: TextStyle(
                color: colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            const Spacer(),
            if (tts.isPlaying)
              TextButton(
                onPressed: tts.pause,
                style: TextButton.styleFrom(
                  foregroundColor: colorScheme.onPrimaryContainer,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Pause'),
              ),
            if (tts.isPaused)
              TextButton(
                onPressed: tts.resume,
                style: TextButton.styleFrom(
                  foregroundColor: colorScheme.onPrimaryContainer,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Resume'),
              ),
            TextButton(
              onPressed: tts.stop,
              style: TextButton.styleFrom(
                foregroundColor: colorScheme.error,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Stop'),
            ),
          ],
        ),
      ),
    );
  }
}
