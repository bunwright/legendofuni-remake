import { PERSUASION, SPIRIT_COST, THEORIES, legacy } from '../content/world';
import { checkEnding, hasTech, integer, log } from './state';
import type { GameState, Result } from './types';

export function newQuestion(s: GameState): void {
  const d = s.diplomacy!;
  const alien = s.aliens.find((a) => a.id === d.alien)!;
  d.question = integer(s, Math.min(5, (Math.floor(alien.level / 2) + 1) * 2));
  d.seconds = 10;
  d.rounds++;
}
export function questionText(s: GameState): string {
  const d = s.diplomacy;
  if (!d) return '';
  return legacy.diplomacyQuestions[d.question].replace(
    '%s',
    s.aliens.find((a) => a.id === d.alien)!.name,
  );
}
function finish(s: GameState): void {
  const d = s.diplomacy!;
  const alien = s.aliens.find((a) => a.id === d.alien)!;
  if (d.progress >= 100) {
    d.progress = 100;
    d.outcome = 'victory';
    alien.relation = Math.min(4, alien.relation + 1);
    log(
      s,
      `我们派出${d.person}与${alien.name}进行了和平谈判，并取得了显著的成果。${alien.relation === 4 ? '结为牢固同盟。' : '双方关系得到改善。'}`,
      'diplomacy',
    );
    checkEnding(s);
  } else if (d.progress <= 0) {
    d.progress = 0;
    d.outcome = 'defeat';
    alien.relation = Math.max(0, alien.relation - 1);
    log(s, `我们派出${d.person}与${alien.name}进行了和平谈判，结果没有任何进展。`, 'diplomacy');
  } else newQuestion(s);
}
export function answer(s: GameState, theory: number): Result {
  const d = s.diplomacy;
  if (!d || d.outcome) return { ok: false, message: '没有正在进行的谈判。' };
  if (!Number.isInteger(theory) || theory < -1 || theory > 4)
    return { ok: false, message: '无效的应答。' };
  if (theory === -1) {
    d.progress -= PERSUASION[d.question];
    d.spirit = Math.min(d.maxSpirit, d.spirit + 25);
    d.log.push('暂避锋芒，恢复 25 点精神，但对方的疑虑加深。');
  } else {
    if (!hasTech(s, THEORIES[theory]))
      return { ok: false, message: '尚未掌握此技术。请先在宇宙社会学研究所进行研究。' };
    if (d.spirit < SPIRIT_COST[theory])
      return { ok: false, message: '精神不足，请等待恢复或暂避锋芒。' };
    d.spirit -= SPIRIT_COST[theory];
    if (theory === d.question) {
      d.progress += PERSUASION[theory];
      d.log.push(`${d.person}：使用“${THEORIES[theory]}”。对方接受了这个论点。`);
    } else {
      d.progress -= Math.floor((PERSUASION[theory] * 2) / 3);
      d.log.push(`“${THEORIES[theory]}”没有回应对方真正的疑虑。`);
    }
  }
  finish(s);
  if (d.log.length > 30) d.log.splice(0, d.log.length - 30);
  return {
    ok: true,
    message:
      d.outcome === 'victory'
        ? '和平谈判取得显著成果。'
        : d.outcome === 'defeat'
          ? '本次谈判未能取得进展。'
          : d.log[d.log.length - 1],
  };
}
export function diplomacyTick(s: GameState, timed: boolean): void {
  const d = s.diplomacy;
  if (!d || d.outcome) return;
  d.spirit = Math.min(d.maxSpirit, d.spirit + 2);
  if (timed) {
    d.seconds--;
    if (d.seconds <= 0) {
      d.progress -= PERSUASION[d.question];
      d.log.push('应答超时，对方的疑虑加深。');
      finish(s);
      if (d.log.length > 30) d.log.splice(0, d.log.length - 30);
    }
  }
}
