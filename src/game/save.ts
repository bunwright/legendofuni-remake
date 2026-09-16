import { z } from 'zod';
import { BRANCHES, BUILDINGS, JOBS, TECH, WEAPON, legacy } from '../content/world';
import { allocated, population } from './state';
import type { GameState, Settings } from './types';

export const SAVE_PREFIX = 'legendofuni:v1:';
const uint = z.number().int().min(0).max(1e9);
const text = z.string().max(12000);
const small = z.string().max(100);
const id = z.number().int().min(0).max(208);
const branch = z.enum([
  'spaceflight',
  'astrophysics',
  'nuclear',
  'proton',
  'sociology',
  'culture',
  'economy',
]);
const job = z.enum(['mining', 'industry', 'arts', ...BRANCHES.map((b) => b.id)] as [
  string,
  ...string[],
]);
const assignment = z.string().max(100).nullable();
const weapon = z.object({ uid: uint, def: small, hp: uint, progress: uint });
const star = z.object({
  id,
  name: small,
  sector: z.number().int().min(0).max(3),
  planet: z.boolean(),
  exists: z.boolean(),
  resource: uint,
  totalResource: uint,
  population: uint,
  capacity: uint,
  owner: small.nullable(),
  discovered: z.boolean(),
  surveyed: z.boolean(),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  radius: z.number().min(0.1).max(4),
  position: z.tuple([
    z.number().min(-100).max(100),
    z.number().min(-20).max(20),
    z.number().min(-100).max(100),
  ]),
  buildings: z
    .array(
      z.object({ kind: z.enum(['mine', 'factory', 'city', 'base']), progress: uint, work: uint }),
    )
    .max(4),
  soldiers: uint,
  weapons: z.array(weapon).max(40),
  commander: small.nullable(),
  recruits: z.number().int().min(0).max(2),
  searchedYear: uint,
});
const person = z.object({
  id: small,
  role: small,
  description: text,
  science: uint.max(100),
  economy: uint.max(100),
  leadership: uint.max(100),
  army: uint.max(100),
  social: uint.max(100),
  art: uint.max(100),
  treachery: uint.max(100),
  discovered: z.boolean(),
  assignment,
});
const event = z.object({
  id: small,
  title: small,
  speaker: small,
  text,
  source: z.enum(['legacy', 'remake']),
  choices: z
    .array(
      z.object({
        label: small,
        description: text,
        ...Object.fromEntries(
          ['economy', 'resource', 'culture', 'unrest', 'army', 'population'].map((k) => [
            k,
            z.number().int().min(-1000000).max(1000000).optional(),
          ]),
        ),
      }),
    )
    .min(1)
    .max(8),
  talks: z
    .array(z.object({ speaker: small, text, portrait: small }))
    .min(1)
    .max(30)
    .optional(),
  page: uint.max(29).optional(),
  warTarget: small.optional(),
});
const battleUnit = z.object({
  uid: z.number().int().min(-209).max(1e9),
  name: small,
  def: small.nullable(),
  hp: uint,
  maxHp: uint,
  attack: uint,
  priority: uint,
  kind: z.enum(['unit', 'bomb']),
  target: z.number().int().nullable(),
});
const schema = z.object({
  version: z.literal(1),
  seed: z.number().int().min(0).max(4294967295),
  rng: z.number().int().min(0).max(4294967295),
  nextUid: uint,
  player: z.string().min(1).max(24),
  pace: z.enum(['classic', 'expedition']),
  year: uint.min(1).max(100000),
  economy: uint,
  resource: uint,
  culture: uint,
  army: uint,
  unrest: uint.max(100),
  level: uint.max(4),
  stars: z.array(star).length(209),
  people: z.array(person).length(28),
  aliens: z
    .array(
      z.object({
        id: small,
        name: small,
        title: small,
        description: text,
        level: uint.max(4),
        relation: uint.max(4),
        discovered: z.boolean(),
        lastDiplomacy: uint,
        home: id,
        army: uint,
      }),
    )
    .length(11),
  workers: z.record(job, uint),
  research: z.partialRecord(branch, z.object({ tech: small, progress: uint, paused: z.boolean() })),
  finished: z.array(small).max(51),
  explored: uint.max(3),
  educated: uint,
  trained: uint,
  recruited: uint,
  history: z
    .array(
      z.object({
        year: uint,
        kind: z.enum(['info', 'science', 'discovery', 'war', 'diplomacy', 'warning']),
        text,
      }),
    )
    .max(2000),
  events: z.array(event).max(100),
  seenEvents: z.array(small).max(2000),
  battle: z
    .object({
      myStar: id,
      enemyStar: id,
      defensive: z.boolean(),
      round: uint.min(1),
      mine: z.array(battleUnit).max(41),
      enemy: z.array(battleUnit).max(41),
      log: z.array(text).max(150),
      originalSoldiers: uint,
      enemyOriginalSoldiers: uint,
      usedSkills: z.array(small).max(3),
      outcome: z.enum(['victory', 'defeat', 'retreat']).nullable(),
    })
    .nullable(),
  diplomacy: z
    .object({
      alien: small,
      person: small,
      progress: uint.max(100),
      spirit: uint.max(100),
      maxSpirit: uint.max(100),
      question: uint.max(4),
      seconds: uint.max(10),
      rounds: uint,
      log: z.array(text).max(30),
      outcome: z.enum(['victory', 'defeat']).nullable(),
    })
    .nullable(),
  report: z
    .object({
      year: uint,
      ...Object.fromEntries(
        ['economy', 'resource', 'population', 'culture', 'unrest'].map((k) => [
          k,
          z.number().int(),
        ]),
      ),
      messages: z.array(text).max(2000),
    })
    .nullable(),
  ending: z.enum(['victory', 'extinction', 'revolt']).nullable(),
  tutorial: uint.max(6),
});
export function validateSave(input: unknown): GameState {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error('存档格式不正确或版本不受支持。请选择本重制版导出的 JSON 存档。');
  const s = result.data as unknown as GameState;
  const bad = () => {
    throw new Error('存档数据不一致，无法读取。原有存档未被修改。');
  };
  const aliens = new Set(s.aliens.map((a) => a.id));
  const persons = new Set(s.people.map((p) => p.id));
  if (aliens.size !== 11 || persons.size !== 28 || legacy.peopleNames.some((n) => !persons.has(n)))
    bad();
  if (s.aliens.some((a, i) => a.id !== `alien-${i}` || a.name !== legacy.alienNames[i])) bad();
  if (
    Object.keys(s.workers).length !== JOBS.length ||
    JOBS.some((j) => !Number.isSafeInteger(s.workers[j.id]))
  )
    bad();
  if (s.finished.some((t) => !TECH[t]) || new Set(s.finished).size !== s.finished.length) bad();
  for (const [branch, project] of Object.entries(s.research)) {
    if (
      !TECH[project.tech] ||
      TECH[project.tech].branch !== branch ||
      s.finished.includes(project.tech) ||
      project.progress >= TECH[project.tech].work
    )
      bad();
  }
  for (const tech of [...s.finished, ...Object.values(s.research).map((p) => p.tech)]) {
    if (TECH[tech].parent && !s.finished.includes(TECH[tech].parent!)) bad();
  }
  const uids = new Set<number>();
  for (const [i, star] of s.stars.entries()) {
    if (
      star.id !== i ||
      star.sector !== (i < 9 ? 0 : i < 49 ? 1 : i < 109 ? 2 : 3) ||
      star.population > star.capacity ||
      star.resource > star.totalResource
    )
      bad();
    if (star.owner && star.owner !== 'earth' && !aliens.has(star.owner)) bad();
    if (star.commander && !persons.has(star.commander)) bad();
    if (new Set(star.buildings.map((b) => b.kind)).size !== star.buildings.length) bad();
    for (const b of star.buildings)
      if (b.work !== BUILDINGS[b.kind].work || b.progress > b.work) bad();
    for (const w of star.weapons) {
      if (
        !WEAPON[w.def] ||
        w.progress > WEAPON[w.def].work ||
        w.hp > WEAPON[w.def].hp ||
        uids.has(w.uid) ||
        w.uid >= s.nextUid
      )
        bad();
      uids.add(w.uid);
    }
  }
  if (allocated(s) > population(s)) bad();
  const assignments = new Set<string>();
  for (const p of s.people) {
    if (!p.assignment) continue;
    if (!p.discovered || assignments.has(p.assignment)) bad();
    assignments.add(p.assignment);
    if (p.assignment.startsWith('base:')) {
      const base = s.stars[Number(p.assignment.slice(5))];
      if (!base || base.owner !== 'earth' || !base.exists || base.commander !== p.id) bad();
    } else if (!JOBS.some((j) => j.id === p.assignment) && p.assignment !== 'administration') bad();
  }
  for (const star of s.stars)
    if (
      star.commander &&
      !s.people.some((p) => p.id === star.commander && p.assignment === `base:${star.id}`)
    )
      bad();
  for (const event of s.events)
    if (event.page !== undefined && (!event.talks || event.page >= event.talks.length)) bad();
  if (s.battle && s.diplomacy) bad();
  if (s.diplomacy) {
    const d = s.diplomacy;
    if (
      !aliens.has(d.alien) ||
      !s.people.some((p) => p.discovered && p.id === d.person) ||
      d.spirit > d.maxSpirit
    )
      bad();
  }
  if (s.battle) {
    const b = s.battle;
    if (
      b.myStar === b.enemyStar ||
      (!b.outcome &&
        (s.stars[b.myStar].owner !== 'earth' || !aliens.has(s.stars[b.enemyStar].owner!)))
    )
      bad();
    for (const units of [b.mine, b.enemy]) {
      if (new Set(units.map((u) => u.uid)).size !== units.length) bad();
      for (const u of units) if ((u.def && !WEAPON[u.def]) || u.hp > u.maxHp) bad();
    }
  }
  return s;
}
export function encodeSave(s: GameState): string {
  return JSON.stringify(
    { format: 'LegendOfUniRemake', version: 1, savedAt: new Date().toISOString(), game: s },
    null,
    2,
  );
}
export function decodeSave(raw: string): GameState {
  if (raw.length > 5_000_000) throw new Error('存档文件超过 5 MB 限制。');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('无法解析这个文件。请选择有效的 JSON 存档。');
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('format' in data) ||
    data.format !== 'LegendOfUniRemake' ||
    !('game' in data)
  )
    throw new Error('这不是《群星传》重制版存档。旧版 .lsv 文件不能直接导入。');
  if (!('version' in data) || data.version !== 1) throw new Error('不支持这个存档版本。');
  return validateSave(data.game);
}
export function saveSlot(
  s: GameState,
  slot: 'auto' | '1' | '2' | '3',
  storage: Storage = localStorage,
): void {
  storage.setItem(`${SAVE_PREFIX}${slot}`, encodeSave(s));
}
export function loadSlot(
  slot: 'auto' | '1' | '2' | '3',
  storage: Storage = localStorage,
): GameState | null {
  const raw = storage.getItem(`${SAVE_PREFIX}${slot}`);
  return raw ? decodeSave(raw) : null;
}
export function defaultSettings(): Settings {
  return {
    sound: false,
    volume: 0.45,
    quality: 'high',
    reducedMotion:
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    timedDiplomacy: false,
  };
}
export function loadSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem(`${SAVE_PREFIX}settings`) ?? '{}');
    return {
      ...defaultSettings(),
      ...z
        .object({
          sound: z.boolean().optional(),
          volume: z.number().min(0).max(1).optional(),
          quality: z.enum(['high', 'low']).optional(),
          reducedMotion: z.boolean().optional(),
          timedDiplomacy: z.boolean().optional(),
        })
        .parse(data),
    };
  } catch {
    return defaultSettings();
  }
}
