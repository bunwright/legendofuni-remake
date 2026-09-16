import { WEAPON } from '../content/world';
import {
  checkEnding,
  integer,
  leader,
  log,
  losePopulation,
  normalizeWorkers,
  random,
} from './state';
import type { Battle, BattleUnit, Command, GameState, Result, Star } from './types';

function units(s: GameState, star: Star, friendly: boolean): BattleUnit[] {
  const result: BattleUnit[] = [];
  if (star.soldiers > 0) {
    const alien = s.aliens.find((a) => a.id === star.owner);
    const commander = friendly ? leader(s, `base:${star.id}`) : undefined;
    result.push({
      uid: -star.id - 1,
      name: friendly ? '地球驻军' : '文明守军',
      def: null,
      hp: star.soldiers,
      maxHp: star.soldiers,
      attack: friendly ? s.army + Math.floor((commander?.army ?? 0) / 5) : (alien?.army ?? 10),
      priority: 0,
      kind: 'unit',
      target: null,
    });
  }
  for (const weapon of star.weapons) {
    const def = WEAPON[weapon.def];
    if (weapon.progress < def.work || (def.kind !== 'unit' && def.kind !== 'bomb')) continue;
    result.push({
      uid: weapon.uid,
      name: def.id,
      def: def.id,
      hp: weapon.hp,
      maxHp: def.hp,
      attack: def.attack,
      priority: def.priority,
      kind: def.kind,
      target: null,
    });
  }
  return result;
}
export function startBattle(
  s: GameState,
  myStar: number,
  enemyStar: number,
  defensive = false,
): void {
  const mine = s.stars[myStar],
    enemy = s.stars[enemyStar];
  s.battle = {
    myStar,
    enemyStar,
    defensive,
    round: 1,
    mine: units(s, mine, true),
    enemy: units(s, enemy, false),
    log: ['大战一触即发……'],
    originalSoldiers: mine.soldiers,
    enemyOriginalSoldiers: enemy.soldiers,
    usedSkills: [],
    outcome: null,
  };
  checkBattle(s);
}
function living(units: BattleUnit[]): BattleUnit[] {
  return units.filter((u) => u.hp > 0 && u.kind === 'unit');
}
function checkBattle(s: GameState): void {
  const b = s.battle!;
  if (!living(b.mine).length) finishBattle(s, 'defeat');
  else if (!living(b.enemy).length) finishBattle(s, 'victory');
}
function syncUnits(star: Star, units: BattleUnit[], soldierCeiling: number): void {
  const soldier = units.find((u) => u.def === null);
  star.soldiers = Math.min(soldierCeiling, Math.max(0, soldier?.hp ?? 0));
  star.weapons = star.weapons.filter((w) => {
    const u = units.find((u) => u.uid === w.uid);
    if (!u) return true; // Noncombat and unfinished weapons did not participate.
    w.hp = Math.max(0, u.hp);
    return w.hp > 0;
  });
}
export function finishBattle(s: GameState, outcome: NonNullable<Battle['outcome']>): void {
  const b = s.battle!;
  if (b.outcome) return;
  b.outcome = outcome;
  const mine = s.stars[b.myStar],
    enemy = s.stars[b.enemyStar];
  const alien = s.aliens.find((a) => a.id === enemy.owner)!;
  syncUnits(mine, b.mine, b.originalSoldiers);
  syncUnits(enemy, b.enemy, b.enemyOriginalSoldiers);
  losePopulation(s, b.originalSoldiers - mine.soldiers, mine.id);
  if (outcome === 'victory') {
    if (!b.defensive) {
      enemy.owner = 'earth';
      enemy.population = 0;
      enemy.soldiers = 0;
      enemy.commander = null;
      enemy.weapons = [];
      if (!enemy.buildings.some((x) => x.kind === 'base'))
        enemy.buildings.push({ kind: 'base', progress: 100, work: 100 });
      log(
        s,
        `我们在进攻${enemy.name}星球的战役中打败了${alien.name}，取得了胜利，未来是我们的！`,
        'war',
      );
    } else
      log(
        s,
        `${alien.name}对我们在${mine.name}星球的基地发动进攻，但他们的阴谋没有得逞，我们取得了胜利！`,
        'war',
      );
  } else if (outcome === 'defeat') {
    if (b.defensive) {
      mine.owner = alien.id;
      mine.population = 0;
      mine.soldiers = Math.max(10, Math.floor(enemy.soldiers / 3));
      mine.weapons = [];
      mine.commander = null;
      for (const p of s.people) if (p.assignment === `base:${mine.id}`) p.assignment = null;
      log(
        s,
        `${alien.name}对我们在${mine.name}星球的基地发动突然袭击，我们被打败，不得不放弃基地。`,
        'war',
      );
    } else
      log(
        s,
        `我们在进攻${enemy.name}星球的战役中被${alien.name}打败了，也许我们需要更多的支援。`,
        'war',
      );
  } else
    log(
      s,
      `我们在进攻${enemy.name}星球的战役遭到${alien.name}的顽强抵抗，不得已只能选择撤退。`,
      'war',
    );
  normalizeWorkers(s);
  checkEnding(s);
}
function strike(s: GameState, attacker: BattleUnit, targets: BattleUnit[], side: string): void {
  const b = s.battle!;
  if (attacker.hp <= 0) return;
  if (attacker.kind === 'bomb') {
    for (const target of living(targets)) {
      target.hp = Math.max(0, target.hp - attacker.attack);
    }
    b.log.push(`${side}投放${attacker.name}，敌方各作战单元损失 ${attacker.attack} 点兵力。`);
    attacker.hp = 0;
    return;
  }
  const alive = living(targets);
  if (!alive.length) return;
  const target = alive.find((t) => t.uid === attacker.target) ?? alive[integer(s, alive.length)];
  const damage = Math.max(1, Math.floor(attacker.attack * (0.85 + random(s) * 0.3)));
  target.hp = Math.max(0, target.hp - damage);
  b.log.push(
    `${side}${attacker.name} → ${target.name}：−${damage}${target.hp === 0 ? '，目标已摧毁' : ''}`,
  );
}
export function battleCommand(s: GameState, cmd: Extract<Command, { type: 'battle-act' }>): Result {
  const b = s.battle;
  if (!b || b.outcome) return { ok: false, message: '当前没有进行中的战斗。' };
  const commander = leader(s, `base:${b.myStar}`);
  let attackers: BattleUnit[] = [];
  const skill = !['attack', 'bomb', 'retreat'].includes(cmd.action);
  if (skill && b.usedSkills.includes(cmd.action))
    return { ok: false, message: '这项指挥技能本场已使用。' };
  if (skill && !commander) return { ok: false, message: '需要先为出发基地任命指挥官。' };
  switch (cmd.action) {
    case 'retreat':
      if (b.defensive) return { ok: false, message: '守土战不能撤军。' };
      finishBattle(s, 'retreat');
      return { ok: true, message: '全军撤退。保存有生力量。' };
    case 'attack':
      attackers = living(b.mine);
      break;
    case 'bomb': {
      const bomb = b.mine.find((u) => u.uid === cmd.weapon && u.hp > 0 && u.kind === 'bomb');
      if (!bomb) return { ok: false, message: '没有可用的消耗武器。' };
      attackers = [bomb];
      break;
    }
    case 'morale':
      if (!(commander!.army > 60 || commander!.leadership > 60 || commander!.art > 80))
        return { ok: false, message: '指挥官需要军事或统率 >60，或艺术 >80。' };
      if (random(s) * 100 < commander!.leadership) {
        const soldier = b.mine.find((u) => u.def === null);
        if (soldier) {
          soldier.hp *= 2;
          soldier.maxHp = Math.max(soldier.maxHp, soldier.hp);
        } else for (const u of living(b.mine)) u.attack = Math.floor(u.attack * 1.25);
        b.log.push('☆ 士气高涨！驻军战时兵力翻倍；无驻军时舰队攻击提升 25%。');
      } else b.log.push('☆ 我方使用士气技能失败了。');
      break;
    case 'bribe':
      if (!(commander!.army > 50 || commander!.leadership > 70))
        return { ok: false, message: '指挥官需要军事 >50 或统率 >70。' };
      if (s.economy < 30) return { ok: false, message: '收买需要 30 经济。' };
      s.economy -= 30;
      if (random(s) * 100 < commander!.leadership) {
        for (const u of living(b.enemy)) u.hp = Math.max(0, u.hp - Math.ceil(u.hp * 0.3));
        b.log.push('☆ 收买成功，敌方各单元兵力下降 30%。');
      } else b.log.push('☆ 我方使用收买技能失败了。');
      break;
    case 'intimidate':
      if (!(commander!.army > 60 || commander!.art > 80))
        return { ok: false, message: '指挥官需要军事 >60 或艺术 >80。' };
      if (random(s) * 100 < commander!.army * 0.7) {
        for (const u of living(b.enemy)) u.hp = Math.max(0, u.hp - 30);
        b.log.push('☆ 恐吓奏效！敌方各单元损失 30 点兵力。');
      } else b.log.push('☆ 我方使用恐吓技能失败了。');
      break;
  }
  if (skill) b.usedSkills.push(cmd.action);
  const enemyBombs = b.enemy.filter((u) => u.kind === 'bomb' && u.hp > 0);
  const enemyAttacks =
    enemyBombs.length && random(s) < 0.33
      ? [enemyBombs[integer(s, enemyBombs.length)]]
      : living(b.enemy);
  const ordered = [
    ...attackers.map((u) => ({ u, friendly: true })),
    ...enemyAttacks.map((u) => ({ u, friendly: false })),
  ].sort((a, c) => c.u.priority - a.u.priority || a.u.uid - c.u.uid);
  for (const { u, friendly } of ordered) {
    if (!living(b.mine).length || !living(b.enemy).length) break;
    strike(s, u, friendly ? b.enemy : b.mine, friendly ? '我方' : '敌方');
  }
  b.round++;
  if (b.log.length > 150) b.log.splice(0, b.log.length - 150);
  checkBattle(s);
  return {
    ok: true,
    message:
      b.outcome === 'victory'
        ? '我们赢得了这场战争！'
        : b.outcome === 'defeat'
          ? '战斗结束。我们需要重新集结。'
          : `第 ${b.round - 1} 轮交锋结束。`,
  };
}
