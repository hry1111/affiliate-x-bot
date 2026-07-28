function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function statusTag(status) {
  return element('span', `status-tag status-${String(status).replace(/[^a-zA-Z0-9]+/g, '-')}`, status);
}

function formatDate(value) {
  if (!value) return '未確認';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function empty(container, message) {
  container.replaceChildren(element('p', 'empty-state', message));
}

function addList(parent, items, emptyText = '未入力') {
  const list = element('ul', 'detail-list');
  for (const item of items?.length ? items : [emptyText]) list.append(element('li', '', item));
  parent.append(list);
}

function addLink(parent, label, url) {
  if (!url) return;
  const link = element('a', 'inline-link', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  parent.append(link);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('copy failed');
  }
  const original = button.textContent;
  button.textContent = 'コピー済み';
  setTimeout(() => { button.textContent = original; }, 1500);
}

function addCopyDraft(parent, label, text) {
  const wrapper = element('div', 'copy-draft');
  wrapper.append(element('p', 'detail-label', label));
  const area = element('textarea', 'draft-text');
  area.readOnly = true;
  area.value = text;
  const button = element('button', 'secondary-button', 'コピー');
  button.type = 'button';
  button.addEventListener('click', async () => {
    try {
      await copyText(text, button);
    } catch {
      button.textContent = 'コピーできませんでした';
    }
  });
  wrapper.append(area, button);
  parent.append(wrapper);
}

function researchCard(opportunity) {
  const card = element('article', 'os-card');
  const heading = element('div', 'card-heading');
  heading.append(statusTag(opportunity.selectionStatus), statusTag(`記事化優先度 ${opportunity.articlePriority}`));
  card.append(heading, element('h2', '', opportunity.offer.name || opportunity.genre));
  card.append(element('p', 'muted', `${opportunity.genre} / 確認 ${formatDate(opportunity.checkedAt)}`));

  card.append(element('h3', '', '需要が伸びている理由'));
  addList(card, opportunity.demandReason, '根拠を取得できませんでした。');
  card.append(element('h3', '', '需要スコア'));
  card.append(element('p', 'score-line', `${opportunity.demandScore.normalized}/100（${opportunity.articlePriority}・信頼度 ${opportunity.confidence}）`));
  const components = element('ul', 'score-components');
  for (const component of opportunity.demandScore.components ?? []) {
    components.append(element('li', '', `${component.name}: ${component.available ? `${component.score}/${component.max}` : '未取得'} - ${component.reason}`));
  }
  card.append(components);
  card.append(element('p', 'muted', `検索需要: ${opportunity.searchDemand?.status ?? '未取得'}。月間検索数の推測値は表示しません。`));

  card.append(element('h3', '', '比較記事・分析'));
  if (opportunity.referenceArticles?.length) {
    const references = element('div', 'reference-list');
    for (const reference of opportunity.referenceArticles) {
      const item = element('div', 'reference-item');
      addLink(item, `${reference.publisher}: ${reference.title}`, reference.url);
      item.append(element('p', 'muted', `確認日: ${formatDate(reference.checkedAt)}`));
      if (reference.whyLikelyTop) item.append(element('p', '', `上位理由分析: ${reference.whyLikelyTop}`));
      if (reference.structurePatterns?.length) item.append(element('p', '', `構成の型: ${reference.structurePatterns.join(' / ')}`));
      if (reference.comparisonAxes?.length) item.append(element('p', '', `比較軸: ${reference.comparisonAxes.join(' / ')}`));
      references.append(item);
    }
    card.append(references);
  } else {
    card.append(element('p', 'muted', '比較記事は手動確認後に登録します。本文・画像は取得しません。'));
  }
  card.append(element('p', 'muted', `根拠区分: ${opportunity.experience?.type === 'owned' ? 'owned（実体験あり）' : '一次情報・ランキング'} / 採用状態: ${opportunity.selectionStatus}`));
  return card;
}

export function renderResearch(container, operation) {
  const opportunities = operation?.research?.opportunities ?? [];
  if (!opportunities.length) return empty(container, '需要リサーチはまだ生成されていません。');
  container.replaceChildren();
  container.append(element('h2', 'view-title', '需要リサーチ'));
  container.append(element('p', 'view-description', 'ランキング、季節一致、履歴、手動確認済みの競合情報だけを根拠として表示します。'));
  const list = element('div', 'os-list');
  for (const opportunity of opportunities) list.append(researchCard(opportunity));
  container.append(list);
}

export function renderExperiences(container, operation) {
  const experiences = operation?.experienceDb?.experiences ?? [];
  if (!experiences.length) return empty(container, '実体験DBは任意です。未使用の商品は一次情報と比較軸だけで記事案を作成できます。');
  container.replaceChildren();
  container.append(element('h2', 'view-title', '実体験'));
  const list = element('div', 'os-list');
  for (const experience of experiences) {
    const card = element('article', 'os-card');
    card.append(statusTag(experience.experienceType), element('h2', '', experience.productName || experience.id));
    card.append(element('p', 'muted', `${experience.manufacturer ?? 'メーカー未入力'} / 確認 ${formatDate(experience.checkedAt)}`));
    card.append(element('h3', '', 'Hiro本人の記録'));
    addList(card, experience.hiroWords, '未入力');
    card.append(element('h3', '', '良かった点'));
    addList(card, experience.pros, '未入力');
    card.append(element('h3', '', '気になった点・失敗談'));
    addList(card, [...(experience.cons ?? []), experience.failureStory].filter(Boolean), '未入力');
    card.append(element('p', 'muted', `向く人: ${(experience.suitableFor ?? []).join(' / ') || '未入力'}`));
    card.append(element('p', 'muted', `向かない人: ${(experience.notSuitableFor ?? []).join(' / ') || '未入力'}`));
    list.append(card);
  }
  container.append(list);
}

function articleCard(draft, quality, social) {
  const card = element('article', 'os-card');
  const heading = element('div', 'card-heading');
  heading.append(statusTag(draft.status), statusTag(quality?.status ?? '未チェック'));
  card.append(heading, element('h2', '', draft.title));
  card.append(element('p', 'muted', `${draft.genre} / ${draft.style} / ${draft.disclosureText}`));
  card.append(element('p', '', draft.introduction));
  const details = element('details', 'article-details');
  details.append(element('summary', '', '記事案の詳細'));
  details.append(element('h3', '', '見出し構成'));
  addList(details, draft.headings);
  details.append(element('h3', '', '比較表の項目'));
  addList(details, draft.comparisonTable?.map((item) => `${item.item}: ${item.purpose}`));
  details.append(element('h3', '', draft.experience?.type === 'owned' ? 'Hiroの実体験' : '根拠の扱い'));
  details.append(element('p', 'experience-text', draft.experience?.text ?? draft.experience?.note ?? '一次情報と比較軸のみを使用'));
  details.append(element('p', 'muted', `向く人: ${(draft.suitableFor ?? []).join(' / ')}`));
  details.append(element('p', 'muted', `見送る条件: ${(draft.notSuitableFor ?? []).join(' / ')}`));
  details.append(element('p', 'muted', `購入導線: ${draft.purchaseGuide?.note ?? '未入力'}（確認 ${formatDate(draft.purchaseGuide?.checkedAt)}）`));
  for (const source of draft.sourceReferences ?? []) addLink(details, `${source.publisher}: ${source.title}`, source.url);
  card.append(details);
  if (social) {
    const socialDetails = element('details', 'article-details');
    socialDetails.append(element('summary', '', 'X・楽天ROOM下書き'));
    social.xPosts.forEach((text, index) => addCopyDraft(socialDetails, `X案 ${index + 1}`, text));
    social.roomPosts.forEach((text, index) => addCopyDraft(socialDetails, `楽天ROOM案 ${index + 1}`, text));
    addCopyDraft(socialDetails, 'ブログからROOMへの短文', social.blogToRoom);
    addCopyDraft(socialDetails, 'セール日向け告知文', social.saleDay);
    card.append(socialDetails);
  }
  return card;
}

export function renderArticles(container, operation) {
  const drafts = operation?.articles?.drafts ?? [];
  if (!drafts.length) return empty(container, '記事下書きは未生成です。config/article-draft-requests.jsonで対象ジャンルまたはリサーチIDを指定してください。');
  const qualityById = new Map((operation?.quality?.results ?? []).map((result) => [result.articleId, result]));
  const socialByArticleId = new Map((operation?.social?.drafts ?? []).map((draft) => [draft.articleId, draft]));
  container.replaceChildren();
  container.append(element('h2', 'view-title', '記事下書き'));
  const list = element('div', 'os-list');
  for (const draft of drafts) list.append(articleCard(draft, qualityById.get(draft.id), socialByArticleId.get(draft.id)));
  container.append(list);
}

export function renderQuality(container, operation) {
  const results = operation?.quality?.results ?? [];
  if (!results.length) return empty(container, '公開前チェックの対象となる記事下書きはありません。');
  container.replaceChildren();
  container.append(element('h2', 'view-title', '公開前チェック'));
  container.append(element('p', 'view-description', '合格でも自動公開はされません。Hiroの最終確認が必要です。'));
  const list = element('div', 'os-list');
  for (const result of results) {
    const card = element('article', 'os-card');
    card.append(statusTag(result.status), element('h2', '', result.articleId));
    card.append(element('p', 'muted', `確認 ${formatDate(result.checkedAt)}`));
    const checks = element('ul', 'quality-list');
    for (const item of result.checks ?? []) {
      checks.append(element('li', item.passed ? 'check-pass' : `check-${item.severity}`, `${item.passed ? '✓' : '要'} ${item.name}: ${item.passed ? '確認済み' : item.reason}`));
    }
    card.append(checks);
    list.append(card);
  }
  container.append(list);
}
