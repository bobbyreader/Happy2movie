import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchAggregated, fetchLatestRecommend } from './src/aggregator.js';
import { DEFAULT_SOURCES } from './src/sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function rewriteM3U8(content, baseUrl) {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    try {
      const resolved = new URL(trimmed, baseUrl).href;
      return `/api/proxy?url=${encodeURIComponent(resolved)}`;
    } catch {
      return line;
    }
  }).join('\n');
}

const server = http.createServer(async (req, res) => {
  // 处理 OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. 聚合搜索接口
  if (pathname === '/api/search') {
    const wd = parsedUrl.searchParams.get('wd') || '';
    if (!wd.trim()) {
      return sendJson(res, 200, { ok: true, groups: [], total: 0 });
    }
    try {
      const data = await searchAggregated(wd);
      return sendJson(res, 200, { ok: true, ...data });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 2. 首页热门推荐
  if (pathname === '/api/recommend') {
    try {
      const items = await fetchLatestRecommend();
      return sendJson(res, 200, { ok: true, items });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message, items: [] });
    }
  }

  // 3. 数据源列表与健康状态
  if (pathname === '/api/sources') {
    return sendJson(res, 200, {
      ok: true,
      sources: DEFAULT_SOURCES.map(s => ({
        id: s.id,
        name: s.name,
        priority: s.priority
      }))
    });
  }

  // 4. 流媒体自适应中继代理（支持 m3u8 清单 URL 重写 & TS 切片跨域转发）
  if (pathname === '/api/proxy') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Invalid URL');
    }

    try {
      const upstreamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': ''
      };
      if (req.headers.range) {
        upstreamHeaders['Range'] = req.headers.range;
      }

      const proxyRes = await fetch(targetUrl, {
        headers: upstreamHeaders,
        redirect: 'follow'
      });

      const contentType = proxyRes.headers.get('content-type') || '';
      const isM3u8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8');

      if (isM3u8) {
        const text = await proxyRes.text();
        const rewritten = rewriteM3U8(text, targetUrl);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache'
        });
        return res.end(rewritten);
      }

      // 普通二进制流 (ts / mp4 / key)
      const forwardHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
        'Content-Type': contentType || 'video/mp2t',
        'Cache-Control': 'public, max-age=86400'
      };

      if (proxyRes.headers.has('content-range')) {
        forwardHeaders['Content-Range'] = proxyRes.headers.get('content-range');
      }
      if (proxyRes.headers.has('content-length')) {
        forwardHeaders['Content-Length'] = proxyRes.headers.get('content-length');
      }
      if (proxyRes.headers.has('accept-ranges')) {
        forwardHeaders['Accept-Ranges'] = proxyRes.headers.get('accept-ranges');
      }

      res.writeHead(proxyRes.status, forwardHeaders);

      if (proxyRes.body) {
        const reader = proxyRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      return res.end();
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`Proxy stream error: ${err.message}`);
    }
  }

  // 5. 静态前端资源
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    return res.end(content);
  } catch {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(content);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Happy2movie 服务已就绪: http://localhost:${PORT}`);
});
