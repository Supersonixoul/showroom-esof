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
</style>
</head>
<body>
  <video id="video" autoplay muted playsinline></video>
  <div id="waiting">ESOF</div>
  <div id="hint">&#9664; &#9654; Naviguer &nbsp;|&nbsp; &#9650; Playlist &nbsp;|&nbsp; OK Valider</div>
  <button id="sound-btn" tabindex="0">🔊 Activer le son</button>
  <div id="controls">
    <span id="now-playing"></span>
    <button id="btn-prev" class="ctrl-btn">&#9198; Précédent</button>
    <button id="btn-playpause" class="ctrl-btn">&#9208; Pause</button>
    <button id="btn-next" class="ctrl-btn">&#9197; Suivant</button>
    <button id="btn-playlist" class="ctrl-btn">&#9776; Playlist</button>
  </div>
  <div id="playlist-panel">
    <div id="playlist-header">Playlist</div>
    <div id="playlist-list"></div>
  </div>
  <script src="/tv/tv.js"></script>
</body>
</html>
`;
