import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchSnapshot } from '../src/lib/research-demand.js';
import { generateArticleDrafts } from '../src/lib/generate-article.js';
import { qualityCheckArticle } from '../src/lib/quality-check.js';
import { generateSocialDrafts } from '../src/lib/generate-social.js';

const generatedAt = '2026-07-27T00:00:00.000Z';
const candidateData = {
  generatedAt,
  candidates: [
    {
      id: 'trend:summer:shop:1',
      candidateType: 'discovery',
      genre: '夏の暮らし',
      target: '暑さ対策をしたい人',
      primaryOffer: {
        provider: 'rakuten',
        name: '冷感アイテム',
        price: 2000,
        url: 'https://example.com/item',
        rank: 3,
        reviewCount: 120,
        reviewAverage: 4.5,
      },
      sourceReferences: [{ publisher: '楽天市場', title: 'リアルタイムランキング 3位', url: 'https://example.com/ranking' }],
    },
  ],
};

function createResearch() {
  return createResearchSnapshot({
    candidateData,
    topics: [{ genre: '夏の暮らし', label: '夏の暑さ対策', priority: 80 }],
    referenceArticles: [],
    experiences: [],
    previousSnapshot: null,
    generatedAt,
  });
}

test('需要リサーチは検索数を推測せず、根拠つきスコアを生成する', () => {
  const research = createResearch();
  const opportunity = research.opportunities[0];
  assert.equal(opportunity.searchDemand.monthlySearchVolume, null);
  assert.equal(opportunity.searchDemand.status, '未取得');
  assert.ok(opportunity.demandScore.components.some((component) => component.name === '楽天ランキング' && component.available));
});

test('ランキングスナップショットがあれば候補上限に依存せずテーマ別にリサーチする', () => {
  const research = createResearchSnapshot({
    candidateData: { generatedAt, candidates: [] },
    rankingSnapshot: {
      generatedAt,
      topics: [
        {
          id: 'kitchen',
          label: 'キッチン・調理',
          genre: 'キッチン・調理',
          target: '調理を楽にしたい人',
          ranking: { period: 'realtime' },
          items: [{ itemCode: 'shop:pan', name: 'フライパン', price: 3000, url: 'https://example.com/pan', rank: 4, reviewCount: 50, reviewAverage: 4.2 }],
        },
      ],
    },
    topics: [{ id: 'kitchen', genre: 'キッチン・調理', label: 'キッチン・調理', priority: 60 }],
    referenceArticles: [],
    experiences: [],
    previousSnapshot: null,
    generatedAt,
  });
  assert.equal(research.opportunities.length, 1);
  assert.equal(research.opportunities[0].genre, 'キッチン・調理');
});

test('実体験がない記事案は使用感を書かず、一次情報ベースの方針を残す', () => {
  const articles = generateArticleDrafts({
    requests: [{ id: 'request-1', enabled: true, genre: '夏の暮らし' }],
    research: createResearch(),
    experiences: [],
    generatedAt,
  });
  assert.equal(articles.drafts.length, 3);
  assert.equal(articles.drafts[0].experience.type, 'not-used');
  assert.equal(articles.drafts[0].experience.text, null);
  assert.match(articles.drafts[0].claimsPolicy, /Hiroは未使用/u);
});

test('未使用でも、一次情報などがそろえばSNS下書きの対象にできる', () => {
  const research = createResearch();
  const productId = research.opportunities[0].candidateId;
  const articles = generateArticleDrafts({
    requests: [{ id: 'request-1', enabled: true, genre: '夏の暮らし', curatedProductId: productId }],
    research,
    experiences: [],
    curatedProducts: [{ id: productId, primaryInformation: { url: 'https://example.com/official', checkedAt: '2026-07-27' }, referenceUse: { copiedText: false, manualCopyCheckAt: '2026-07-27' } }],
    generatedAt,
  });
  const quality = qualityCheckArticle(articles.drafts[0]);
  assert.equal(quality.status, '合格');
  const social = generateSocialDrafts({ drafts: articles.drafts, qualityResults: [quality], generatedAt });
  assert.equal(social.drafts.length, 1);
});

test('ownedの実体験と確認済み一次情報がある記事だけSNS下書きを生成する', () => {
  const research = createResearch();
  const productId = research.opportunities[0].candidateId;
  const articles = generateArticleDrafts({
    requests: [{ id: 'request-1', enabled: true, genre: '夏の暮らし', curatedProductId: productId }],
    research,
    experiences: [{ id: 'experience-1', productId, productName: '冷感アイテム', experienceType: 'owned', hiroWords: ['持ち歩く場面で使った。'], pros: ['サイズを確認しやすい。'], cons: [], checkedAt: '2026-07-27' }],
    curatedProducts: [{ id: productId, primaryInformation: { url: 'https://example.com/official', checkedAt: '2026-07-27' }, referenceUse: { copiedText: false, manualCopyCheckAt: '2026-07-27' } }],
    generatedAt,
  });
  const quality = qualityCheckArticle(articles.drafts[0]);
  assert.equal(quality.status, '合格');
  const social = generateSocialDrafts({ drafts: articles.drafts, qualityResults: [quality], generatedAt });
  assert.equal(social.drafts.length, 1);
  assert.match(social.drafts[0].xPosts[0], /【PR】/u);
});
