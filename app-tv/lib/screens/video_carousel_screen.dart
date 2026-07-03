import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../models/promo_video.dart';
import '../services/api_service.dart';
import '../services/video_repository.dart';

/// Mode ordinaire de l'app TV boutique : carousel vidéo plein écran, en
/// boucle, des vidéos promotionnelles actives (triées par position).
class VideoCarouselScreen extends StatefulWidget {
  const VideoCarouselScreen({super.key});

  @override
  State<VideoCarouselScreen> createState() => _VideoCarouselScreenState();
}

class _VideoCarouselScreenState extends State<VideoCarouselScreen> {
  final VideoRepository _repository = VideoRepository();
  VideoPlayerController? _controller;
  List<PromoVideo> _videos = [];
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _repository.videos.addListener(_onVideosChanged);
    _repository.init();
  }

  void _onVideosChanged() {
    final newVideos = _repository.videos.value;
    final wasEmpty = _videos.isEmpty;
    _videos = newVideos;
    if (wasEmpty && _videos.isNotEmpty) {
      _currentIndex = 0;
      _playVideoAt(_currentIndex);
    } else if (_videos.isEmpty && _controller != null) {
      final old = _controller;
      setState(() => _controller = null);
      old?.dispose();
    }
  }

  void _playVideoAt(int index) {
    if (_videos.isEmpty) return;
    final safeIndex = index % _videos.length;
    final video = _videos[safeIndex];
    final oldController = _controller;
    final newController = VideoPlayerController.networkUrl(
      Uri.parse(ApiService.mediaUrl(video.url)),
    );
    newController.addListener(_onControllerUpdate);
    newController.initialize().then((_) {
      if (!mounted) return;
      setState(() {
        _currentIndex = safeIndex;
        _controller = newController;
      });
      newController.play();
      oldController?.removeListener(_onControllerUpdate);
      oldController?.dispose();
    });
  }

  void _onControllerUpdate() {
    final controller = _controller;
    if (controller == null) return;
    final value = controller.value;
    if (value.isInitialized &&
        !value.isPlaying &&
        value.duration > Duration.zero &&
        value.position >= value.duration) {
      _playVideoAt(_currentIndex + 1);
    }
  }

  @override
  void dispose() {
    _repository.videos.removeListener(_onVideosChanged);
    _controller?.removeListener(_onControllerUpdate);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && controller.value.isInitialized;
    return Scaffold(
      backgroundColor: Colors.black,
      body: ready
          ? Center(
              child: AspectRatio(
                aspectRatio: controller.value.aspectRatio,
                child: VideoPlayer(controller),
              ),
            )
          : _videos.isEmpty
              ? const Center(
                  child: Text(
                    'Aucune vidéo promotionnelle disponible',
                    style: TextStyle(color: Colors.white70, fontSize: 20),
                  ),
                )
              : const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
    );
  }
}
