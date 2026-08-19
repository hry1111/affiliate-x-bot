export const SOCIAL_STRATEGY_THRESHOLDS = Object.freeze({
  value: 21,
  discovery: 21,
  hybrid: 20,
  x: 7,
});

const EXPERIENCE_PATTERNS = /使ってみた|使った|買ってよかった|愛用|リピート/u;
const SALE_PATTERNS = [/セール/u, /値下げ/u, /割引/u, /半額/u, /クーポン/u, /\d+%\s*off/iu, /価格優位/u];
const UTILITY_PATTERNS = [/便利/u, /実用/u, /持ち運び/u, /防災/u, /収納/u, /掃除/u, /調理/u, /充電/u, /家事/u, /対策/u, /省スペース/u, /冷却/u, /扇風機/u, /キッチン/u];
const FUNCTION_PATTERNS = [/機能/u, /\d+way/iu, /\d+段階/u, /モード/u, /自動/u, /静音/u, /軽量/u, /大容量/u, /防水/u, /充電/u, /冷却/u, /対応/u, /セット/u, /コンパクト/u];
const TIME_PATTERNS = [/時短/u, /省力/u, /自動/u, /ワンタッチ/u, /簡単/u, /手間/u, /ながら/u, /まとめて/u, /すぐ/u];
const COMPARISON_PATTERNS = [/比較/u, /ランキング/u, /優位/u, /受賞/u, /レビュー/u];
const NOVELTY_PATTERNS = [/珍し/u, /意外/u, /新感覚/u, /アイデア/u, /\d+way/iu, /変形/u, /ユニーク/u, /冷却プレート/u, /話題/u, /限定/u];
const DESIRE_PATTERNS = [/欲し/u, /かわいい/u, /可愛い/u, /おしゃれ/u, /便利/u, /人気/u, /快適/u, /楽し/u, /ギフト/u, /プレゼント/u, /ご褒美/u];
const VISUAL_PATTERNS = [/かわいい/u, /可愛い/u, /おしゃれ/u, /デザイン/u, /カラー/u, /映え/u, /コンパクト/u, /ミニ/u, /変形/u, /\d+way/iu];
const GIFT_PATTERNS = [/ギフト/u, /プレゼント/u, /贈り/u, /誕生日/u, /母の日/u, /父の日/u, /敬老/u, /お祝い/u];

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function countMatches(text, patterns) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function cleanEvidenceText(value) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  return EXPERIENCE_PATTERNS.test(text) ? '' : text;
}

function compactProductName(candidate) {
  const source = cleanEvidenceText(candidate.primaryOffer?.name) || 'この商品';
  const cleaned = source
    .replace(/【[^】]*】/gu, ' ')
    .replace(/楽天\s*\d+位/gu, ' ')
    .replace(/最安|最強/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return cleaned.length > 34 ? `${cleaned.slice(0, 33)}…` : cleaned;
}

function candidateText(candidate) {
  return [
    candidate.primaryOffer?.name,
    candidate.genre,
    candidate.target,
    candidate.problem,
    candidate.reason,
    candidate.selectionSummary,
    ...(candidate.sourceReferences ?? []).map((source) => source.title),
  ]
    .map(cleanEvidenceText)
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ja-JP');
}

function scoreValue(candidate, text) {
  const offer = candidate.primaryOffer ?? {};
  const price = numberOrNull(offer.price);
  const rank = numberOrNull(offer.rank);
  const reviewCount = numberOrNull(offer.reviewCount);
  const reviewAverage = numberOrNull(offer.reviewAverage);
  const demandScore = numberOrNull(candidate.demandScore?.normalized);
  const references = (candidate.sourceReferences ?? []).filter((source) => source?.url);
  const saleEvidence = candidate.postMode === 'sale' || countMatches(text, SALE_PATTERNS) > 0;
  const utilityMatches = countMatches(text, UTILITY_PATTERNS);
  const functionMatches = countMatches(text, FUNCTION_PATTERNS);
  const timeMatches = countMatches(text, TIME_PATTERNS);
  const comparisonMatches = countMatches(text, COMPARISON_PATTERNS);

  const priceAdvantage = price == null ? 0 : saleEvidence ? 5 : price <= 3000 ? 3 : price <= 8000 ? 2 : 1;
  const utility = utilityMatches >= 3 ? 5 : utilityMatches === 2 ? 4 : utilityMatches === 1 ? 3 : candidate.target && candidate.problem ? 2 : 1;
  const functionality = functionMatches >= 3 ? 5 : functionMatches === 2 ? 4 : functionMatches === 1 ? 3 : references.length ? 2 : 1;
  const timeSaving = timeMatches >= 2 ? 5 : timeMatches === 1 ? 4 : utilityMatches >= 2 ? 2 : 1;
  const comparativeAdvantage = references.length >= 2 && comparisonMatches > 0
    ? 5
    : references.length >= 2
      ? 4
      : rank != null && rank <= 10
        ? 4
        : rank != null || demandScore >= 70
          ? 3
          : candidate.reason
            ? 2
            : 1;
  const trust = reviewAverage >= 4.3 && reviewCount >= 1000
    ? 5
    : reviewAverage >= 4 && reviewCount >= 100
      ? 4
      : references.length >= 2 || (rank != null && reviewCount >= 100)
        ? 4
        : references.length > 0
          ? 3
          : offer.url
            ? 2
            : 0;

  const result = {
    price_advantage: priceAdvantage,
    utility,
    functionality,
    time_saving: timeSaving,
    comparative_advantage: comparativeAdvantage,
    trust,
  };
  return { ...result, total: Object.values(result).reduce((sum, score) => sum + score, 0) };
}

function scoreDiscovery(candidate, text) {
  const offer = candidate.primaryOffer ?? {};
  const hasImage = Boolean(offer.imageUrl);
  const references = (candidate.sourceReferences ?? []).filter((source) => source?.url);
  const noveltyMatches = countMatches(text, NOVELTY_PATTERNS);
  const desireMatches = countMatches(text, DESIRE_PATTERNS);
  const visualMatches = countMatches(text, VISUAL_PATTERNS);
  const giftMatches = countMatches(text, GIFT_PATTERNS);
  const reviewCount = numberOrNull(offer.reviewCount);
  const reviewAverage = numberOrNull(offer.reviewAverage);
  const evidenceCount = [offer.price != null, offer.rank != null, reviewCount != null, candidate.reason, references.length > 0].filter(Boolean).length;

  const instantUnderstanding = hasImage && candidate.problem && candidate.reason ? 4 : hasImage && candidate.reason ? 3 : candidate.reason ? 2 : 1;
  const novelty = noveltyMatches >= 2 ? 5 : noveltyMatches === 1 ? 4 : candidate.candidateType === 'discovery' ? 2 : 1;
  const desirability = desireMatches >= 2
    ? 5
    : desireMatches === 1
      ? 4
      : reviewAverage >= 4.3 && reviewCount >= 500
        ? 3
        : candidate.target && candidate.reason
          ? 2
          : 1;
  const socialVisual = hasImage && visualMatches >= 2 ? 5 : hasImage && visualMatches === 1 ? 3 : hasImage ? 2 : 0;
  const giftability = giftMatches >= 2 ? 5 : giftMatches === 1 ? 4 : 0;
  const valueStory = evidenceCount >= 4 ? 5 : evidenceCount === 3 ? 4 : evidenceCount === 2 ? 3 : evidenceCount === 1 ? 2 : 1;

  const result = {
    instant_understanding: instantUnderstanding,
    novelty,
    desirability,
    social_visual: socialVisual,
    giftability,
    value_story: valueStory,
  };
  return { ...result, total: Object.values(result).reduce((sum, score) => sum + score, 0) };
}

function scoreX(candidate, valueScore, discoveryScore) {
  const nameLength = String(candidate.primaryOffer?.name ?? '').length;
  const reasonLength = String(candidate.reason ?? '').length;
  const scrollStop = valueScore.total >= 25 || discoveryScore.total >= 24 ? 3 : valueScore.total >= 18 || discoveryScore.total >= 18 ? 2 : 1;
  const shortCopyFit = nameLength <= 60 && reasonLength <= 120 ? 3 : nameLength <= 100 && reasonLength <= 180 ? 2 : 0;
  const conversationPotential = discoveryScore.novelty >= 4 || discoveryScore.giftability >= 4 ? 2 : candidate.problem ? 1 : 0;
  const clickIntent = valueScore.total >= 21 || discoveryScore.total >= 21 ? 2 : candidate.primaryOffer?.url && candidate.primaryOffer?.price != null ? 1 : 0;
  const result = {
    scroll_stop: scrollStop,
    short_copy_fit: shortCopyFit,
    conversation_potential: conversationPotential,
    click_intent: clickIntent,
  };
  return { ...result, total: Object.values(result).reduce((sum, score) => sum + score, 0) };
}

function safetyEligible(candidate) {
  const statuses = [candidate.status, candidate.qualityStatus, candidate.selectionStatus]
    .map((status) => String(status ?? '').toLocaleLowerCase('ja-JP'));
  const blocked = statuses.some((status) => /公開不可|reject|blocked|停止/u.test(status));
  return !blocked && Boolean(candidate.primaryOffer?.name && candidate.primaryOffer?.url);
}

export function classifySocialStrategy({ valueTotal, discoveryTotal, xTotal, eligible = true }) {
  if (!eligible || xTotal < SOCIAL_STRATEGY_THRESHOLDS.x) return 'REJECT';
  if (valueTotal >= SOCIAL_STRATEGY_THRESHOLDS.hybrid && discoveryTotal >= SOCIAL_STRATEGY_THRESHOLDS.hybrid) return 'HYBRID';
  if (valueTotal >= SOCIAL_STRATEGY_THRESHOLDS.value && discoveryTotal < SOCIAL_STRATEGY_THRESHOLDS.discovery) return 'VALUE';
  if (discoveryTotal >= SOCIAL_STRATEGY_THRESHOLDS.discovery && valueTotal < SOCIAL_STRATEGY_THRESHOLDS.value) return 'DISCOVERY';
  return 'REJECT';
}

function formatPrice(price) {
  const value = numberOrNull(price);
  return value == null ? '価格未確認' : `¥${value.toLocaleString('ja-JP')}`;
}

function buildValueReason(candidate, score) {
  const facts = [`価格情報 ${formatPrice(candidate.primaryOffer?.price)}`];
  if (score.functionality >= 4) facts.push('機能情報が具体的');
  if (score.time_saving >= 4) facts.push('時短・省力につながる記述あり');
  if ((candidate.sourceReferences ?? []).length) facts.push(`確認可能な根拠 ${(candidate.sourceReferences ?? []).length}件`);
  return `${facts.join('、')}。価格だけでなく実用面も比較できる。`;
}

function buildDiscoveryReason(candidate, score) {
  const facts = [];
  if (score.novelty >= 4) facts.push('商品名・説明に意外性の根拠がある');
  if (score.giftability >= 4) facts.push('ギフト用途の記述がある');
  if (candidate.primaryOffer?.imageUrl) facts.push('商品画像URLあり（画像内容は未解析）');
  return facts.length ? `${facts.join('、')}。` : '珍しさや見た目の根拠が不足しているため、発見価値は控えめに評価。';
}

function buildHook(candidate, postType) {
  const name = compactProductName(candidate);
  const price = formatPrice(candidate.primaryOffer?.price);
  if (postType === 'VALUE') return `${name}、${price}でこの機能構成なら比較候補。`;
  if (postType === 'DISCOVERY') return `${name}、こういう選択肢があるのは知らなかった。`;
  if (postType === 'HYBRID') return `${name}、発想が面白くて${price}の実用性も気になる。`;
  return `${name}は、紹介前に根拠をもう少し確認したい。`;
}

function buildReasonToPost(candidate, postType, xScore) {
  const rank = numberOrNull(candidate.primaryOffer?.rank);
  const referenceCount = (candidate.sourceReferences ?? []).filter((source) => source?.url).length;
  if (postType === 'REJECT') return `X Score ${xScore.total}/10。投稿基準または確認根拠が不足している。`;
  if (rank != null) return `楽天ランキング${rank}位の確認情報があり、短文で魅力を説明できる。投稿前に価格・在庫を再確認する。`;
  if (referenceCount) return `確認可能な根拠が${referenceCount}件あり、短文で紹介理由を示せる。`;
  return `X Score ${xScore.total}/10。価格と商品情報を短文で説明できる。`;
}

function confidenceFor(candidate) {
  const offer = candidate.primaryOffer ?? {};
  const evidenceCount = [
    offer.price != null,
    offer.rank != null,
    offer.reviewCount != null && offer.reviewAverage != null,
    Boolean(offer.imageUrl),
    Boolean(cleanEvidenceText(candidate.reason)),
    (candidate.sourceReferences ?? []).some((source) => source?.url),
  ].filter(Boolean).length;
  return evidenceCount >= 5 ? 'high' : evidenceCount >= 3 ? 'medium' : 'low';
}

/**
 * 既存の確認済みcandidate情報だけからSNS投稿適性を決定論的に評価する。
 */
export function createSocialStrategy(candidate) {
  const text = candidateText(candidate);
  const valueScore = scoreValue(candidate, text);
  const discoveryScore = scoreDiscovery(candidate, text);
  const xScore = scoreX(candidate, valueScore, discoveryScore);
  const postType = classifySocialStrategy({
    valueTotal: valueScore.total,
    discoveryTotal: discoveryScore.total,
    xTotal: xScore.total,
    eligible: safetyEligible(candidate),
  });
  return {
    version: '1.0',
    post_type: postType,
    value_score: valueScore,
    discovery_score: discoveryScore,
    x_score: xScore,
    value_reason: buildValueReason(candidate, valueScore),
    discovery_reason: buildDiscoveryReason(candidate, discoveryScore),
    reason_to_post: buildReasonToPost(candidate, postType, xScore),
    hook: buildHook(candidate, postType),
    confidence: confidenceFor(candidate),
  };
}

export function isExperienceClaim(text) {
  return EXPERIENCE_PATTERNS.test(String(text ?? ''));
}

export function normalizeScore(value, maximum) {
  return clamp(Number(value) || 0, 0, maximum);
}
