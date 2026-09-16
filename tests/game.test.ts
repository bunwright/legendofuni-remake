import { describe, expect, it } from 'vitest';
import { TECHNOLOGIES, TECH, WEAPONS, runtime } from '../src/content/world';
import { execute } from '../src/game/actions';
import {
  allocated,
  checkEnding,
  complete,
  createGame,
  idle,
  population,
  researchRate,
  score,
  upgrade,
} from '../src/game/state';
import { economicForecast } from '../src/game/simulation';
import { startBattle } from '../src/game/combat';
import { decodeSave, encodeSave, validateSave } from '../src/game/save';
import { act, game, resolveEvents, valid, year } from './helpers';

describe('original content', () => {
  it('restores complete content with valid prerequisite graphs', () => {
    expect(TECHNOLOGIES).toHaveLength(51);
    expect(runtime.people).toHaveLength(28);
    expect(runtime.aliens).toHaveLength(11);
    expect(WEAPONS).toHaveLength(10);
    expect(runtime.events).toHaveLength(13);
    expect(runtime.randomEvents).toHaveLength(8);
    for (const technology of TECHNOLOGIES) {
      const seen = new Set([technology.id]);
      let parent = technology.parent;
      while (parent) {
        expect(TECH[parent]).toBeDefined();
        expect(seen.has(parent)).toBe(false);
        seen.add(parent);
        parent = TECH[parent].parent;
      }
    }
    for (const weapon of WEAPONS) expect(TECH[weapon.tech]).toBeDefined();
  });
  it('uses authentic Earth and alien starting values', () => {
    const s = game();
    expect([population(s), s.economy, s.resource, s.army, s.culture, s.unrest]).toEqual([
      65, 100, 100, 10, 0, 0,
    ]);
    expect([s.stars[0].resource, s.stars[0].capacity]).toEqual([1000, 120]);
    s.aliens.forEach((a, i) => {
      expect(a.army).toBe(runtime.aliens[i].army);
      expect(s.stars[a.home].soldiers).toBe(runtime.aliens[i].population);
    });
    expect(s.stars).toHaveLength(209);
    expect([0, 1, 2, 3].map((i) => s.stars.filter((t) => t.sector === i).length)).toEqual([
      9, 40, 60, 100,
    ]);
    expect(new Set(s.aliens.map((a) => a.home)).size).toBe(11);
    valid(s);
  });
  it('reproduces the same world from a seed', () => {
    expect(createGame('A', 'classic', 987)).toEqual(createGame('A', 'classic', 987));
    expect(createGame('A', 'classic', 987).stars).not.toEqual(
      createGame('A', 'classic', 988).stars,
    );
  });
});

describe('annual economy and labor', () => {
  it('conserves labor and requires releasing workers before enlisting', () => {
    const s = game();
    expect(idle(s)).toBe(0);
    expect(execute(s, { type: 'recruit-soldiers', star: 0, count: 10 }).ok).toBe(false);
    act(s, { type: 'workers', job: 'arts', count: 10 });
    act(s, { type: 'recruit-soldiers', star: 0, count: 10 });
    expect(allocated(s)).toBe(population(s));
    act(s, { type: 'preset', preset: 'science' });
    expect(s.stars[0].soldiers).toBe(10);
    expect(allocated(s)).toBe(population(s));
    valid(s);
  });
  it.each([-1, 0.5, NaN, Infinity, 1e7])('rejects invalid worker counts: %s', (count) => {
    const s = game(),
      before = structuredClone(s);
    expect(execute(s, { type: 'workers', job: 'mining', count }).ok).toBe(false);
    expect(s).toEqual(before);
  });
  it('converts two resources into one economy, bounded by finite deposits', () => {
    const s = game();
    s.stars[0].resource = 5;
    s.resource = 0;
    const forecast = economicForecast(s);
    expect(forecast.mining).toBe(5);
    expect(forecast.production).toBe(2);
    expect(forecast.resource).toBe(1);
    year(s);
    expect(s.stars[0].resource).toBe(0);
    expect(s.resource).toBe(1);
    expect(s.economy).toBe(102);
    valid(s);
  });
  it('mass-energy conversion makes industry independent of mining', () => {
    const s = game();
    s.finished = ['质能转换'];
    s.stars[0].resource = 0;
    s.resource = 0;
    expect(economicForecast(s).production).toBe(11);
    expect(economicForecast(s).resource).toBe(0);
  });
  it('does not grow cities beyond capacity', () => {
    const s = game();
    s.stars[0].population = 119;
    year(s);
    expect(population(s)).toBe(120);
    year(s);
    expect(population(s)).toBe(120);
    valid(s);
  });
  it('education and training have a once-per-year budget', () => {
    const s = game();
    s.unrest = 20;
    act(s, { type: 'educate' });
    expect(s.unrest).toBeGreaterThanOrEqual(11);
    expect(s.unrest).toBeLessThanOrEqual(15);
    act(s, { type: 'train' });
    expect(s.army).toBeGreaterThanOrEqual(13);
    expect(s.army).toBeLessThanOrEqual(15);
    expect(s.economy).toBe(80);
    expect(execute(s, { type: 'educate' }).ok).toBe(false);
    expect(execute(s, { type: 'train' }).ok).toBe(false);
    year(s);
    act(s, { type: 'educate' });
    valid(s);
  });
  it('awards each civilization level only once', () => {
    const s = game();
    s.culture = 500;
    upgrade(s);
    expect(s.level).toBe(3);
    expect(s.army).toBe(70);
    upgrade(s);
    expect(s.army).toBe(70);
    s.culture = 100;
    upgrade(s);
    expect(s.level).toBe(3);
  });
});

describe('research, construction and exploration', () => {
  it('requires levels and prerequisites and prevents duplicate spending', () => {
    const s = game();
    expect(execute(s, { type: 'research', tech: '50%光速飞船' }).ok).toBe(false);
    expect(execute(s, { type: 'research', tech: '宇宙社会学公理' }).ok).toBe(false);
    act(s, { type: 'research', tech: '10%光速飞船' });
    expect(s.economy).toBe(70);
    expect(execute(s, { type: 'research', tech: '10%光速飞船' }).ok).toBe(false);
    expect(s.economy).toBe(70);
    valid(s);
  });
  it('pauses without losing progress or allowing another project', () => {
    const s = game();
    act(s, { type: 'research', tech: '10%光速飞船' });
    year(s);
    const progress = s.research.spaceflight!.progress;
    act(s, { type: 'pause-research', branch: 'spaceflight' });
    year(s);
    expect(s.research.spaceflight!.progress).toBe(progress);
    expect(execute(s, { type: 'research', tech: '行星开发Ⅰ' }).ok).toBe(false);
    act(s, { type: 'pause-research', branch: 'spaceflight' });
    year(s);
    expect(s.finished).toContain('10%光速飞船');
    valid(s);
  });
  it('accelerates research but not ordinary industry', () => {
    const a = game('classic'),
      b = game('expedition');
    expect(researchRate(b, 'spaceflight')).toBe(researchRate(a, 'spaceflight') * 3);
    expect(economicForecast(a).production).toBe(economicForecast(b).production);
  });
  it('preserves per-weapon production speed and does not apply alien level to Earth', () => {
    const s = game();
    s.finished.push('10%光速飞船');
    act(s, { type: 'weapon', star: 0, weapon: '小型战舰' });
    year(s);
    expect(s.stars[0].weapons[0].progress).toBe(100);
    expect(s.level).toBe(0);
    valid(s);
    const classic = game('classic');
    classic.finished.push('10%光速飞船');
    act(classic, { type: 'weapon', star: 0, weapon: '小型战舰' });
    year(classic);
    expect(classic.stars[0].weapons[0].progress).toBe(50);
  });
  it('claims neutral planets and finishes construction at the proper pace', () => {
    const s = game();
    act(s, { type: 'build', star: 4, kind: 'base' });
    expect(s.stars[4].owner).toBe('earth');
    expect(complete(s.stars[4], 'base')).toBe(false);
    expect(s.economy).toBe(80);
    expect(execute(s, { type: 'build', star: 4, kind: 'base' }).ok).toBe(false);
    year(s);
    year(s);
    expect(complete(s.stars[4], 'base')).toBe(true);
    valid(s);
  });
  it('disallows ordinary structures on stars', () => {
    const s = game();
    expect(execute(s, { type: 'build', star: 1, kind: 'base' }).ok).toBe(false);
    expect(execute(s, { type: 'build', star: 1, kind: 'mine' }).ok).toBe(false);
  });
  it('requires both observation and range, caps expeditions at three per year', () => {
    const s = game();
    expect(execute(s, { type: 'explore', star: 9 }).ok).toBe(false);
    s.finished.push('10%光速飞船', '50光年望远镜');
    s.culture = 70;
    upgrade(s);
    [9, 10, 11].forEach((star) => {
      act(s, { type: 'explore', star });
      resolveEvents(s);
    });
    expect(execute(s, { type: 'explore', star: 12 }).ok).toBe(false);
    year(s);
    act(s, { type: 'explore', star: 12 });
    resolveEvents(s);
    valid(s);
  });
  it('identifies distant civilizations by radio without landing', () => {
    const s = game();
    s.year = 3;
    s.culture = 70;
    upgrade(s);
    s.finished = ['50光年望远镜', '太阳电波放大(50光年)'];
    const near = s.aliens.filter((a) => s.stars[a.home].sector === 1);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((a) => !a.discovered)).toBe(true);
    year(s);
    expect(near.every((a) => a.discovered)).toBe(true);
    expect(near.every((a) => !s.stars[a.home].discovered)).toBe(true);
    const distant = s.aliens.filter(
      (a) => !s.stars.some((star) => star.owner === a.id && star.sector === 1),
    );
    expect(distant.length).toBeGreaterThan(0);
    expect(distant.every((a) => !a.discovered)).toBe(true);
    valid(s);
  });
  it('moves troops and only completed weapons between bases', () => {
    const s = game();
    s.stars[4].owner = 'earth';
    s.stars[4].buildings.push({ kind: 'base', work: 100, progress: 100 });
    act(s, { type: 'workers', job: 'arts', count: 0 });
    act(s, { type: 'recruit-soldiers', star: 0, count: 20 });
    s.stars[0].weapons.push(
      { uid: s.nextUid++, def: '小型战舰', hp: 100, progress: 100 },
      { uid: s.nextUid++, def: '小型战舰', hp: 100, progress: 50 },
    );
    act(s, { type: 'transfer', from: 0, to: 4, soldiers: 12, weapons: true });
    expect([s.stars[0].soldiers, s.stars[4].soldiers]).toEqual([8, 12]);
    expect(s.stars[0].weapons[0].progress).toBe(50);
    expect(s.stars[4].weapons).toHaveLength(1);
    valid(s);
  });
});

describe('characters and scripted events', () => {
  it('preserves all opening dialogue and requires reaching the last page', () => {
    const s = createGame();
    expect(s.events[0].talks).toHaveLength(7);
    expect(execute(s, { type: 'event-choice', choice: 0 }).ok).toBe(false);
    act(s, { type: 'event-next' });
    expect(s.events[0].page).toBe(1);
    act(s, { type: 'event-next', skip: true });
    act(s, { type: 'event-choice', choice: 0 });
    expect(s.events).toHaveLength(0);
    valid(s);
  });
  it('replaces appointments and maintains reciprocal base assignments', () => {
    const s = game();
    act(s, { type: 'assign', person: '丁仪', assignment: 'base:0' });
    expect(s.stars[0].commander).toBe('丁仪');
    expect(s.people.find((p) => p.id === '章北海')!.assignment).toBeNull();
    act(s, { type: 'assign', person: '丁仪', assignment: 'spaceflight' });
    expect(s.stars[0].commander).toBeNull();
    valid(s);
  });
  it('limits recruitment and city searches to one each per year', () => {
    const s = game();
    act(s, { type: 'recruit-person' });
    expect(s.people.filter((p) => p.discovered)).toHaveLength(5);
    expect(execute(s, { type: 'recruit-person' }).ok).toBe(false);
    act(s, { type: 'search-city', star: 0 });
    expect(execute(s, { type: 'search-city', star: 0 }).ok).toBe(false);
    valid(s);
  });
  it('triggers the authentic year-17 invasion after the dialogue', () => {
    const s = game();
    s.year = 16;
    act(s, { type: 'next-year' });
    expect(s.events.some((e) => e.id === 'legacy-17')).toBe(true);
    expect(s.battle).toBeNull();
    resolveEvents(s);
    expect(s.battle?.defensive).toBe(true);
    expect(s.battle?.myStar).toBe(0);
    expect(s.stars[s.battle!.enemyStar].name).toBe('银河饲养场');
    valid(s);
  });
  it('an alliance cancels the scripted invasion', () => {
    const s = game();
    s.aliens[0].relation = 4;
    s.year = 16;
    year(s);
    expect(s.battle).toBeNull();
    expect(s.ending).toBeNull();
    valid(s);
  });
});

describe('tactical combat', () => {
  function battle() {
    const s = game();
    s.stars[0].weapons.push({ uid: s.nextUid++, def: '小型战舰', hp: 100, progress: 100 });
    const enemy = s.stars[s.aliens[0].home];
    enemy.discovered = true;
    enemy.soldiers = 1;
    return { s, enemy };
  }
  it('resolves an offensive victory and preserves surviving ships', () => {
    const { s, enemy } = battle();
    startBattle(s, 0, enemy.id);
    act(s, { type: 'battle-act', action: 'attack' });
    expect(s.battle?.outcome).toBe('victory');
    expect(enemy.owner).toBe('earth');
    expect(s.stars[0].weapons).toHaveLength(1);
    valid(s);
  });
  it('consumes bombs and damages all enemies', () => {
    const { s, enemy } = battle();
    enemy.soldiers = 500;
    enemy.weapons.push({ uid: s.nextUid++, def: '小型战舰', hp: 100, progress: 100 });
    const uid = s.nextUid++;
    s.stars[0].weapons.push({ uid, def: '小行星级氢弹', hp: 100, progress: 100 });
    startBattle(s, 0, enemy.id);
    act(s, { type: 'battle-act', action: 'bomb', weapon: uid });
    expect(s.battle!.mine.find((u) => u.uid === uid)!.hp).toBe(0);
    expect(s.battle!.enemy.find((u) => u.def === null)!.hp).toBe(450);
    expect(s.battle!.enemy.find((u) => u.def === '小型战舰')!.hp).toBe(50);
    act(s, { type: 'battle-act', action: 'retreat' });
    expect(s.stars[0].weapons.some((w) => w.uid === uid)).toBe(false);
    valid(s);
  });
  it('cannot hold territory with bombs alone', () => {
    const s = game();
    s.stars[0].weapons.push({ uid: s.nextUid++, def: '小行星级氢弹', hp: 100, progress: 100 });
    startBattle(s, 0, s.aliens[0].home, true);
    expect(s.battle?.outcome).toBe('defeat');
    expect(s.ending).toBe('extinction');
    valid(s);
  });
  it('blocks unrelated commands and retreat during defense', () => {
    const { s, enemy } = battle();
    enemy.soldiers = 100;
    startBattle(s, 0, enemy.id, true);
    expect(execute(s, { type: 'battle-act', action: 'retreat' }).ok).toBe(false);
    expect(execute(s, { type: 'next-year' }).ok).toBe(false);
    expect(execute(s, { type: 'train' }).ok).toBe(false);
    valid(s);
  });
  it('allows selecting an enemy and prevents targeting wrecks', () => {
    const { s, enemy } = battle();
    enemy.soldiers = 100;
    startBattle(s, 0, enemy.id);
    act(s, { type: 'battle-target', unit: s.battle!.mine[0].uid, target: s.battle!.enemy[0].uid });
    expect(s.battle!.mine[0].target).toBe(s.battle!.enemy[0].uid);
    act(s, { type: 'battle-target', unit: s.battle!.mine[0].uid, target: null });
    expect(s.battle!.mine[0].target).toBeNull();
    expect(execute(s, { type: 'battle-target', unit: 999, target: 999 }).ok).toBe(false);
    valid(s);
  });
  it('deducts soldier losses from population without creating labor', () => {
    const s = game();
    act(s, { type: 'workers', job: 'arts', count: 0 });
    act(s, { type: 'recruit-soldiers', star: 0, count: 20 });
    const enemy = s.stars[s.aliens[0].home];
    enemy.soldiers = 500;
    startBattle(s, 0, enemy.id);
    act(s, { type: 'battle-act', action: 'attack' });
    expect(s.battle?.outcome).toBe('defeat');
    expect(population(s)).toBe(45);
    expect(allocated(s)).toBeLessThanOrEqual(45);
    valid(s);
  });
});

describe('diplomacy and endings', () => {
  function talking() {
    const s = game();
    s.finished = TECHNOLOGIES.filter((t) => t.branch === 'sociology').map((t) => t.id);
    s.culture = 200;
    upgrade(s);
    s.aliens[0].discovered = true;
    act(s, { type: 'diplomacy', alien: 'alien-0', person: '罗辑' });
    return s;
  }
  it('improves relations after a sequence of correct answers', () => {
    const s = talking();
    for (let i = 0; i < 10 && !s.diplomacy!.outcome; i++) {
      for (let t = 0; t < 50; t++) act(s, { type: 'dip-tick', timed: false });
      act(s, { type: 'dip-answer', theory: s.diplomacy!.question });
    }
    expect(s.diplomacy!.outcome).toBe('victory');
    expect(s.aliens[0].relation).toBe(3);
    act(s, { type: 'close-diplomacy' });
    expect(execute(s, { type: 'diplomacy', alien: 'alien-0', person: '罗辑' }).ok).toBe(false);
    valid(s);
  });
  it('recovers spirit, times out only when enabled and can leave', () => {
    const s = talking(),
      initial = s.diplomacy!.maxSpirit;
    act(s, { type: 'dip-answer', theory: s.diplomacy!.question });
    expect(s.diplomacy!.spirit).toBeLessThan(initial);
    const spirit = s.diplomacy!.spirit;
    act(s, { type: 'dip-tick', timed: false });
    expect(s.diplomacy!.spirit).toBe(spirit + 2);
    expect(s.diplomacy!.seconds).toBe(10);
    const progress = s.diplomacy!.progress;
    for (let i = 0; i < 10; i++) act(s, { type: 'dip-tick', timed: true });
    expect(s.diplomacy!.progress).toBeLessThan(progress);
    expect(s.diplomacy!.seconds).toBe(10);
    act(s, { type: 'dip-leave' });
    expect(s.diplomacy!.outcome).toBe('defeat');
    expect(s.aliens[0].relation).toBe(2);
    valid(s);
  });
  it('queues the original finale on alliance victory and allows finishing it', () => {
    const s = game();
    s.aliens.forEach((a) => {
      a.relation = 4;
    });
    checkEnding(s);
    expect(s.ending).toBe('victory');
    expect(s.events[0].talks).toHaveLength(12);
    resolveEvents(s);
    expect(s.events).toHaveLength(0);
    expect(execute(s, { type: 'next-year' }).ok).toBe(false);
    expect(score(s)).toBe(75);
    valid(s);
  });
  it('recognizes conquest and mixed victory', () => {
    const s = game();
    s.aliens.forEach((a, i) => {
      if (i % 2) a.relation = 4;
      else s.stars[a.home].owner = null;
    });
    checkEnding(s);
    expect(s.ending).toBe('victory');
    valid(s);
  });
  it('recognizes revolt and loss of all territory', () => {
    const s = game();
    s.unrest = 100;
    checkEnding(s);
    expect(s.ending).toBe('revolt');
    const other = game();
    other.stars[0].owner = null;
    checkEnding(other);
    expect(other.ending).toBe('extinction');
  });
});

describe('save integrity', () => {
  it.each([0, 12345, 4294967295])('round-trips all 32-bit seeds (%s)', (seed) => {
    const s = game('expedition', seed);
    act(s, { type: 'research', tech: '10%光速飞船' });
    year(s);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it('round-trips active battles and dialogue pages', () => {
    const s = createGame();
    act(s, { type: 'event-next' });
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const b = game();
    b.stars[0].weapons.push({ uid: b.nextUid++, def: '小型战舰', hp: 100, progress: 100 });
    startBattle(b, 0, b.aliens[0].home);
    expect(decodeSave(encodeSave(b))).toEqual(b);
  });
  it.each(['{}', 'not-json', '{"format":"OldGame"}', 'x'.repeat(5_000_001)])(
    'rejects invalid envelopes',
    (raw) => {
      expect(() => decodeSave(raw)).toThrow();
    },
  );
  it('rejects unsupported envelope versions and invalid dialogue pages', () => {
    const s = createGame();
    const envelope = JSON.parse(encodeSave(s));
    envelope.version = 2;
    expect(() => decodeSave(JSON.stringify(envelope))).toThrow('版本');
    s.events[0].page = s.events[0].talks!.length;
    expect(() => validateSave(s)).toThrow();
    s.events[0].page = 0;
    delete s.events[0].talks;
    expect(() => validateSave(s)).toThrow();
  });
  it('rejects negative resources, labor overflow and broken prerequisites', () => {
    const s = game();
    s.resource = -1;
    expect(() => validateSave(s)).toThrow();
    s.resource = 1;
    s.workers.mining = 500;
    expect(() => validateSave(s)).toThrow();
    s.workers.mining = 22;
    s.finished = ['99%光速飞船'];
    expect(() => validateSave(s)).toThrow();
  });
  it('rejects duplicate weapons and inconsistent commanders', () => {
    const s = game();
    s.stars[0].commander = '丁仪';
    expect(() => validateSave(s)).toThrow();
    s.stars[0].commander = '章北海';
    s.nextUid = 3;
    s.stars[0].weapons = [
      { uid: 1, def: '小型战舰', hp: 100, progress: 100 },
      { uid: 1, def: '小型战舰', hp: 100, progress: 100 },
    ];
    expect(() => validateSave(s)).toThrow();
  });
  it('validates many generated universes', () => {
    for (let seed = 0; seed < 100; seed++) valid(createGame('A', 'classic', seed * 89123));
  });
});
