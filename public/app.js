// Happy2movie 前端交互核心逻辑

const STORAGE_KEY = 'happy2movie_history_v1';

const state = {
  currentMovie: null,
  currentSourceIdx: 0,
  currentLineIdx: 0,
  currentEpIdx: 0,
  art: null,
  hls: null,
  history: []
};

// DOM 元素引用
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const brandBtn = document.getElementById('brandBtn');
const hotTags = document.getElementById('hotTags');
const statsBar = document.getElementById('statsBar');
const statsSummary = document.getElementById('statsSummary');
const sourcePills = document.getElementById('sourcePills');

const playerSection = document.getElementById('playerSection');
const catalogSection = document.getElementById('catalogSection');
const backBtn = document.getElementById('backBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const pipBtn = document.getElementById('pipBtn');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingEp = document.getElementById('nowPlayingEp');
const sourceSelector = document.getElementById('sourceSelector');
const lineSelector = document.getElementById('lineSelector');
const episodesGrid = document.getElementById('episodesGrid');
const episodesCount = document.getElementById('episodesCount');
const metaTitle = document.getElementById('metaTitle');
const metaTags = document.getElementById('metaTags');
const metaDesc = document.getElementById('metaDesc');

const searchResultsArea = document.getElementById('searchResultsArea');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const searchResultsGrid = document.getElementById('searchResultsGrid');
const recommendArea = document.getElementById('recommendArea');
const recommendGrid = document.getElementById('recommendGrid');

const historyToggleBtn = document.getElementById('historyToggleBtn');
const historyOverlay = document.getElementById('historyOverlay');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('historyList');
const historyBadge = document.getElementById('historyBadge');

// 初始化历史记录
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.history = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.history = [];
  }
  updateHistoryBadge();
}

function saveHistoryItem(movie, sourceName, epName, epUrl) {
  if (!movie) return;
  const now = new Date();
  const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  state.history = state.history.filter(h => h.movieName !== movie.name);
  state.history.unshift({
    movieName: movie.name,
    pic: movie.pic,
    sourceName,
    epName,
    epUrl,
    timeStr,
    movieData: movie
  });

  if (state.history.length > 30) state.history.pop();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  } catch (e) {}
  updateHistoryBadge();
}

function updateHistoryBadge() {
  const count = state.history.length;
  if (count > 0) {
    historyBadge.style.display = 'inline-block';
    historyBadge.textContent = count;
  } else {
    historyBadge.style.display = 'none';
  }
}

function renderHistoryDrawer() {
  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-tip">暂无播放记录，快去搜一部喜欢的影片吧！</p>';
    return;
  }

  historyList.innerHTML = state.history.map((h, i) => `
    <div class="history-item" data-idx="${i}">
      <img class="history-thumb" src="${h.pic || '/favicon.svg'}" onerror="this.src='/favicon.svg'" alt="">
      <div class="history-info">
        <div class="history-title">${escapeHtml(h.movieName)}</div>
        <div class="history-ep">${escapeHtml(h.epName)} · ${escapeHtml(h.sourceName)}</div>
        <div class="history-time">${h.timeStr}</div>
      </div>
    </div>
  `).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      const target = state.history[idx];
      if (target && target.movieData) {
        historyOverlay.style.display = 'none';
        openPlayer(target.movieData);
      }
    });
  });
}

// 首页推荐
async function loadRecommend() {
  try {
    const res = await fetch('/api/recommend');
    const data = await res.json();
    if (data.ok && Array.isArray(data.items) && data.items.length) {
      renderRecommendCards(data.items);
    } else {
      recommendGrid.innerHTML = '<div class="loading-state"><p>推荐加载稍慢，可在上方输入片名直接搜索</p></div>';
    }
  } catch (err) {
    recommendGrid.innerHTML = '<div class="loading-state"><p>推荐加载超时，请直接在上方搜索</p></div>';
  }
}

function renderRecommendCards(items) {
  recommendGrid.innerHTML = items.map((item, idx) => `
    <div class="movie-card" data-rec-idx="${idx}">
      <div class="card-poster-wrap">
        <img class="card-poster" src="${item.pic || '/favicon.svg'}" onerror="this.src='/favicon.svg'" loading="lazy" alt="${escapeHtml(item.name)}">
        ${item.remarks ? `<span class="card-badge-remarks">${escapeHtml(item.remarks)}</span>` : ''}
        <span class="card-badge-sources">${escapeHtml(item.sourceName)}</span>
      </div>
      <div class="card-info">
        <div class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="card-meta">
          <span>${item.year || '近期'}</span>
          <span>${item.type || '影视'}</span>
        </div>
      </div>
    </div>
  `).join('');

  recommendGrid.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.recIdx, 10);
      const item = items[idx];
      const groupMovie = {
        name: item.name,
        pic: item.pic,
        year: item.year,
        area: item.area,
        type: item.type,
        remarks: item.remarks,
        content: item.content || '',
        sources: [
          {
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            vodId: item.vodId,
            remarks: item.remarks,
            playGroups: item.playGroups
          }
        ]
      };
      openPlayer(groupMovie);
    });
  });
}

// 搜索逻辑
async function doSearch(keyword) {
  const query = (keyword || searchInput.value || '').trim();
  if (!query) return;

  searchInput.value = query;
  clearBtn.style.display = 'block';

  searchResultsArea.style.display = 'block';
  searchResultsTitle.textContent = `正在全网探测 "${query}" 可播放源...`;
  searchResultsGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>正在并发请求 7 大主流节点，仅保留 m3u8 直链...</p>
    </div>
  `;
  statsBar.style.display = 'none';

  try {
    const res = await fetch(`/api/search?wd=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.ok) {
      searchResultsGrid.innerHTML = `<div class="loading-state"><p>搜索出错: ${data.error}</p></div>`;
      return;
    }

    renderStatsBar(data);

    if (!data.groups || data.groups.length === 0) {
      searchResultsTitle.textContent = `未找到关于 "${query}" 的直链资源`;
      searchResultsGrid.innerHTML = `
        <div class="loading-state">
          <p>各大资源站暂未收录该片可播放流，可尝试搜索别名。</p>
        </div>
      `;
      return;
    }

    searchResultsTitle.textContent = `搜索结果：共找到 ${data.groups.length} 部影片 (${data.totalRecords} 个可用片源)`;
    renderSearchCards(data.groups);
    searchResultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    searchResultsGrid.innerHTML = `<div class="loading-state"><p>网络请求异常: ${err.message}</p></div>`;
  }
}

function renderStatsBar(data) {
  statsBar.style.display = 'block';
  statsSummary.textContent = `⚡ 聚合耗时 ${data.tookMs}ms · 覆盖 ${data.totalSources} 个数据源 · 命中 ${data.totalRecords} 条可播记录`;

  sourcePills.innerHTML = (data.stats || []).map(s => `
    <span class="source-pill ${s.ok ? 'ok' : 'fail'}">
      ${s.sourceName}: ${s.ok ? `${s.count}条 (${s.tookMs}ms)` : '超时/离线'}
    </span>
  `).join('');
}

function renderSearchCards(groups) {
  searchResultsGrid.innerHTML = groups.map((g, idx) => `
    <div class="movie-card" data-group-idx="${idx}">
      <div class="card-poster-wrap">
        <img class="card-poster" src="${g.pic || '/favicon.svg'}" onerror="this.src='/favicon.svg'" loading="lazy" alt="${escapeHtml(g.name)}">
        ${g.remarks ? `<span class="card-badge-remarks">${escapeHtml(g.remarks)}</span>` : ''}
        <span class="card-badge-sources">${g.sources.length} 个源可选</span>
      </div>
      <div class="card-info">
        <div class="card-title" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
        <div class="card-meta">
          <span>${g.year || ''} ${g.area || ''}</span>
          <span>${g.type || '影视'}</span>
        </div>
      </div>
    </div>
  `).join('');

  searchResultsGrid.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.groupIdx, 10);
      const group = groups[idx];
      openPlayer(group);
    });
  });
}

// 播放器控制器
function openPlayer(movie) {
  state.currentMovie = movie;
  state.currentSourceIdx = 0;
  state.currentLineIdx = 0;
  state.currentEpIdx = 0;

  playerSection.style.display = 'block';
  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  nowPlayingTitle.textContent = movie.name;
  metaTitle.textContent = `${movie.name} ${movie.year ? `(${movie.year})` : ''}`;
  metaTags.innerHTML = `
    <span>${movie.type || ''}</span>
    <span>${movie.area || ''}</span>
    ${movie.remarks ? `<span>状态: ${escapeHtml(movie.remarks)}</span>` : ''}
    ${movie.director ? `<span>导演: ${escapeHtml(movie.director)}</span>` : ''}
  `;
  metaDesc.textContent = movie.content || '暂无详细剧情简介。';

  renderSourceTabs();
  renderLineTabs();
  renderEpisodes();
  playCurrent();
}

function renderSourceTabs() {
  const sources = state.currentMovie.sources || [];
  sourceSelector.innerHTML = sources.map((s, idx) => `
    <button class="selector-chip ${idx === state.currentSourceIdx ? 'active' : ''}" data-sidx="${idx}">
      ${escapeHtml(s.sourceName)}
    </button>
  `).join('');

  sourceSelector.querySelectorAll('.selector-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const sidx = parseInt(btn.dataset.sidx, 10);
      if (sidx !== state.currentSourceIdx) {
        state.currentSourceIdx = sidx;
        state.currentLineIdx = 0;
        renderSourceTabs();
        renderLineTabs();
        renderEpisodes();
        playCurrent();
      }
    });
  });
}

function renderLineTabs() {
  const currentSource = state.currentMovie.sources[state.currentSourceIdx];
  const lines = currentSource?.playGroups || [];
  
  lineSelector.innerHTML = lines.map((l, idx) => `
    <button class="selector-chip ${idx === state.currentLineIdx ? 'active' : ''}" data-lidx="${idx}">
      ${escapeHtml(l.lineName)}
    </button>
  `).join('');

  lineSelector.querySelectorAll('.selector-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const lidx = parseInt(btn.dataset.lidx, 10);
      if (lidx !== state.currentLineIdx) {
        state.currentLineIdx = lidx;
        renderLineTabs();
        renderEpisodes();
        playCurrent();
      }
    });
  });
}

function renderEpisodes() {
  const currentSource = state.currentMovie.sources[state.currentSourceIdx];
  const currentLine = currentSource?.playGroups[state.currentLineIdx];
  const episodes = currentLine?.episodes || [];

  episodesCount.textContent = `共 ${episodes.length} 集`;

  episodesGrid.innerHTML = episodes.map((ep, idx) => `
    <button class="episode-btn ${idx === state.currentEpIdx ? 'active' : ''}" data-epidx="${idx}" title="${escapeHtml(ep.name)}">
      ${escapeHtml(ep.name)}
    </button>
  `).join('');

  episodesGrid.querySelectorAll('.episode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const epidx = parseInt(btn.dataset.epidx, 10);
      state.currentEpIdx = epidx;
      renderEpisodes();
      playCurrent();
    });
  });
}

function playCurrent() {
  const currentSource = state.currentMovie.sources[state.currentSourceIdx];
  const currentLine = currentSource?.playGroups[state.currentLineIdx];
  const episodes = currentLine?.episodes || [];

  if (!episodes.length) {
    if (state.art) state.art.notice.show = '当前线路暂无可用直链，请切换其它线路或源';
    return;
  }

  if (state.currentEpIdx >= episodes.length) {
    state.currentEpIdx = 0;
  }

  const ep = episodes[state.currentEpIdx];
  nowPlayingEp.textContent = `[${currentSource.sourceName}] ${ep.name}`;

  initArtPlayer(ep.url, `${state.currentMovie.name} - ${ep.name}`);
  saveHistoryItem(state.currentMovie, currentSource.sourceName, ep.name, ep.url);
}

function cleanM3u8Ads(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('#EXTM3U')) return text;

  const lines = text.split('\n');
  const cleaned = [];
  let inAdBlock = false;
  let seenAdStart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 匹配主流切片系统（如 PPVOD）中插广告标记
    if (/ppvod-ad-injected|advertisement|#\s*ad\b|guanggao/i.test(line)) {
      inAdBlock = true;
      seenAdStart = false;
      continue;
    }

    if (inAdBlock) {
      if (line === '#EXT-X-DISCONTINUITY') {
        if (!seenAdStart) {
          seenAdStart = true;
        } else {
          inAdBlock = false;
          seenAdStart = false;
        }
      }
      continue;
    }

    // 单行中插广告切片过滤
    if (/(\/ad\/|_ad_|\/guanggao\/|ad\.ts)/i.test(line) && !line.startsWith('#')) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1].trim().startsWith('#EXTINF')) {
        cleaned.pop();
      }
      continue;
    }

    cleaned.push(lines[i]);
  }

  return cleaned.join('\n');
}

// 检测 iOS 设备 (iPhone, iPad, iPod 及 iPadOS)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 强制注入 iOS 画中画 (PiP) 与切到后台自动悬浮窗的核心属性
function setupVideoPip(video) {
  if (!video) return;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x-webkit-airplay', 'allow');
  video.setAttribute('autopictureinpicture', '');
  video.setAttribute('autoPictureInPicture', 'true');
  video.disablePictureInPicture = false;
}

// 全局全屏控制器（优先复用 Artplayer 内置全屏，自带状态同步与播放器样式）
function toggleFullscreen() {
  const art = state.art;
  const video = art?.template?.$video || art?.video;
  if (!art || !video) return;

  // 1. iPhone / iPad 走 webkitEnterFullscreen（iOS 唯一真正的系统级全屏，带原生手势）
  //    注意：video 元素只有 hasAttribute('webkitSupportsFullscreen') 这个标记属性，
  //    旧代码用 typeof video.webkitEnterFullscreen === 'function' 判断在 Safari 下恒为假，导致按钮点了没反应
  if (isIOS || (video.webkitSupportsFullscreen && !document.fullscreenEnabled)) {
    const requestVideoFullscreen = () => {
      if (typeof video.webkitEnterFullscreen === 'function') {
        video.webkitEnterFullscreen();
      } else if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
    };
    try {
      if (video.webkitDisplayingFullscreen) {
        video.webkitExitFullscreen?.();
      } else {
        requestVideoFullscreen();
      }
      return;
    } catch (e) {
      console.warn('webkitEnterFullscreen error:', e);
    }
  }

  // 2. PC / Android：交给 Artplayer 内置全屏（支持标准 Fullscreen API 与 Safari 的 webkit 模式）
  try {
    art.fullscreen = !art.fullscreen;
    return;
  } catch (e) {
    console.warn('art.fullscreen error:', e);
  }

  // 3. 兜底：网页全屏 / 原生 requestFullscreen
  if (art.fullscreenWeb !== undefined) {
    art.fullscreenWeb = !art.fullscreenWeb;
    return;
  }
  const $player = art.template.$player;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if ($player?.requestFullscreen) {
    $player.requestFullscreen().catch(() => {});
  }
}

// 全局画中画切换控制器（支持 iOS 原生 PresentationMode 与 W3C 标准 PiP）
async function togglePictureInPicture() {
  const art = state.art;
  const video = art?.template?.$video || art?.video;
  if (!video) return;

  setupVideoPip(video);

  // 1. iOS / WebKit 原生画中画：必须满足用户手势 + 视频已在播放，否则静默失败
  if (typeof video.webkitSetPresentationMode === 'function') {
    const currentMode = video.webkitPresentationMode;
    const targetMode = currentMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
    try {
      if (targetMode === 'picture-in-picture' && video.paused) {
        video.play().catch(() => {});
      }
      video.webkitSetPresentationMode(targetMode);
      return;
    } catch (e) {
      console.warn('webkitSetPresentationMode error:', e);
      if (art?.notice) art.notice.show = '当前浏览器不支持悬浮画中画，请使用系统自带的画中画按钮';
      return;
    }
  }

  // 2. W3C 标准 Picture-in-Picture API（Chrome / Edge）
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
      if (video.readyState === 0) {
        if (art?.notice) art.notice.show = '视频还在加载，稍后再点一次即可开启画中画';
        return;
      }
      if (video.paused) video.play().catch(() => {});
      await video.requestPictureInPicture();
      return;
    }
    if (art?.notice) art.notice.show = '当前浏览器不支持画中画，请换用 Chrome / Edge / Safari';
  } catch (err) {
    console.warn('PiP error:', err);
    if (art?.notice) art.notice.show = '画中画开启失败，请检查浏览器权限设置';
  }
}

function initArtPlayer(playUrl, title) {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  if (state.art) {
    state.art.destroy(false);
    state.art = null;
  }

  const isM3U8 = playUrl.includes('.m3u8') || playUrl.includes('m3u8');

  try {
    state.art = new Artplayer({
      container: '#artplayer',
      url: playUrl,
      title: title,
      type: isM3U8 ? 'm3u8' : 'auto',
      customType: {
        m3u8: function (video, url, art) {
          setupVideoPip(video);

          // 针对 iOS（iPhone / iPad Safari 及固定到主屏幕的 PWA Standalone 模式）
          if (isIOS && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            setupVideoPip(video);

            const onReady = () => {
              if (art.loading) art.loading.show = false;
              setupVideoPip(video);
              if (art.option.autoplay) {
                video.play().catch(() => {});
              }
            };

            video.addEventListener('loadedmetadata', onReady, { once: true });
            video.addEventListener('canplay', onReady, { once: true });
            video.addEventListener('playing', () => {
              if (art.loading) art.loading.show = false;
              setupVideoPip(video);
            });

            video.addEventListener('webkitbeginfullscreen', () => {
              setupVideoPip(video);
            });
            video.addEventListener('webkitendfullscreen', () => {
              setupVideoPip(video);
            });

            video.load();
            return;
          }

          if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 60,
              pLoader: class extends window.Hls.DefaultConfig.loader {
                constructor(config) {
                  super(config);
                  const load = this.load.bind(this);
                  this.load = function (context, config, callbacks) {
                    const onSuccess = callbacks.onSuccess;
                    callbacks.onSuccess = function (response, stats, context, networkDetails) {
                      if (response && typeof response.data === 'string') {
                        response.data = cleanM3u8Ads(response.data);
                      }
                      onSuccess(response, stats, context, networkDetails);
                    };
                    load(context, config, callbacks);
                  };
                }
              }
            });
            state.hls = hls;

            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(window.Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                console.warn('HLS 异常:', data.type, data.details);
                switch (data.type) {
                  case window.Hls.ErrorTypes.NETWORK_ERROR:
                    art.notice.show = '当前源响应慢或超时，建议点击右侧切换其它播放源';
                    break;
                  case window.Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    art.notice.show = '播放源错误，请切换右侧其它源或线路';
                    hls.destroy();
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          } else {
            art.notice.show = '当前浏览器环境不支持 HLS 播放';
          }
        }
      },
      poster: state.currentMovie.pic || '',
      theme: '#f43f5e',
      autoplay: true,
      autoSize: false,
      autoMini: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      hotkey: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      airplay: true,
      // 画中画 / 全屏直接复用 Artplayer 自带的控制条按钮（与其它按钮同排，位于播放窗口右下角），
      // 这里只接管点击后的行为，不再额外插入重复的自定义按钮
      settings: [
        {
          html: '悬浮画中画',
          tooltip: '切到桌面小窗播放',
          onClick: function () {
            togglePictureInPicture();
          }
        },
        {
          html: '全屏播放',
          tooltip: '撑满整个屏幕',
          onClick: function () {
            toggleFullscreen();
          }
        }
      ]
    });

    state.art.on('video:ended', () => {
      const currentSource = state.currentMovie.sources[state.currentSourceIdx];
      const currentLine = currentSource?.playGroups[state.currentLineIdx];
      const episodes = currentLine?.episodes || [];
      if (state.currentEpIdx + 1 < episodes.length) {
        state.currentEpIdx += 1;
        renderEpisodes();
        playCurrent();
      }
    });

    state.art.on('ready', () => {
      const $video = state.art?.template?.$video;
      setupVideoPip($video);

      // 注意：双击画面全屏由 Artplayer 内置逻辑处理（DBCLICK_FULLSCREEN），
      // 这里不要重复绑定 'dblclick' -> 全屏，否则一次双击会切换两次、互相抵消
      const art = state.art;
      art.on('fullscreen', (isFullscreen) => {
        const btn = art.template?.$player?.querySelector('.art-control-fullscreen');
        if (btn) btn.setAttribute('title', isFullscreen ? '退出全屏' : '全屏播放');
      });

      if (pipBtn) {
        const syncPipBtn = (isPip) => {
          pipBtn.classList.toggle('active', isPip);
          pipBtn.innerHTML = isPip ? '✕ 退出画中画' : '📺 悬浮画中画';
        };
        if ($video) {
          $video.addEventListener('webkitpresentationmodechanged', () => {
            syncPipBtn($video.webkitPresentationMode === 'picture-in-picture');
          });
          $video.addEventListener('enterpictureinpicture', () => syncPipBtn(true));
          $video.addEventListener('leavepictureinpicture', () => syncPipBtn(false));
        }
      }

      state.art.play().catch(() => {});
    });
  } catch (err) {
    console.error('Artplayer init error:', err);
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 事件绑定
searchBtn.addEventListener('click', () => doSearch());
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  searchInput.focus();
});

searchInput.addEventListener('input', () => {
  clearBtn.style.display = searchInput.value ? 'block' : 'none';
});

hotTags.querySelectorAll('.tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const kw = chip.dataset.kw;
    doSearch(kw);
  });
});

brandBtn.addEventListener('click', () => {
  playerSection.style.display = 'none';
  searchResultsArea.style.display = 'none';
  statsBar.style.display = 'none';
  recommendArea.style.display = 'block';
  searchInput.value = '';
  clearBtn.style.display = 'none';
  if (state.art) state.art.pause();
});

backBtn.addEventListener('click', () => {
  playerSection.style.display = 'none';
  if (state.art) state.art.pause();
});

// 全屏按钮手动触发
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen();
  });
}

// 画中画按钮手动触发
if (pipBtn) {
  pipBtn.addEventListener('click', () => {
    togglePictureInPicture();
  });
}

// 历史记录抽屉
historyToggleBtn.addEventListener('click', () => {
  renderHistoryDrawer();
  historyOverlay.style.display = 'flex';
});

closeHistoryBtn.addEventListener('click', () => {
  historyOverlay.style.display = 'none';
});

historyOverlay.addEventListener('click', (e) => {
  if (e.target === historyOverlay) {
    historyOverlay.style.display = 'none';
  }
});

clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  updateHistoryBadge();
  renderHistoryDrawer();
});

// 初始化入口
loadHistory();
loadRecommend();
