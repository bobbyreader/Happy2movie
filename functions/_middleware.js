// 简易哈希计算，用于验证 Cookie 合法性
async function computeHash(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password + '_happy2movie_salt_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

function renderAuthHtml(errorMsg = '') {
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
      display: ${errorMsg ? 'block' : 'none'};
    }
    .tip {
      font-size: 11px;
      color: #6b7280;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="icon-badge">🎬</div>
    <h1>【科学技术私享影会】</h1>
    <p>内部交流专线 · 请输入通行口令接入系统</p>
    
    <div class="err-msg" id="errMsg">${errorMsg}</div>

    <form method="POST" action="/api/login" id="authForm">
      <div class="input-wrap">
        <input type="password" name="password" id="passInput" placeholder="请输入通行口令" autofocus required autocomplete="current-password" />
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
        errMsg.textContent = '网络连接异常，请重试';
        errMsg.style.display = 'block';
        btn.textContent = '解锁进入';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 支持环境变量自定义口令，默认 9527
  const SITE_PASSWORD = env.SITE_PASSWORD || '9527';
  const validHash = await computeHash(SITE_PASSWORD);

  // 1. 口令登录接口
  if (pathname === '/api/login') {
    if (request.method === 'POST') {
      let pwd = '';
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try {
          const body = await request.json();
          pwd = body.password || '';
        } catch {}
      } else {
        const formData = await request.formData();
        pwd = formData.get('password') || '';
      }

      if (pwd === SITE_PASSWORD) {
        // 下发 30 天 HttpOnly 安全 Cookie
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': `site_auth=${validHash}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly; Secure`,
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({ ok: false, error: '口令错误' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }
  }

  // 2. 检查静态资源排除项 (图标、vendor等)
  if (
    pathname === '/favicon.svg' ||
    pathname.startsWith('/vendor/') ||
    pathname === '/robots.txt'
  ) {
    return await context.next();
  }

  // 3. 校验 Cookie
  const cookies = parseCookies(request.headers.get('cookie') || '');
  if (cookies['site_auth'] === validHash) {
    return await context.next();
  }

  // 4. 未授权拦截
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: '未授权，请先验证口令' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 页面访问返回认证拦截界面
  return new Response(renderAuthHtml(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
