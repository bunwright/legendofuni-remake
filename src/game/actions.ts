import {
  BRANCHES,
  BUILDINGS,
  JOBS,
  RELATIONS,
  SECTORS,
  TECH,
  WEAPON,
  legacy,
} from '../content/world';
import { battleCommand, startBattle } from './combat';
import { answer, diplomacyTick, newQuestion } from './diplomacy';
import { nextYear } from './simulation';
import {
  branchOpen,
  checkEnding,
  complete,
  hasTech,
  idle,
  integer,
  log,
  owned,
  population,
  reachable,
  researchReason,
  upgrade,
  visibleSector,
} from './state';
import type { Command, GameState, Person, Result } from './types';

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });
const validCount = (n: number): boolean => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
function discoverPerson(s: GameState): string | null {
  const hidden = s.people.filter((p) => !p.discovered);
  if (!hidden.length) return null;
  const person = hidden[integer(s, hidden.length)];
  person.discovered = true;
  log(
    s,
    `发现新人物：${person.id}。${legacy.discoveryQuotes[integer(s, legacy.discoveryQuotes.length)]}`,
    'discovery',
  );
  return person.id;
}
export function buildReason(s: GameState, id: number, kind: keyof typeof BUILDINGS): string | null {
  const star = s.stars[id],
    def = BUILDINGS[kind];
  if (!star || !def || !star.exists || !star.discovered) return '需要先探索这颗星球。';
  if (!reachable(s, star)) return '飞船航程不足，无法抵达。';
  if (star.owner && star.owner !== 'earth') return '这颗星球属于外星文明。';
  if (!star.planet && kind !== 'mine') return '恒星只能建造采矿工厂。';
  if (star.buildings.some((b) => b.kind === kind)) return '已存在该设施或建造计划。';
  const tech = kind === 'mine' && !star.planet ? '恒星开发Ⅰ' : def.tech;
  if (!hasTech(s, tech)) return `需要先掌握「${tech}」。`;
  if (s.economy < def.cost) return `需要 ${def.cost} 经济。`;
  return null;
}
export function execute(s: GameState, cmd: Command): Result {
  if (cmd.type === 'tutorial') {
    if (!Number.isInteger(cmd.step) || cmd.step < 0 || cmd.step > 6) return fail('无效指引阶段。');
    s.tutorial = cmd.step;
    return ok('指引已更新。');
  }
  if (cmd.type === 'dismiss-report') {
    s.report = null;
    return ok('年度战报已归档。');
  }
  if (cmd.type === 'close-battle') {
    if (!s.battle?.outcome) return fail('请先完成当前战斗。');
    s.battle = null;
    return ok('返回指挥中心。');
  }
  if (cmd.type === 'close-diplomacy') {
    if (!s.diplomacy?.outcome) return fail('请先完成或结束谈判。');
    s.diplomacy = null;
    return ok('外交记录已归档。');
  }
  if (s.ending && !['event-next', 'event-choice'].includes(cmd.type))
    return fail('这段文明史已经结束。你可以查看结局或开始新的旅程。');
  if (s.battle && !['battle-act', 'battle-target'].includes(cmd.type))
    return fail('请先完成当前战斗。');
  if (s.diplomacy && !['dip-answer', 'dip-tick', 'dip-leave'].includes(cmd.type))
    return fail('请先完成当前谈判。');
  switch (cmd.type) {
    case 'next-year':
      if (s.events.length) return fail('请先回应当前事件。');
      nextYear(s);
      return ok(`进入危机纪元 ${s.year} 年。`);
    case 'workers': {
      if (!JOBS.some((j) => j.id === cmd.job) || !validCount(cmd.count))
        return fail('人口分配必须是有效的非负整数。');
      const branch = BRANCHES.find((b) => b.id === cmd.job);
      if (branch && !branchOpen(s, branch.id)) return fail('当前文明级别尚未解锁该研究所。');
      if (cmd.count > s.workers[cmd.job] + idle(s))
        return fail('可分配人口不足，请先从其他部门调回人口。');
      s.workers[cmd.job] = cmd.count;
      return ok('人口部署已更新。');
    }
    case 'preset': {
      if (!['balanced', 'science', 'culture', 'industry'].includes(cmd.preset))
        return fail('未知的人口部署方案。');
      const available = population(s) - owned(s).reduce((n, star) => n + star.soldiers, 0);
      for (const job of JOBS) s.workers[job.id] = 0;
      const ratios =
        cmd.preset === 'culture'
          ? [0.3, 0.15, 0.45]
          : cmd.preset === 'science'
            ? [0.3, 0.15, 0.15]
            : cmd.preset === 'industry'
              ? [0.5, 0.25, 0.15]
              : [0.34, 0.17, 0.3];
      s.workers.mining = Math.floor(available * ratios[0]);
      s.workers.industry = Math.floor(available * ratios[1]);
      s.workers.arts = Math.floor(available * ratios[2]);
      const active = BRANCHES.filter((b) => !!s.research[b.id] && branchOpen(s, b.id));
      const targets = active.length ? active : [BRANCHES[0]];
      let remaining = idle(s);
      targets.forEach((b, i) => {
        const n = Math.floor(remaining / (targets.length - i));
        s.workers[b.id] = n;
        remaining -= n;
      });
      return ok('人口已按部署方案分配。现役驻军保持不变。');
    }
    case 'research': {
      const reason = researchReason(s, cmd.tech);
      if (reason) return fail(reason);
      const tech = TECH[cmd.tech];
      s.economy -= tech.cost;
      s.research[tech.branch] = { tech: tech.id, progress: 0, paused: false };
      log(s, `启动研究：${tech.id}。`, 'science');
      return ok(`「${tech.id}」研究已启动。`);
    }
    case 'pause-research': {
      const project = s.research[cmd.branch];
      if (!project) return fail('该研究所没有进行中的项目。');
      project.paused = !project.paused;
      return ok(project.paused ? '研究已暂停，进度和资金投入保留。' : '研究已继续。');
    }
    case 'build': {
      const reason = buildReason(s, cmd.star, cmd.kind);
      if (reason) return fail(reason);
      const star = s.stars[cmd.star],
        def = BUILDINGS[cmd.kind];
      s.economy -= def.cost;
      star.owner = 'earth';
      star.buildings.push({ kind: cmd.kind, progress: 0, work: def.work });
      log(s, `在${star.name}开工建造${def.name}。`);
      return ok(`${star.name}：${def.name}开始建造。`);
    }
    case 'explore': {
      const star = s.stars[cmd.star];
      if (!star?.exists) return fail('目标星球不存在。');
      if (!visibleSector(s, star.sector))
        return fail(`需要先掌握「${SECTORS[star.sector].telescope}」。`);
      if (star.discovered) return fail('这颗星球已经完成探索。');
      if (!reachable(s, star))
        return fail(`需要「${SECTORS[star.sector].flight}」才能登陆这个星域。`);
      if (s.explored >= 3) return fail('本年度已探索 3 颗新星。请在下一年度继续。');
      s.explored++;
      star.discovered = true;
      log(s, `发现新的星球：${star.name}。`, 'discovery');
      const alien = s.aliens.find((a) => a.id === star.owner);
      if (alien && !alien.discovered) {
        alien.discovered = true;
        log(s, `首次接触：${alien.name}。${alien.description}`, 'discovery');
        s.events.push({
          id: `contact-${alien.id}`,
          title: `首次接触 · ${alien.name}`,
          speaker: alien.name,
          source: 'remake',
          text: `${alien.description}\n\n我们的信号穿过了漫长的黑暗。如今，在星图上，第一次出现了另一个文明的名字。`,
          choices: [
            { label: '建立文明档案', description: '可以通过外交改善关系，也可以准备军事行动。' },
          ],
        });
      }
      return ok(
        `已抵达${star.name}。${alien ? `发现${alien.name}。` : star.planet ? '这是一颗行星。' : '这是一颗恒星。'}`,
      );
    }
    case 'educate':
      if (s.educated === s.year) return fail('每年只能进行一次全民教育。');
      if (s.economy < 10) return fail('全民教育需要 10 经济。');
      s.economy -= 10;
      s.educated = s.year;
      {
        const decrease = Math.min(s.unrest, 5 + integer(s, 5));
        s.unrest -= decrease;
        log(s, `通过本次全民教育，全民逃亡主义下降 ${decrease} 点。`);
        return ok(`全民教育完成，逃亡主义下降 ${decrease}。`);
      }
    case 'train':
      if (s.trained === s.year) return fail('每年只能进行一次军事训练。');
      if (s.economy < 10) return fail('军事训练需要 10 经济。');
      s.economy -= 10;
      s.trained = s.year;
      {
        const gain = 3 + integer(s, 3);
        s.army += gain;
        log(s, `本次军事训练，我军的战斗力提升了 ${gain} 点。`, 'war');
        return ok(`军事训练完成，战斗力提升 ${gain}。`);
      }
    case 'recruit-person': {
      if (s.recruited === s.year) return fail('本年度的人才征召已经完成。');
      if (!s.people.some((p) => !p.discovered)) return fail('所有人物都已加入文明。');
      if (s.economy < 15) return fail('人才征召需要 15 经济。');
      s.economy -= 15;
      s.recruited = s.year;
      return ok(`${discoverPerson(s)}加入了地球文明。`);
    }
    case 'search-city': {
      const star = s.stars[cmd.star];
      if (!star || star.owner !== 'earth' || !star.exists || !complete(star, 'city'))
        return fail('只能在已建成的地球城市中寻访。');
      if (star.searchedYear === s.year) return fail('今年已在这座城市寻访过。');
      if (star.recruits >= 2) return fail('这座城市的两位隐士都已找到。');
      if (!s.people.some((p) => !p.discovered)) return fail('所有人物都已加入文明。');
      star.searchedYear = s.year;
      if (integer(s, 4) === 2) {
        star.recruits++;
        return ok(`发现新人物：${discoverPerson(s)}！`);
      }
      return ok('这次没有遇见新人物，明年可以继续寻访。');
    }
    case 'assign': {
      const p = s.people.find((p) => p.id === cmd.person && p.discovered);
      if (!p) return fail('尚未找到这位人物。');
      const assignment = cmd.assignment;
      const baseId =
        typeof assignment === 'string' && /^base:\d+$/.test(assignment)
          ? Number(assignment.slice(5))
          : null;
      const base = baseId === null ? null : s.stars[baseId];
      if (
        assignment &&
        !JOBS.some((j) => j.id === assignment) &&
        assignment !== 'administration' &&
        !(base && base.owner === 'earth' && base.exists && complete(base, 'base'))
      )
        return fail('无效的任命部门或基地。');
      if (p.assignment?.startsWith('base:'))
        s.stars[Number(p.assignment.slice(5))].commander = null;
      if (assignment)
        for (const other of s.people) if (other.assignment === assignment) other.assignment = null;
      p.assignment = assignment;
      if (base) base.commander = p.id;
      return ok(assignment ? `${p.id}已到任。` : `${p.id}已解除职务。`);
    }
    case 'recruit-soldiers': {
      const star = s.stars[cmd.star];
      if (!star || !star.exists || star.owner !== 'earth' || !complete(star, 'base'))
        return fail('需要已建成的军事基地。');
      if (!validCount(cmd.count)) return fail('驻军人数必须为非负整数。');
      if (cmd.count > star.soldiers + idle(s))
        return fail('可分配人口不足，请先从其他部门调回人口。');
      star.soldiers = cmd.count;
      return ok('基地驻军已调整。');
    }
    case 'weapon': {
      const star = s.stars[cmd.star],
        def = WEAPON[cmd.weapon];
      if (!star || !star.exists || star.owner !== 'earth' || !complete(star, 'base'))
        return fail('需要已建成的军事基地。');
      if (!def) return fail('不存在的武器。');
      if (!hasTech(s, def.tech)) return fail(`需要先掌握「${def.tech}」。`);
      if (star.weapons.length >= 40) return fail('单个基地最多容纳 40 个武器或生产任务。');
      if (s.economy < def.cost) return fail(`建造需要 ${def.cost} 经济。`);
      s.economy -= def.cost;
      star.weapons.push({ uid: s.nextUid++, def: def.id, hp: def.hp, progress: 0 });
      return ok(`${def.id}已进入${star.name}的生产队列。`);
    }
    case 'transfer': {
      const from = s.stars[cmd.from],
        to = s.stars[cmd.to];
      if (
        !from ||
        !to ||
        from === to ||
        !from.exists ||
        !to.exists ||
        from.owner !== 'earth' ||
        to.owner !== 'earth' ||
        !complete(from, 'base') ||
        !complete(to, 'base')
      )
        return fail('调动需要两个不同的、已建成的己方军事基地。');
      if (!reachable(s, to)) return fail('目的地超出飞船航程。');
      if (!validCount(cmd.soldiers) || cmd.soldiers > from.soldiers)
        return fail('调动人数超过出发基地的驻军。');
      const moving = cmd.weapons
        ? from.weapons.filter((w) => w.progress >= WEAPON[w.def].work)
        : [];
      if (moving.length + to.weapons.length > 40) return fail('目的基地武器容量不足。');
      from.soldiers -= cmd.soldiers;
      to.soldiers += cmd.soldiers;
      to.weapons.push(...moving);
      from.weapons = from.weapons.filter((w) => !moving.includes(w));
      log(
        s,
        `从${from.name}向${to.name}调动 ${cmd.soldiers} 驻军与 ${moving.length} 件武器。`,
        'war',
      );
      return ok('舰队已调动到目的基地。');
    }
    case 'spy':
    case 'singularity': {
      const from = s.stars[cmd.from],
        to = s.stars[cmd.to];
      if (
        !from?.exists ||
        from.owner !== 'earth' ||
        !to?.exists ||
        !to.discovered ||
        !to.owner ||
        to.owner === 'earth' ||
        !reachable(s, to)
      )
        return fail('需要己方基地与航程内已探索的外星文明目标。');
      const kind = cmd.type === 'spy' ? 'spy' : 'singularity';
      const w = from.weapons.find(
        (w) => WEAPON[w.def].kind === kind && w.progress >= WEAPON[w.def].work,
      );
      if (!w)
        return fail(
          cmd.type === 'spy' ? '该基地没有已完成的智子。' : '该基地没有已完成的奇点炸弹。',
        );
      const alien = s.aliens.find((a) => a.id === to.owner)!;
      if (cmd.type === 'singularity' && alien.relation === 4)
        return fail('不能向盟友投放奇点炸弹。需要先宣战。');
      from.weapons = from.weapons.filter((x) => x !== w);
      if (cmd.type === 'spy') {
        to.surveyed = true;
        log(
          s,
          `智子刺探回报：${to.name}驻军 ${to.soldiers}，拥有 ${to.weapons.length} 件武器。`,
          'war',
        );
        return ok(`智子已部署。${to.name}的战备情报已公开。`);
      }
      to.exists = false;
      to.owner = null;
      to.population = 0;
      to.soldiers = 0;
      to.weapons = [];
      to.buildings = [];
      alien.relation = 0;
      log(
        s,
        `我们对${to.name}星球使用了奇点炸弹。${to.name}被炸成了粉末，永远成为宇宙中的一个历史名词。`,
        'war',
      );
      checkEnding(s);
      return ok(`${to.name}已被摧毁。这是一个无法撤回的决定。`);
    }
    case 'declare-war': {
      const alien = s.aliens.find((a) => a.id === cmd.alien && a.discovered);
      if (!alien) return fail('未知的文明。');
      alien.relation = 0;
      log(s, `地球向${alien.name}宣战。`, 'war');
      return ok(`与${alien.name}的关系变为${RELATIONS[0]}。`);
    }
    case 'attack': {
      const from = s.stars[cmd.from],
        to = s.stars[cmd.to];
      if (
        !from?.exists ||
        from.owner !== 'earth' ||
        !complete(from, 'base') ||
        !to?.exists ||
        !to.discovered ||
        !to.owner ||
        to.owner === 'earth'
      )
        return fail('需要己方军事基地和已探索的外星目标。');
      if (!reachable(s, to)) return fail('目标超出飞船航程。');
      const alien = s.aliens.find((a) => a.id === to.owner)!;
      if (alien.relation === 4) return fail('这是我们的盟友。必须先宣战才能发动攻击。');
      if (
        from.soldiers === 0 &&
        !from.weapons.some((w) => WEAPON[w.def].kind === 'unit' && w.progress >= WEAPON[w.def].work)
      )
        return fail('出发基地没有驻军或已完成的作战舰船。');
      alien.relation = Math.max(0, alien.relation - 1);
      startBattle(s, from.id, to.id);
      return ok(`舰队已抵达${to.name}。战斗开始。`);
    }
    case 'battle-target': {
      const b = s.battle;
      if (!b || b.outcome) return fail('没有进行中的战斗。');
      const unit = b.mine.find((u) => u.uid === cmd.unit && u.hp > 0 && u.kind === 'unit');
      if (
        !unit ||
        (cmd.target !== null &&
          !b.enemy.some((u) => u.uid === cmd.target && u.hp > 0 && u.kind === 'unit'))
      )
        return fail('无效的作战单元或目标。');
      unit.target = cmd.target;
      return ok('攻击目标已锁定。');
    }
    case 'battle-act':
      return battleCommand(s, cmd);
    case 'diplomacy': {
      const alien = s.aliens.find((a) => a.id === cmd.alien && a.discovered),
        person = s.people.find((p) => p.id === cmd.person && p.discovered);
      if (!alien || !person) return fail('需要已接触的文明和已发现的人物。');
      if (!s.stars.some((star) => star.exists && star.owner === alien.id))
        return fail('该文明已经消亡。');
      if (alien.relation === 4) return fail('我们已经结为牢固同盟。');
      if (alien.lastDiplomacy === s.year) return fail('每年只能与同一文明谈判一次。');
      if (!hasTech(s, '宇宙社会学公理')) return fail('需要先研究「宇宙社会学公理」。');
      alien.lastDiplomacy = s.year;
      const spirit = Math.floor((person.leadership * 4 + person.social * 6) / 10);
      s.diplomacy = {
        alien: alien.id,
        person: person.id,
        progress: 50,
        spirit,
        maxSpirit: spirit,
        question: 0,
        seconds: 10,
        rounds: 0,
        log: [],
        outcome: null,
      };
      newQuestion(s);
      return ok('和平谈判开始。留意对方问题背后的理论。');
    }
    case 'dip-answer':
      return answer(s, cmd.theory);
    case 'dip-tick':
      diplomacyTick(s, cmd.timed);
      return ok('');
    case 'dip-leave': {
      const d = s.diplomacy;
      if (!d || d.outcome) return fail('没有正在进行的谈判。');
      d.outcome = 'defeat';
      log(
        s,
        `${d.person}结束了与${s.aliens.find((a) => a.id === d.alien)!.name}的谈判。`,
        'diplomacy',
      );
      return ok('已结束谈判。可以在下一年再试。');
    }
    case 'event-next': {
      const event = s.events[0];
      if (!event?.talks) return fail('没有可继续的对话。');
      event.page = cmd.skip
        ? event.talks.length - 1
        : Math.min(event.talks.length - 1, (event.page ?? 0) + 1);
      return ok('');
    }
    case 'event-choice': {
      const event = s.events[0];
      const choice = event?.choices[cmd.choice];
      if (!Number.isInteger(cmd.choice) || !choice) return fail('不存在的事件选项。');
      if (event.talks && (event.page ?? 0) < event.talks.length - 1)
        return fail('请先继续或跳过对话。');
      if (
        event.source !== 'legacy' &&
        (s.economy + (choice.economy ?? 0) < 0 || s.resource + (choice.resource ?? 0) < 0)
      )
        return fail('当前资源不足，请选择其他方案。');
      s.economy = Math.max(0, s.economy + (choice.economy ?? 0));
      s.resource = Math.max(0, s.resource + (choice.resource ?? 0));
      s.culture = Math.max(0, s.culture + (choice.culture ?? 0));
      let newPopulation = choice.population ?? 0;
      for (const colony of owned(s)) {
        const added = Math.min(Math.max(0, newPopulation), colony.capacity - colony.population);
        colony.population += added;
        newPopulation -= added;
      }
      s.unrest = Math.max(0, Math.min(100, s.unrest + (choice.unrest ?? 0)));
      s.army = Math.max(0, s.army + (choice.army ?? 0));
      log(s, `${event.title}：${choice.label}。`);
      s.events.shift();
      const contacts: Record<string, number> = {
        'legacy-2': 0,
        'legacy-20': 2,
        'legacy-25': 1,
        'legacy-50': 6,
        'legacy-70': 7,
        'legacy-83': 5,
      };
      if (event.id in contacts) s.aliens[contacts[event.id]].discovered = true;
      if (event.warTarget) {
        const enemy = s.stars.find((star) => star.name === event.warTarget && star.exists);
        const alien = s.aliens.find((a) => a.id === enemy?.owner);
        if (enemy && alien && alien.relation !== 4 && s.stars[0].owner === 'earth') {
          enemy.discovered = true;
          alien.discovered = true;
          startBattle(s, 0, enemy.id, true);
        } else log(s, '敌人的兵力不足或已缔结同盟，最终取消了这场战争。');
      }
      upgrade(s);
      checkEnding(s);
      return ok('决定已记录在文明史中。');
    }
    default:
      return fail('未知的指令。');
  }
}

export function assignmentLabel(p: Person): string {
  if (!p.assignment) return '待命';
  if (p.assignment === 'administration') return '人力资源部';
  if (p.assignment.startsWith('base:')) return '基地指挥官';
  return JOBS.find((j) => j.id === p.assignment)?.name ?? '待命';
}
