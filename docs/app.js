import { renderArticles, renderExperiences, renderQuality, renderResearch } from './os-ui.js';

const list = document.querySelector('#candidate-list');
const updatedAt = document.querySelector('#updated-at');
const genreFilter = document.querySelector('#genre-filter');
const filterStatus = document.querySelector('#filter-status');
const template = document.querySelector('#candidate-template');
const hiddenKey = 'affiliate-candidates-hidden';
const genreFilterKey = 'affiliate-candidates-genre-filter';
const views = {
  candidates: document.querySelector('#candidate-view'),
  research: document.querySelector('#research-view'),
  experiences: document.querySelector('#experiences-view'),
  articles: document.querySelector('#articles-view'),
  quality: document.querySelector('#quality-view'),
};
const viewButtons = [...document.querySelectorAll('[data-view]')];
const candidateOnly = [...document.querySelectorAll('[data-candidate-only]')];
let currentCandidates = [];
let currentOperation = null;

function loadHiddenIds() {
  return new Set(JSON.parse(localStorage.getItem(hiddenKey) ?? '[]'));
}

function saveHiddenIds(ids) {
  localStorage.setItem(hiddenKey, JSON.stringify([...ids]));
}

function loadGenreFilter() {
  return localStorage.getItem(genreFilterKey) ?? '';
}

function saveGenreFilter(genre) {
  localStorage.setItem(genreFilterKey, genre);
}

function configureGenreFilter(candidates, configuredGenres = []) {
  const genres = [...new Set([...configuredGenres, ...candidates.map((candidate) => candidate.genre).filter(Boolean)])].sort((a, b) =>
    a.localeCompare(b, 'ja')
  );
  const selectedGenre = genres.includes(loadGenreFilter()) ? loadGenreFilter() : '';
  genreFilter.replaceChildren(new Option('すべて', ''));
  for (const genre of genres) genreFilter.add(new Option(genre, genre));
  genreFilter.value = selectedGenre;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.setAttribute('readonly', '');
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    document.body.append(temporary);
    temporary.select();
    const copied = document.execCommand('copy');
    temporary.remove();
    if (!copied) throw new Error('コピーできませんでした。');
  }
  const original = button.textContent;
  button.textContent = 'コピー済み';
  setTimeout(() => { button.textContent = original; }, 1500);
}

function appendResearchSummary(container, candidate) {
  const research = currentOperation?.research?.opportunities?.find((entry) => entry.candidateId === candidate.id);
  if (!research) return;
  container.hidden = false;
  const heading = document.createElement('p');
  heading.className = 'research-heading';
  heading.textContent = `記事化優先度: ${research.articlePriority} / 採用状態: ${research.selectionStatus} / 根拠: ${research.experience?.type === 'owned' ? '実体験あり' : '一次情報・ランキング'}`;
  container.append(heading);
  const reason = document.createElement('p');
  reason.textContent = `需要の根拠: ${(research.demandReason ?? []).join(' / ') || '未取得'}`;
  container.append(reason);
  const score = document.createElement('p');
  score.textContent = `需要スコア: ${research.demandScore?.normalized ?? '未取得'}/100（信頼度 ${research.confidence ?? '未取得'}）`;
  container.append(score);
  for (const source of research.referenceArticles ?? []) {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `比較記事: ${source.publisher}: ${source.title}`;
    container.append(link);
    if (source.whyLikelyTop) {
      const analysis = document.createElement('p');
      analysis.textContent = `上位理由分析: ${source.whyLikelyTop}`;
      container.append(analysis);
    }
  }
}

function createCandidate(candidate, hiddenIds) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.candidate-card');
  const image = fragment.querySelector('.product-image');
  const candidateKind = fragment.querySelector('.candidate-kind');
  const genre = fragment.querySelector('.genre');
  const postMode = fragment.querySelector('.post-mode');
  const name = fragment.querySelector('.product-name');
  const target = fragment.querySelector('.target');
  const reason = fragment.querySelector('.reason');
  const caution = fragment.querySelector('.caution');
  const selectionSummary = fragment.querySelector('.selection-summary');
  const researchSummary = fragment.querySelector('.research-summary');
  const sourceReferences = fragment.querySelector('.source-references');
  const offerList = fragment.querySelector('.offer-list');
  const copyTabs = fragment.querySelector('.copy-tabs');
  const postText = fragment.querySelector('.post-text');
  const copyButton = fragment.querySelector('.copy-button');
  const xLink = fragment.querySelector('.x-link');
  const postEditor = fragment.querySelector('.post-editor');
  const discoveryActions = fragment.querySelector('.discovery-actions');
  const copyConfigButton = fragment.querySelector('.copy-config-button');
  const isDiscovery = candidate.candidateType === 'discovery';
  const primaryOffer = candidate.primaryOffer;

  image.src = primaryOffer.imageUrl || '';
  image.alt = primaryOffer.name;
  image.hidden = !primaryOffer.imageUrl;
  card.classList.toggle('without-image', !primaryOffer.imageUrl);
  card.classList.toggle('discovery-card', isDiscovery);
  candidateKind.textContent = isDiscovery ? '要確認' : '投稿可能';
  genre.textContent = candidate.genre;
  postMode.textContent = isDiscovery
    ? '楽天ランキングから自動抽出'
    : candidate.postMode === 'owned'
      ? '実体験あり'
      : candidate.postMode === 'sale'
        ? 'セール情報'
        : '比較記事を参考';
  name.textContent = primaryOffer.name;
  target.textContent = `こんな人へ: ${candidate.target}`;
  reason.textContent = candidate.reason;
  caution.textContent = `確認: ${candidate.caution}`;
  selectionSummary.hidden = !isDiscovery;
  selectionSummary.textContent = candidate.selectionSummary ?? '';
  appendResearchSummary(researchSummary, candidate);

  for (const source of candidate.sourceReferences ?? []) {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `${source.publisher}: ${source.title}`;
    sourceReferences.append(link);
  }
  for (const offer of candidate.purchaseOptions ?? []) {
    const link = document.createElement('a');
    link.href = offer.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `${offer.label} ${offer.price ? `¥${Number(offer.price).toLocaleString()}` : '価格確認'}`;
    offerList.append(link);
  }

  function setPostText(variant) {
    postText.value = variant.text;
    xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(variant.text)}`;
    for (const button of copyTabs.querySelectorAll('button')) {
      button.setAttribute('aria-selected', String(button.dataset.variantId === variant.id));
    }
  }

  if (!isDiscovery) {
    for (const variant of candidate.copyVariants ?? []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = variant.label;
      button.dataset.variantId = variant.id;
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => setPostText(variant));
      copyTabs.append(button);
    }
    setPostText(candidate.copyVariants?.[0] ?? { id: 'empty', text: '' });
  }
  postEditor.hidden = isDiscovery;
  discoveryActions.hidden = !isDiscovery;
  postText.addEventListener('input', () => {
    xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(postText.value)}`;
  });
  copyButton.addEventListener('click', async () => {
    try {
      await copyText(postText.value, copyButton);
    } catch {
      copyButton.textContent = 'コピーできませんでした';
    }
  });
  for (const button of fragment.querySelectorAll('.hide-button')) button.addEventListener('click', () => {
    hiddenIds.add(candidate.id);
    saveHiddenIds(hiddenIds);
    renderCandidates();
  });
  copyConfigButton?.addEventListener('click', async () => {
    try {
      await copyText(candidate.reviewDraft, copyConfigButton);
    } catch {
      copyConfigButton.textContent = 'コピーできませんでした';
    }
  });
  return fragment;
}

function renderGroup(title, candidates, hiddenIds) {
  const section = document.createElement('section');
  section.className = 'candidate-group';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const cards = document.createElement('div');
  cards.className = 'candidate-list';
  for (const candidate of candidates) cards.append(createCandidate(candidate, hiddenIds));
  section.append(heading, cards);
  list.append(section);
}

function renderEmptyState() {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = '現在、投稿候補はありません。比較記事を確認した商品を設定すると、ここに表示されます。';
  list.replaceChildren(empty);
}

function renderCandidates() {
  list.replaceChildren();
  const hiddenIds = loadHiddenIds();
  const selectedGenre = genreFilter.value;
  const visibleCandidates = currentCandidates.filter(
    (candidate) => !hiddenIds.has(candidate.id) && (!selectedGenre || candidate.genre === selectedGenre)
  );
  const genreLabel = selectedGenre || 'すべて';
  filterStatus.textContent = `${genreLabel}: ${visibleCandidates.length}件`;
  if (!visibleCandidates.length) return renderEmptyState();
  const readyCandidates = visibleCandidates.filter((candidate) => candidate.candidateType !== 'discovery');
  const discoveryCandidates = visibleCandidates.filter((candidate) => candidate.candidateType === 'discovery');
  if (readyCandidates.length) renderGroup('投稿できる候補', readyCandidates, hiddenIds);
  if (discoveryCandidates.length) renderGroup('季節・トレンドから探す', discoveryCandidates, hiddenIds);
}

function renderCurrentView(view) {
  if (view === 'research') renderResearch(views.research, currentOperation);
  if (view === 'experiences') renderExperiences(views.experiences, currentOperation);
  if (view === 'articles') renderArticles(views.articles, currentOperation);
  if (view === 'quality') renderQuality(views.quality, currentOperation);
}

function setView(view) {
  for (const [name, section] of Object.entries(views)) section.hidden = name !== view;
  for (const button of viewButtons) button.setAttribute('aria-selected', String(button.dataset.view === view));
  for (const node of candidateOnly) node.hidden = view !== 'candidates';
  renderCurrentView(view);
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} を取得できませんでした。`);
  return response.json();
}

async function main() {
  try {
    const [candidateData, operationResult] = await Promise.all([
      loadJson('./data/post-candidates.json'),
      loadJson('./data/operation-os.json').catch(() => null),
    ]);
    updatedAt.textContent = candidateData.generatedAt
      ? `最終更新 ${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(candidateData.generatedAt))}`
      : 'まだ候補データはありません';
    currentCandidates = candidateData.candidates ?? [];
    currentOperation = operationResult;
    configureGenreFilter(currentCandidates, candidateData.genres);
    renderCandidates();
    setView('candidates');
  } catch (error) {
    updatedAt.textContent = '読み込みに失敗しました';
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: error.message }));
  }
}

genreFilter.addEventListener('change', () => {
  saveGenreFilter(genreFilter.value);
  renderCandidates();
});
for (const button of viewButtons) button.addEventListener('click', () => setView(button.dataset.view));

main();
