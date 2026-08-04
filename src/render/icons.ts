export type IconId =
  | 'model' | 'dir' | 'git' | 'context' | 'cache' | 'rate_limits'
  | 'agent' | 'pr' | 'fast' | 'style' | 'session' | 'cost' | 'version';

const ICONS: Record<IconId, string> = {
  model: '🤖',
  agent: '👤',
  dir: '📁',
  git: '🌿',
  pr: '🔀',
  context: '⚡️',
  cache: '💾',
  rate_limits: '📊',
  fast: '🚀',
  style: '🎯',
  session: '⏱️',
  cost: '💰',
  version: '💩',
};

export function icon(id: IconId): string {
  return ICONS[id];
}
