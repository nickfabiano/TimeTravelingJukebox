import { getAccessToken, forceRefresh } from './auth';

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  if (!token) throw new Error('Not signed in to Spotify.');

  const doFetch = (t: string) =>
    fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await forceRefresh();
    if (!token) throw new Error('Spotify session expired — please log in again.');
    res = await doFetch(token);
  }
  if (res.status === 429) throw new Error('Spotify rate limit hit — slow down a moment.');
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify API error (${res.status})`);
  }
  return res;
}

export async function playPlaylist(playlistId: string, deviceId: string): Promise<void> {
  await apiFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
  });
}

export async function setShuffle(state: boolean, deviceId: string): Promise<void> {
  await apiFetch(
    `/me/player/shuffle?state=${state}&device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' },
  );
}
