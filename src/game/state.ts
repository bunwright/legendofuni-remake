import {
  ALIEN_LORE,
  BRANCHES,
  BUILDINGS,
  JOBS,
  LEVELS,
  SECTORS,
  TECH,
  THRESHOLDS,
  WEAPON,
  runtime,
  makePeople,
} from '../content/world';
import { finalEvent, yearEvents } from '../content/story';
import type { Alien, Branch, BuildingKind, GameState, Job, Pace, Person, Star } from './types';

export function random(s: Pick<GameState, 'rng'>): number {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function integer(s: Pick<GameState, 'rng'>, max: number): number {
  return Math.floor(random(s) * max);
}
export function rate(s: GameState): number {
  return s.pace === 'expedition' ? 3 : 1;
}
export function hasTech(s: GameState, id: string | null): boolean {
  return id === null || s.finished.includes(id);
}
export function owned(s: GameState): Star[] {
  return s.stars.filter((star) => star.exists && star.owner === 'earth');
}
export function population(s: GameState): number {
  return owned(s).reduce((sum, star) => sum + star.population, 0);
}
export function soldiers(s: GameState): number {
  return owned(s).reduce((sum, star) => sum + star.soldiers, 0);
}
export function allocated(s: GameState): number {
  return Object.values(s.workers).reduce((sum, n) => sum + n, 0) + soldiers(s);
}
export function idle(s: GameState): number {
  return Math.max(0, population(s) - allocated(s));
}
export function complete(star: Star, kind: BuildingKind): boolean {
  return star.buildings.some((b) => b.kind === kind && b.progress >= b.work);
}
export function leader(s: GameState, job: Person['assignment']): Person | undefined {
  return s.people.find((p) => p.discovered && p.assignment === job);
}
export function branchOpen(s: GameState, branch: Branch): boolean {
  return s.level >= BRANCHES.find((b) => b.id === branch)!.level;
}
export function visibleSector(s: GameState, sector: number): boolean {
  return !!SECTORS[sector] && hasTech(s, SECTORS[sector].telescope);
}
export function reachable(s: GameState, star: Star): boolean {
  return star.exists && visibleSector(s, star.sector) && hasTech(s, SECTORS[star.sector].flight);
}
export function activeWeaponCount(s: GameState): number {
  return owned(s).reduce(
    (sum, star) => sum + star.weapons.filter((w) => w.progress >= WEAPON[w.def].work).length,
    0,
  );
}
export function researchRate(s: GameState, branch: Branch): number {
  return (
    Math.min(
      100,
      Math.floor(
        ((s.workers[branch] + Math.floor((leader(s, branch)?.science ?? 0) / 10)) *
          (100 - s.unrest)) /
          100,
      ),
    ) * rate(s)
  );
}
export function techWeight(s: GameState, prefix: string): number {
  return hasTech(s, `${prefix}Ⅲ`)
    ? 5
    : hasTech(s, `${prefix}Ⅱ`)
      ? 4
      : hasTech(s, `${prefix}Ⅰ`)
        ? 3
        : 2;
}
export function log(
  s: GameState,
  text: string,
  kind: GameState['history'][number]['kind'] = 'info',
): void {
  s.history.push({ year: s.year, kind, text });
  if (s.history.length > 2000) s.history.splice(0, s.history.length - 2000);
}
export function upgrade(s: GameState): void {
  let level = 0;
  THRESHOLDS.forEach((n, i) => {
    if (s.culture >= n) level = i;
  });
  if (level > s.level) {
    s.army += 20 * (level - s.level);
    s.level = level;
    log(s, `地球文明升级到“${LEVELS[level]}”级别。我们的视野正在拓宽。`, 'science');
  }
}
export function checkEnding(s: GameState): void {
  if (s.ending) return;
  if (owned(s).length === 0) s.ending = 'extinction';
  else if (s.unrest >= 100) s.ending = 'revolt';
  else if (
    s.aliens.every(
      (a) => a.relation === 4 || !s.stars.some((star) => star.exists && star.owner === a.id),
    )
  ) {
    s.ending = 'victory';
    s.events = [finalEvent()];
  }
}
export function score(s: GameState): number {
  return population(s) + s.culture + s.army - s.unrest * 2;
}
export function honor(s: GameState): string {
  const destroyed = s.aliens.filter(
    (a) => !s.stars.some((star) => star.exists && star.owner === a.id),
  ).length;
  const total =
    destroyed +
    s.aliens.filter(
      (a) => a.relation === 4 && s.stars.some((star) => star.exists && star.owner === a.id),
    ).length;
  if (!destroyed) return '神圣';
  if (destroyed === total) return '战神';
  if (destroyed === Math.floor(total / 2)) return '纵横家';
  return destroyed / total < 0.25
    ? '文明使者'
    : destroyed / total < 0.5
      ? '和平主义'
      : destroyed / total < 0.75
        ? '军国主义'
        : '战争狂人';
}

export function normalizeWorkers(s: GameState): void {
  let excess = allocated(s) - population(s);
  for (const job of [...JOBS].reverse()) {
    if (excess <= 0) break;
    const removed = Math.min(excess, s.workers[job.id]);
    s.workers[job.id] -= removed;
    excess -= removed;
  }
  for (const star of owned(s)) {
    if (excess <= 0) break;
    const removed = Math.min(excess, star.soldiers);
    star.soldiers -= removed;
    excess -= removed;
  }
}
export function losePopulation(s: GameState, count: number, preferred: number): void {
  const colonies = owned(s).sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
  for (const star of colonies) {
    const removed = Math.min(count, star.population);
    star.population -= removed;
    count -= removed;
    if (count <= 0) break;
  }
  normalizeWorkers(s);
}

const solarNames = ['地球', '太阳', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星'];
const solarColors = [
  '#78b5d1',
  '#ffd19a',
  '#a5a19b',
  '#d2b68b',
  '#c08067',
  '#c2aa93',
  '#d1bd8c',
  '#8bd0d5',
  '#668cca',
];
const solarPositions: [number, number, number][] = [
  [-1, 0, 7],
  [0, 0, 0],
  [2.8, 0, 1.6],
  [-4.2, 0, 2.2],
  [6.2, 0, -5],
  [-10, 0, -7],
  [13, 0, 9],
  [-17, 0, 7],
  [13, 0, -16],
];
const solarRadii = [1.05, 2.3, 0.34, 0.72, 0.53, 1.65, 1.4, 0.95, 0.93];
const solarRes = [3500, 24000, 1800, 2800, 4500, 6500, 4800, 5000, 4500];

export function createGame(
  player = '执政官',
  pace: Pace = 'expedition',
  seed = Date.now() >>> 0,
): GameState {
  const s: GameState = {
    version: 1,
    seed: seed >>> 0,
    rng: seed >>> 0,
    nextUid: 1,
    player: player.trim().slice(0, 24) || '执政官',
    pace,
    year: 1,
    economy: 100,
    resource: 100,
    culture: 0,
    army: 10,
    unrest: 0,
    level: 0,
    stars: [],
    people: makePeople(),
    aliens: [],
    workers: Object.fromEntries(JOBS.map((j) => [j.id, 0])) as Record<Job, number>,
    research: {},
    finished: [],
    explored: 0,
    educated: 0,
    trained: 0,
    recruited: 0,
    history: [],
    events: yearEvents(1),
    seenEvents: ['legacy-1'],
    battle: null,
    diplomacy: null,
    report: null,
    ending: null,
    tutorial: 0,
  };
  for (let id = 0; id < 209; id++) {
    const sector = id < 9 ? 0 : id < 49 ? 1 : id < 109 ? 2 : 3;
    const index = sector === 1 ? id - 9 : sector === 2 ? id - 49 : id - 109;
    const angle = index * 2.399963229728653 + sector * 0.8;
    const distance = 3 + Math.sqrt(index + 1) * (sector === 3 ? 2.2 : 2.5);
    const planet = id < 9 ? id !== 1 : integer(s, 5) !== 2;
    const resource = id < 9 ? solarRes[id] : integer(s, 4000) + 1;
    s.stars.push({
      id,
      name: id < 9 ? solarNames[id] : `星${id}`,
      sector,
      planet,
      exists: true,
      resource,
      totalResource: resource,
      population: id === 0 ? 65 : 0,
      capacity: id === 0 ? 180 : planet ? integer(s, 300) + 10 : 0,
      owner: id === 0 ? 'earth' : null,
      discovered: id < 9,
      surveyed: false,
      color:
        id < 9
          ? solarColors[id]
          : ['#97c4d7', '#d6aa8a', '#bcb4d6', '#89b7b2', '#d6ceaf'][integer(s, 5)],
      radius: id < 9 ? solarRadii[id] : 0.22 + random(s) * 0.22,
      position:
        id < 9
          ? solarPositions[id]
          : [Math.cos(angle) * distance, (random(s) - 0.5) * 1.8, Math.sin(angle) * distance],
      buildings:
        id === 0
          ? Object.entries(BUILDINGS).map(([kind, b]) => ({
              kind: kind as BuildingKind,
              progress: b.work,
              work: b.work,
            }))
          : [],
      soldiers: 0,
      weapons: [],
      commander: null,
      recruits: 0,
      searchedYear: 0,
    });
  }
  const used = new Set<number>();
  for (const definition of runtime.stars) {
    let index = definition.index;
    if (index >= 9) {
      const candidates = s.stars.filter(
        (star) => star.sector === definition.sector && !used.has(star.id),
      );
      index = candidates[integer(s, candidates.length)].id;
    }
    used.add(index);
    Object.assign(s.stars[index], {
      name: definition.name,
      resource: definition.resource,
      totalResource: definition.resource,
      planet: definition.planet,
      capacity: definition.capacity,
    });
  }
  runtime.aliens.forEach((definition, i) => {
    const home = s.stars.find((star) => star.name === runtime.stars[definition.starIndex].name)!;
    const alien: Alien = {
      id: definition.id,
      name: definition.name,
      title: ALIEN_LORE[i][0],
      description: ALIEN_LORE[i][1],
      level: definition.level,
      army: definition.army,
      relation: 2,
      discovered: false,
      lastDiplomacy: 0,
      home: home.id,
    };
    s.aliens.push(alien);
    home.owner = alien.id;
    home.soldiers = definition.population;
    home.buildings = [{ kind: 'base', progress: 100, work: 100 }];
  });
  s.workers.mining = 22;
  s.workers.industry = 11;
  s.workers.arts = 20;
  s.workers.spaceflight = 12;
  s.people.find((p) => p.id === '丁仪')!.assignment = 'spaceflight';
  s.people.find((p) => p.id === '罗辑')!.assignment = 'arts';
  s.people.find((p) => p.id === '叶文洁')!.assignment = 'astrophysics';
  s.people.find((p) => p.id === '章北海')!.assignment = 'base:0';
  s.stars[0].commander = '章北海';
  log(s, `${s.player}就任地球首席执政官。危机纪元开始。`);
  return s;
}

export function researchReason(s: GameState, id: string): string | null {
  const tech = TECH[id];
  if (!tech) return '不存在的科技。';
  if (hasTech(s, id)) return '已经掌握这项科技。';
  if (!branchOpen(s, tech.branch))
    return `文明需要达到“${LEVELS[BRANCHES.find((b) => b.id === tech.branch)!.level]}”。`;
  if (tech.parent && !hasTech(s, tech.parent)) return `需要先掌握「${tech.parent}」。`;
  if (s.research[tech.branch]) return '本研究所已有项目，请先完成。暂停只保留进度，不释放研究所。';
  if (s.economy < tech.cost) return `需要 ${tech.cost} 经济，当前只有 ${s.economy}。`;
  return null;
}
