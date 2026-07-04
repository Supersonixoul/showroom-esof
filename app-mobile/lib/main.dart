import 'package:flutter/material.dart';

import 'screens/home_screen.dart';
import 'services/auth_session.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthSession.instance.restore();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ESOF Showroom',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
