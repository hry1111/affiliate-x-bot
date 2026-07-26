const ENDPOINT = 'https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601';
const REQUEST_INTERVAL_MS = 1100;
const MAX_RATE_LIMIT_RETRIES = 3;

let nextRequestAt = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestSlot() {
  const scheduledAt = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = scheduledAt + REQUEST_INTERVAL_MS;
  await wait(Math.max(0, scheduledAt - Date.now()));
}

async function fetchWithRateLimit(url, headers) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    await waitForRequestSlot();
    const res = await fetch(url, { headers });
    if (res.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) return res;

    // 楽天APIのレート制限に達した場合も、次の予約枠まで待機して再試行する。
    console.warn(`楽天ランキングAPIのレート制限に達したため、${REQUEST_INTERVAL_MS / 1000}秒後に再試行します。`);
  }

  throw new Error('楽天ランキングAPIの再試行回数を超えました。');
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeItem(item, watch) {
  const itemCode = item.itemCode;
  if (!itemCode) return null;

  return {
    key: `rakuten:${itemCode}`,
    name: item.itemName,
    price: item.itemPrice,
    url: item.affiliateUrl || item.itemUrl,
    imageUrl: item.mediumImageUrls?.[0]?.imageUrl || null,
    shopName: item.shopName || null,
    itemCode,
    rank: item.rank ?? null,
    reviewCount: toNumber(item.reviewCount),
    reviewAverage: toNumber(item.reviewAverage),
    source: {
      type: 'rakuten-ranking',
      watchId: watch.id,
      period: watch.period ?? 'realtime',
      genreId: watch.genreId ?? null,
    },
  };
}

function passesFilters(item, watch) {
  if (watch.minPrice != null && item.price < watch.minPrice) return false;
  if (watch.maxPrice != null && item.price > watch.maxPrice) return false;
  if (watch.minReviewCount != null && (item.reviewCount ?? 0) < watch.minReviewCount) return false;
  if (watch.minReviewAverage != null && (item.reviewAverage ?? 0) < watch.minReviewAverage) return false;
  return true;
}

/**
 * 楽天市場ランキングAPIからランキング商品を取得する。
 * period は realtime / daily / weekly / monthly を想定する。
 */
export async function fetchRankingItems(watch, { applicationId, accessKey, affiliateId, requestOrigin, requestReferer }) {
  const pages = Math.max(1, Math.min(Number(watch.pages ?? 1), 10));
  const period = watch.period ?? 'realtime';
  const items = [];

  for (let page = 1; page <= pages; page += 1) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('format', 'json');
    url.searchParams.set('applicationId', applicationId);
    url.searchParams.set('accessKey', accessKey);
    if (affiliateId) url.searchParams.set('affiliateId', affiliateId);
    url.searchParams.set('period', period);
    url.searchParams.set('page', String(page));
    if (watch.genreId != null) url.searchParams.set('genreId', String(watch.genreId));
    if (watch.age != null) url.searchParams.set('age', String(watch.age));
    if (watch.sex != null) url.searchParams.set('sex', String(watch.sex));

    const headers = {};
    if (requestOrigin) headers.Origin = requestOrigin;
    if (requestReferer) headers.Referer = requestReferer;
    const res = await fetchWithRateLimit(url, headers);
    if (!res.ok) {
      throw new Error(`楽天ランキングAPIエラー (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    for (const wrapper of data.items ?? data.Items ?? []) {
      const rawItem = wrapper.item ?? wrapper.Item ?? wrapper;
      if (!rawItem) continue;
      const item = normalizeItem(rawItem, watch);
      if (item && passesFilters(item, watch)) items.push(item);
    }
  }

  return items;
}
