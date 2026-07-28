const GUARANTEE_PATTERNS = [/最安保証/u, /必ず(?:効く|改善|成功)/u, /絶対(?:に)?/u, /在庫(?:あり|保証)/u, /効果を保証/u];

function check(name, passed, severity, reason) {
  return { name, passed, severity, reason };
}

function textForReview(draft) {
  return [draft.title, draft.introduction, ...(draft.headings ?? []), draft.experience?.text ?? '', draft.claimsPolicy ?? '', ...(draft.cautions ?? [])].join('\n');
}

/**
 * 記事案を公開前ルールで判定する。合格でも自動公開は許可しない。
 */
export function qualityCheckArticle(draft) {
  const text = textForReview(draft);
  const hasPlaceholder = text.includes('【ここに体験：');
  const hasGuarantee = GUARANTEE_PATTERNS.some((pattern) => pattern.test(text));
  const usesOwnedExperience = draft.experience?.type === 'owned';
  const hasSupportedExperience = !usesOwnedExperience || Boolean(draft.experience?.sourceId);
  const hasNonExperiencePolicy = usesOwnedExperience || draft.experience?.type === 'not-used';
  const checks = [
    check('一次情報', Boolean(draft.primaryInformation?.url), '要修正', '公式情報または確認済みの一次情報URLが必要です。'),
    check('比較軸', (draft.comparisonTable ?? []).length >= 2, '要修正', '比較軸を2つ以上設定してください。'),
    check('実体験の扱い', hasNonExperiencePolicy && !hasPlaceholder, '公開不可', '未使用なら使用感を書かず、使用感を書く場合はownedの実体験記録を設定してください。'),
    check('購入導線', Boolean(draft.purchaseGuide?.url && draft.purchaseGuide?.checkedAt), '要修正', '確認日時付きの購入先を設定してください。'),
    check('体験捏造なし', hasSupportedExperience, '公開不可', '使用感にはexperience-db.jsonのowned記録が必要です。'),
    check('誇大表現なし', !hasGuarantee, '公開不可', '最安・効果・在庫などの保証表現を削除してください。'),
    check('参考記事の非転載確認', Boolean(draft.referenceUse?.manualCopyCheckAt) && draft.referenceUse?.copiedText === false, '要修正', '参考記事の文言をコピーしていないことをHiroが確認してください。'),
    check('対象者と見送り条件', (draft.suitableFor ?? []).length > 0 && (draft.notSuitableFor ?? []).length > 0, '要修正', '向く人と見送る条件を設定してください。'),
    check('PR表記', draft.disclosureText === '【PR】', '公開不可', '記事案に【PR】を含めてください。'),
  ];
  const blocked = checks.some((entry) => !entry.passed && entry.severity === '公開不可');
  const needsFix = checks.some((entry) => !entry.passed && entry.severity === '要修正');
  return {
    articleId: draft.id,
    status: blocked ? '公開不可' : needsFix ? '要修正' : '合格',
    autoPublish: false,
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export function qualityCheckArticles(drafts) {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), results: (drafts ?? []).map(qualityCheckArticle) };
}
