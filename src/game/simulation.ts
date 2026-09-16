import { BRANCHES, SECTORS, STORY, TECH, WEAPONS, WEAPON, runtime } from '../content/world';
import { originalEvent, yearEvents } from '../content/story';
import { startBattle } from './combat';
import {
  checkEnding,
  complete,
  hasTech,
  integer,
  leader,
  log,
  owned,
  population,
  random,
  rate,
  researchRate,
  techWeight,
  upgrade,
} from './state';
import type { AnnualReport, GameState, Star } from './types';

export function economicForecast(s: GameState): {
  mining: number;
  production: number;
  resource: number;
  culture: number;
  population: number;
} {
  const mines = owned(s).filter((star) => complete(star, 'mine') && star.resource > 0);
  const factories = owned(s).filter((star) => complete(star, 'factory'));
  const economyLeader = leader(s, 'mining') ?? leader(s, 'industry');
  const efficiency = (100 - s.unrest) / 100;
  const minerCount = mines.length ? Math.floor(s.workers.mining / mines.length) : 0;
  let mining = 0;
  if (s.workers.mining > 0)
    for (const mine of mines) {
      mining += Math.min(
        100,
        mine.resource,
        Math.floor(
          Math.floor(
            ((minerCount + Math.floor((economyLeader?.economy ?? 0) / 20)) *
              techWeight(s, '采矿技术')) /
              2,
          ) * efficiency,
        ),
      );
    }
  const workerCount = factories.length ? Math.floor(s.workers.industry / factories.length) : 0;
  let production = 0;
  if (s.workers.industry > 0)
    for (const _factory of factories) {
      production += Math.min(
        100,
        Math.floor(
          Math.floor(
            ((workerCount + Math.floor((economyLeader?.economy ?? 0) / 30)) *
              techWeight(s, '生产技术')) /
              2,
          ) * efficiency,
        ),
      );
    }
  if (!hasTech(s, '质能转换'))
    production = Math.min(production, Math.floor((s.resource + mining) / 2));
  const culture =
    Math.min(
      100,
      Math.floor(
        ((s.workers.arts + Math.floor((leader(s, 'arts')?.social ?? 0) / 5)) *
          techWeight(s, '思想钢印')) /
          20,
      ),
    ) * rate(s);
  const growth = owned(s)
    .filter((star) => complete(star, 'city'))
    .reduce(
      (sum, star) =>
        sum +
        Math.max(
          0,
          Math.min(star.capacity - star.population, Math.floor((5 * techWeight(s, '人口')) / 2)),
        ),
      0,
    );
  return {
    mining,
    production,
    resource: mining - (hasTech(s, '质能转换') ? 0 : production * 2),
    culture,
    population: growth,
  };
}
function runEconomy(s: GameState): void {
  const forecast = economicForecast(s);
  s.culture += forecast.culture;
  const mines = owned(s).filter((star) => complete(star, 'mine') && star.resource > 0);
  const person = leader(s, 'mining') ?? leader(s, 'industry');
  const workerCount = mines.length ? Math.floor(s.workers.mining / mines.length) : 0;
  if (s.workers.mining > 0)
    for (const mine of mines) {
      const extracted = Math.min(
        100,
        mine.resource,
        Math.floor(
          (Math.floor(
            ((workerCount + Math.floor((person?.economy ?? 0) / 20)) * techWeight(s, '采矿技术')) /
              2,
          ) *
            (100 - s.unrest)) /
            100,
        ),
      );
      mine.resource -= extracted;
    }
  s.resource += forecast.resource;
  s.economy += forecast.production;
  for (const star of owned(s)) {
    if (complete(star, 'city'))
      star.population += Math.max(
        0,
        Math.min(star.capacity - star.population, Math.floor((5 * techWeight(s, '人口')) / 2)),
      );
  }
}
function constructionSpeed(s: GameState, star: Star, kind: string): number {
  const prefix =
    kind === 'mine'
      ? star.planet
        ? '行星开发'
        : '恒星开发'
      : kind === 'factory'
        ? '行星建设'
        : kind === 'city'
          ? '行星殖民'
          : '';
  return (
    (prefix && hasTech(s, `${prefix}Ⅲ`) ? 50 : prefix && hasTech(s, `${prefix}Ⅱ`) ? 40 : 20) *
    rate(s)
  );
}
function runScience(s: GameState): void {
  for (const { id } of BRANCHES) {
    const project = s.research[id];
    if (!project || project.paused) continue;
    project.progress += researchRate(s, id);
    if (project.progress >= TECH[project.tech].work) {
      s.finished.push(project.tech);
      log(s, `科技突破：我们掌握了「${project.tech}」。`, 'science');
      delete s.research[id];
    }
  }
}
function runConstruction(s: GameState): void {
  for (const star of owned(s)) {
    for (const building of star.buildings) {
      if (building.progress >= building.work) continue;
      building.progress = Math.min(
        building.work,
        building.progress + constructionSpeed(s, star, building.kind),
      );
      if (building.progress >= building.work) log(s, `${star.name}的新设施已投入使用。`);
    }
    for (const w of star.weapons) {
      const def = WEAPON[w.def];
      if (w.progress >= def.work) continue;
      w.progress = Math.min(def.work, w.progress + def.perRound * rate(s));
      if (w.progress >= def.work) log(s, `${star.name}：${def.id}建造完成。`, 'war');
    }
  }
}
function alienTurn(s: GameState): void {
  for (const alien of s.aliens) {
    const territory = s.stars.filter((star) => star.exists && star.owner === alien.id);
    if (!territory.length) continue;
    for (const star of territory) {
      star.soldiers += 2 + (integer(s, 10) === 5 ? 30 : 0);
      if (integer(s, 10) === 5 && star.weapons.length < 12) {
        const available = WEAPONS.filter(
          (w) => w.level <= alien.level && (w.kind === 'unit' || w.kind === 'bomb'),
        );
        if (available.length) {
          const def = available[integer(s, available.length)];
          star.weapons.push({ uid: s.nextUid++, def: def.id, hp: def.hp, progress: def.work });
        }
      }
    }
    if (integer(s, 7) !== 5) continue;
    const target = s.stars[9 + integer(s, 200)];
    if (!target.exists || !target.planet || (target.owner && target.owner !== 'earth')) continue;
    if (target.owner === 'earth') {
      if (alien.relation < 4 && !s.battle) {
        alien.discovered = true;
        const source = territory[integer(s, territory.length)];
        source.discovered = true;
        log(s, `${alien.name}正在向${target.name}发动进攻！`, 'warning');
        startBattle(s, target.id, source.id, true);
      }
    } else {
      target.owner = alien.id;
      target.soldiers = 20 + alien.level * 10;
      target.buildings = [{ kind: 'base', progress: 100, work: 100 }];
      if (target.discovered) log(s, `${alien.name}在${target.name}建立了前哨。`, 'warning');
    }
  }
}
export function nextYear(s: GameState): void {
  const before = {
    economy: s.economy,
    resource: s.resource,
    culture: s.culture,
    population: population(s),
    unrest: s.unrest,
    history: s.history.length,
  };
  runScience(s);
  runEconomy(s);
  runConstruction(s);
  s.unrest = Math.min(100, s.unrest + integer(s, 3));
  s.year++;
  s.explored = 0;
  upgrade(s);
  alienTurn(s);
  for (const alien of s.aliens) {
    if (
      !alien.discovered &&
      s.stars.some(
        (star) =>
          star.exists &&
          star.owner === alien.id &&
          hasTech(s, SECTORS[star.sector].telescope) &&
          hasTech(s, SECTORS[star.sector].radio),
      )
    ) {
      alien.discovered = true;
      log(s, `太阳电波识别到${alien.name}的文明信号。`, 'discovery');
    }
  }
  for (const event of yearEvents(s.year)) {
    if (!s.seenEvents.includes(event.id)) {
      s.events.push(event);
      s.seenEvents.push(event.id);
    }
  }
  for (const story of STORY.filter(
    (story) =>
      s.pace === 'expedition' && !runtime.events.some((e) => Number(e.name) === story.year),
  )) {
    if (story.year <= s.year && !s.seenEvents.includes(story.event.id)) {
      s.events.push(structuredClone(story.event));
      s.seenEvents.push(story.event.id);
    }
  }
  if (random(s) < 0.1 && !s.events.length) {
    const event = originalEvent(runtime.randomEvents[integer(s, runtime.randomEvents.length)]);
    event.id += `-${s.year}`;
    s.events.push(event);
  }
  const report: AnnualReport = {
    year: s.year,
    economy: s.economy - before.economy,
    resource: s.resource - before.resource,
    culture: s.culture - before.culture,
    population: population(s) - before.population,
    unrest: s.unrest - before.unrest,
    messages: s.history.slice(before.history).map((h) => h.text),
  };
  s.report = report;
  checkEnding(s);
}
