(function () {
  "use strict";
  /* PublicDROP stand-in player: embeds the documented Vumeto iframe (https://vumeto.xyz/docs).
     app.js calls PublicDROPStaticPlayer.mount(container, options) and keeps the returned cleanup function. */
  const config = window.PUBLICDROP_CONFIG || {};
  const BASE = String(config.VUMETO_EMBED_BASE_URL || config.PYTHON_EMBED_BASE_URL || "https://vumeto.xyz").replace(/\/$/, "");
  const SERVERS = { 1: "aether", 3: "nova" }; // HD-1 and HD-3 start on different Vumeto sources

  function resumeSeconds(type, id, season, episode) {
    try {
      const key = `publicdrop_progress_${type}_${id}_${type === "movie" ? 0 : season}_${type === "movie" ? 0 : episode}`;
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value > 5 ? Math.floor(value) : 0;
    } catch { return 0; }
  }

  function buildUrl(o) {
    const id = encodeURIComponent(String(o.id));
    const season = Math.max(1, Number(o.season) || 1);
    const episode = Math.max(1, Number(o.episode) || 1);
    const params = new URLSearchParams({ autoplay: "1", muted: "0", autonext: "1" });
    let path;
    if (o.type === "anime") {
      const idType = o.isTmdb ? "tmdb" : "anilist";
      path = `/embed/anime/${idType}/${id}/${o.isTmdb && o.tmdbType === "movie" ? 1 : episode}`;
      if (o.isTmdb) { if (o.tmdbType === "movie") params.set("format", "movie"); else params.set("season", String(season)); }
      params.set("dub", o.dub === "dub" ? "dub" : "sub");
    } else {
      path = o.type === "tv" ? `/embed/tv/${id}/${season}/${episode}` : `/embed/movie/${id}`;
      params.set("server", SERVERS[o.playbackServer] || "aether");
      const start = resumeSeconds(o.type, String(o.id), season, episode);
      if (start) params.set("start", String(start));
    }
    return `${BASE}${path}?${params.toString()}`;
  }

  function mount(container, options) {
    const frame = document.createElement("iframe");
    frame.className = "publicdrop-embed-frame";
    frame.title = "PublicDROP video player";
    frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.style.cssText = "display:block;width:100%;aspect-ratio:16/9;border:0;background:#000;border-radius:inherit";
    frame.src = buildUrl(options || {});
    container.replaceChildren(frame);
    return function cleanup() { frame.remove(); };
  }

  window.PublicDROPStaticPlayer = Object.freeze({ mount });
})();
