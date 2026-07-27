function offerName(draft) {
  return draft.productEvaluations?.[0]?.productName ?? '対象商品';
}

function baseFooter(draft) {
  return [`【PR】`, draft.purchaseGuide?.url ?? '【ここに購入先：確認日時つきのURL】'].join('\n');
}

/**
 * 合格した記事案だけから、手動投稿用のSNS・楽天ROOM下書きを作る。
 */
export function generateSocialDrafts({ drafts, qualityResults, generatedAt }) {
  const passedIds = new Set((qualityResults ?? []).filter((result) => result.status === '合格').map((result) => result.articleId));
  const socialDrafts = [];

  for (const draft of drafts ?? []) {
    if (!passedIds.has(draft.id)) continue;
    const name = offerName(draft);
    const footer = baseFooter(draft);
    socialDrafts.push({
      articleId: draft.id,
      status: '確認待ち',
      autoPost: false,
      generatedAt,
      xPosts: [
        `${draft.target}へ。\n\n${name}を選ぶ前に、${draft.comparisonTable?.[0]?.item ?? '比較軸'}を確認すると失敗しにくい。\n\n${footer}`,
        `買う前に確認したいのは、価格だけじゃない。\n${name}は${draft.comparisonTable?.map((item) => item.item).slice(0, 2).join('・')}を見てから。\n\n${footer}`,
        `${draft.notSuitableFor?.[0] ?? '条件が合わない人'}には見送りもあり。\n${name}は、条件が合うか先に確認。\n\n${footer}`,
        `比較記事の下書きを作るときに整理した${name}の確認ポイント。\n${draft.suitableFor?.[0] ?? draft.target}なら候補。\n\n${footer}`,
        `${name}を選ぶなら、販売ページで仕様と条件を確認してから。\n価格や在庫は購入前に再確認。\n\n${footer}`,
      ],
      roomPosts: [
        `【PR】${name}\n${draft.suitableFor?.[0] ?? draft.target}向け。購入前に${draft.comparisonTable?.[0]?.item ?? '仕様'}を確認。`,
        `【PR】${name}\n向かない条件も確認してから選びたい人向けの候補。`,
        `【PR】${name}\n価格・在庫・仕様は販売ページで確認してから検討。`,
      ],
      blogToRoom: `【PR】記事で確認した条件に合う商品は、楽天ROOMの一覧から確認できます。`,
      saleDay: `【PR】${name}\n【ここにセール情報：確認日時つきの価格・キャンペーン名】\n${draft.purchaseGuide?.url ?? ''}`,
    });
  }

  return { schemaVersion: 1, generatedAt, drafts: socialDrafts };
}
