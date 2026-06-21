function getToken() {
  return localStorage.getItem('token');
}

async function request(server, endpoint, body) {
  const url = `http://${server.host}:${server.port}/api/player/${endpoint}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Player server error: ${res.status}`);
  return res.json();
}

export function playOnServer(server, { streamUrl, title, artist, coverUrl }) {
  return request(server, 'play', { streamUrl, title, artist, coverUrl });
}

export function pauseOnServer(server) {
  return request(server, 'pause', {});
}

export function resumeOnServer(server) {
  return request(server, 'resume', {});
}

export function stopOnServer(server) {
  return request(server, 'stop', {});
}

export function seekOnServer(server, position) {
  return request(server, 'seek', { position });
}

export function setVolumeOnServer(server, level) {
  return request(server, 'volume', { level });
}

export function getServerStatus(server) {
  return request(server, 'status');
}
