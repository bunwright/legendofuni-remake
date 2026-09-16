export type Branch =
  'sociology' | 'nuclear' | 'spaceflight' | 'proton' | 'astrophysics' | 'culture' | 'economy';
export type Job = 'mining' | 'industry' | 'arts' | Branch;
export type BuildingKind = 'mine' | 'factory' | 'city' | 'base';
export type Pace = 'classic' | 'expedition';
export type Owner = 'earth' | string | null;
export interface Technology {
  id: string;
  parent: string | null;
  branch: Branch;
  work: number;
  cost: number;
  description: string;
}
export interface Building {
  kind: BuildingKind;
  progress: number;
  work: number;
}
export interface WeaponDef {
  id: string;
  tech: string;
  kind: 'unit' | 'bomb' | 'spy' | 'singularity';
  hp: number;
  attack: number;
  priority: number;
  cost: number;
  work: number;
  perRound: number;
  level: number;
}
export interface Weapon {
  uid: number;
  def: string;
  hp: number;
  progress: number;
}
export interface Star {
  id: number;
  name: string;
  sector: number;
  planet: boolean;
  exists: boolean;
  resource: number;
  totalResource: number;
  population: number;
  capacity: number;
  owner: Owner;
  discovered: boolean;
  surveyed: boolean;
  color: string;
  radius: number;
  position: [number, number, number];
  buildings: Building[];
  soldiers: number;
  weapons: Weapon[];
  commander: string | null;
  recruits: number;
  searchedYear: number;
}
export interface Person {
  id: string;
  role: string;
  description: string;
  science: number;
  economy: number;
  leadership: number;
  army: number;
  social: number;
  art: number;
  treachery: number;
  discovered: boolean;
  assignment: Job | 'administration' | `base:${number}` | null;
}
export interface Alien {
  id: string;
  name: string;
  title: string;
  description: string;
  level: number;
  relation: number;
  discovered: boolean;
  lastDiplomacy: number;
  home: number;
  army: number;
}
export interface Research {
  tech: string;
  progress: number;
  paused: boolean;
}
export interface Chronicle {
  year: number;
  kind: 'info' | 'science' | 'discovery' | 'war' | 'diplomacy' | 'warning';
  text: string;
}
export interface EventChoice {
  label: string;
  description: string;
  economy?: number;
  resource?: number;
  culture?: number;
  unrest?: number;
  army?: number;
  population?: number;
}
export interface Talk {
  speaker: string;
  text: string;
  portrait: string;
}
export interface StoryEvent {
  id: string;
  title: string;
  speaker: string;
  text: string;
  source: 'legacy' | 'remake';
  choices: EventChoice[];
  talks?: Talk[];
  page?: number;
  warTarget?: string;
}
export interface BattleUnit {
  uid: number;
  name: string;
  def: string | null;
  hp: number;
  maxHp: number;
  attack: number;
  priority: number;
  kind: 'unit' | 'bomb';
  target: number | null;
}
export interface Battle {
  myStar: number;
  enemyStar: number;
  defensive: boolean;
  round: number;
  mine: BattleUnit[];
  enemy: BattleUnit[];
  log: string[];
  originalSoldiers: number;
  enemyOriginalSoldiers: number;
  usedSkills: string[];
  outcome: 'victory' | 'defeat' | 'retreat' | null;
}
export interface Diplomacy {
  alien: string;
  person: string;
  progress: number;
  spirit: number;
  maxSpirit: number;
  question: number;
  seconds: number;
  rounds: number;
  log: string[];
  outcome: 'victory' | 'defeat' | null;
}
export interface AnnualReport {
  year: number;
  economy: number;
  resource: number;
  population: number;
  culture: number;
  unrest: number;
  messages: string[];
}
export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  nextUid: number;
  player: string;
  pace: Pace;
  year: number;
  economy: number;
  resource: number;
  culture: number;
  army: number;
  unrest: number;
  level: number;
  stars: Star[];
  people: Person[];
  aliens: Alien[];
  workers: Record<Job, number>;
  research: Partial<Record<Branch, Research>>;
  finished: string[];
  explored: number;
  educated: number;
  trained: number;
  recruited: number;
  history: Chronicle[];
  events: StoryEvent[];
  seenEvents: string[];
  battle: Battle | null;
  diplomacy: Diplomacy | null;
  report: AnnualReport | null;
  ending: 'victory' | 'extinction' | 'revolt' | null;
  tutorial: number;
}
export interface Settings {
  sound: boolean;
  volume: number;
  quality: 'high' | 'low';
  reducedMotion: boolean;
  timedDiplomacy: boolean;
}
export interface Result {
  ok: boolean;
  message: string;
}
export type Command =
  | { type: 'next-year' }
  | { type: 'workers'; job: Job; count: number }
  | { type: 'preset'; preset: 'balanced' | 'science' | 'culture' | 'industry' }
  | { type: 'research'; tech: string }
  | { type: 'pause-research'; branch: Branch }
  | { type: 'build'; star: number; kind: BuildingKind }
  | { type: 'explore'; star: number }
  | { type: 'educate' | 'train' | 'recruit-person' }
  | { type: 'assign'; person: string; assignment: Person['assignment'] }
  | { type: 'search-city'; star: number }
  | { type: 'recruit-soldiers'; star: number; count: number }
  | { type: 'weapon'; star: number; weapon: string }
  | { type: 'transfer'; from: number; to: number; soldiers: number; weapons: boolean }
  | { type: 'spy' | 'singularity'; from: number; to: number }
  | { type: 'declare-war'; alien: string }
  | { type: 'attack'; from: number; to: number }
  | { type: 'battle-target'; unit: number; target: number | null }
  | {
      type: 'battle-act';
      action: 'attack' | 'bomb' | 'morale' | 'bribe' | 'intimidate' | 'retreat';
      weapon?: number;
    }
  | { type: 'close-battle' }
  | { type: 'diplomacy'; alien: string; person: string }
  | { type: 'dip-answer'; theory: number }
  | { type: 'dip-tick'; timed: boolean }
  | { type: 'dip-leave' | 'close-diplomacy' }
  | { type: 'event-next'; skip?: boolean }
  | { type: 'event-choice'; choice: number }
  | { type: 'dismiss-report' }
  | { type: 'tutorial'; step: number };
