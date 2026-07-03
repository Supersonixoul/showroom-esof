import 'package:flutter/material.dart';

import 'navigation/app_navigation.dart';
import 'screens/video_carousel_screen.dart';

void main() {
  runApp(const ShowroomTvApp());
}

class ShowroomTvApp extends StatelessWidget {
  const ShowroomTvApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Showroom ESOF - TV',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      navigatorKey: appNavigatorKey,
      navigatorObservers: [catalogRouteObserver],
      builder: (context, child) => InactivityGuard(child: child!),
      home: const VideoCarouselScreen(),
    );
  }
}
