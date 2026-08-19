import { createSocialStrategy } from './socialStrategy.js';

function tokyoMonth(date) {
  return Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Tokyo' }).format(date));
}

function periodLabel(period) {
  return {
    realtime: 'リアルタイム',
    daily: 'デイリー',
    weekly: '週間',
    monthly: '月間',
  }[period] ?? 'ランキング';
}

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('ja-JP');
}

function includesAny(text, keywords) {
  return !keywords?.length || keywords.some((keyword) => text.includes(normalize(keyword)));
}

function includesExcluded(text, keywords) {
  return keywords?.some((keyword) => text.includes(normalize(keyword))) ?? false;
}

function rankingScore(item) {
  const rank = Number(item.rank);
  return Number.isFinite(rank) ? Math.max(0, 40 - Math.min(rank - 1, 40)) : 0;
}

function reviewScore(item) {
  const average = Number(item.reviewAverage);
  const count = Number(item.reviewCount);
  if (!Number.isFinite(average) || !Number.isFinite(count)) return 0;
  return Math.round(Math.min(average / 5, 1) * 10) + Math.min(Math.floor(count / 100), 10);
}

function toOffer(item) {
  return {
    provider: 'rakuten',
    label: '楽天市場',
    name: item.name,
    price: item.price,
    url: item.url,
    imageUrl: item.imageUrl,
    shopName: item.shopName ?? null,
    rank: item.rank ?? null,
    reviewCount: item.reviewCount ?? null,
    reviewAverage: item.reviewAverage ?? null,
  };
}

function createReviewDraft(topic, item) {
  return JSON.stringify(
    {
      id: `review-${topic.id}-${item.itemCode.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
      enabled: false,
      priority: topic.priority ?? 0,
      genre: topic.genre,
      target: topic.target,
      problem: topic.problem,
      postMode: 'research',
      reason: '比較記事と商品仕様を確認した上で、自分の言葉で選定理由を入力してください。',
      caution: topic.caution,
      primaryProvider: 'rakuten',
      sourceReferences: [],
      rakuten: { itemCode: item.itemCode },
    },
    null,
    2
  );
}

/**
 * 日本時間の月に合わせて、楽天ランキングを取得する季節テーマを絞り込む。
 */
export function isSeasonalTopicActive(topic, now = new Date()) {
  if (topic.enabled === false) return false;
  if (!topic.activeMonths?.length) return true;
  return topic.activeMonths.includes(tokyoMonth(now));
}

/**
 * 楽天ランキング内から、季節テーマとキーワードに合う確認待ちの商品を作る。
 * 比較根拠が未登録のため、ここでは投稿文を生成しない。
 */
export function createTrendCandidates({ topics, itemsByTopic, config, now = new Date() }) {
  const candidatesByItemCode = new Map();

  for (const topic of topics.filter((entry) => isSeasonalTopicActive(entry, now))) {
    for (const item of itemsByTopic.get(topic.id) ?? []) {
      const name = normalize(item.name);
      const ranking = topic.ranking ?? {};
      if (!includesAny(name, ranking.includeAnyKeywords)) continue;
      if (includesExcluded(name, ranking.excludeKeywords)) continue;

      const score = Number(topic.priority ?? 0) + rankingScore(item) + reviewScore(item);
      const offer = toOffer(item);
      const candidate = {
        id: `trend:${topic.id}:${item.itemCode}`,
        candidateType: 'discovery',
        genre: topic.genre,
        target: topic.target,
        problem: topic.problem,
        reason: `${topic.label}の候補として、楽天市場${periodLabel(ranking.period)}ランキング${item.rank ?? '上位'}位の商品。`,
        caution: topic.caution,
        postMode: 'discovery',
        sourceReferences: [
          {
            publisher: '楽天市場',
            title: `${topic.label} / ${periodLabel(ranking.period)}ランキング ${item.rank ?? '上位'}位`,
            url: item.url,
          },
        ],
        primaryOffer: offer,
        purchaseOptions: [offer],
        copyVariants: [],
        selectionSummary: `${topic.label} / 楽天${periodLabel(ranking.period)} ${item.rank ?? '上位'}位${
          item.reviewAverage != null ? ` / 評価 ${item.reviewAverage}（${item.reviewCount ?? 0}件）` : ''
        }`,
        reviewDraft: createReviewDraft(topic, item),
        score,
      };
      candidate.socialStrategy = createSocialStrategy(candidate);

      const existing = candidatesByItemCode.get(item.itemCode);
      if (!existing || candidate.score > existing.score) candidatesByItemCode.set(item.itemCode, candidate);
    }
  }

  return [...candidatesByItemCode.values()]
    .sort((a, b) => b.score - a.score || a.primaryOffer.price - b.primaryOffer.price)
    .slice(0, config.maxTrendCandidatesPerRun ?? 6);
}
