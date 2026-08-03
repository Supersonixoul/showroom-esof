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
 *  - Overlay bas d'écran : Précédent / Lecture-Pause / Suivant / Playlist /
 *    Catalogue, focus visuel déplacé par Gauche/Droite, validé avec Entrée,
 *    masqué après 5 s d'inactivité.
 *  - Haut (ou bouton Playlist) : ouvre le panneau de sélection de vidéo,
 *    navigation Haut/Bas, validation Entrée, fermeture avec Back/Escape ou
 *    après 10 s d'inactivité.
 *  - Bas (ou bouton Catalogue) : ouvre le mode « Catalogue produits »
 *    (catégories → produits → fiche détail), navigation 4 directions,
 *    validation Entrée, retour avec Back/Escape (à la racine : retour vidéo),
 *    et retour automatique à la vidéo après 3 min d'inactivité. La vidéo est
 *    mise en pause à l'entrée et reprise (pas redémarrée) à la sortie.
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
  var btnCatalog = document.getElementById('btn-catalog');
  var playlistPanel = document.getElementById('playlist-panel');
  var playlistList = document.getElementById('playlist-list');

  var catalogRoot = document.getElementById('catalog-root');
  var btnExitCatalog = document.getElementById('btn-exit-catalog');
  var catTitle = document.getElementById('cat-title');
  var catCategoriesScreen = document.getElementById('cat-categories-screen');
  var catCategoriesGrid = document.getElementById('cat-categories-grid');
  var catProductsScreen = document.getElementById('cat-products-screen');
  var catBackBtn = document.getElementById('cat-back-btn');
  var catSubChips = document.getElementById('cat-sub-chips');
  var catBrandChips = document.getElementById('cat-brand-chips');
  var catGammeChips = document.getElementById('cat-gamme-chips');
  var catProductsGrid = document.getElementById('cat-products-grid');
  var catEmpty = document.getElementById('cat-empty');
  var catPagination = document.getElementById('cat-pagination');
  var catDetailScreen = document.getElementById('cat-detail-screen');
  var catDetailBackBtn = document.getElementById('cat-detail-back-btn');
  var catDetailPhoto = document.getElementById('cat-detail-photo');
  var catDetailDots = document.getElementById('cat-detail-dots');
  var catDetailBrand = document.getElementById('cat-detail-brand');
  var catDetailName = document.getElementById('cat-detail-name');
  var catDetailCategory = document.getElementById('cat-detail-category');
  var catDetailRef = document.getElementById('cat-detail-ref');
  var catDetailAvailability = document.getElementById('cat-detail-availability');
  var catDetailDesc = document.getElementById('cat-detail-desc');
  var debugPanel = document.getElementById('debug-panel');

  // ------ Panneau de debug (activé via /tv?debug=1) ------
  // Placé tout en haut de l'IIFE pour capturer via window.onerror la moindre
  // exception JS qui surviendrait plus loin dans ce fichier (utile car la TV
  // n'a pas de console accessible). N'a aucun effet sans le paramètre
  // d'URL : le panneau reste display:none (voir CSS de tv-page.ts) et aucune
  // des fonctions ci-dessous n'écrit dedans.
  var DEBUG = /[?&]debug=1(&|$)/.test(window.location.search);
  var debugLastKeyCode = null;
  var debugErrorCount = 0;
  var debugLastError = '';

  function renderDebugPanel() {
    if (!DEBUG || !debugPanel) {
      return;
    }
    var lines = [
      'mode: ' + mode,
      'catalogScreen: ' + catalogScreen,
      'zone: ' + (catalogScreen === 'detail' && detailState ? detailState.zone : productsState ? productsState.zone : '-'),
      'playlistOpen: ' + playlistOpen,
      'controlsVisible: ' + controlsVisible,
      'currentIndex: ' + currentIndex + ' / ' + playlist.length,
      'lastKeyCode: ' + debugLastKeyCode,
      'errors (' + debugErrorCount + '): ' + debugLastError,
    ];
    debugPanel.textContent = lines.join('\\n');
  }

  function debugReportError(message) {
    if (!DEBUG) {
      return;
    }
    debugErrorCount++;
    debugLastError = String(message);
    renderDebugPanel();
  }

  if (DEBUG) {
    debugPanel.className = 'visible';
    window.onerror = function (message, source, lineno, colno) {
      debugReportError(message + ' @' + source + ':' + lineno + ':' + colno);
      return false;
    };
    window.addEventListener('unhandledrejection', function (ev) {
      var reason = ev && ev.reason ? (ev.reason.message || ev.reason) : 'inconnue';
      debugReportError('promesse rejetée : ' + reason);
    });
    // Le premier rendu réel est fait plus bas (juste avant fetchPlaylist),
    // une fois toutes les variables d'état (playlist, mode, catalogScreen…)
    // effectivement initialisées : les lire ici les référencerait avant
    // leur "var" d'initialisation (encore "undefined" via le hoisting),
    // ce qui ferait planter ce bloc (ex. playlist.length sur "undefined")
    // et empêcherait, en mode debug (?debug=1), tout le reste du script de
    // s'exécuter (aucun listener clavier attaché) — d'où ce premier appel
    // différé.
  }

  var buttons = [btnPrev, btnPlayPause, btnNext, btnPlaylist, btnCatalog];

  var REFRESH_MS = 5 * 60 * 1000;
  var RETRY_MS = 60 * 1000;
  var CONTROLS_HIDE_MS = 5000;
  var PLAYLIST_HIDE_MS = 10000;
  var HINT_MS = 5000;
  var CATALOG_INACTIVITY_MS = 3 * 60 * 1000;
  var CATALOG_GRID_COLS = 4;

  var playlist = [];
  var currentIndex = -1;
  var retryTimer = null;

  var controlsVisible = false;
  var controlsHideTimer = null;
  var focusedButtonIndex = 1;

  var playlistOpen = false;
  var playlistFocusIndex = 0;
  var playlistHideTimer = null;

  // ------ État du mode « Catalogue produits » ------

  var mode = 'video';
  var catalogScreen = 'categories';
  var catalogInactivityTimer = null;
  var categories = [];
  var categoryFocusIndex = 0;
  var productsState = null;
  var detailState = null;

  var PLACEHOLDER_IMG =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
        '<rect width="400" height="400" fill="#222"/>' +
        '<text x="50%" y="50%" font-size="26" fill="#888" text-anchor="middle" ' +
        'dominant-baseline="middle" font-family="Arial">Pas de photo</text></svg>',
    );

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

  function scheduledTick() {
    if (mode === 'catalog') {
      // Reporte le rafraîchissement de la playlist tant que le kiosque est
      // en mode Catalogue — évite d'interrompre la navigation en cours.
      scheduleNext(REFRESH_MS);
      return;
    }
    fetchPlaylist();
  }

  function scheduleNext(delay) {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    retryTimer = setTimeout(scheduledTick, delay);
  }

  function fetchPlaylist() {
    try {
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
    } catch (err) {
      // Erreur synchrone (ex. fetch() indisponible sur ce moteur) : la
      // lecture vidéo ne doit jamais rester bloquée pour autant.
      console.error('fetchPlaylist a échoué de façon synchrone :', err);
      debugReportError('fetchPlaylist: ' + err);
      showWaiting();
      scheduleNext(RETRY_MS);
    }
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
    } else if (focusedButtonIndex === 4) {
      enterCatalogMode();
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
  btnCatalog.addEventListener('click', function () {
    enterCatalogMode();
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

  // ------ Mode « Catalogue produits » ------

  function colorForName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    var hue = Math.abs(hash) % 360;
    return 'hsl(' + hue + ', 62%, 55%)';
  }

  function setImageWithFallback(imgEl, url) {
    // Affectation en propriété DOM (pas d'attribut onerror inline) : le CSP
    // par défaut de helmet (script-src 'self') bloquerait un gestionnaire
    // inline dans le HTML.
    imgEl.onerror = function () {
      imgEl.onerror = null;
      imgEl.src = PLACEHOLDER_IMG;
    };
    imgEl.src = url || PLACEHOLDER_IMG;
  }

  // Le prix n'est jamais exposé par l'API publique (voir catalog.service.ts
  // \`toPublicProduct\`) : seul un badge de disponibilité est affiché, avec la
  // quantité exacte en plus si le produit a \`afficherQuantite = true\`.
  function formatAvailabilityLabel(p) {
    if (p.disponible) {
      if (p.quantiteStock !== undefined && p.quantiteStock !== null) {
        return { text: 'Disponible (' + p.quantiteStock + ')', available: true };
      }
      return { text: 'Disponible', available: true };
    }
    return { text: 'Épuisé', available: false };
  }

  /**
   * Déplace un focus dans une grille de \`total\` cases sur \`cols\` colonnes.
   * Renvoie le même index si le déplacement franchirait un bord de la
   * grille dans la direction \`dir\` — l'appelant détecte alors le bord pour
   * déclencher un changement de page ou de zone (ex. chips de marque).
   */
  function gridMove(index, cols, total, dir) {
    var row = Math.floor(index / cols);
    var col = index % cols;
    if (dir === 'left') {
      if (col === 0) {
        return index;
      }
      return index - 1;
    }
    if (dir === 'right') {
      if (col === cols - 1 || index === total - 1) {
        return index;
      }
      return index + 1;
    }
    if (dir === 'up') {
      if (row === 0) {
        return index;
      }
      return index - cols;
    }
    if (dir === 'down') {
      var next = index + cols;
      if (next >= total) {
        return index;
      }
      return next;
    }
    return index;
  }

  function enterCatalogMode() {
    if (mode === 'catalog') {
      return;
    }
    mode = 'catalog';
    hideControls();
    video.pause();
    catalogRoot.className = 'visible';
    resetCatalogInactivityTimer();
    showCatalogScreen('categories');
    if (categories.length === 0) {
      fetchCategories();
    } else {
      renderCategories();
    }
  }

  function exitCatalogMode() {
    if (mode !== 'catalog') {
      return;
    }
    mode = 'video';
    catalogRoot.className = '';
    clearCatalogInactivityTimer();
    // Reprend la vidéo là où elle en était, sans la redémarrer.
    video.play().catch(function (err) {
      console.error('Lecture vidéo impossible :', err);
    });
  }

  function resetCatalogInactivityTimer() {
    if (catalogInactivityTimer) {
      clearTimeout(catalogInactivityTimer);
    }
    catalogInactivityTimer = setTimeout(exitCatalogMode, CATALOG_INACTIVITY_MS);
  }

  function clearCatalogInactivityTimer() {
    if (catalogInactivityTimer) {
      clearTimeout(catalogInactivityTimer);
      catalogInactivityTimer = null;
    }
  }

  function showCatalogScreen(name) {
    catalogScreen = name;
    catCategoriesScreen.className = name === 'categories' ? 'cat-screen active' : 'cat-screen';
    catProductsScreen.className = name === 'products' ? 'cat-screen active' : 'cat-screen';
    catDetailScreen.className = name === 'detail' ? 'cat-screen active' : 'cat-screen';
    if (name !== 'detail') {
      // Le bouton « Vidéos » est partagé par les 3 écrans catalogue ; sa
      // mise en focus ne concerne que la navigation D-pad de la fiche
      // article (voir handleDetailKey) — on nettoie donc son surlignage
      // dès qu'on quitte cet écran, pour ne pas le laisser « focused »
      // sur les écrans catégories/produits qui ne gèrent pas cette zone.
      btnExitCatalog.className = 'ctrl-btn';
    }
    if (name === 'categories') {
      catTitle.textContent = 'Catalogue produits';
    } else if (name === 'products' && productsState) {
      catTitle.textContent = productsState.categoryName;
    }
    // Pour 'detail', le titre est déjà positionné par renderDetail().
  }

  // ---- Écran catégories ----

  function fetchCategories() {
    try {
      fetch('/catalog/categories')
        .then(function (res) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          categories = data;
          categoryFocusIndex = 0;
          renderCategories();
        })
        .catch(function (err) {
          console.error('Impossible de charger les catégories :', err);
          debugReportError('fetchCategories: ' + err);
        });
    } catch (err) {
      // Un échec du catalogue ne doit jamais empêcher le retour au mode
      // vidéo (Back reste actif) ni casser les contrôles vidéo.
      console.error('fetchCategories a échoué de façon synchrone :', err);
      debugReportError('fetchCategories: ' + err);
    }
  }

  function renderCategories() {
    catCategoriesGrid.innerHTML = '';
    for (var i = 0; i < categories.length; i++) {
      (function (i) {
        var cat = categories[i];
        var card = document.createElement('div');
        var classes = 'category-card';
        if (cat.productCount === 0) {
          classes += ' empty';
        }
        if (i === categoryFocusIndex) {
          classes += ' focused';
        }
        card.className = classes;

        var icon;
        if (cat.imageUrl) {
          icon = document.createElement('img');
          icon.className = 'cat-photo';
          setImageWithFallback(icon, cat.imageUrl);
        } else {
          icon = document.createElement('div');
          icon.className = 'cat-icon';
          icon.style.background = colorForName(cat.name);
          icon.textContent = cat.name.charAt(0).toUpperCase();
        }

        var photoWrap = document.createElement('div');
        photoWrap.className = 'cat-photo-wrap';
        photoWrap.appendChild(icon);

        var label = document.createElement('div');
        label.className = 'cat-label';

        var name = document.createElement('span');
        name.className = 'cat-name';
        name.textContent = cat.name;

        var count = document.createElement('span');
        count.className = 'cat-count';
        count.textContent = '(' + cat.productCount + ')';

        label.appendChild(name);
        label.appendChild(count);

        card.appendChild(photoWrap);
        card.appendChild(label);
        card.addEventListener('click', function () {
          categoryFocusIndex = i;
          renderCategories();
          openCategory(cat);
        });
        catCategoriesGrid.appendChild(card);
      })(i);
    }
  }

  function moveCategoryFocus(dir) {
    if (categories.length === 0) {
      return;
    }
    var next = gridMove(categoryFocusIndex, CATALOG_GRID_COLS, categories.length, dir);
    if (next !== categoryFocusIndex) {
      categoryFocusIndex = next;
      renderCategories();
    }
  }

  function openCategory(cat) {
    productsState = {
      categoryId: cat.id,
      categoryName: cat.name,
      brandId: null,
      brands: [],
      subcategories: cat.subcategories || [],
      subcategoryId: null,
      gammes: [],
      gammeId: null,
      items: [],
      page: 1,
      pageSize: 8,
      totalPages: 1,
      focusIndex: 0,
      chipsFocusIndex: 0,
      subChipsFocusIndex: 0,
      gammeChipsFocusIndex: 0,
      zone: 'grid',
      pendingFocus: null,
    };
    showCatalogScreen('products');
    renderBackButton();
    fetchProducts();
  }

  // Le bouton « ← Retour » vit tout en haut de la chaîne de navigation
  // Haut/Bas des filtres (au-dessus de subChips/chips/gammeChips), et
  // représente aussi le point d'arrivée de la touche BACK une fois revenu
  // à la grille produits (voir handleProductsKey).
  function renderBackButton() {
    catBackBtn.className =
      productsState && productsState.zone === 'back' ? 'cat-back-btn focused' : 'cat-back-btn';
  }

  // Retour à l'écran catégories : la grille catégories n'a jamais été
  // détruite (juste masquée par showCatalogScreen), et categoryFocusIndex
  // n'a pas changé depuis l'ouverture de la catégorie — le focus et le
  // défilement sont donc déjà cohérents, sans re-rendu ni rechargement.
  function goBackToCategories() {
    showCatalogScreen('categories');
  }

  // ---- Écran produits ----

  function fetchProducts() {
    var url =
      '/catalog/products?categoryId=' + encodeURIComponent(productsState.categoryId) +
      '&page=' + productsState.page + '&pageSize=' + productsState.pageSize;
    if (productsState.brandId) {
      url += '&brandId=' + encodeURIComponent(productsState.brandId);
    }
    if (productsState.subcategoryId) {
      url += '&subcategoryId=' + encodeURIComponent(productsState.subcategoryId);
    }
    if (productsState.gammeId) {
      url += '&gammeId=' + encodeURIComponent(productsState.gammeId);
    }
    try {
      fetch(url)
        .then(function (res) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          productsState.items = data.items;
          productsState.totalPages = data.totalPages;
          productsState.brands = data.brands;
          productsState.gammes = data.gammes;
          if (productsState.pendingFocus === 'last') {
            productsState.focusIndex = Math.max(0, productsState.items.length - 1);
          } else if (productsState.pendingFocus === 'first') {
            productsState.focusIndex = 0;
          }
          productsState.pendingFocus = null;
          renderSubChips();
          renderBrandChips();
          renderGammeChips();
          renderBackButton();
          renderProducts();
          renderPagination();
        })
        .catch(function (err) {
          console.error('Impossible de charger les produits :', err);
          debugReportError('fetchProducts: ' + err);
        });
    } catch (err) {
      console.error('fetchProducts a échoué de façon synchrone :', err);
      debugReportError('fetchProducts: ' + err);
    }
  }

  function makeChip(label, brandId, index) {
    var chip = document.createElement('div');
    var classes = 'chip';
    if (productsState.brandId === brandId) {
      classes += ' active';
    }
    if (productsState.zone === 'chips' && index === productsState.chipsFocusIndex) {
      classes += ' focused';
    }
    chip.className = classes;
    chip.textContent = label;
    chip.addEventListener('click', function () {
      productsState.chipsFocusIndex = index;
      selectBrandChip(brandId);
    });
    return chip;
  }

  function renderBrandChips() {
    catBrandChips.innerHTML = '';
    catBrandChips.appendChild(makeChip('Toutes', null, 0));
    for (var i = 0; i < productsState.brands.length; i++) {
      var b = productsState.brands[i];
      catBrandChips.appendChild(makeChip(b.name, b.id, i + 1));
    }
  }

  function selectBrandChip(brandId) {
    productsState.brandId = brandId;
    // Les gammes sont propres à une marque : on réinitialise le filtre
    // gamme dès qu'on change de marque (sinon un gammeId d'une autre
    // marque resterait actif silencieusement côté API).
    productsState.gammeId = null;
    productsState.gammeChipsFocusIndex = 0;
    productsState.page = 1;
    productsState.focusIndex = 0;
    fetchProducts();
  }

  // Ligne de puces "Sous-catégorie" — n'existe que si la catégorie ouverte en
  // possède (récupérées avec la liste des catégories, pas d'appel réseau
  // supplémentaire). "Toutes" (index 0, subcategoryId=null) inclut aussi les
  // produits sans sous-catégorie, puisque le filtre est alors simplement omis
  // côté API (voir catalog.service.ts getCatalogProducts).
  function makeSubChip(label, subcategoryId, index, imageUrl) {
    var chip = document.createElement('div');
    var classes = 'chip';
    if (productsState.subcategoryId === subcategoryId) {
      classes += ' active';
    }
    if (productsState.zone === 'subChips' && index === productsState.subChipsFocusIndex) {
      classes += ' focused';
    }
    chip.className = classes;
    if (imageUrl) {
      var thumb = document.createElement('img');
      thumb.className = 'chip-thumb';
      setImageWithFallback(thumb, imageUrl);
      chip.appendChild(thumb);
    }
    chip.appendChild(document.createTextNode(label));
    chip.addEventListener('click', function () {
      productsState.subChipsFocusIndex = index;
      selectSubChip(subcategoryId);
    });
    return chip;
  }

  function renderSubChips() {
    catSubChips.innerHTML = '';
    if (!productsState.subcategories || productsState.subcategories.length === 0) {
      catSubChips.className = 'empty';
      return;
    }
    catSubChips.className = '';
    catSubChips.appendChild(makeSubChip('Toutes', null, 0, null));
    for (var i = 0; i < productsState.subcategories.length; i++) {
      var s = productsState.subcategories[i];
      catSubChips.appendChild(makeSubChip(s.name, s.id, i + 1, s.imageUrl));
    }
  }

  function selectSubChip(subcategoryId) {
    productsState.subcategoryId = subcategoryId;
    productsState.page = 1;
    productsState.focusIndex = 0;
    fetchProducts();
  }

  // Ligne de puces "Gamme" — n'existe que si une marque est sélectionnée
  // (une gamme appartient toujours à une marque, voir catalog.service.ts
  // getCatalogProducts) et que cette marque a des gammes dans la catégorie.
  function makeGammeChip(label, gammeId, index, imageUrl) {
    var chip = document.createElement('div');
    var classes = 'chip';
    if (productsState.gammeId === gammeId) {
      classes += ' active';
    }
    if (productsState.zone === 'gammeChips' && index === productsState.gammeChipsFocusIndex) {
      classes += ' focused';
    }
    chip.className = classes;
    if (imageUrl) {
      var thumb = document.createElement('img');
      thumb.className = 'chip-thumb';
      setImageWithFallback(thumb, imageUrl);
      chip.appendChild(thumb);
    }
    chip.appendChild(document.createTextNode(label));
    chip.addEventListener('click', function () {
      productsState.gammeChipsFocusIndex = index;
      selectGammeChip(gammeId);
    });
    return chip;
  }

  function renderGammeChips() {
    catGammeChips.innerHTML = '';
    if (!productsState.gammes || productsState.gammes.length === 0) {
      catGammeChips.className = 'empty';
      return;
    }
    catGammeChips.className = '';
    catGammeChips.appendChild(makeGammeChip('Toutes', null, 0, null));
    for (var i = 0; i < productsState.gammes.length; i++) {
      var g = productsState.gammes[i];
      catGammeChips.appendChild(makeGammeChip(g.name, g.id, i + 1, g.imageUrl));
    }
  }

  function selectGammeChip(gammeId) {
    productsState.gammeId = gammeId;
    productsState.page = 1;
    productsState.focusIndex = 0;
    fetchProducts();
  }

  function renderProducts() {
    catProductsGrid.innerHTML = '';
    var items = productsState.items;
    catEmpty.className = items.length === 0 ? 'cat-empty visible' : 'cat-empty';
    for (var i = 0; i < items.length; i++) {
      (function (i) {
        var p = items[i];
        var card = document.createElement('div');
        var classes = 'product-card';
        if (productsState.zone === 'grid' && i === productsState.focusIndex) {
          classes += ' focused';
        }
        card.className = classes;

        var photoWrap = document.createElement('div');
        photoWrap.className = 'prod-photo-wrap';
        var img = document.createElement('img');
        // Variante "full" (1600px) systématique côté TV : écran 1080p, rendu net.
        setImageWithFallback(img, p.imageVariants ? p.imageVariants.full : null);
        photoWrap.appendChild(img);

        var info = document.createElement('div');
        info.className = 'prod-info';
        var name = document.createElement('div');
        name.className = 'prod-name';
        name.textContent = p.name;
        var brand = document.createElement('div');
        brand.className = 'prod-brand';
        brand.textContent = p.brand || '';
        var availability = document.createElement('div');
        var availabilityInfo = formatAvailabilityLabel(p);
        availability.className =
          'prod-availability ' + (availabilityInfo.available ? 'available' : 'unavailable');
        availability.textContent = availabilityInfo.text;
        info.appendChild(name);
        info.appendChild(brand);
        info.appendChild(availability);

        card.appendChild(photoWrap);
        card.appendChild(info);
        card.addEventListener('click', function () {
          productsState.zone = 'grid';
          productsState.focusIndex = i;
          openProductDetail(i);
        });
        catProductsGrid.appendChild(card);
        // Carré fixé en pixels une fois la carte insérée dans le DOM (et non
        // via CSS aspect-ratio/padding-top en %) : avec grid-auto-rows:auto,
        // les navigateurs calculent mal la hauteur de ligne quand un enfant
        // flex dépend d'un pourcentage pour sa propre hauteur, ce qui
        // provoquait un chevauchement massif entre les lignes de la grille.
        photoWrap.style.height = photoWrap.offsetWidth + 'px';
      })(i);
    }
  }

  function renderPagination() {
    catPagination.textContent = 'Page ' + productsState.page + ' / ' + productsState.totalPages;
  }

  function goToPage(newPage, focusHint) {
    if (newPage < 1 || newPage > productsState.totalPages || newPage === productsState.page) {
      return;
    }
    productsState.page = newPage;
    productsState.pendingFocus = focusHint;
    fetchProducts();
  }

  function handleChipsKey(action) {
    var total = productsState.brands.length + 1;
    if (action === 'left') {
      if (productsState.chipsFocusIndex > 0) {
        productsState.chipsFocusIndex--;
        renderBrandChips();
      }
    } else if (action === 'right') {
      if (productsState.chipsFocusIndex < total - 1) {
        productsState.chipsFocusIndex++;
        renderBrandChips();
      }
    } else if (action === 'up') {
      if (productsState.subcategories && productsState.subcategories.length > 0) {
        productsState.zone = 'subChips';
        renderSubChips();
        renderBrandChips();
      } else {
        productsState.zone = 'back';
        renderBrandChips();
        renderBackButton();
      }
    } else if (action === 'down') {
      productsState.zone = productsState.gammes.length > 0 ? 'gammeChips' : 'grid';
      renderBrandChips();
      renderGammeChips();
      renderProducts();
    } else if (action === 'enter') {
      var brandId =
        productsState.chipsFocusIndex === 0
          ? null
          : productsState.brands[productsState.chipsFocusIndex - 1].id;
      selectBrandChip(brandId);
    }
  }

  function handleGammeChipsKey(action) {
    var total = productsState.gammes.length + 1;
    if (action === 'left') {
      if (productsState.gammeChipsFocusIndex > 0) {
        productsState.gammeChipsFocusIndex--;
        renderGammeChips();
      }
    } else if (action === 'right') {
      if (productsState.gammeChipsFocusIndex < total - 1) {
        productsState.gammeChipsFocusIndex++;
        renderGammeChips();
      }
    } else if (action === 'up') {
      productsState.zone = 'chips';
      renderGammeChips();
      renderBrandChips();
    } else if (action === 'down') {
      productsState.zone = 'grid';
      renderGammeChips();
      renderProducts();
    } else if (action === 'enter') {
      var gammeId =
        productsState.gammeChipsFocusIndex === 0
          ? null
          : productsState.gammes[productsState.gammeChipsFocusIndex - 1].id;
      selectGammeChip(gammeId);
    }
  }

  function handleSubChipsKey(action) {
    var total = productsState.subcategories.length + 1;
    if (action === 'left') {
      if (productsState.subChipsFocusIndex > 0) {
        productsState.subChipsFocusIndex--;
        renderSubChips();
      }
    } else if (action === 'right') {
      if (productsState.subChipsFocusIndex < total - 1) {
        productsState.subChipsFocusIndex++;
        renderSubChips();
      }
    } else if (action === 'up') {
      productsState.zone = 'back';
      renderSubChips();
      renderBackButton();
    } else if (action === 'down') {
      productsState.zone = productsState.brands.length > 0 ? 'chips' : 'grid';
      renderSubChips();
      renderBrandChips();
      renderProducts();
    } else if (action === 'enter') {
      var subcategoryId =
        productsState.subChipsFocusIndex === 0
          ? null
          : productsState.subcategories[productsState.subChipsFocusIndex - 1].id;
      selectSubChip(subcategoryId);
    }
  }

  function handleProductsGridKey(action) {
    var items = productsState.items;
    if (items.length === 0) {
      if (action === 'up') {
        if (productsState.gammes.length > 0) {
          productsState.zone = 'gammeChips';
          renderGammeChips();
        } else if (productsState.brands.length > 0) {
          productsState.zone = 'chips';
          renderBrandChips();
        } else if (productsState.subcategories && productsState.subcategories.length > 0) {
          productsState.zone = 'subChips';
          renderSubChips();
        } else {
          productsState.zone = 'back';
          renderBackButton();
        }
      }
      return;
    }
    if (action === 'enter') {
      openProductDetail(productsState.focusIndex);
      return;
    }
    if (action === 'up' && Math.floor(productsState.focusIndex / CATALOG_GRID_COLS) === 0) {
      if (productsState.gammes.length > 0) {
        productsState.zone = 'gammeChips';
        renderGammeChips();
        renderProducts();
      } else if (productsState.brands.length > 0) {
        productsState.zone = 'chips';
        renderBrandChips();
        renderProducts();
      } else if (productsState.subcategories && productsState.subcategories.length > 0) {
        productsState.zone = 'subChips';
        renderSubChips();
        renderProducts();
      } else {
        productsState.zone = 'back';
        renderBackButton();
        renderProducts();
      }
      return;
    }
    if (action === 'left' && productsState.focusIndex % CATALOG_GRID_COLS === 0 && productsState.page > 1) {
      goToPage(productsState.page - 1, 'last');
      return;
    }
    if (action === 'right') {
      var isLast = productsState.focusIndex === items.length - 1;
      var atRightEdge = productsState.focusIndex % CATALOG_GRID_COLS === CATALOG_GRID_COLS - 1;
      if ((atRightEdge || isLast) && productsState.page < productsState.totalPages) {
        goToPage(productsState.page + 1, 'first');
        return;
      }
    }
    var next = gridMove(productsState.focusIndex, CATALOG_GRID_COLS, items.length, action);
    if (next !== productsState.focusIndex) {
      productsState.focusIndex = next;
      renderProducts();
    }
  }

  // Point d'entrée de la zone « back » (bouton visible « ← Retour »),
  // au sommet de la chaîne de navigation Haut/Bas des filtres.
  function handleBackZoneKey(action) {
    if (action === 'enter') {
      goBackToCategories();
    } else if (action === 'down') {
      if (productsState.subcategories && productsState.subcategories.length > 0) {
        productsState.zone = 'subChips';
      } else if (productsState.brands.length > 0) {
        productsState.zone = 'chips';
      } else if (productsState.gammes.length > 0) {
        productsState.zone = 'gammeChips';
      } else {
        productsState.zone = 'grid';
      }
      renderBackButton();
      renderSubChips();
      renderBrandChips();
      renderGammeChips();
      renderProducts();
    }
  }

  function handleProductsKey(action) {
    if (action === 'back') {
      // Remonte d'un seul niveau à la fois : depuis un filtre (marque,
      // sous-catégorie, gamme), on revient d'abord à la grille produits ;
      // depuis la grille (ou le bouton Retour), on quitte vers les
      // catégories. Cohérent avec le bouton « ← Retour » visible à l'écran.
      if (productsState.zone === 'grid' || productsState.zone === 'back') {
        goBackToCategories();
      } else {
        productsState.zone = 'grid';
        renderSubChips();
        renderBrandChips();
        renderGammeChips();
        renderBackButton();
        renderProducts();
      }
      return;
    }
    if (productsState.zone === 'back') {
      handleBackZoneKey(action);
    } else if (productsState.zone === 'chips') {
      handleChipsKey(action);
    } else if (productsState.zone === 'gammeChips') {
      handleGammeChipsKey(action);
    } else if (productsState.zone === 'subChips') {
      handleSubChipsKey(action);
    } else {
      handleProductsGridKey(action);
    }
  }

  // ---- Écran fiche produit ----

  function openProductDetail(index) {
    var p = productsState.items[index];
    if (!p) {
      return;
    }
    productsState.focusIndex = index;
    try {
      fetch('/catalog/products/' + p.id)
        .then(function (res) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          detailState = { product: data, imageIndex: 0, imageCount: 0, zone: 'photo' };
          renderDetail();
          renderDetailNav();
          showCatalogScreen('detail');
        })
        .catch(function (err) {
          console.error('Impossible de charger le produit :', err);
          debugReportError('openProductDetail: ' + err);
        });
    } catch (err) {
      console.error('openProductDetail a échoué de façon synchrone :', err);
      debugReportError('openProductDetail: ' + err);
    }
  }

  function renderDetail() {
    var p = detailState.product;
    catTitle.textContent = p.name;
    catDetailBrand.textContent = p.brand ? p.brand.name : '';
    catDetailName.textContent = p.name;
    catDetailCategory.textContent = p.category.name;
    if (p.reference) {
      catDetailRef.textContent = 'Réf.\u00A0: ' + p.reference;
      catDetailRef.style.display = '';
    } else {
      catDetailRef.textContent = '';
      catDetailRef.style.display = 'none';
    }
    var detailAvailability = formatAvailabilityLabel(p);
    catDetailAvailability.textContent = detailAvailability.text;
    catDetailAvailability.className =
      detailAvailability.available ? 'available' : 'unavailable';
    catDetailDesc.textContent = p.description || '';

    var images = p.images || [];
    detailState.imageCount = images.length;
    var currentImage = images[detailState.imageIndex];
    setImageWithFallback(catDetailPhoto, currentImage ? currentImage.full : null);

    catDetailDots.innerHTML = '';
    if (images.length > 1) {
      for (var i = 0; i < images.length; i++) {
        var dot = document.createElement('div');
        dot.className = i === detailState.imageIndex ? 'detail-dot active' : 'detail-dot';
        catDetailDots.appendChild(dot);
      }
    }
  }

  function moveDetailImage(dir) {
    var count = detailState.imageCount;
    if (count <= 1) {
      return;
    }
    if (dir === 'left') {
      detailState.imageIndex = (detailState.imageIndex - 1 + count) % count;
    } else {
      detailState.imageIndex = (detailState.imageIndex + 1) % count;
    }
    renderDetail();
  }

  // Rangée de navigation en haut de la fiche : « ← Retour » (nouveau,
  // toujours à gauche) et « Vidéos » (bouton partagé du topbar, réutilisé
  // tel quel — son action reste exitCatalogMode(), inchangée).
  function renderDetailNav() {
    catDetailBackBtn.className =
      detailState && detailState.zone === 'back' ? 'cat-back-btn cat-detail-back-btn focused' : 'cat-back-btn cat-detail-back-btn';
    btnExitCatalog.className = detailState && detailState.zone === 'videos' ? 'ctrl-btn focused' : 'ctrl-btn';
  }

  // Retour à l'écran produits depuis la fiche : la grille produits n'a
  // jamais été détruite (juste masquée par showCatalogScreen), donc le
  // focus/scroll y sont déjà cohérents, sans re-rendu ni rechargement.
  function goBackToProducts() {
    showCatalogScreen('products');
  }

  function handleDetailKey(action) {
    if (action === 'back') {
      if (detailState.zone === 'videos') {
        // Un niveau à la fois : depuis le bouton Vidéos, BACK revient
        // d'abord dans la fiche (zone photo) avant de quitter vers la liste.
        detailState.zone = 'photo';
        renderDetailNav();
        return;
      }
      goBackToProducts();
      return;
    }
    if (detailState.zone === 'photo') {
      if (action === 'left') {
        moveDetailImage('left');
      } else if (action === 'right') {
        moveDetailImage('right');
      } else if (action === 'up') {
        detailState.zone = 'back';
        renderDetailNav();
      }
      return;
    }
    // zone 'back' ou 'videos' : rangée de boutons en haut de la fiche.
    if (action === 'left') {
      detailState.zone = 'back';
      renderDetailNav();
    } else if (action === 'right') {
      detailState.zone = 'videos';
      renderDetailNav();
    } else if (action === 'down') {
      detailState.zone = 'photo';
      renderDetailNav();
    } else if (action === 'enter') {
      if (detailState.zone === 'back') {
        goBackToProducts();
      } else {
        exitCatalogMode();
      }
    }
  }

  // ---- Répartiteur clavier du mode Catalogue ----

  function handleCatalogKey(action) {
    if (!action) {
      return;
    }
    resetCatalogInactivityTimer();
    if (action === 'back' && catalogScreen === 'categories') {
      exitCatalogMode();
      return;
    }
    if (catalogScreen === 'categories') {
      if (action === 'enter') {
        if (categories[categoryFocusIndex]) {
          openCategory(categories[categoryFocusIndex]);
        }
      } else {
        moveCategoryFocus(action);
      }
    } else if (catalogScreen === 'products') {
      handleProductsKey(action);
    } else if (catalogScreen === 'detail') {
      handleDetailKey(action);
    }
  }

  btnExitCatalog.addEventListener('click', function () {
    exitCatalogMode();
  });

  catBackBtn.addEventListener('click', function () {
    goBackToCategories();
  });

  catDetailBackBtn.addEventListener('click', function () {
    goBackToProducts();
  });

  catalogRoot.addEventListener('click', function () {
    if (mode === 'catalog') {
      resetCatalogInactivityTimer();
    }
  });

  // ------ Gestion clavier / télécommande ------

  var KEY_LEFT = 37;
  var KEY_UP = 38;
  var KEY_RIGHT = 39;
  var KEY_DOWN = 40;
  var KEY_ENTER = 13;
  var KEY_ESC = 27;
  var KEY_BACKSPACE = 8;
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
    if (
      code === KEY_BACK_WEBOS ||
      code === KEY_ESC ||
      code === KEY_BACKSPACE ||
      key === 'Escape' ||
      key === 'GoBack' ||
      key === 'Back' ||
      key === 'Backspace'
    ) {
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
    } else if (action === 'down') {
      enterCatalogMode();
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
    if (DEBUG) {
      debugLastKeyCode = e.keyCode || e.which || 0;
    }
    // Laisse le bouton son gérer nativement sa propre touche Entrée.
    if (document.activeElement === soundBtn && (e.keyCode === KEY_ENTER || e.key === 'Enter')) {
      if (DEBUG) {
        renderDebugPanel();
      }
      return;
    }
    var action = getKeyAction(e);
    if (mode === 'catalog') {
      if (action) {
        e.preventDefault();
      }
      handleCatalogKey(action);
      if (DEBUG) {
        renderDebugPanel();
      }
      return;
    }
    if (playlistOpen) {
      if (action) {
        e.preventDefault();
      }
      handlePlaylistKey(action);
      if (DEBUG) {
        renderDebugPanel();
      }
      return;
    }
    if (action) {
      e.preventDefault();
    }
    showControls();
    if (action) {
      handleControlsKey(action);
    }
    if (DEBUG) {
      renderDebugPanel();
    }
  });

  document.addEventListener('click', function (e) {
    if (mode === 'catalog' || playlistOpen || e.target === soundBtn) {
      return;
    }
    showControls();
  });

  // ------ Rappel des touches au démarrage ------

  setTimeout(function () {
    hint.className = 'hidden';
  }, HINT_MS);

  renderDebugPanel();
  fetchPlaylist();
})();
`;
