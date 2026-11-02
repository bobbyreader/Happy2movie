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
      airplay: true
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
