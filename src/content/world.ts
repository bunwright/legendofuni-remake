import legacy from './legacy.generated.json';
import runtime from './runtime.generated.json';
import type {
  Branch,
  BuildingKind,
  Job,
  Person,
  StoryEvent,
  Technology,
  WeaponDef,
} from '../game/types';

export { legacy, runtime };
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
export function portrait(name: string): string {
  const portraits = runtime.portraits as Record<string, string>;
  return asset(portraits[name] ?? portraits.player);
}
export const TECHNOLOGIES = legacy.technologies as Technology[];
export const TECH = Object.fromEntries(TECHNOLOGIES.map((t) => [t.id, t]));
export const BRANCHES: {
  id: Branch;
  name: string;
  icon: string;
  level: number;
  description: string;
}[] = [
  {
    id: 'spaceflight',
    name: '航天技术',
    icon: 'orbit',
    level: 0,
    description: '从行星的摇篮，走向群星。',
  },
  {
    id: 'astrophysics',
    name: '天体物理',
    icon: 'telescope',
    level: 1,
    description: '视野的边界，就是文明的边界。',
  },
  { id: 'nuclear', name: '核技术', icon: 'atom', level: 1, description: '驯服恒星的火焰。' },
  {
    id: 'proton',
    name: '质子技术',
    icon: 'scan',
    level: 2,
    description: '一粒微尘，也能容纳一个宇宙。',
  },
  {
    id: 'sociology',
    name: '宇宙社会学',
    icon: 'network',
    level: 2,
    description: '黑暗森林中，最有力的武器也许是思想。',
  },
  {
    id: 'culture',
    name: '地球文化',
    icon: 'fingerprint',
    level: 0,
    description: '我们所守护的，不止是一颗星球。',
  },
  {
    id: 'economy',
    name: '经济学',
    icon: 'boxes',
    level: 0,
    description: '让有限的物质，托举无限的未来。',
  },
];
export const JOBS: { id: Job; name: string; icon: string }[] = [
  { id: 'mining', name: '资源开采', icon: 'pickaxe' },
  { id: 'industry', name: '工业生产', icon: 'factory' },
  { id: 'arts', name: '文化建设', icon: 'landmark' },
  ...BRANCHES.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
];
export const LEVELS = ['荒蛮', '起源', '风暴', '逐鹿', '霸王'];
export const THRESHOLDS = [0, 70, 200, 500, 1000];
export const SECTORS = [
  {
    name: '太阳系',
    subtitle: '文明的摇篮',
    scale: '30 AU',
    telescope: null,
    flight: null,
    radio: null,
  },
  {
    name: '50 光年',
    subtitle: '恒星的近邻',
    scale: '50 ly',
    telescope: '50光年望远镜',
    flight: '10%光速飞船',
    radio: '太阳电波放大(50光年)',
  },
  {
    name: '1 万光年',
    subtitle: '猎户座旋臂',
    scale: '10,000 ly',
    telescope: '1万光年望远镜',
    flight: '50%光速飞船',
    radio: '太阳电波放大(1万光年)',
  },
  {
    name: '银河系',
    subtitle: '黑暗森林',
    scale: '100,000 ly',
    telescope: '银河系望远镜',
    flight: '99%光速飞船',
    radio: '太阳电波放大(银河系)',
  },
];
export const BUILDINGS: Record<
  BuildingKind,
  {
    name: string;
    icon: string;
    cost: number;
    work: number;
    tech: string | null;
    description: string;
  }
> = {
  mine: {
    name: '采矿工厂',
    icon: 'pickaxe',
    cost: 20,
    work: 100,
    tech: '行星开发Ⅰ',
    description: '开采星球的有限矿藏，供给整个文明。',
  },
  factory: {
    name: '加工工厂',
    icon: 'factory',
    cost: 20,
    work: 200,
    tech: '行星建设Ⅰ',
    description: '将 2 点资源转化为 1 点经济。',
  },
  city: {
    name: '城市',
    icon: 'building-2',
    cost: 20,
    work: 400,
    tech: '行星殖民Ⅰ',
    description: '每年产生新人口，也可能发现新人物。',
  },
  base: {
    name: '军事基地',
    icon: 'shield',
    cost: 20,
    work: 100,
    tech: null,
    description: '部署驻军、建造战舰，守卫文明的疆域。',
  },
};

// All numeric values are recovered verbatim from the original weapon.ini.
export const WEAPONS = runtime.weapons as WeaponDef[];
export const WEAPON = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const THEORIES = ['宇宙社会学公理', '技术爆炸理论', '猜疑链', '黑暗森林理论', '种族沟通'];
export const SPIRIT_COST = [20, 26, 32, 35, 40];
export const PERSUASION = [10, 14, 17, 20, 25];
export const RELATIONS = ['仇恨', '敌对', '普通', '友好', '亲密同盟'];

const profiles: Record<string, [string, string]> = {
  丁仪: ['理论物理学家', '从球状闪电到宏观原子，在宇宙最深处追索答案。'],
  罗辑: ['宇宙社会学家', '把文明之间的沉默，变成一门足以改变命运的科学。'],
  章北海: ['太空军军官', '冷静而坚定。星海辽阔，航向必须由自己决定。'],
  叶文洁: ['天体物理学家', '曾经向深空投去目光，如今试图读懂来自宇宙的回声。'],
  林云: ['武器研究者', '以科学和勇气，探索力量的边界。'],
  杨冬: ['高能物理学家', '在微观世界的矛盾中，寻找自然法则最后的秩序。'],
  大史: ['安全顾问', '从复杂的局面里找到最直接的答案。'],
  伊依: ['诗人', '在陌生的星空下，依然坚持诗歌的价值。'],
  汪淼: ['纳米材料学家', '把微小尺度的突破，变成文明宏大的工程。'],
  霍金: ['宇宙学家', '用思想越过时间与空间，凝视宇宙的起点。'],
  常伟思: ['战略指挥官', '把每一次准备，视为未来战场上的一次胜利。'],
  庄颜: ['画家', '让人们记得，蓝色星球上仍有值得守护的美。'],
  希恩斯: ['脑科学家', '理解思想，才能理解人类所相信的未来。'],
  雷迪亚兹: ['战略家', '以极端意志，面对极端的生存困局。'],
  东方延绪: ['舰队舰长', '以精确的行动，将遥远的目的地变成归途。'],
};
export function makePeople(): Person[] {
  return legacy.peopleNames.map((id) => {
    const p = profiles[id] ?? ['地球顾问', '在文明的危机中，贡献自己的知识、勇气与想象。'];
    const original = runtime.people.find((person) => person.id === id)!;
    return {
      ...original,
      id,
      role: p[0],
      description: p[1],
      discovered: ['丁仪', '罗辑', '章北海', '叶文洁'].includes(id),
      assignment: null,
    };
  });
}
export const ALIEN_LORE = [
  ['流浪的掠食者', '一艘庞大的世界之船，带着无法满足的饥饿穿越星海。'],
  ['三颗太阳的子民', '在毁灭与复苏之间演化的文明。稳定的世界，是最昂贵的愿望。'],
  ['诗歌的收藏者', '他们试图穷尽语言的所有排列，为宇宙写下一首终极诗篇。'],
  ['行星的终结者', '星球在他们的航迹之后碎裂。力量，似乎是他们唯一的语言。'],
  ['星河的守望者', '把危险消除在出现之前，是他们信奉的秩序。'],
  ['共同的生命形式', '许多世界联合在同一个名字下，探索碳基生命的共同命运。'],
  ['远古的播种者', '技术远超人类想象。对他们而言，创造生命也许只是一项工程。'],
  ['失落的亲缘', '陌生的信号中，藏着一段意外熟悉的历史。'],
  ['绝对零度的雕刻者', '在冰冷中追求美。他们的杰作，可能以一整个世界为材料。'],
  ['远方的航海者', '从波江座方向驶来的舰船，携带着另一种文明的选择。'],
  ['绿色海洋的居民', '一片覆盖整个行星的生命之海，正在倾听外界的声音。'],
];
export const STORY: { year: number; event: StoryEvent }[] = [
  {
    year: 5,
    event: {
      id: 'pale-blue',
      title: '暗淡蓝点',
      speaker: '深空观测站',
      source: 'remake',
      text: '探测器传回了第一张远离家园的影像。画面中，地球只剩下一个几乎看不见的蓝点。\n\n有人说，我们应当把有限的预算留在地面。也有人说，正因为如此，我们才必须继续向前。',
      choices: [
        { label: '继续深空计划', description: '经济 −15，文化 +20', economy: -15, culture: 20 },
        { label: '向全民公开影像', description: '文化 +8，逃亡主义 −4', culture: 8, unrest: -4 },
      ],
    },
  },
  {
    year: 12,
    event: {
      id: 'quiet-sky',
      title: '长久的沉默',
      speaker: '天体物理研究所',
      source: 'remake',
      text: '接收阵列已经听了十二年。宇宙依然沉默。\n\n沉默意味着孤独，还是意味着有人正在屏息？我们可以扩建接收器，也可以先让我们的世界学会团结。',
      choices: [
        { label: '扩建观测阵列', description: '经济 −25，文化 +35', economy: -25, culture: 35 },
        { label: '开展公共讨论', description: '逃亡主义 −6，文化 +10', unrest: -6, culture: 10 },
      ],
    },
  },
];
