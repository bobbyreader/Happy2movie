import { DEFAULT_SOURCES } from '../../src/sources.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    sources: DEFAULT_SOURCES.map(s => ({
      id: s.id,
      name: s.name,
      priority: s.priority
    }))
  }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}
