const TYPE_LABELS = {
  VALUE: 'VALUE',
  DISCOVERY: 'DISCOVERY',
  HYBRID: 'HYBRID',
  REJECT: '投稿対象外',
};

const CONFIDENCE_LABELS = {
  high: '根拠: 高',
  medium: '根拠: 中',
  low: '根拠: 低',
};

/** 旧candidateではnullを返し、従来表示を維持する。 */
export function formatSocialStrategy(strategy) {
  if (!strategy) return null;
  return {
    summary: `SNS評価: ${TYPE_LABELS[strategy.post_type] ?? strategy.post_type}`,
    scores: `VALUE ${strategy.value_score?.total ?? 0}/30・DISCOVERY ${strategy.discovery_score?.total ?? 0}/30・X ${strategy.x_score?.total ?? 0}/10`,
    hook: `Hook: ${strategy.hook ?? '未生成'}`,
    confidence: CONFIDENCE_LABELS[strategy.confidence] ?? '根拠: 未判定',
  };
}
