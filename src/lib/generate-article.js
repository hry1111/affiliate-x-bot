function compactName(name) {
  const value = String(name ?? '対象商品');
  return value.length > 72 ? `${value.slice(0, 71)}…` : value;
}

function findOpportunity(request, research) {
  const opportunities = research.opportunities ?? [];
  if (request.curatedProductId) {
    const curatedOpportunity = opportunities.find((entry) => entry.candidateId === request.curatedProductId);
    if (curatedOpportunity) return curatedOpportunity;
  }
  if (request.researchId) return opportunities.find((entry) => entry.id === request.researchId) ?? null;
  return opportunities.find((entry) => entry.genre === request.genre) ?? null;
}

function findOwnedExperience(experiences, opportunity) {
  return experiences.find(
    (experience) =>
      experience.experienceType === 'owned' &&
      (experience.productId === opportunity.candidateId || experience.productName === opportunity.offer.name)
  );
}

function experienceSection(experience) {
  if (!experience) {
    return {
      type: 'not-used',
      sourceId: null,
      text: null,
      note: 'Hiroは未使用。使用感は記載せず、一次情報と比較軸だけで構成する。',
    };
  }
  const lines = [
    experience.purchaseReason ? `購入理由: ${experience.purchaseReason}` : null,
    experience.usagePeriod ? `使用期間: ${experience.usagePeriod}` : null,
    ...(experience.hiroWords ?? []),
    ...(experience.pros ?? []).map((point) => `良かった点: ${point}`),
    ...(experience.cons ?? []).map((point) => `気になった点: ${point}`),
  ].filter(Boolean);
  return { type: 'owned', sourceId: experience.id, text: lines.join('\n') || '【ここに体験：Hiro本人の言葉を追加】' };
}

function draftVariant({ style, opportunity, experience, curatedProduct, generatedAt }) {
  const productName = compactName(curatedProduct?.displayName ?? opportunity.offer.name);
  const target = opportunity.target || '選び方で迷っている人';
  const axes = opportunity.comparisonAxes?.length ? opportunity.comparisonAxes : ['価格と容量', '使う場面', '確認すべき仕様'];
  const sourceReferences = [
    ...(curatedProduct?.sourceReferences ?? []),
    ...(opportunity.referenceArticles ?? []),
  ].filter((source, index, sources) => source.url && sources.findIndex((entry) => entry.url === source.url) === index);
  const titleByStyle = {
    problem: `${target}向け ${productName}の選び方`,
    comparison: `${productName}を比較するときの${axes.slice(0, 2).join('・')}`,
    avoid: `${productName}で失敗しないために確認したいこと`,
  };
  const introductionByStyle = {
    problem: `${target}が、用途に合う商品を選ぶための確認項目を整理する下書きです。`,
    comparison: `ランキングや価格だけで決めず、${axes.join('・')}を確認するための下書きです。`,
    avoid: `買ったあとに合わなかったと感じないよう、確認条件を先に整理する下書きです。`,
  };
  const evidenceHeading = experience.type === 'owned' ? '実体験で確認できたこと' : '根拠と購入前の確認方法';

  return {
    id: `article:${opportunity.id}:${style}`,
    style,
    status: '確認待ち',
    autoPublish: false,
    generatedAt,
    disclosureText: '【PR】',
    genre: opportunity.genre,
    researchId: opportunity.id,
    curatedProductId: curatedProduct?.id ?? null,
    target,
    searchIntent: `${opportunity.genre}の商品を、用途・条件・比較軸で失敗なく選びたい。`,
    title: titleByStyle[style],
    introduction: introductionByStyle[style],
    headings: [
      '最初に確認したい使う場面と条件',
      `${productName}を比較するときの軸`,
      evidenceHeading,
      '向く人・見送る条件',
      '購入前に販売ページで確認すること',
    ],
    comparisonTable: axes.map((axis) => ({ item: axis, purpose: '購入前に販売ページまたは一次情報で確認する。' })),
    productEvaluations: [
      {
        productName,
        sourceFacts: `楽天ランキング${opportunity.offer.rank ?? '未取得'}位、レビュー${opportunity.offer.reviewCount ?? '未取得'}件（${opportunity.checkedAt}確認）。`,
        evaluation: '仕様と比較軸を確認してから、Hiroが追記する。',
      },
      ...opportunity.relatedProducts.slice(0, 2).map((product) => ({
        productName: compactName(product.name),
        sourceFacts: `楽天ランキング${product.rank ?? '未取得'}位として候補化。`,
        evaluation: '同じ比較軸で販売ページを確認する。',
      })),
    ],
    experience,
    claimsPolicy: experience.type === 'owned'
      ? '使用感はexperience-db.jsonのowned記録にある内容だけを記載する。'
      : 'Hiroは未使用。使用感、効果の断定、個人の感想は記載せず、一次情報と確認日時付きのランキング情報だけを扱う。',
    suitableFor: [target, '購入前に仕様と条件を確認できる人'],
    notSuitableFor: ['必要な仕様やサイズが商品説明と合わない人', '販売ページの一次情報を確認せずに即決したい人'],
    purchaseGuide: {
      label: '販売ページで価格・仕様・在庫を確認する',
      url: opportunity.offer.url ?? null,
      checkedAt: opportunity.checkedAt,
      note: '価格、在庫、キャンペーン条件は変動するため、購入直前に再確認する。',
    },
    cautions: ['広告表現や商品の注意事項を販売ページで確認する。', '価格、在庫、ランキングは確認日時時点の情報であり、保証しない。'],
    primaryInformation: curatedProduct?.primaryInformation ?? null,
    sourceReferences,
    referenceUse: {
      allowedUse: '構成・比較軸・情報設計の型のみ',
      copiedText: curatedProduct?.referenceUse?.copiedText === true,
      manualCopyCheckAt: curatedProduct?.referenceUse?.manualCopyCheckAt ?? null,
    },
    demandEvidence: opportunity.demandEvidence,
    articlePriority: opportunity.articlePriority,
  };
}

/**
 * 手動で指定されたジャンルまたはリサーチ候補に対して、公開前の比較記事案を3案生成する。
 */
export function generateArticleDrafts({ requests, research, experiences, curatedProducts, generatedAt }) {
  const drafts = [];
  const skipped = [];

  for (const request of requests ?? []) {
    if (request.enabled === false) continue;
    const opportunity = findOpportunity(request, research);
    if (!opportunity) {
      skipped.push({ requestId: request.id, reason: '対象のリサーチ候補が見つかりません。' });
      continue;
    }
    const curatedProduct = (curatedProducts ?? []).find(
      (product) => product.id === request.curatedProductId || product.id === opportunity.candidateId
    );
    const experience = experienceSection(findOwnedExperience(experiences ?? [], opportunity));
    for (const style of ['problem', 'comparison', 'avoid']) {
      drafts.push(draftVariant({ style, opportunity, experience, curatedProduct, generatedAt }));
    }
  }

  return { schemaVersion: 1, generatedAt, drafts, skipped };
}
