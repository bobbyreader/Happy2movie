import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { searchAggregated, fetchLatestRecommend } from './src/aggregator.js';
import { DEFAULT_SOURCES } from './src/sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = parseInt(process.env.PORT || '3000', 10);
const SITE_PASSWORD = process.env.SITE_PASSWORD || '9527';

function computeHash(password) {
  return crypto.createHash('sha256').update(password + '_happy2movie_salt_2026').digest('hex');
}

const VALID_AUTH_HASH = computeHash(SITE_PASSWORD);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function parseCookies(cookieHeader = '') {
  const list = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function renderAuthHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>访问认证 - Happy2movie</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0c0e14;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .auth-card {
      background: #151922;
      border: 1px solid #272f40;
      border-radius: 16px;
      padding: 36px 30px;
      width: 100%;
      max-width: 380px;
      text-align: center;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    }
    .icon-badge {
      width: 68px;
      height: 68px;
      margin: 0 auto 16px auto;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      border: 1.5px solid rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 34px;
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.25);
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.3px; color: #fff; }
    p { font-size: 13px; color: #9ca3af; margin-bottom: 24px; line-height: 1.5; }
    .input-wrap { margin-bottom: 16px; text-align: left; }
    input {
      width: 100%;
      background: #1a202c;
      border: 1.5px solid #2d3748;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 15px;
      color: #fff;
      outline: none;
      transition: all 0.2s ease;
      letter-spacing: 2px;
      text-align: center;
    }
    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    button {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: #fff;
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    button:hover { opacity: 0.95; transform: translateY(-1px); }
    .err-msg {
      color: #ef4444;
      font-size: 13px;
      margin-bottom: 14px;
      background: rgba(239, 68, 68, 0.1);
      padding: 8px;
      border-radius: 6px;
      display: none;
    }
    .tip { font-size: 11px; color: #6b7280; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="icon-badge">🎬</div>
    <h1>【科学技术私享影会】</h1>
    <p>内部交流专线 · 请输入通行口令接入系统</p>
    
    <div class="err-msg" id="errMsg"></div>

    <form id="authForm">
      <div class="input-wrap">
        <input type="password" id="passInput" placeholder="请输入通行口令" autofocus required autocomplete="current-password" />
      </div>
      <button type="submit" id="submitBtn">验证并进入</button>
    </form>

    <div class="tip">认证成功后 30 天内免重复输入</div>
  </div>

  <script>
    const form = document.getElementById('authForm');
    const input = document.getElementById('passInput');
    const errMsg = document.getElementById('errMsg');
    const btn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.textContent = '验证中...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: input.value.trim() })
        });
        const data = await res.json();
        if (data.ok) {
          window.location.reload();
        } else {
          errMsg.textContent = data.error || '口令错误，请重新输入';
          errMsg.style.display = 'block';
          input.value = '';
          input.focus();
          btn.textContent = '解锁进入';
          btn.disabled = false;
        }
      } catch (err) {
        errMsg.textContent = '网络异常，请重试';
        errMsg.style.display = 'block';
        btn.textContent = '解锁进入';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. 口令登录接口
  if (pathname === '/api/login' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        if (body.password === SITE_PASSWORD) {
          return sendJson(res, 200, { ok: true }, {
            'Set-Cookie': `site_auth=${VALID_AUTH_HASH}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
          });
        }
        return sendJson(res, 401, { ok: false, error: '口令错误' });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: '请求数据格式错误' });
      }
    });
    return;
  }

  // 静态白名单放行
  if (pathname === '/favicon.svg' || pathname.startsWith('/vendor/')) {
    let fPath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(fPath)) {
      const ext = path.extname(fPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return res.end(fs.readFileSync(fPath));
    }
  }

  // 校验 Cookie
  const cookies = parseCookies(req.headers.cookie || '');
  const isAuthed = cookies['site_auth'] === VALID_AUTH_HASH;

  if (!isAuthed) {
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 401, { ok: false, error: '未授权，请先验证口令' });
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderAuthHtml());
  }

  // 2. 聚合搜索接口
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

  // 3. 首页热门推荐
  if (pathname === '/api/recommend') {
    try {
      const items = await fetchLatestRecommend();
      return sendJson(res, 200, { ok: true, items });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message, items: [] });
    }
  }

  // 4. 数据源列表与健康状态
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
  console.log(`🎬 Happy2movie 服务已就绪 (口令保护模式): http://localhost:${PORT}`);
});
