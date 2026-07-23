import path from 'node:path';
import { fetchItem as fetchRakutenItem } from './lib/rakuten.js';
import { fetchItems as fetchAmazonItems, MAX_ITEMS_PER_REQUEST as AMAZON_BATCH_SIZE } from './lib/amazon.js';
import { loadJson, saveJson } from './lib/jsonStore.js';
import { createCuratedCandidates } from './lib/curatedCandidates.js';

const CONFIG_PATH = path.resolve('config/config.json');
const CURATED_PRODUCTS_PATH = path.resolve('config/curated-products.json');
const CANDIDATES_PATH = path.resolve('data/post-candidates.json');

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchRakutenWatchItems(watchItems) {
  const fetched = new Map();
  if (!watchItems.length) return fetched;

  const { RAKUTEN_APP_ID, RAKUTEN_AFFILIATE_ID } = process.env;
  if (!RAKUTEN_APP_ID) {
    throw new Error('RAKUTEN_APP_ID が設定されていません。.env.example を参照してください。');
  }

  for (const watchItem of watchItems) {
    try {
      const item = await fetchRakutenItem(watchItem.itemCode, {
        applicationId: RAKUTEN_APP_ID,
        affiliateId: RAKUTEN_AFFILIATE_ID,
      });
      if (item) fetched.set(watchItem, item);
      else console.warn(`[${watchItem.id}] 商品が見つかりませんでした (itemCode: ${watchItem.itemCode})`);
    } catch (err) {
      console.error(`[${watchItem.id}] 楽天商品取得エラー: ${err.message}`);
    }
  }
  return fetched;
}

async function fetchAmazonWatchItems(watchItems) {
  const fetched = new Map();
  if (!watchItems.length) return fetched;

  const { AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG, AMAZON_HOST, AMAZON_REGION, AMAZON_MARKETPLACE } =
    process.env;
  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY || !AMAZON_PARTNER_TAG) {
    throw new Error(
      'AMAZON_ACCESS_KEY / AMAZON_SECRET_KEY / AMAZON_PARTNER_TAG が設定されていません。.env.example を参照してください。'
    );
  }

  const credentials = {
    accessKey: AMAZON_ACCESS_KEY,
    secretKey: AMAZON_SECRET_KEY,
    partnerTag: AMAZON_PARTNER_TAG,
    host: AMAZON_HOST,
    region: AMAZON_REGION,
    marketplace: AMAZON_MARKETPLACE,
  };

  for (const batch of chunk(watchItems, AMAZON_BATCH_SIZE)) {
    try {
      const results = await fetchAmazonItems(
        batch.map((w) => w.asin),
        credentials
      );
      for (const watchItem of batch) {
        const item = results[watchItem.asin];
        if (item) fetched.set(watchItem, item);
        else console.warn(`[${watchItem.id}] Amazon商品が見つかりませんでした (ASIN: ${watchItem.asin})`);
      }
    } catch (err) {
      console.error(`Amazon商品取得エラー (${batch.map((w) => w.id).join(', ')}): ${err.message}`);
    }
  }
  return fetched;
}

async function main() {
  const config = loadJson(CONFIG_PATH, {
    maxCandidatesPerRun: 6,
    disclosureText: '【PR】',
  });
  const products = loadJson(CURATED_PRODUCTS_PATH, []);
  const enabledProducts = products.filter((product) => product.enabled !== false);
  const rakutenWatchItems = enabledProducts
    .filter((product) => product.rakuten?.itemCode)
    .map((product) => ({ id: product.id, itemCode: product.rakuten.itemCode }));
  const amazonWatchItems = enabledProducts
    .filter((product) => product.amazon?.asin)
    .map((product) => ({ id: product.id, asin: product.amazon.asin }));

  const offersByProduct = new Map(enabledProducts.map((product) => [product.id, {}]));
  for (const [watchItem, item] of await fetchRakutenWatchItems(rakutenWatchItems)) {
    offersByProduct.get(watchItem.id).rakuten = item;
  }
  for (const [watchItem, item] of await fetchAmazonWatchItems(amazonWatchItems)) {
    offersByProduct.get(watchItem.id).amazon = item;
  }

  const selectedCandidates = createCuratedCandidates({ products, offersByProduct, config });
  console.log(`投稿候補を${selectedCandidates.length}件生成しました。`);

  saveJson(CANDIDATES_PATH, {
    generatedAt: new Date().toISOString(),
    candidates: selectedCandidates,
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
