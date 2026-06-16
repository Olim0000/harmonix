export function groupAlbums(tracks) {
  const seen = new Set();
  const albums = [];
  for (const track of tracks) {
    if (!track.album) continue;
    const key = `${track.artist_id}|${track.album}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = track.album.match(/^(.*?)\s+\((\d{4})\)$/);
    albums.push({
      album: track.album,
      displayName: m ? m[1] : track.album,
      year: m ? m[2] : null,
      artist_id: track.artist_id,
      artist: track.artist,
      cover: track.cover || null,
      trackCount: tracks.filter((t) => t.album === track.album && t.artist_id === track.artist_id).length,
    });
  }
  return albums;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function albumCard(alb) {
  return {
    key: `${alb.artist_id}|${alb.album}`,
    to: `/album/${alb.artist_id}/${encodeURIComponent(alb.album)}`,
    img: alb.cover || null,
    placeholder: alb.displayName[0],
    title: alb.displayName,
    subtitle: `${alb.artist} · ${alb.trackCount} track${alb.trackCount !== 1 ? 's' : ''}`,
    year: alb.year,
  };
}
