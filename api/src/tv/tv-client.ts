/**
 * Client JS de la page TV (GET /tv/tv.js).
 * Consomme l'endpoint public GET /catalog/promo-videos (tableau de vidéos
 * actives triées par position puis createdAt — voir catalog.service.ts).
 * Défile en boucle sur toutes les vidéos actives (carrousel), comme le fait
 * app-tv (video_carousel_screen.dart) : passage à la suivante à la fin de
 * chaque vidéo, retour à la première après la dernière. La balise <video>
 * n'a volontairement PAS l'attribut "loop" (sinon l'événement "ended" ne se
 * déclencherait jamais et on resterait bloqué sur la même vidéo).
 *
 * Contrôles télécommande (voir spec sprint navigation TV) :
 *  - Gauche/Droite : vidéo précédente/suivante (bouclage), affiche l'overlay.
 *  - Overlay bas d'écran : Précédent / Lecture-Pause / Suivant / Playlist,
 *    focus visuel déplacé par Gauche/Droite, validé avec Entrée, masqué après
 *    5 s d'inactivité.
 *  - Haut (ou bouton Playlist) : ouvre le panneau de sélection de vidéo,
 *    navigation Haut/Bas, validation Entrée, fermeture avec Back/Escape ou
 *    après 10 s d'inactivité.
 * Compatible ES5/ES6 basique (moteur Chromium ancien de webOS) : pas de
 * template literals, pas d'optional chaining, event.keyCode en repli de
 * event.key.
 */
export const TV_CLIENT_JS = `(function () {
  var video = document.getElementById('video');
  var waiting = document.getElementById('waiting');
  var soundBtn = document.getElementById('sound-btn');
  var hint = document.getElementById('hint');
  var controls = document.getElementById('controls');
  var nowPlaying = document.getElementById('now-playing');
  var btnPrev = document.getElementById('btn-prev');
  var btnPlayPause = document.getElementById('btn-playpause');
  var btnNext = document.getElementById('btn-next');
  var btnPlaylist = document.getElementById('btn-playlist');
  var playlistPanel = document.getElementById('playlist-panel');
  var playlistList = document.getElementById('playlist-list');

  var buttons = [btnPrev, btnPlayPause, btnNext, btnPlaylist];

  var REFRESH_MS = 5 * 60 * 1000;
  var RETRY_MS = 60 * 1000;
  var CONTROLS_HIDE_MS = 5000;
  var PLAYLIST_HIDE_MS = 10000;
  var HINT_MS = 5000;

  var playlist = [];
  var currentIndex = -1;
  var retryTimer = null;

  var controlsVisible = false;
  var controlsHideTimer = null;
  var focusedButtonIndex = 1;

  var playlistOpen = false;
  var playlistFocusIndex = 0;
  var playlistHideTimer = null;

  function showWaiting() {
    waiting.style.display = 'flex';
    video.style.display = 'none';
  }

  function showVideoEl() {
    waiting.style.display = 'none';
    video.style.display = 'block';
  }

  function findIndexById(id) {
    for (var i = 0; i < playlist.length; i++) {
      if (playlist[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  function updateNowPlaying() {
    if (currentIndex < 0 || !playlist[currentIndex]) {
      nowPlaying.textContent = '';
      return;
    }
    nowPlaying.textContent =
      playlist[currentIndex].title + '  (' + (currentIndex + 1) + ' / ' + playlist.length + ')';
  }

  function updatePlayPauseLabel() {
    btnPlayPause.textContent = video.paused ? '\u25b6 Lecture' : '\u23f8 Pause';
  }

  function playIndex(index) {
    currentIndex = index;
    video.src = playlist[index].url;
    showVideoEl();
    video.play().catch(function (err) {
      console.error('Lecture vidéo impossible :', err);
    });
    updateNowPlaying();
    if (playlistOpen) {
      renderPlaylist();
    }
  }

  function playNext() {
    if (playlist.length === 0) {
      showWaiting();
      return;
    }
    playIndex((currentIndex + 1) % playlist.length);
  }

  function playPrev() {
    if (playlist.length === 0) {
      showWaiting();
      return;
    }
    playIndex((currentIndex - 1 + playlist.length) % playlist.length);
  }

  function togglePlayPause() {
    if (video.paused) {
      video.play().catch(function (err) {
        console.error('Lecture vidéo impossible :', err);
      });
    } else {
      video.pause();
    }
  }

  video.addEventListener('play', updatePlayPauseLabel);
  video.addEventListener('pause', updatePlayPauseLabel);
  video.addEventListener('ended', playNext);

  function scheduleNext(delay) {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    retryTimer = setTimeout(fetchPlaylist, delay);
  }

  function fetchPlaylist() {
    fetch('/catalog/promo-videos')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (videos) {
        if (!videos || videos.length === 0) {
          playlist = [];
          currentIndex = -1;
          showWaiting();
          updateNowPlaying();
          if (playlistOpen) {
            renderPlaylist();
          }
          scheduleNext(RETRY_MS);
          return;
        }
        var currentId =
          currentIndex >= 0 && playlist[currentIndex]
            ? playlist[currentIndex].id
            : null;
        playlist = videos;
        if (currentId === null) {
          playIndex(0);
        } else {
          var idx = findIndexById(currentId);
          if (idx === -1) {
            // La vidéo en cours de lecture n'est plus active, on change.
            playIndex(0);
          } else {
            // On garde la lecture en cours, juste la playlist est à jour.
            currentIndex = idx;
            updateNowPlaying();
            if (playlistOpen) {
              renderPlaylist();
            }
          }
        }
        scheduleNext(REFRESH_MS);
      })
      .catch(function (err) {
        console.error('Impossible de joindre le serveur ESOF :', err);
        showWaiting();
        scheduleNext(RETRY_MS);
      });
  }

  soundBtn.addEventListener('click', function () {
    video.muted = false;
    soundBtn.style.display = 'none';
  });

  // ------ Overlay de contrôle (barre du bas) ------

  function updateFocusVisual() {
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = i === focusedButtonIndex ? 'ctrl-btn focused' : 'ctrl-btn';
    }
  }

  function showControls() {
    if (!controlsVisible) {
      focusedButtonIndex = 1;
      updateFocusVisual();
    }
    controlsVisible = true;
    controls.className = 'visible';
    updatePlayPauseLabel();
    resetControlsTimer();
  }

  function hideControls() {
    controlsVisible = false;
    controls.className = '';
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
      controlsHideTimer = null;
    }
  }

  function resetControlsTimer() {
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
    }
    controlsHideTimer = setTimeout(hideControls, CONTROLS_HIDE_MS);
  }

  function activateFocusedButton() {
    if (focusedButtonIndex === 0) {
      playPrev();
    } else if (focusedButtonIndex === 1) {
      togglePlayPause();
    } else if (focusedButtonIndex === 2) {
      playNext();
    } else if (focusedButtonIndex === 3) {
      openPlaylistPanel();
    }
  }

  btnPrev.addEventListener('click', function () {
    playPrev();
    focusedButtonIndex = 0;
    updateFocusVisual();
    resetControlsTimer();
  });
  btnNext.addEventListener('click', function () {
    playNext();
    focusedButtonIndex = 2;
    updateFocusVisual();
    resetControlsTimer();
  });
  btnPlayPause.addEventListener('click', function () {
    togglePlayPause();
    focusedButtonIndex = 1;
    updateFocusVisual();
    resetControlsTimer();
  });
  btnPlaylist.addEventListener('click', function () {
    openPlaylistPanel();
  });

  // ------ Panneau playlist ------

  function renderPlaylist() {
    playlistList.innerHTML = '';
    for (var i = 0; i < playlist.length; i++) {
      var item = document.createElement('div');
      var classes = 'playlist-item';
      if (i === currentIndex) {
        classes += ' active';
      }
      if (i === playlistFocusIndex) {
        classes += ' focused';
      }
      item.className = classes;
      item.textContent = (i + 1) + '. ' + playlist[i].title;
      (function (index) {
        item.addEventListener('click', function () {
          playlistFocusIndex = index;
          selectPlaylistItem();
        });
      })(i);
      playlistList.appendChild(item);
    }
  }

  function scrollFocusedItemIntoView() {
    var item = playlistList.children[playlistFocusIndex];
    if (item && item.scrollIntoView) {
      item.scrollIntoView();
    }
  }

  function openPlaylistPanel() {
    if (playlist.length === 0) {
      return;
    }
    hideControls();
    playlistOpen = true;
    playlistFocusIndex = currentIndex >= 0 ? currentIndex : 0;
    renderPlaylist();
    playlistPanel.className = 'open';
    resetPlaylistTimer();
    scrollFocusedItemIntoView();
  }

  function closePlaylistPanel() {
    playlistOpen = false;
    playlistPanel.className = '';
    if (playlistHideTimer) {
      clearTimeout(playlistHideTimer);
      playlistHideTimer = null;
    }
    showControls();
  }

  function resetPlaylistTimer() {
    if (playlistHideTimer) {
      clearTimeout(playlistHideTimer);
    }
    playlistHideTimer = setTimeout(closePlaylistPanel, PLAYLIST_HIDE_MS);
  }

  function movePlaylistFocus(delta) {
    if (playlist.length === 0) {
      return;
    }
    playlistFocusIndex = (playlistFocusIndex + delta + playlist.length) % playlist.length;
    renderPlaylist();
    scrollFocusedItemIntoView();
    resetPlaylistTimer();
  }

  function selectPlaylistItem() {
    if (playlist[playlistFocusIndex]) {
      playIndex(playlistFocusIndex);
    }
    closePlaylistPanel();
  }

  // ------ Gestion clavier / télécommande ------

  var KEY_LEFT = 37;
  var KEY_UP = 38;
  var KEY_RIGHT = 39;
  var KEY_DOWN = 40;
  var KEY_ENTER = 13;
  var KEY_ESC = 27;
  var KEY_BACK_WEBOS = 461;

  function getKeyAction(e) {
    var code = e.keyCode || e.which || 0;
    var key = e.key;
    if (code === KEY_LEFT || key === 'ArrowLeft') {
      return 'left';
    }
    if (code === KEY_RIGHT || key === 'ArrowRight') {
      return 'right';
    }
    if (code === KEY_UP || key === 'ArrowUp') {
      return 'up';
    }
    if (code === KEY_DOWN || key === 'ArrowDown') {
      return 'down';
    }
    if (code === KEY_ENTER || key === 'Enter') {
      return 'enter';
    }
    if (code === KEY_BACK_WEBOS || code === KEY_ESC || key === 'Escape' || key === 'GoBack' || key === 'Back') {
      return 'back';
    }
    return null;
  }

  function handlePlaylistKey(action) {
    if (action === 'up') {
      movePlaylistFocus(-1);
    } else if (action === 'down') {
      movePlaylistFocus(1);
    } else if (action === 'enter') {
      selectPlaylistItem();
    } else if (action === 'back') {
      closePlaylistPanel();
    } else {
      resetPlaylistTimer();
    }
  }

  function handleControlsKey(action) {
    if (action === 'left') {
      playPrev();
      focusedButtonIndex = 0;
      updateFocusVisual();
      resetControlsTimer();
    } else if (action === 'right') {
      playNext();
      focusedButtonIndex = 2;
      updateFocusVisual();
      resetControlsTimer();
    } else if (action === 'up') {
      openPlaylistPanel();
    } else if (action === 'enter') {
      activateFocusedButton();
      resetControlsTimer();
    } else if (action === 'back') {
      hideControls();
    } else {
      resetControlsTimer();
    }
  }

  document.addEventListener('keydown', function (e) {
    // Laisse le bouton son gérer nativement sa propre touche Entrée.
    if (document.activeElement === soundBtn && (e.keyCode === KEY_ENTER || e.key === 'Enter')) {
      return;
    }
    var action = getKeyAction(e);
    if (playlistOpen) {
      if (action) {
        e.preventDefault();
      }
      handlePlaylistKey(action);
      return;
    }
    if (action) {
      e.preventDefault();
    }
    showControls();
    if (action) {
      handleControlsKey(action);
    }
  });

  document.addEventListener('click', function (e) {
    if (playlistOpen || e.target === soundBtn) {
      return;
    }
    showControls();
  });

  // ------ Rappel des touches au démarrage ------

  setTimeout(function () {
    hint.className = 'hidden';
  }, HINT_MS);

  fetchPlaylist();
})();
`;
