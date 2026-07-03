import 'package:flutter_test/flutter_test.dart';

import 'package:app_mobile/main.dart';

void main() {
  testWidgets('Home screen shows the three catalogue entry points',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('Marques'), findsOneWidget);
    expect(find.text('Catégories'), findsOneWidget);
    expect(find.text('Caractéristiques'), findsOneWidget);
  });
}
