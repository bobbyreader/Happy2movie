import { DEFAULT_SOURCES } from './sources.js';

/**
 * 解析播放线路与选集
 * 过滤所有网页分享类（如 /share/、无后缀网页），仅保留真实可播放的 .m3u8 与 .mp4 流地址
 */
export function parseEpisodes(vod_play_from = '', vod_play_url = '') {
  const froms = (vod_play_from || '').split('$$$').map(s => s.trim());
  const groups = (vod_play_url || '').split('$$$').map(s => s.trim());

  const parsedGroups = groups.map((g, idx) => {
    const rawFrom = froms[idx] || `线路 ${idx + 1}`;
    const cleanLineName = formatLineName(rawFrom);

    const episodes = g.split('#').map(item => {
      const parts = item.split('$');
      let name = '正片';
      let url = '';
      if (parts.length >= 2) {
        name = parts[0].trim();
        url = parts.slice(1).join('$').trim();
      } else {
        url = item.trim();
      }

      return { name, url };
    }).filter(e => {
      if (!e.url || !e.url.startsWith('http')) return false;
      // 必须是真实的流媒体格式
      const isMedia = e.url.includes('.m3u8') || e.url.includes('.mp4');
      // 排除 HTML 网页/嵌套播放器
      const isHtmlPage = e.url.includes('/share/') || (e.url.includes('/play/') && !e.url.includes('.m3u8'));
      return isMedia && !isHtmlPage;
    });

    return {
      lineKey: rawFrom,
      lineName: cleanLineName,
      isM3u8: /m3u8/i.test(rawFrom) || episodes.some(e => e.url.includes('.m3u8')),
      episodes
    };
  }).filter(group => group.episodes.length > 0);

  // m3u8 直链优先置顶
  parsedGroups.sort((a, b) => (b.isM3u8 ? 1 : 0) - (a.isM3u8 ? 1 : 0));

  return parsedGroups;
}

function formatLineName(name) {
  if (/lzm3u8/i.test(name)) return '量子直链 (lzm3u8)';
  if (/modum3u8/i.test(name)) return '魔都直链 (modum3u8)';
  if (/xlm3u8/i.test(name)) return '新浪直链 (xlm3u8)';
  if (/jsm3u8/i.test(name)) return '极速直链 (jsm3u8)';
  if (/gsm3u8/i.test(name)) return '光速直链 (gsm3u8)';
  if (/hym3u8/i.test(name)) return '虎牙直链 (hym3u8)';
  if (/rym3u8/i.test(name)) return '如意直链 (rym3u8)';
  if (/m3u8/i.test(name)) return `超清直链 (${name})`;
  if (/mp4/i.test(name)) return `MP4极速 (${name})`;
  return name || '标准播放线';
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function getMatchScore(item, query) {
  const name = (item.name || '').toLowerCase();
  let score = 0;
  if (name === query) {
    score += 1000;
  } else if (name.startsWith(query)) {
    score += 500;
  } else if (name.includes(query)) {
    score += 200;
  }
  score += Math.min(item.sources.length * 10, 50);
  if (item.pic) score += 5;
  return score;
}

function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('TimeoutError')), ms);
  return controller.signal;
}

export async function fetchFromSource(source, keyword = '', timeout = 5000) {
  const start = Date.now();
  const endpoint = `${source.api}?ac=detail&wd=${encodeURIComponent(keyword)}`;

  try {
    const res = await fetch(endpoint, {
      signal: createTimeoutSignal(timeout),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data.list) ? data.list : [];
    const tookMs = Date.now() - start;

    const items = list.map(raw => {
      const playGroups = parseEpisodes(raw.vod_play_from, raw.vod_play_url);
      return {
        id: `${source.id}_${raw.vod_id}`,
        sourceId: source.id,
        sourceName: source.name,
        vodId: raw.vod_id,
        name: raw.vod_name?.trim() || '',
        subName: raw.vod_sub?.trim() || '',
        pic: raw.vod_pic || '',
        year: raw.vod_year || '',
        area: raw.vod_area || '',
        type: raw.type_name || '',
        remarks: raw.vod_remarks || '',
        actor: raw.vod_actor || '',
        director: raw.vod_director || '',
        content: stripHtml(raw.vod_content || ''),
        playGroups
      };
    }).filter(item => item.playGroups.length > 0);

    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: true,
      tookMs,
      count: items.length,
      items
    };
  } catch (err) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: false,
      tookMs: Date.now() - start,
      error: err.name === 'TimeoutError' ? '请求超时' : err.message,
      count: 0,
      items: []
    };
  }
}

export async function searchAggregated(keyword, sources = DEFAULT_SOURCES) {
  const t0 = Date.now();
  if (!keyword || !keyword.trim()) {
    return {
      query: '',
      tookMs: 0,
      totalSources: sources.length,
      matchedGroups: 0,
      totalRecords: 0,
      stats: [],
      groups: []
    };
  }

  const trimmed = keyword.trim();
  const promises = sources.map(s => fetchFromSource(s, trimmed, s.timeout || 5000));
  const results = await Promise.allSettled(promises);

  const stats = [];
  const allItems = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const val = r.value;
      stats.push({
        sourceId: val.sourceId,
        sourceName: val.sourceName,
        ok: val.ok,
        count: val.count,
        tookMs: val.tookMs,
        error: val.error || null
      });
      if (val.ok && val.items.length) {
        allItems.push(...val.items);
      }
    }
  }

  // 相同片名归纳聚合，方便一键切源
  const groupedMap = new Map();

  for (const item of allItems) {
    const key = (item.name || '').toLowerCase().replace(/\s+/g, '');
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        groupKey: key,
        name: item.name,
        pic: item.pic,
        year: item.year,
        area: item.area,
        type: item.type,
        remarks: item.remarks,
        actor: item.actor,
        director: item.director,
        content: item.content,
        sources: []
      });
    }

    const group = groupedMap.get(key);
    if (!group.pic && item.pic) group.pic = item.pic;
    if (!group.content && item.content) group.content = item.content;
    if (!group.actor && item.actor) group.actor = item.actor;

    group.sources.push({
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      vodId: item.vodId,
      remarks: item.remarks,
      playGroups: item.playGroups
    });
  }

  const groupedList = Array.from(groupedMap.values());

  // 内部源按纯净度优先级升序排列（纯净无中插源优先）
  const sourcePriorityMap = new Map(sources.map((s, idx) => [s.id, s.priority ?? idx]));
  for (const group of groupedList) {
    group.sources.sort((a, b) => {
      const pA = sourcePriorityMap.get(a.sourceId) ?? 999;
      const pB = sourcePriorityMap.get(b.sourceId) ?? 999;
      return pA - pB;
    });
  }

  // 智能排序：精确匹配优先，多源优先
  const queryLower = trimmed.toLowerCase();
  groupedList.sort((a, b) => {
    const scoreA = getMatchScore(a, queryLower);
    const scoreB = getMatchScore(b, queryLower);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.sources.length - a.sources.length;
  });

  return {
    query: trimmed,
    tookMs: Date.now() - t0,
    totalSources: sources.length,
    matchedGroups: groupedList.length,
    totalRecords: allItems.length,
    stats,
    groups: groupedList
  };
}

export async function fetchLatestRecommend(source = DEFAULT_SOURCES[0], limit = 18) {
  try {
    const res = await fetch(`${source.api}?ac=detail&pg=1`, {
      signal: createTimeoutSignal(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data.list) ? data.list : [];

    const validItems = [];
    for (const raw of list) {
      const playGroups = parseEpisodes(raw.vod_play_from, raw.vod_play_url);
      if (playGroups.length > 0) {
        validItems.push({
          id: `${source.id}_${raw.vod_id}`,
          sourceId: source.id,
          sourceName: source.name,
          vodId: raw.vod_id,
          name: raw.vod_name?.trim() || '',
          pic: raw.vod_pic || '',
          year: raw.vod_year || '',
          area: raw.vod_area || '',
          type: raw.type_name || '',
          remarks: raw.vod_remarks || '',
          content: stripHtml(raw.vod_content || ''),
          playGroups
        });
      }
      if (validItems.length >= limit) break;
    }

    return validItems;
  } catch (e) {
    return [];
  }
}
