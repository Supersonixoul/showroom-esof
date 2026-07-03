class PromoVideo {
  final String id;
  final String title;
  final String url;
  final int position;
  final bool isActive;
  final String updatedAt;

  PromoVideo({
    required this.id,
    required this.title,
    required this.url,
    required this.position,
    required this.isActive,
    required this.updatedAt,
  });

  factory PromoVideo.fromJson(Map<String, dynamic> json) {
    return PromoVideo(
      id: json['id'] as String,
      title: json['title'] as String,
      url: json['url'] as String,
      position: json['position'] as int,
      isActive: json['isActive'] as bool,
      updatedAt: json['updatedAt'] as String,
    );
  }

  factory PromoVideo.fromMap(Map<String, dynamic> map) {
    return PromoVideo(
      id: map['id'] as String,
      title: map['title'] as String,
      url: map['url'] as String,
      position: map['position'] as int,
      isActive: (map['isActive'] as int) == 1,
      updatedAt: map['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'url': url,
      'position': position,
      'isActive': isActive ? 1 : 0,
      'updatedAt': updatedAt,
    };
  }
}
