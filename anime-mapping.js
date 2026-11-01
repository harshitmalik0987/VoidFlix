(function () {
  "use strict";
  const pending = new Map();
  const quarters = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };
  const valid = item => item?.id && Number.isInteger(Number(item.anilistId)) && Number(item.anilistId) > 0;
  function seasonRecords(items, tmdbId, movie) {
    return [...new Map((items || []).filter(item => valid(item) && Number(item.tmdbId) === tmdbId &&
      (movie ? item.format === "MOVIE" : ["TV", "TV_SHORT", "ONA"].includes(item.format))).map(item => [item.id, item])).values()]
      .sort((a,b) => (Number(a.seasonYear)||Infinity)-(Number(b.seasonYear)||Infinity) ||
        (quarters[a.season] ?? 4)-(quarters[b.season] ?? 4) || String(a.id).localeCompare(String(b.id)));
  }
  async function searchRecords(api, titles, tmdbId, movie) {
    let lastError;
    for (const title of [...new Set(titles.filter(Boolean))]) {
      try {
        const data = await api.animeSearch({ title });
        const records = seasonRecords(data.items, tmdbId, movie);
        if (records.length) return records;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error("AnimeX has no exact TMDB mapping for this title.");
  }
  async function resolve(options) {
    const api = window.PublicDROPAPI;
    const season = Math.max(1, Number(options.season) || 1);
    const episode = Math.max(1, Number(options.episode) || 1);
    const movie = options.tmdbType === "movie";
    let metadata = { ...(options.metadata || {}) }, records, record;
    if (!options.isTmdb) {
      const anilistId = Number(metadata.anilistId || options.id);
      record = (await api.animeDetails({ anilistId })).anime;
      if (!valid(record) || Number(record.anilistId) !== anilistId) throw new Error("AnimeX has no verified match for this AniList ID.");
      records = [record];
      if (!movie && ["TV","TV_SHORT","ONA"].includes(record.format) && Number(record.tmdbId)) {
        const title = record.titleEnglish || record.titleRomaji || metadata.title || "";
        const base = title.replace(/\s+(?:season\s+\d+|\d+(?:st|nd|rd|th)\s+season)\b.*$/i, "").split(":")[0].trim();
        records = await searchRecords(api, [base, title], Number(record.tmdbId), false);
        if (!records.some(item => item.id === record.id)) records = seasonRecords([...records, record], Number(record.tmdbId), false);
      }
    } else {
      const tmdbId = Number(options.id);
      const details = await api.details({ id: tmdbId, type: movie ? "movie" : "tv", language: "en" });
      metadata = { ...metadata, tmdbId, title: metadata.title || details.name || details.title };
      records = await searchRecords(api, [details.name, details.title, details.original_name, details.original_title, metadata.title], tmdbId, movie);
      record = movie ? records[0] : records[season - 1];
    }
    if (options.seasonSlug) record = records.find(item => item.id === options.seasonSlug);
    if (!record) throw new Error("This AnimeX season is not available for the mapped title.");
    const data = movie ? { episodes: [] } : await api.animeEpisodes({ id: record.id });
    const episodes = data.episodes || [];
    // Episode numbers belong to this AnimeX season; never offset using TMDB counts.
    const mappedEpisode = movie ? 1 : episode;
    if (!movie && !episodes.some(e => Number(e.number) === mappedEpisode)) throw new Error("This episode is not available for the mapped AnimeX season.");
    return { ...metadata, tmdbId: Number(record.tmdbId) || metadata.tmdbId || 0,
      anilistId: Number(record.anilistId), malId: Number(record.malId)||0,
      animexId: record.id, anidapId: record.id, animeEpisode: mappedEpisode,
      animeEpisodeOffset: 0, animeRouteSeason: season, animeRouteEpisode: episode,
      animeRouteEpisodeCount: episodes.length, animeEpisodeData: episodes,
      animeSeasons: records, animeSeasonIndex: records.findIndex(item => item.id === record.id) + 1,
      title: record.titleEnglish || record.titleRomaji || metadata.title,
      episodes: episodes.length, seasons: movie ? 0 : records.length,
      animeMappingVerified: true, animeMappingError: "" };
  }
  window.PublicDROPAnimeMapping = Object.freeze({
    seasonRecords,
    resolve(options) {
      const identity = options.isTmdb ? Number(options.id) : Number(options.metadata?.anilistId || options.id);
      const key = JSON.stringify([Boolean(options.isTmdb), identity, Number(options.season)||1, Number(options.episode)||1, options.tmdbType||"tv", options.seasonSlug||""]);
      if (!pending.has(key)) {
        const request = resolve(options).catch(error => { pending.delete(key); throw error; });
        pending.set(key, request);
        if (pending.size > 128) pending.delete(pending.keys().next().value);
      }
      return pending.get(key);
    }
  });
})();
