import test from 'node:test';
import assert from 'node:assert/strict';
import { composePostVariants } from '../src/lib/composePostVariants.js';
import { createSocialStrategy, classifySocialStrategy, isExperienceClaim } from '../src/lib/socialStrategy.js';
import { createCuratedCandidates } from '../src/lib/curatedCandidates.js';
import { qualityCheckArticle } from '../src/lib/quality-check.js';
import { generateSocialDrafts } from '../src/lib/generate-social.js';
import { formatSocialStrategy } from '../docs/socialStrategyView.js';

function candidate(overrides = {}) {
  return {
    id: 'candidate-1',
    candidateType: 'ready',
    genre: '日用品',
    target: '毎日の手間を減らしたい人',
    problem: '家事の手間と収納で迷っている',
    reason: '確認済みの比較記事で機能と使う場面を比較できる。',
    caution: '仕様と価格を販売ページで確認してください。',
    postMode: 'research',
    sourceReferences: [
      { publisher: '比較媒体A', title: '機能比較', url: 'https://example.com/a' },
      { publisher: '比較媒体B', title: '実用性比較', url: 'https://example.com/b' },
    ],
    primaryOffer: {
      name: '自動・時短・静音・軽量の多機能収納ツール セール',
      price: 2980,
      url: 'https://example.com/item',
      imageUrl: 'https://example.com/item.jpg',
      rank: 3,
      reviewCount: 2000,
      reviewAverage: 4.6,
    },
    ...overrides,
  };
}

test('A: 明確なVALUE候補をVALUEへ分類する', () => {
  const strategy = createSocialStrategy(candidate());
  assert.equal(strategy.post_type, 'VALUE');
  assert.ok(strategy.value_score.total >= 21);
  assert.ok(strategy.discovery_score.total < 21);
});

test('B: 明確なDISCOVERY候補をDISCOVERYへ分類する', () => {
  const strategy = createSocialStrategy(candidate({
    genre: 'ギフト',
    target: '珍しい贈り物を探している人',
    problem: '普通のプレゼントでは意外性がない',
    reason: '猫型に変形するアイデア商品で、可愛いデザインをギフトにできる。',
    sourceReferences: [{ publisher: '公式', title: '商品仕様', url: 'https://example.com/official' }],
    primaryOffer: {
      name: '猫型に変形する新感覚アイデアギフトライト',
      price: 12000,
      url: 'https://example.com/gift',
      imageUrl: 'https://example.com/gift.jpg',
      rank: null,
      reviewCount: null,
      reviewAverage: null,
    },
  }));
  assert.equal(strategy.post_type, 'DISCOVERY');
  assert.ok(strategy.discovery_score.total >= 21);
  assert.ok(strategy.value_score.total < 21);
});

test('C: VALUEとDISCOVERYが強い候補をHYBRIDへ分類する', () => {
  const strategy = createSocialStrategy(candidate({
    genre: 'ギフト・収納',
    reason: '比較記事で実用性を確認でき、珍しい変形デザインはプレゼントにも向く。',
    primaryOffer: {
      name: 'セール 4way 自動時短 コンパクト変形ギフト収納ツール',
      price: 2480,
      url: 'https://example.com/hybrid',
      imageUrl: 'https://example.com/hybrid.jpg',
      rank: 2,
      reviewCount: 3000,
      reviewAverage: 4.7,
    },
  }));
  assert.equal(strategy.post_type, 'HYBRID');
  assert.ok(strategy.value_score.total >= 20);
  assert.ok(strategy.discovery_score.total >= 20);
});

test('D: scoreと根拠が不足する候補をREJECTへ分類する', () => {
  const strategy = createSocialStrategy(candidate({
    target: '',
    problem: '',
    reason: '',
    sourceReferences: [],
    primaryOffer: { name: '一般商品', price: null, url: 'https://example.com/plain' },
  }));
  assert.equal(strategy.post_type, 'REJECT');
});

test('E: X Scoreが7未満なら他scoreにかかわらずREJECTになる', () => {
  assert.equal(classifySocialStrategy({ valueTotal: 30, discoveryTotal: 5, xTotal: 6 }), 'REJECT');
});

test('未取得のランキング順位を0位として理由へ出さない', () => {
  const strategy = createSocialStrategy(candidate({
    primaryOffer: { ...candidate().primaryOffer, rank: null },
  }));
  assert.doesNotMatch(strategy.reason_to_post, /ランキング0位/u);
});

test('F: ownedでない候補から体験表現を生成しない', () => {
  const product = candidate();
  const strategy = createSocialStrategy(product);
  const variants = composePostVariants({ product, item: product.primaryOffer, socialStrategy: strategy });
  for (const text of [strategy.hook, strategy.value_reason, strategy.discovery_reason, strategy.reason_to_post, ...variants.map((variant) => variant.text)]) {
    assert.equal(isExperienceClaim(text), false);
  }
});

test('G: PR品質gateを維持する', () => {
  const product = candidate();
  const strategy = createSocialStrategy(product);
  const variants = composePostVariants({ product, item: product.primaryOffer, disclosureText: '【PR】', socialStrategy: strategy });
  assert.ok(variants.length > 0);
  assert.ok(variants.every((variant) => variant.text.includes('【PR】')));
  const quality = qualityCheckArticle({
    id: 'article-1',
    disclosureText: '',
    comparisonTable: [{}, {}],
    experience: { type: 'not-used', text: null },
    purchaseGuide: { url: 'https://example.com', checkedAt: '2026-08-20' },
    primaryInformation: { url: 'https://example.com/official' },
    referenceUse: { copiedText: false, manualCopyCheckAt: '2026-08-20' },
    suitableFor: ['対象'],
    notSuitableFor: ['対象外'],
  });
  assert.equal(quality.status, '公開不可');
});

test('H: socialStrategyがない旧candidateはlegacy表示できる', () => {
  assert.equal(formatSocialStrategy(undefined), null);
  assert.equal(formatSocialStrategy(null), null);
});

test('I: autoPostとautoPublishはfalseを維持する', () => {
  const quality = { articleId: 'article-1', status: '合格' };
  const draft = {
    id: 'article-1',
    autoPublish: false,
    target: '対象者',
    productEvaluations: [{ productName: '商品' }],
    purchaseGuide: { url: 'https://example.com' },
  };
  const social = generateSocialDrafts({ drafts: [draft], qualityResults: [quality], generatedAt: '2026-08-20T00:00:00Z' });
  assert.equal(draft.autoPublish, false);
  assert.equal(social.drafts[0].autoPost, false);
});

test('J: curated candidateへ戦略を付与し既存offerを維持する', () => {
  const product = candidate({ enabled: true, displayName: '多機能収納ツール', primaryProvider: 'rakuten', priority: 10 });
  const offersByProduct = new Map([[product.id, { rakuten: product.primaryOffer }]]);
  const [result] = createCuratedCandidates({ products: [product], offersByProduct, config: { disclosureText: '【PR】' } });
  assert.equal(result.primaryOffer.provider, 'rakuten');
  assert.equal(result.socialStrategy.version, '1.0');
  assert.ok(result.copyVariants.every((variant) => variant.text.includes(result.socialStrategy.hook)));
});
