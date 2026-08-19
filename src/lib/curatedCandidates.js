import { composePostVariants } from './composePostVariants.js';
import { createSocialStrategy } from './socialStrategy.js';

function toOffer(item, provider, displayName = null) {
  if (!item) return null;
  return {
    provider,
    label: provider === 'rakuten' ? '楽天市場' : 'Amazon',
    name: displayName || item.name,
    listingName: item.name,
    price: item.price,
    url: item.url,
    imageUrl: item.imageUrl,
    shopName: item.shopName ?? null,
    rank: item.rank ?? null,
    reviewCount: item.reviewCount ?? null,
    reviewAverage: item.reviewAverage ?? null,
  };
}

function orderedOffers(product, offers) {
  const providerOrder = [product.primaryProvider, 'rakuten', 'amazon'].filter(Boolean);
  return [...new Map(providerOrder.map((provider) => [provider, offers[provider]]).filter(([, offer]) => offer)).values()];
}

/**
 * 手動で確認した比較記事の根拠を起点に、販売中の商品だけを投稿候補へ変換する。
 */
export function createCuratedCandidates({ products, offersByProduct, config }) {
  const candidates = [];

  for (const product of products.filter((entry) => entry.enabled !== false)) {
    const offers = offersByProduct.get(product.id) ?? {};
    const purchaseOptions = orderedOffers(product, {
      rakuten: toOffer(offers.rakuten, 'rakuten', product.displayName),
      amazon: toOffer(offers.amazon, 'amazon', product.displayName),
    });
    const primaryOffer = purchaseOptions[0];

    if (!primaryOffer) {
      console.warn(`[${product.id}] 販売中の楽天・Amazon商品を取得できなかったため候補から外しました。`);
      continue;
    }

    const candidate = {
      id: product.id,
      candidateType: 'ready',
      genre: product.genre,
      target: product.target,
      problem: product.problem,
      reason: product.reason,
      caution: product.caution,
      postMode: product.postMode,
      sourceReferences: product.sourceReferences,
      primaryOffer,
      purchaseOptions,
      priority: Number(product.priority ?? 0),
    };
    candidate.socialStrategy = createSocialStrategy(candidate);
    candidate.copyVariants = composePostVariants({
        product,
        item: primaryOffer,
        disclosureText: config.disclosureText,
        socialStrategy: candidate.socialStrategy,
      });
    candidates.push(candidate);
  }

  return candidates
    .sort((a, b) => b.priority - a.priority || a.primaryOffer.price - b.primaryOffer.price)
    .slice(0, config.maxCandidatesPerRun ?? 6);
}
