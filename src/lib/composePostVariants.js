function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function formatPrice(price) {
  return Number.isFinite(price) ? `¥${price.toLocaleString('ja-JP')}` : '価格は販売ページで確認';
}

function buildFooter({ item, disclosureText }) {
  return unique([item.name, formatPrice(item.price), disclosureText, item.url]).join('\n');
}

/**
 * 商品の選定根拠と体験区分に応じて、誇張しない自然な投稿文を3案作成する。
 */
export function composePostVariants({ product, item, disclosureText = '【PR】' }) {
  const productName = item.name;
  const target = product.target;
  const problem = product.problem;
  const reason = product.reason;
  const caution = product.caution;
  const footer = buildFooter({ item, disclosureText });

  if (product.postMode === 'owned') {
    const personalNote = product.personalNote || `${productName}を使ってみて気づいたこと。`;
    return [
      {
        id: 'owned-story',
        label: '使った感想',
        text: `${personalNote}\n\n${target}なら、${reason}\n\n${caution}\n\n${footer}`,
      },
      {
        id: 'owned-conclusion',
        label: '結論から',
        text: `${target}へ。\n\n結論、${productName}は${reason}\n\n${caution}\n\n${footer}`,
      },
      {
        id: 'owned-caution',
        label: '失敗回避',
        text: `${problem}なら、${productName}は候補に入れてよかった。\n\n${reason}\n\nただ、${caution}\n\n${footer}`,
      },
    ];
  }

  if (product.postMode === 'sale') {
    return [
      {
        id: 'sale-check',
        label: '今見る',
        text: `これ気になってた人は、今なら見ておいてよさそう。\n\n${reason}\n\n${caution}\n\n${footer}`,
      },
      {
        id: 'sale-target',
        label: '対象者向け',
        text: `${target}なら、${productName}が買いやすい価格になってる。\n\n${reason}\n\n${caution}\n\n${footer}`,
      },
      {
        id: 'sale-caution',
        label: '確認してから',
        text: `安いからといって、誰にでも合うわけではない。\n\n${problem}なら、これは候補。\n${caution}\n\n${footer}`,
      },
    ];
  }

  const sourceNames = (product.sourceReferences ?? []).map((source) => source.publisher).join('・') || '比較記事';
  return [
    {
      id: 'research-natural',
      label: '自然な紹介',
      text: `${problem}で迷ってる人は、これ候補に入れてよさそう。\n\n${reason}\n\n${caution}\n\n${footer}`,
    },
    {
      id: 'research-target',
      label: '対象者向け',
        text: `${target}へ。\n\n${productName}は、${reason}\n\n${caution}\n\n${footer}`,
    },
    {
      id: 'research-source',
      label: '比較根拠あり',
      text: `${problem}なら、比較記事を見た上でこれは候補。\n\n${sourceNames}で紹介されていて、${reason}\n\n${caution}\n\n${footer}`,
    },
  ];
}
