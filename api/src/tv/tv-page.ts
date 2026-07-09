/**
 * Page HTML plein écran pour navigateur TV (WebOS) — GET /tv.
 * Aucune installation côté TV : il suffit de saisir http://<ip-serveur>:3000/tv.
 * Le JS est chargé depuis un fichier externe (/tv/tv.js) pour rester compatible
 * avec la Content-Security-Policy par défaut de helmet (script-src 'self').
 */
export const TV_PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ESOF — Vitrine TV</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    width: 100%;
    height: 100%;
  }
  #video {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover;
    background: #000;
    display: none;
  }
  #waiting {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 8vw;
    letter-spacing: 0.3em;
  }
  #sound-btn {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    cursor: pointer;
    z-index: 25;
  }
  #sound-btn:focus {
    outline: 3px solid #fff;
    outline-offset: 2px;
    background: rgba(255, 255, 255, 0.28);
  }

  #hint {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 22px;
    padding: 10px 26px;
    border-radius: 8px;
    letter-spacing: 0.02em;
    opacity: 1;
    transition: opacity 0.6s ease;
    pointer-events: none;
    z-index: 20;
  }
  #hint.hidden {
    opacity: 0;
  }

  #controls {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 22px 30px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0));
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.4s ease;
    z-index: 30;
  }
  #controls.visible {
    opacity: 1;
    visibility: visible;
  }

  #now-playing {
    position: absolute;
    top: -46px;
    left: 30px;
    right: 30px;
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 20px;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctrl-btn {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-radius: 10px;
    font-family: Arial, sans-serif;
    font-size: 28px;
    padding: 14px 26px;
    cursor: pointer;
    min-width: 90px;
  }
  .ctrl-btn.focused {
    border-color: #ffcc00;
    background: rgba(255, 204, 0, 0.25);
    box-shadow: 0 0 0 4px rgba(255, 204, 0, 0.4);
  }

  #playlist-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 34vw;
    min-width: 380px;
    max-width: 560px;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    font-family: Arial, sans-serif;
    transform: translateX(100%);
    transition: transform 0.35s ease;
    z-index: 40;
    overflow-y: auto;
    padding-bottom: 20px;
  }
  #playlist-panel.open {
    transform: translateX(0);
  }

  #playlist-header {
    font-size: 26px;
    padding: 24px 28px 16px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  }

  .playlist-item {
    padding: 16px 28px;
    font-size: 22px;
    border-left: 6px solid transparent;
    cursor: pointer;
  }
  .playlist-item.active {
    color: #ffcc00;
    font-weight: bold;
  }
  .playlist-item.focused {
    border-left-color: #ffcc00;
    background: rgba(255, 255, 255, 0.1);
  }

  /* ---- Mode Catalogue produits ---- */

  #catalog-root {
    position: fixed;
    inset: 0;
    background: #0b0b0c;
    color: #fff;
    font-family: Arial, sans-serif;
    display: none;
    flex-direction: column;
    z-index: 50;
  }
  #catalog-root.visible {
    display: flex;
  }

  #cat-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 44px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 2px solid rgba(255, 255, 255, 0.15);
    flex: 0 0 auto;
  }
  #cat-title {
    font-size: 28px;
    font-weight: bold;
  }

  .cat-screen {
    display: none;
    flex: 1;
    overflow: hidden;
    padding: 32px 44px;
    flex-direction: column;
  }
  .cat-screen.active {
    display: flex;
  }

  .cat-heading {
    font-size: 34px;
    margin: 0 0 24px;
  }

  .cat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: minmax(0, 240px);
    align-content: start;
    gap: 26px;
    flex: 1;
    overflow: hidden;
  }

  .category-card {
    background: rgba(255, 255, 255, 0.08);
    border: 4px solid transparent;
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .category-card.empty {
    opacity: 0.5;
  }
  .category-card.focused {
    border-color: #ffcc00;
    transform: scale(1.06);
    box-shadow: 0 0 0 6px rgba(255, 204, 0, 0.35), 0 14px 26px rgba(0, 0, 0, 0.55);
  }
  .cat-icon {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34px;
    font-weight: bold;
    margin-bottom: 16px;
    color: #111;
  }
  .cat-name {
    font-size: 26px;
    font-weight: bold;
  }
  .cat-count {
    font-size: 22px;
    opacity: 0.7;
    margin-top: 6px;
  }

  .product-card {
    background: rgba(255, 255, 255, 0.08);
    border: 4px solid transparent;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .product-card.focused {
    border-color: #ffcc00;
    transform: scale(1.05);
    box-shadow: 0 0 0 6px rgba(255, 204, 0, 0.35), 0 14px 26px rgba(0, 0, 0, 0.55);
  }
  .prod-photo-wrap {
    flex: 1;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .prod-photo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .prod-info {
    padding: 14px 18px 18px;
  }
  .prod-name {
    font-size: 22px;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prod-brand {
    font-size: 22px;
    opacity: 0.75;
  }
  .prod-price {
    font-size: 24px;
    color: #ffcc00;
    margin-top: 4px;
    font-weight: bold;
  }

  #cat-sub-chips,
  #cat-brand-chips {
    display: flex;
    gap: 14px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    flex: 0 0 auto;
  }
  #cat-sub-chips.empty {
    display: none;
    margin-bottom: 0;
  }
  .chip {
    background: rgba(255, 255, 255, 0.1);
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 999px;
    padding: 10px 24px;
    font-size: 24px;
    color: #fff;
  }
  .chip.active {
    background: rgba(255, 204, 0, 0.22);
    border-color: #ffcc00;
    color: #ffcc00;
  }
  .chip.focused {
    box-shadow: 0 0 0 4px rgba(255, 204, 0, 0.55);
  }

  #cat-pagination {
    text-align: center;
    font-size: 24px;
    padding-top: 18px;
    opacity: 0.85;
    flex: 0 0 auto;
  }

  .cat-empty {
    flex: 1;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    opacity: 0.7;
  }
  .cat-empty.visible {
    display: flex;
  }

  #cat-detail-screen.active {
    flex-direction: row;
    gap: 48px;
  }
  #cat-detail-photo-wrap {
    flex: 1.2;
    position: relative;
    background: #000;
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #cat-detail-photo {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  #cat-detail-dots {
    position: absolute;
    bottom: 18px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 12px;
  }
  .detail-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
  }
  .detail-dot.active {
    background: #ffcc00;
  }
  #cat-detail-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }
  #cat-detail-brand {
    font-size: 24px;
    opacity: 0.85;
    margin-bottom: 10px;
  }
  #cat-detail-name {
    font-size: 40px;
    margin: 0 0 16px;
    line-height: 1.2;
  }
  #cat-detail-category,
  #cat-detail-ref {
    font-size: 24px;
    opacity: 0.75;
    margin-bottom: 8px;
  }
  #cat-detail-price {
    font-size: 30px;
    color: #ffcc00;
    font-weight: bold;
    margin: 16px 0;
  }
  #cat-detail-desc {
    font-size: 24px;
    line-height: 1.5;
    opacity: 0.9;
    max-height: 40vh;
    overflow: auto;
  }
</style>
</head>
<body>
  <video id="video" autoplay muted playsinline></video>
  <div id="waiting">ESOF</div>
  <div id="hint">&#9664; &#9654; Naviguer &nbsp;|&nbsp; &#9650; Playlist &nbsp;|&nbsp; &#9660; Catalogue &nbsp;|&nbsp; OK Valider</div>
  <button id="sound-btn" tabindex="0">🔊 Activer le son</button>
  <div id="controls">
    <span id="now-playing"></span>
    <button id="btn-prev" class="ctrl-btn">&#9198; Précédent</button>
    <button id="btn-playpause" class="ctrl-btn">&#9208; Pause</button>
    <button id="btn-next" class="ctrl-btn">&#9197; Suivant</button>
    <button id="btn-playlist" class="ctrl-btn">&#9776; Playlist</button>
    <button id="btn-catalog" class="ctrl-btn">&#128722; Catalogue</button>
  </div>
  <div id="playlist-panel">
    <div id="playlist-header">Playlist</div>
    <div id="playlist-list"></div>
  </div>

  <div id="catalog-root">
    <div id="cat-topbar">
      <span id="cat-title">Catalogue produits</span>
      <button id="btn-exit-catalog" class="ctrl-btn">&#9654; Vidéos</button>
    </div>

    <div id="cat-categories-screen" class="cat-screen">
      <h1 class="cat-heading">Catégories</h1>
      <div id="cat-categories-grid" class="cat-grid"></div>
    </div>

    <div id="cat-products-screen" class="cat-screen">
      <div id="cat-sub-chips" class="empty"></div>
      <div id="cat-brand-chips"></div>
      <div id="cat-products-grid" class="cat-grid"></div>
      <div id="cat-empty" class="cat-empty">Aucun produit dans cette catégorie</div>
      <div id="cat-pagination"></div>
    </div>

    <div id="cat-detail-screen" class="cat-screen">
      <div id="cat-detail-photo-wrap">
        <img id="cat-detail-photo" alt="" />
        <div id="cat-detail-dots"></div>
      </div>
      <div id="cat-detail-info">
        <div id="cat-detail-brand"></div>
        <h1 id="cat-detail-name"></h1>
        <div id="cat-detail-category"></div>
        <div id="cat-detail-ref"></div>
        <div id="cat-detail-price"></div>
        <p id="cat-detail-desc"></p>
      </div>
    </div>
  </div>

  <script src="/tv/tv.js"></script>
</body>
</html>
`;
