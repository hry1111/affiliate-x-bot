const list = document.querySelector('#candidate-list');
const updatedAt = document.querySelector('#updated-at');
const template = document.querySelector('#candidate-template');
const hiddenKey = 'affiliate-candidates-hidden';

function loadHiddenIds() {
  return new Set(JSON.parse(localStorage.getItem(hiddenKey) ?? '[]'));
}

function saveHiddenIds(ids) {
  localStorage.setItem(hiddenKey, JSON.stringify([...ids]));
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = 'コピー済み';
  setTimeout(() => { button.textContent = original; }, 1500);
}

function createCandidate(candidate, hiddenIds) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.candidate-card');
  const image = fragment.querySelector('.product-image');
  const genre = fragment.querySelector('.genre');
  const postMode = fragment.querySelector('.post-mode');
  const name = fragment.querySelector('.product-name');
  const target = fragment.querySelector('.target');
  const reason = fragment.querySelector('.reason');
  const caution = fragment.querySelector('.caution');
  const sourceReferences = fragment.querySelector('.source-references');
  const offerList = fragment.querySelector('.offer-list');
  const copyTabs = fragment.querySelector('.copy-tabs');
  const postText = fragment.querySelector('.post-text');
  const copyButton = fragment.querySelector('.copy-button');
  const xLink = fragment.querySelector('.x-link');
  const hideButton = fragment.querySelector('.hide-button');

  const primaryOffer = candidate.primaryOffer;
  image.src = primaryOffer.imageUrl || '';
  image.alt = primaryOffer.name;
  image.hidden = !primaryOffer.imageUrl;
  card.classList.toggle('without-image', !primaryOffer.imageUrl);
  genre.textContent = candidate.genre;
  postMode.textContent = candidate.postMode === 'owned' ? '実体験あり' : candidate.postMode === 'sale' ? 'セール情報' : '比較記事を参考';
  name.textContent = primaryOffer.name;
  target.textContent = `こんな人へ: ${candidate.target}`;
  reason.textContent = candidate.reason;
  caution.textContent = `確認: ${candidate.caution}`;

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

  postText.addEventListener('input', () => {
    xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(postText.value)}`;
  });

  copyButton.addEventListener('click', async () => {
    try {
      await copyText(postText.value, copyButton);
    } catch {
      postText.focus();
      postText.select();
      document.execCommand('copy');
      copyButton.textContent = 'コピー済み';
    }
  });

  hideButton.addEventListener('click', () => {
    hiddenIds.add(candidate.id);
    saveHiddenIds(hiddenIds);
    card.remove();
    if (!list.children.length) renderEmptyState();
  });

  return fragment;
}

function renderEmptyState() {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = '現在、投稿候補はありません。比較記事を確認した商品を設定すると、ここに表示されます。';
  list.replaceChildren(empty);
}

async function main() {
  try {
    const response = await fetch('./data/post-candidates.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('候補データを取得できませんでした。');
    const data = await response.json();
    updatedAt.textContent = data.generatedAt
      ? `最終更新 ${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}`
      : 'まだ候補データはありません';

    const hiddenIds = loadHiddenIds();
    const visibleCandidates = data.candidates.filter((candidate) => !hiddenIds.has(candidate.id));
    if (!visibleCandidates.length) return renderEmptyState();
    for (const candidate of visibleCandidates) list.append(createCandidate(candidate, hiddenIds));
  } catch (error) {
    updatedAt.textContent = '読み込みに失敗しました';
    const message = document.createElement('p');
    message.className = 'empty-state';
    message.textContent = error.message;
    list.replaceChildren(message);
  }
}

main();
