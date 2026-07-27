import fs from 'node:fs';
import path from 'node:path';
import { loadJson, saveJson } from './lib/jsonStore.js';
import { createResearchSnapshot } from './lib/research-demand.js';
import { generateArticleDrafts } from './lib/generate-article.js';
import { qualityCheckArticles } from './lib/quality-check.js';
import { generateSocialDrafts } from './lib/generate-social.js';

const CANDIDATES_PATH = path.resolve('data/post-candidates.json');
const RANKING_SNAPSHOT_PATH = path.resolve('data/ranking-snapshot.json');
const CURATED_PRODUCTS_PATH = path.resolve('config/curated-products.json');
const TOPICS_PATH = path.resolve('config/seasonal-topics.json');
const SOURCES_PATH = path.resolve('config/research-sources.json');
const EXPERIENCES_PATH = path.resolve('config/experience-db.json');
const REQUESTS_PATH = path.resolve('config/article-draft-requests.json');
const RESEARCH_DIR = path.resolve('data/research');
const ARTICLE_DIR = path.resolve('data/article-drafts');
const QUALITY_DIR = path.resolve('data/quality-checks');
const SOCIAL_DIR = path.resolve('data/social-drafts');
const DASHBOARD_PATH = path.resolve('data/operation-os.json');

function tokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function latestJsonIn(directory, beforeFileName) {
  if (!fs.existsSync(directory)) return null;
  const files = fs
    .readdirSync(directory)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file) && file < beforeFileName)
    .sort();
  if (!files.length) return null;
  return loadJson(path.join(directory, files.at(-1)), null);
}

function main() {
  const now = new Date();
  const generatedAt = now.toISOString();
  const date = tokyoDate(now);
  const candidateData = loadJson(CANDIDATES_PATH, { candidates: [] });
  const rankingSnapshot = loadJson(RANKING_SNAPSHOT_PATH, { topics: [] });
  const curatedProducts = loadJson(CURATED_PRODUCTS_PATH, []);
  const topics = loadJson(TOPICS_PATH, []);
  const sources = loadJson(SOURCES_PATH, { referenceArticles: [] });
  const experienceDb = loadJson(EXPERIENCES_PATH, { experiences: [] });
  const requestConfig = loadJson(REQUESTS_PATH, { requests: [] });
  const previousSnapshot = latestJsonIn(RESEARCH_DIR, `${date}.json`);

  const research = createResearchSnapshot({
    candidateData,
    rankingSnapshot,
    topics,
    referenceArticles: sources.referenceArticles,
    experiences: experienceDb.experiences,
    previousSnapshot,
    generatedAt,
  });
  const articles = generateArticleDrafts({
    requests: requestConfig.requests,
    research,
    experiences: experienceDb.experiences,
    curatedProducts,
    generatedAt,
  });
  const quality = qualityCheckArticles(articles.drafts);
  const social = generateSocialDrafts({ drafts: articles.drafts, qualityResults: quality.results, generatedAt });

  saveJson(path.join(RESEARCH_DIR, `${date}.json`), research);
  saveJson(path.join(ARTICLE_DIR, `${date}.json`), articles);
  saveJson(path.join(QUALITY_DIR, `${date}.json`), quality);
  saveJson(path.join(SOCIAL_DIR, `${date}.json`), social);
  saveJson(DASHBOARD_PATH, {
    schemaVersion: 1,
    generatedAt,
    operationRules: { path: 'config/operation-rules.md', status: 'template' },
    experienceDb: { updatedAt: experienceDb.updatedAt ?? null, experiences: experienceDb.experiences ?? [] },
    research,
    articles,
    quality,
    social,
  });
  console.log(`運用OSを更新: リサーチ${research.opportunities.length}件、記事案${articles.drafts.length}件、品質判定${quality.results.length}件、SNS下書き${social.drafts.length}件`);
}

main();
