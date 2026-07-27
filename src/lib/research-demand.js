function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactOffer(candidate) {
  const offer = candidate.primaryOffer ?? {};
  return {
    provider: offer.provider ?? null,
    name: offer.name ?? null,
    price: asNumber(offer.price),
    url: offer.url ?? null,
    shopName: offer.shopName ?? null,
    rank: asNumber(offer.rank),
    reviewCount: asNumber(offer.reviewCount),
    reviewAverage: asNumber(offer.reviewAverage),
  };
}

function candidateFromRankingSnapshot(topic, item) {
  return {
    id: `trend:${topic.id}:${item.itemCode}`,
    candidateType: 'research',
    genre: topic.genre,
    target: topic.target,
    primaryOffer: {
      provider: 'rakuten',
      name: item.name,
      price: item.price,
      url: item.url,
      shopName: item.shopName,
      rank: item.rank,
      reviewCount: item.reviewCount,
      reviewAverage: item.reviewAverage,
    },
    sourceReferences: [
      {
        publisher: '楽天市場',
        title: `${topic.label} / ${topic.ranking?.period === 'realtime' ? 'リアルタイム' : topic.ranking?.period ?? 'ランキング'}ランキング ${item.rank ?? '上位'}位`,
        url: item.url,
      },
    ],
  };
}

function researchCandidates(candidateData, rankingSnapshot) {
  const byId = new Map();
  for (const topic of rankingSnapshot?.topics ?? []) {
    for (const item of topic.items ?? []) byId.set(`trend:${topic.id}:${item.itemCode}`, candidateFromRankingSnapshot(topic, item));
  }
  for (const candidate of candidateData.candidates ?? []) byId.set(candidate.id, candidate);
  return [...byId.values()];
}

function rankingComponent(rank) {
  if (rank == null) return { name: '楽天ランキング', available: false, score: null, max: 30, reason: 'ランキング順位を取得できません。' };
  const score = Math.max(1, Math.round(((301 - Math.min(rank, 300)) / 300) * 30));
  return { name: '楽天ランキング', available: true, score, max: 30, reason: `楽天ランキング${rank}位を確認しました。` };
}

function seasonalComponent(topic) {
  if (!topic) return { name: '季節一致度', available: false, score: null, max: 25, reason: '季節テーマとの対応を確認できません。' };
  const score = Math.min(25, Math.max(1, Math.round((Number(topic.priority ?? 0) / 100) * 25)));
  return { name: '季節一致度', available: true, score, max: 25, reason: `有効な季節テーマ「${topic.label}」に一致しています。` };
}

function trendComponent(previous, offer) {
  if (!previous?.offer || offer.rank == null || previous.offer.rank == null) {
    return { name: 'トレンド上昇', available: false, score: null, max: 20, reason: '前回比較できる順位履歴がありません。' };
  }
  const rankChange = previous.offer.rank - offer.rank;
  const reviewChange = Math.max(0, (offer.reviewCount ?? 0) - (previous.offer.reviewCount ?? 0));
  const score = Math.min(20, Math.max(0, rankChange * 2) + Math.min(10, Math.floor(reviewChange / 10)));
  return {
    name: 'トレンド上昇',
    available: true,
    score,
    max: 20,
    reason: `前回比: 順位${rankChange >= 0 ? `${rankChange}位上昇` : `${Math.abs(rankChange)}位低下`}、レビュー${reviewChange}件増加。`,
  };
}

function reviewComponent(offer) {
  if (offer.reviewCount == null) return { name: 'レビュー根拠', available: false, score: null, max: 15, reason: 'レビュー件数を取得できません。' };
  const score = Math.min(15, Math.max(1, Math.floor(Math.log10(offer.reviewCount + 1) * 4)));
  const average = offer.reviewAverage == null ? '評価未取得' : `評価${offer.reviewAverage}`;
  return { name: 'レビュー根拠', available: true, score, max: 15, reason: `${average}、レビュー${offer.reviewCount}件を確認しました。` };
}

function competitionComponent(referenceArticles) {
  const articleWithCount = referenceArticles.find((article) => Number.isFinite(Number(article.competitorArticleCount)));
  if (!articleWithCount) return { name: '競合記事数', available: false, score: null, max: 10, reason: '競合記事数は未確認です。' };
  const count = Number(articleWithCount.competitorArticleCount);
  const score = count <= 5 ? 10 : count <= 20 ? 7 : count <= 50 ? 4 : 1;
  return {
    name: '競合記事数',
    available: true,
    score,
    max: 10,
    reason: `${articleWithCount.competitorCountSource ?? '手動確認'}で競合記事${count}件として確認しました。`,
  };
}

function scoreSummary(components) {
  const available = components.filter((component) => component.available);
  const score = available.reduce((total, component) => total + component.score, 0);
  const max = available.reduce((total, component) => total + component.max, 0);
  const normalized = max ? Math.round((score / max) * 100) : 0;
  return {
    score,
    max,
    normalized,
    priority: normalized >= 75 ? '高' : normalized >= 45 ? '中' : '低',
    confidence: available.length >= 4 ? '高' : available.length >= 2 ? '中' : '低',
  };
}

function findOwnedExperience(experiences, candidate) {
  return experiences.find(
    (experience) =>
      experience.experienceType === 'owned' &&
      (experience.productId === candidate.id || experience.productName === candidate.primaryOffer?.name)
  );
}

function relatedProducts(candidates, genre, currentId) {
  return candidates
    .filter((candidate) => candidate.genre === genre && candidate.id !== currentId)
    .slice(0, 4)
    .map((candidate) => ({ id: candidate.id, name: candidate.primaryOffer?.name ?? null, rank: asNumber(candidate.primaryOffer?.rank) }));
}

/**
 * 楽天ランキングと手動確認済みの参考記事メタデータから、日次の需要リサーチを作成する。
 * 検索数は取得しないため、推測値を月間検索数として出力しない。
 */
export function createResearchSnapshot({ candidateData, rankingSnapshot, topics, referenceArticles, experiences, previousSnapshot, generatedAt }) {
  const candidates = researchCandidates(candidateData, rankingSnapshot);
  const topicByGenre = new Map((topics ?? []).map((topic) => [topic.genre, topic]));
  const previousByCandidateId = new Map((previousSnapshot?.opportunities ?? []).map((entry) => [entry.candidateId, entry]));
  const checkedAt = generatedAt;

  const opportunities = candidates.map((candidate) => {
    const offer = compactOffer(candidate);
    const topic = topicByGenre.get(candidate.genre);
    const articles = (referenceArticles ?? []).filter((article) => article.genre === candidate.genre);
    const ownedExperience = findOwnedExperience(experiences ?? [], candidate);
    const components = [
      rankingComponent(offer.rank),
      seasonalComponent(topic),
      trendComponent(previousByCandidateId.get(candidate.id), offer),
      reviewComponent(offer),
      competitionComponent(articles),
    ];
    const score = scoreSummary(components);
    const rankingSource = (candidate.sourceReferences ?? []).find((source) => source.publisher === '楽天市場');

    return {
      id: `research:${checkedAt.slice(0, 10)}:${candidate.id}`,
      candidateId: candidate.id,
      genre: candidate.genre,
      target: candidate.target,
      candidateType: candidate.candidateType,
      selectionStatus: candidate.candidateType === 'ready' ? '採用済み' : '確認待ち',
      offer,
      demandReason: components.filter((component) => component.available).map((component) => component.reason),
      demandEvidence: [
        rankingSource
          ? { type: '楽天ランキング', source: rankingSource.url, checkedAt, detail: rankingSource.title }
          : null,
        ...articles
          .filter((article) => article.url && article.checkedAt)
          .map((article) => ({ type: '参考記事メタデータ', source: article.url, checkedAt: article.checkedAt, detail: `${article.publisher}: ${article.title}` })),
      ].filter(Boolean),
      searchDemand: {
        monthlySearchVolume: null,
        status: '未取得',
        reason: '正確な検索数を取得するAPIを設定していないため、推測値は表示しません。',
      },
      relatedProducts: relatedProducts(candidates, candidate.genre, candidate.id),
      referenceArticles: articles.map((article) => ({
        url: article.url ?? null,
        title: article.title ?? null,
        publisher: article.publisher ?? null,
        checkedAt: article.checkedAt ?? null,
        whyLikelyTop: article.whyLikelyTop ?? null,
        structurePatterns: article.structurePatterns ?? [],
        comparisonAxes: article.comparisonAxes ?? [],
      })),
      topReasonAnalysis: articles.map((article) => article.whyLikelyTop).filter(Boolean),
      structurePatterns: [...new Set(articles.flatMap((article) => article.structurePatterns ?? []))],
      comparisonAxes: [...new Set(articles.flatMap((article) => article.comparisonAxes ?? []))],
      demandScore: { components, ...score },
      experience: ownedExperience
        ? { type: 'owned', experienceId: ownedExperience.id, checkedAt: ownedExperience.checkedAt ?? null }
        : { type: 'none', experienceId: null, checkedAt: null },
      articlePriority: score.priority,
      confidence: score.confidence,
      checkedAt,
    };
  });

  return {
    schemaVersion: 1,
    generatedAt,
    candidateDataGeneratedAt: candidateData.generatedAt ?? null,
    rankingSnapshotGeneratedAt: rankingSnapshot?.generatedAt ?? null,
    opportunities,
  };
}
