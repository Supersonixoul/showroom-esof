import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_tv/main.dart';

void main() {
  testWidgets('App builds and shows the video carousel screen',
      (WidgetTester tester) async {
    await tester.pumpWidget(const ShowroomTvApp());
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
