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
  const discount = fragment.querySelector('.discount');
  const rank = fragment.querySelector('.rank');
  const name = fragment.querySelector('.product-name');
  const shop = fragment.querySelector('.shop-name');
  const price = fragment.querySelector('.price');
  const review = fragment.querySelector('.review');
  const postText = fragment.querySelector('.post-text');
  const copyButton = fragment.querySelector('.copy-button');
  const xLink = fragment.querySelector('.x-link');
  const hideButton = fragment.querySelector('.hide-button');

  image.src = candidate.imageUrl || '';
  image.alt = candidate.name;
  image.hidden = !candidate.imageUrl;
  discount.textContent = `${Math.round(candidate.discountRate * 100)}% OFF`;
  rank.textContent = candidate.rank ? `楽天ランキング ${candidate.rank}位` : '';
  name.textContent = candidate.name;
  shop.textContent = candidate.shopName || '';
  price.textContent = `¥${candidate.price.toLocaleString()}（前回 ¥${candidate.previousPrice.toLocaleString()}）`;
  review.textContent = candidate.reviewCount ? `レビュー ${candidate.reviewAverage} / ${candidate.reviewCount}件` : '';
  postText.value = candidate.text;
  xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(candidate.text)}`;

  copyButton.addEventListener('click', async () => {
    try {
      await copyText(candidate.text, copyButton);
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
  empty.textContent = '現在、投稿候補はありません。';
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
