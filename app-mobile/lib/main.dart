import 'package:flutter/material.dart';

import 'screens/home_screen.dart';
import 'services/auth_session.dart';
import 'services/pending_quote_queue.dart';
import 'services/server_config.dart';
import 'theme/app_colors.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ServerConfig.init();
  await AuthSession.instance.restore();
  PendingQuoteQueue.instance.startFlushLoop();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ESOF Showroom',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.navy,
          primary: AppColors.navy,
          secondary: AppColors.orangeAccent,
        ),
      ),
      home: const HomeScreen(),
    );
  }
}
