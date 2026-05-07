import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart';

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_bn.dart';

abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('bn'),
    Locale('ta'),
    Locale('te'),
    Locale('kn'),
    Locale('ml'),
    Locale('mr'),
    Locale('gu'),
    Locale('pa'),
    Locale('or'),
    Locale('as'),
    Locale('ur'),
    Locale('ar'),
    Locale('fr'),
    Locale('es'),
    Locale('de'),
    Locale('ja'),
    Locale('ko'),
    Locale('zh'),
    Locale('pt'),
    Locale('ru'),
    Locale('nl'),
    Locale('tr'),
    Locale('vi'),
    Locale('th'),
    Locale('id'),
    Locale('pl'),
    Locale('sv'),
  ];

  String get appTitle;
  String get scanner;
  String get notebook;
  String get settings;
  String get tapToScan;
  String get addPhotos;
  String get generateQuiz;
  String get readAloud;
  String get addToNote;
  String get copy;
  String get aiResponseLanguage;
  String get voiceLanguage;
  String get appLanguage;
  String get darkMode;
  String get fontSize;
  String get volume;
  String get pitch;
  String get speechRate;
  String get clearAllNotes;
  String get appVersion;
  String get save;
  String get cancel;
  String get delete;
  String get edit;
  String get newNote;
  String get searchNotes;
  String get subject;
  String get aiAssistant;
  String get askAboutThisPage;
  String get echoAiIsThinking;
  String get readingAloud;
  String get paused;
  String get stop;
  String get resume;
  String get pause;
  String get numberOfQuestions;
  String get timeLimitMinutes;
  String get generate;
  String get submit;
  String get next;
  String get prev;
  String get reviewAnswers;
  String get aiFeedback;
  String get excellent;
  String get goodJob;
  String get keepPracticing;
  String get backToScanner;
  String get copiedToClipboard;
  String get savedToNotebook;
  String get allNotesDeleted;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(_lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => AppLocalizations.supportedLocales
      .any((l) => l.languageCode == locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations _lookupAppLocalizations(Locale locale) {
  switch (locale.languageCode) {
    case 'hi': return AppLocalizationsHi();
    case 'bn': return AppLocalizationsBn();
    default:   return AppLocalizationsEn();
  }
}
