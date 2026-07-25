const list = document.querySelector('#candidate-list');
const updatedAt = document.querySelector('#updated-at');
const genreFilter = document.querySelector('#genre-filter');
const filterStatus = document.querySelector('#filter-status');
const template = document.querySelector('#candidate-template');
const hiddenKey = 'affiliate-candidates-hidden';
const genreFilterKey = 'affiliate-candidates-genre-filter';
let currentCandidates = [];

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
    link.textContent = `${offer.label} ${offer.price ? `¥${offer.price.toLocaleString()}` : '価格確認'}`;
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

async function main() {
  try {
    const response = await fetch('./data/post-candidates.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('候補データを取得できませんでした。');
    const data = await response.json();
    updatedAt.textContent = data.generatedAt
      ? `最終更新 ${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}`
      : 'まだ候補データはありません';

    currentCandidates = data.candidates;
    configureGenreFilter(currentCandidates, data.genres);
    renderCandidates();
  } catch (error) {
    updatedAt.textContent = '読み込みに失敗しました';
    const message = document.createElement('p');
    message.className = 'empty-state';
    message.textContent = error.message;
    list.replaceChildren(message);
  }
}

genreFilter.addEventListener('change', () => {
  saveGenreFilter(genreFilter.value);
  renderCandidates();
});

main();
