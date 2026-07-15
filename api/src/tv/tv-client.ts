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
  var catSubChips = document.getElementById('cat-sub-chips');
  var catBrandChips = document.getElementById('cat-brand-chips');
  var catProductsGrid = document.getElementById('cat-products-grid');
  var catEmpty = document.getElementById('cat-empty');
  var catPagination = document.getElementById('cat-pagination');
  var catDetailScreen = document.getElementById('cat-detail-screen');
  var catDetailPhoto = document.getElementById('cat-detail-photo');
  var catDetailDots = document.getElementById('cat-detail-dots');
  var catDetailBrand = document.getElementById('cat-detail-brand');
  var catDetailName = document.getElementById('cat-detail-name');
  var catDetailCategory = document.getElementById('cat-detail-category');
  var catDetailRef = document.getElementById('cat-detail-ref');
  var catDetailPrice = document.getElementById('cat-detail-price');
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
    renderDebugPanel();
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

        var name = document.createElement('div');
        name.className = 'cat-name';
        name.textContent = cat.name;

        var count = document.createElement('div');
        count.className = 'cat-count';
        count.textContent = cat.productCount + (cat.productCount === 1 ? ' produit' : ' produits');

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(count);
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
      items: [],
      page: 1,
      pageSize: 8,
      totalPages: 1,
      focusIndex: 0,
      chipsFocusIndex: 0,
      subChipsFocusIndex: 0,
      zone: 'grid',
      pendingFocus: null,
    };
    showCatalogScreen('products');
    fetchProducts();
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
          if (productsState.pendingFocus === 'last') {
            productsState.focusIndex = Math.max(0, productsState.items.length - 1);
          } else if (productsState.pendingFocus === 'first') {
            productsState.focusIndex = 0;
          }
          productsState.pendingFocus = null;
          renderSubChips();
          renderBrandChips();
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
        setImageWithFallback(img, p.imageUrl);
        photoWrap.appendChild(img);

        var info = document.createElement('div');
        info.className = 'prod-info';
        var name = document.createElement('div');
        name.className = 'prod-name';
        name.textContent = p.name;
        var brand = document.createElement('div');
        brand.className = 'prod-brand';
        brand.textContent = p.brand;
        var price = document.createElement('div');
        price.className = 'prod-price';
        // Pas de champ prix dans le schéma actuel — libellé de repli.
        price.textContent = 'Prix en magasin';
        info.appendChild(name);
        info.appendChild(brand);
        info.appendChild(price);

        card.appendChild(photoWrap);
        card.appendChild(info);
        card.addEventListener('click', function () {
          productsState.zone = 'grid';
          productsState.focusIndex = i;
          openProductDetail(i);
        });
        catProductsGrid.appendChild(card);
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
      }
    } else if (action === 'down') {
      productsState.zone = 'grid';
      renderBrandChips();
      renderProducts();
    } else if (action === 'enter') {
      var brandId =
        productsState.chipsFocusIndex === 0
          ? null
          : productsState.brands[productsState.chipsFocusIndex - 1].id;
      selectBrandChip(brandId);
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
        if (productsState.brands.length > 0) {
          productsState.zone = 'chips';
          renderBrandChips();
        } else if (productsState.subcategories && productsState.subcategories.length > 0) {
          productsState.zone = 'subChips';
          renderSubChips();
        }
      }
      return;
    }
    if (action === 'enter') {
      openProductDetail(productsState.focusIndex);
      return;
    }
    if (action === 'up' && Math.floor(productsState.focusIndex / CATALOG_GRID_COLS) === 0) {
      if (productsState.brands.length > 0) {
        productsState.zone = 'chips';
        renderBrandChips();
        renderProducts();
      } else if (productsState.subcategories && productsState.subcategories.length > 0) {
        productsState.zone = 'subChips';
        renderSubChips();
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

  function handleProductsKey(action) {
    if (action === 'back') {
      showCatalogScreen('categories');
      return;
    }
    if (productsState.zone === 'chips') {
      handleChipsKey(action);
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
          detailState = { product: data, imageIndex: 0, imageCount: 0 };
          renderDetail();
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
    catDetailBrand.textContent = p.brand.name;
    catDetailName.textContent = p.name;
    catDetailCategory.textContent = p.category.name;
    catDetailRef.textContent = p.reference ? 'Réf. ' + p.reference : '';
    // Pas de champ prix dans le schéma actuel — libellé de repli.
    catDetailPrice.textContent = 'Prix en magasin';
    catDetailDesc.textContent = p.description || '';

    var images = p.images || [];
    detailState.imageCount = images.length;
    setImageWithFallback(catDetailPhoto, images[detailState.imageIndex]);

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

  function handleDetailKey(action) {
    if (action === 'back') {
      // Ré-affiche l'écran produits sans le re-générer : la grille garde
      // exactement la position (page / focus / marque) qu'elle avait.
      showCatalogScreen('products');
      return;
    }
    if (action === 'left') {
      moveDetailImage('left');
    } else if (action === 'right') {
      moveDetailImage('right');
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

  fetchPlaylist();
})();
`;
