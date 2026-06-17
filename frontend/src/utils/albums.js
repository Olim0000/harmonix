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
  return [...arr].sort(() => Math.random() - 0.5);
}
