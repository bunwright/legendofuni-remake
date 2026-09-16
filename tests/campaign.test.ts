import { describe, expect, it } from 'vitest';
import { BRANCHES, JOBS, TECH } from '../src/content/world';
import { execute } from '../src/game/actions';
import {
  hasTech,
  idle,
  population,
  reachable,
  researchReason,
  visibleSector,
} from '../src/game/state';
import type { Branch, GameState } from '../src/game/types';
import { act, game, resolveEvents, valid } from './helpers';

const priorities: Partial<Record<Branch, string[]>> = {
  spaceflight: ['10%光速飞船', '行星开发Ⅰ', '行星殖民Ⅰ', '行星建设Ⅰ', '50%光速飞船', '99%光速飞船'],
  astrophysics: ['50光年望远镜', '1万光年望远镜', '银河系望远镜'],
  sociology: ['宇宙社会学公理', '技术爆炸理论', '猜疑链', '黑暗森林理论', '种族沟通'],
  proton: ['质子3维展开', '质子6维展开', '质子9维展开', '质子11维展开', '质能转换'],
  culture: ['人口Ⅰ', '思想钢印Ⅰ', '人口Ⅱ', '思想钢印Ⅱ', '人口Ⅲ'],
  economy: ['采矿技术Ⅰ', '生产技术Ⅰ', '采矿技术Ⅱ', '生产技术Ⅱ'],
};
function distribute(s: GameState): void {
  for (const job of JOBS) if (s.workers[job.id]) act(s, { type: 'workers', job: job.id, count: 0 });
  const available = idle(s);
  const projects = BRANCHES.filter((b) => s.research[b.id]);
  const jobs = [
    ['mining', hasTech(s, '质能转换') ? 0 : Math.floor(available * 0.32)],
    ['industry', Math.floor(available * (hasTech(s, '质能转换') ? 0.4 : 0.2))],
    ['arts', s.level < 2 ? Math.floor(available * 0.3) : Math.floor(available * 0.13)],
  ] as const;
  for (const [job, count] of jobs) act(s, { type: 'workers', job, count });
  if (projects.length) {
    const remaining = idle(s);
    projects.forEach((b, i) =>
      act(s, {
        type: 'workers',
        job: b.id,
        count:
          Math.floor(remaining / projects.length) + (i === 0 ? remaining % projects.length : 0),
      }),
    );
  } else act(s, { type: 'workers', job: 'industry', count: s.workers.industry + idle(s) });
}
function prepare(s: GameState): void {
  if (s.unrest >= 5 && s.economy >= 10) act(s, { type: 'educate' });
  if (s.year <= 17 && hasTech(s, '10%光速飞船') && s.stars[0].weapons.length < 4 && s.economy >= 50)
    act(s, { type: 'weapon', star: 0, weapon: '小型战舰' });
  const reserve = s.year < 17 && s.stars[0].weapons.length < 3 ? 50 : 20;
  if (s.year === 16) {
    for (const job of JOBS)
      if (s.workers[job.id]) act(s, { type: 'workers', job: job.id, count: 0 });
    act(s, { type: 'recruit-soldiers', star: 0, count: Math.min(60, population(s)) });
  }
  if (s.year > 17 && s.stars[0].soldiers) act(s, { type: 'recruit-soldiers', star: 0, count: 0 });
  for (const id of [4, 3, 2, 7, 8, 5, 6]) {
    const star = s.stars[id];
    if (s.economy < reserve + 20) break;
    if (hasTech(s, '行星殖民Ⅰ') && !star.buildings.some((b) => b.kind === 'city'))
      act(s, { type: 'build', star: id, kind: 'city' });
    if (s.economy < reserve + 20) break;
    if (hasTech(s, '行星开发Ⅰ') && !star.buildings.some((b) => b.kind === 'mine'))
      act(s, { type: 'build', star: id, kind: 'mine' });
    if (s.economy < reserve + 20) break;
    if (hasTech(s, '行星建设Ⅰ') && !star.buildings.some((b) => b.kind === 'factory'))
      act(s, { type: 'build', star: id, kind: 'factory' });
  }
  for (const branch of BRANCHES) {
    const next = priorities[branch.id]?.find((t) => !hasTech(s, t));
    if (!next || researchReason(s, next)) continue;
    if (s.economy >= TECH[next].cost + (next === '10%光速飞船' ? 0 : reserve))
      act(s, { type: 'research', tech: next });
  }
  distribute(s);
}
function settle(s: GameState): void {
  resolveEvents(s);
  if (s.battle) {
    if (!s.battle.outcome && !s.battle.usedSkills.includes('morale'))
      execute(s, { type: 'battle-act', action: 'morale' });
    for (let rounds = 0; rounds < 100 && !s.battle.outcome; rounds++)
      act(s, { type: 'battle-act', action: 'attack' });
    expect(s.battle.outcome, `Battle failed at year ${s.year}`).toBe('victory');
    act(s, { type: 'close-battle' });
    resolveEvents(s);
  }
}
function negotiate(s: GameState): void {
  if (!hasTech(s, '种族沟通')) return;
  for (const alien of s.aliens.filter((a) => a.discovered && a.relation < 4)) {
    if (s.ending) break;
    const envoy = s.people
      .filter((p) => p.discovered)
      .sort((a, b) => b.leadership * 0.4 + b.social * 0.6 - a.leadership * 0.4 - a.social * 0.6)[0];
    act(s, { type: 'diplomacy', alien: alien.id, person: envoy.id });
    for (let step = 0; step < 20 && !s.diplomacy!.outcome; step++) {
      for (let tick = 0; tick < 25; tick++) act(s, { type: 'dip-tick', timed: false });
      act(s, { type: 'dip-answer', theory: s.diplomacy!.question });
    }
    expect(s.diplomacy!.outcome).toBe('victory');
    act(s, { type: 'close-diplomacy' });
  }
}
describe('complete command-driven campaigns', () => {
  it('can complete a conquest campaign using researched singularity weapons', () => {
    const s = game('expedition', 12345);
    for (let round = 0; round < 1000 && !s.ending; round++) {
      prepare(s);
      if (hasTech(s, '质能转换') && !researchReason(s, '奇点炸弹'))
        act(s, { type: 'research', tech: '奇点炸弹' });
      for (const star of s.stars
        .filter((star) => !star.discovered && star.exists && reachable(s, star))
        .slice(0, 3)) {
        act(s, { type: 'explore', star: star.id });
        resolveEvents(s);
      }
      if (hasTech(s, '奇点炸弹')) {
        while (
          s.stars[0].weapons.some((w) => w.def === '奇点炸弹' && w.progress >= 100) &&
          !s.ending
        ) {
          const target = s.stars.find(
            (star) => star.exists && star.discovered && star.owner && star.owner !== 'earth',
          );
          if (!target) break;
          act(s, { type: 'singularity', from: 0, to: target.id });
        }
        while (s.economy >= 1020 && s.stars[0].weapons.length < 40 && !s.ending)
          act(s, { type: 'weapon', star: 0, weapon: '奇点炸弹' });
      }
      if (s.ending) break;
      act(s, { type: 'next-year' });
      settle(s);
      valid(s);
    }
    expect(s.ending, `Conquest stalled at year ${s.year}`).toBe('victory');
    expect(s.aliens.every((a) => !s.stars.some((star) => star.exists && star.owner === a.id))).toBe(
      true,
    );
    valid(s);
  });
  it.each([12345, 99, 314159])(
    'can survive the invasion and win diplomatically (seed %s)',
    (seed) => {
      const s = game('expedition', seed);
      for (let round = 0; round < 350 && !s.ending; round++) {
        prepare(s);
        for (const star of s.stars
          .filter(
            (star) =>
              !star.discovered &&
              star.exists &&
              visibleSector(s, star.sector) &&
              reachable(s, star),
          )
          .slice(0, 3)) {
          act(s, { type: 'explore', star: star.id });
          resolveEvents(s);
        }
        negotiate(s);
        if (s.ending) break;
        act(s, { type: 'next-year' });
        settle(s);
        valid(s);
      }
      expect(
        s.ending,
        JSON.stringify({
          year: s.year,
          economy: s.economy,
          resource: s.resource,
          population: population(s),
          culture: s.culture,
          research: s.research,
          finished: s.finished,
          allies: s.aliens.filter((a) => a.relation === 4).length,
        }),
      ).toBe('victory');
      expect(s.aliens.every((a) => a.relation === 4)).toBe(true);
      valid(s);
    },
  );
});
