import 'package:flutter/material.dart';

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
      home: const VideoCarouselScreen(),
    );
  }
}
