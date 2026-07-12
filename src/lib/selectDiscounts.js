/**
 * 前回価格と今回価格を比較し、値下げ幅がしきい値以上の商品を投稿候補として判定する。
 */
export function evaluateItem({ item, watchItem, history, defaultThreshold }) {
  const prev = history[item.key];
  const threshold = watchItem.minDiscountRate ?? defaultThreshold;

  if (!prev) {
    return { item, watchItem, eligible: false, reason: 'no-history' };
  }

  if (!Number.isFinite(item.price) || item.price >= prev.lastPrice) {
    return { item, watchItem, eligible: false, reason: 'no-drop' };
  }

  const discountRate = (prev.lastPrice - item.price) / prev.lastPrice;
  if (discountRate < threshold) {
    return { item, watchItem, eligible: false, reason: 'below-threshold', discountRate };
  }

  return {
    item,
    watchItem,
    eligible: true,
    reason: 'ok',
    discountRate,
    previousPrice: prev.lastPrice,
  };
}
