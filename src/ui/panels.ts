import {
  BRANCHES,
  BUILDINGS,
  JOBS,
  LEVELS,
  RELATIONS,
  SECTORS,
  TECH,
  TECHNOLOGIES,
  THRESHOLDS,
  WEAPON,
  WEAPONS,
  portrait,
  runtime,
} from '../content/world';
import { assignmentLabel, buildReason } from '../game/actions';
import {
  activeWeaponCount,
  branchOpen,
  complete,
  hasTech,
  idle,
  owned,
  population,
  rate,
  reachable,
  researchRate,
  researchReason,
  soldiers,
  visibleSector,
} from '../game/state';
import { economicForecast } from '../game/simulation';
import type { Branch, BuildingKind, GameState, Star } from '../game/types';
import { button, command, empty, esc, heading, icon, meter, number, signed } from './html';

export type Panel =
  'map' | 'science' | 'population' | 'people' | 'fleet' | 'diplomacy' | 'history' | 'guide';
export interface ViewState {
  panel: Panel;
  sector: number;
  selected: number;
  branch: Branch;
  base: number;
  alien: string;
  directory: boolean;
}
export const NAV: { id: Panel; name: string; icon: string; key: string }[] = [
  { id: 'map', name: '星图', icon: 'orbit', key: '1' },
  { id: 'science', name: '科研', icon: 'atom', key: '2' },
  { id: 'population', name: '发展', icon: 'factory', key: '3' },
  { id: 'people', name: '人物', icon: 'users', key: '4' },
  { id: 'fleet', name: '舰队', icon: 'shield', key: '5' },
  { id: 'diplomacy', name: '外交', icon: 'signal', key: '6' },
  { id: 'history', name: '编年史', icon: 'book', key: '7' },
  { id: 'guide', name: '百科', icon: 'star', key: '8' },
];
export function hud(s: GameState, view: ViewState, sound: boolean): string {
  const forecast = economicForecast(s);
  const stats = [
    ['人口', population(s), `闲置 ${idle(s)}`, 'users'],
    ['经济', s.economy, `${signed(forecast.production)} / 年`, 'factory'],
    ['资源', s.resource, `${signed(forecast.resource)} / 年`, 'pickaxe'],
    ['文化', s.culture, `${signed(forecast.culture)} / 年`, 'landmark'],
    ['战力', s.army, `驻军 ${soldiers(s)}`, 'shield'],
    ['逃亡', s.unrest, '100 即文明崩溃', 'signal'],
  ] as const;
  return `<header class="topbar"><button class="brand-mark" data-action="panel:map" aria-label="返回星图">${icon('orbit')}<span>群星传<small>LEGEND OF UNI</small></span></button><div class="resources">${stats.map(([label, value, detail, glyph]) => `<div class="resource ${label === '逃亡' && s.unrest >= 50 ? 'danger-text' : ''}" title="${esc(detail)}">${icon(glyph)}<div><span>${label}</span><strong>${number(value)}${label === '逃亡' ? '<small>%</small>' : ''}</strong><small>${esc(detail)}</small></div></div>`).join('')}</div><button class="epoch" data-action="panel:history"><span>危机纪元</span><strong>${String(s.year).padStart(3, '0')}<small>年</small></strong></button></header>
  <nav class="command-nav" aria-label="指挥导航">${NAV.map((n) => `<button data-action="panel:${n.id}" class="${view.panel === n.id ? 'active' : ''}" aria-current="${view.panel === n.id ? 'page' : 'false'}" title="${n.name} · ${n.key}">${icon(n.icon)}<span>${n.name}</span><kbd>${n.key}</kbd></button>`).join('')}<div class="nav-bottom">${button(sound ? '静音' : '声音', 'sound', 'nav-utility', 'volume')}${button('存档', 'modal:saves', 'nav-utility', 'save')}${button('设置', 'modal:settings', 'nav-utility', 'settings')}</div></nav>
  <footer class="bottombar"><div class="sector-tabs" aria-label="星域导航">${SECTORS.map((sector, i) => `<button data-action="sector:${i}" class="${view.sector === i ? 'active' : ''}" ${!visibleSector(s, i) ? `title="需要 ${esc(sector.telescope)}"` : ''}><small>0${i + 1}</small>${!visibleSector(s, i) ? icon('lock') : ''}<span>${sector.name}</span></button>`).join('')}</div><div class="civilization-level"><span>${LEVELS[s.level]}文明</span>${meter(s.culture, THRESHOLDS[s.level + 1] ?? Math.max(1000, s.culture), '文明文化进度')}<small>${s.level < 4 ? `${s.culture} / ${THRESHOLDS[s.level + 1]} 文化` : '文明巅峰'}</small></div>${command('结束年度', { type: 'next-year' }, { class: 'next-year', icon: 'arrow', disabled: s.battle || s.diplomacy || s.events.length || s.ending ? '先完成当前事件、战斗或谈判。' : null })}<kbd class="end-key">N</kbd></footer>`;
}
export function mapPanel(s: GameState, view: ViewState): string {
  const star = s.stars[view.selected];
  return `<section class="map-heading"><div class="eyebrow">STELLAR CARTOGRAPHY / ${SECTORS[view.sector].scale}</div><h1>${SECTORS[view.sector].name}</h1><p>${SECTORS[view.sector].subtitle} <span>·</span> ${s.stars.filter((x) => x.sector === view.sector && x.discovered && x.exists).length} 个已知天体</p><div class="map-tools">${button('星球目录', 'directory', 'text-button', 'book')}${button('重置视角', 'camera:reset', 'text-button', 'orbit')}</div></section>
  ${
    view.directory
      ? `<aside class="star-directory" aria-label="星球目录"><h2>当前星域 ${button('关闭', 'directory', 'icon-button', 'close')}</h2>${s.stars
          .filter((x) => x.sector === view.sector && x.exists)
          .map(
            (x) =>
              `<button data-action="select:${x.id}" class="${x.id === view.selected ? 'active' : ''}"><span>${esc(x.discovered ? x.name : `未知信号 ${x.id}`)}</span><small>${x.discovered ? (x.owner === 'earth' ? '地球领土' : x.owner ? '异星文明' : '未殖民') : '待探索'}</small></button>`,
          )
          .join('')}</aside>`
      : ''
  }
  <aside class="planet-panel" aria-label="星球情报">${star?.exists && star.sector === view.sector ? planetPanel(s, star) : empty('选择一颗星球', '点击星图中的天体或使用星球目录。')}</aside>
  <aside class="mission-strip"><div class="eyebrow">CIVILIZATION DIRECTIVE</div><h2>${s.year < 17 ? `距吞食帝国到来 · ${17 - s.year} 年` : '生存不是唯一的答案'}</h2><p>${s.year < 17 ? '研究 10% 光速飞船以生产小型战舰，部署地球守军。第 17 年将迎来原作的第一次入侵。' : `与全部 11 个文明结盟，或终结其领土。当前同盟 ${s.aliens.filter((a) => a.relation === 4).length} / 11。`}</p>${button(s.year < 17 ? '前往科研 →' : '打开外交 →', s.year < 17 ? 'panel:science' : 'panel:diplomacy', 'text-button')}</aside>
  <div class="map-instructions">拖动旋转 · 滚轮缩放 · 点击「抵近观测」聚焦</div>`;
}
function planetPanel(s: GameState, star: Star): string {
  const alien = s.aliens.find((a) => a.id === star.owner);
  const known = star.discovered;
  return `<div class="eyebrow">${known ? (star.planet ? 'PLANETARY SURVEY' : 'STELLAR SURVEY') : 'UNIDENTIFIED SIGNAL'} / ${String(star.id).padStart(3, '0')}</div><div class="planet-title"><h2>${esc(known ? star.name : '未知天体')}</h2>${button('抵近观测', `focus:${star.id}`, 'icon-button', 'telescope')}</div><div class="ownership">${icon(known && star.owner === 'earth' ? 'shield' : 'orbit')} ${known ? (star.owner === 'earth' ? '地球联合政府' : (alien?.name ?? '无主天体')) : hasTech(s, SECTORS[star.sector].radio) ? `电波识别：${alien?.name ?? '无主天体'}` : '尚未进行实地探索'}</div>
  ${
    !known
      ? `<p class="muted">星光已经抵达这里，而我们的航迹尚未抵达那里。</p><p class="note">${reachable(s, star) ? '飞船航程允许探索。' : `需要 ${esc(SECTORS[star.sector].flight)}。`}本年度剩余 ${3 - s.explored} 次探索。</p>${command('派遣探索飞船', { type: 'explore', star: star.id }, { class: 'primary wide', icon: 'arrow', disabled: !reachable(s, star) ? '飞船航程不足' : s.explored >= 3 ? '本年度探索次数用尽' : null })}`
      : `
  <dl class="planet-facts"><div><dt>剩余矿藏</dt><dd>${number(star.resource)}<small> / ${number(star.totalResource)}</small></dd></div><div><dt>人口 / 容量</dt><dd>${star.owner === 'earth' ? number(star.population) : '—'}<small> / ${number(star.capacity)}</small></dd></div><div><dt>天体类型</dt><dd>${star.planet ? '行星' : '恒星'}</dd></div><div><dt>可达状态</dt><dd>${reachable(s, star) ? '航程内' : '航程外'}</dd></div></dl>
  ${
    star.owner && star.owner !== 'earth'
      ? `<div class="section-label">异星情报</div><p class="note">${esc(alien?.description)}<br>关系：${RELATIONS[alien?.relation ?? 2]}<br>${star.surveyed ? `驻军 ${star.soldiers} · 武器 ${star.weapons.length}` : '详细军情未知，可使用智子侦察。'}</p>${button('联系这个文明', `alien:${alien?.id}`, 'command wide', 'signal')}${button('军事行动', `target:${star.id}`, 'command wide', 'shield')}`
      : `
  <div class="section-label">行星设施 <span>${star.buildings.length} / ${star.planet ? 4 : 1}</span></div><div class="building-list">${(
    Object.keys(BUILDINGS) as BuildingKind[]
  )
    .filter((kind) => star.planet || kind === 'mine')
    .map((kind) => {
      const def = BUILDINGS[kind],
        built = star.buildings.find((b) => b.kind === kind),
        reason = buildReason(s, star.id, kind);
      return `<div class="building-item">${icon(def.icon)}<div><strong>${def.name}</strong><small>${built ? (built.progress >= built.work ? '运行中' : `施工 ${built.progress} / ${built.work}`) : (reason ?? `${def.cost} 经济 · ${def.work} 工作量`)}</small>${built && built.progress < built.work ? meter(built.progress, built.work, def.name) : ''}</div>${built ? `<span class="facility-status">${built.progress >= built.work ? icon('check') : '⋯'}</span>` : command('建造', { type: 'build', star: star.id, kind }, { class: 'small-button', disabled: reason })}</div>`;
    })
    .join(
      '',
    )}</div>${star.owner === 'earth' && complete(star, 'city') ? command('城市寻访', { type: 'search-city', star: star.id }, { class: 'command wide', icon: 'users', disabled: star.searchedYear === s.year ? '今年已寻访' : star.recruits >= 2 ? '已找到两位人物' : null }) : ''}
  ${star.owner === 'earth' && complete(star, 'base') ? `${button(`军事基地 · 驻军 ${star.soldiers}`, `base:${star.id}`, 'command wide', 'shield')}<small class="muted">指挥官：${esc(star.commander ?? '尚未任命')}</small>` : ''}`
  }`
  }`;
}
export function sciencePanel(s: GameState, view: ViewState): string {
  const branch = BRANCHES.find((b) => b.id === view.branch)!;
  const technologies = TECHNOLOGIES.filter((t) => t.branch === branch.id);
  const project = s.research[branch.id],
    speed = researchRate(s, branch.id);
  return `${heading('SCIENCE DIRECTORATE', '向未知，推进一步', '七条科技谱系，五十一个突破。每一项研究，都改变我们在宇宙中的位置。')}<div class="science-layout"><nav class="branch-nav" aria-label="科研分支">${BRANCHES.map((b) => `<button data-action="branch:${b.id}" class="${view.branch === b.id ? 'active' : ''}">${icon(b.icon)}<span>${b.name}<small>${s.finished.filter((id) => TECH[id].branch === b.id).length} / ${TECHNOLOGIES.filter((t) => t.branch === b.id).length} ${!branchOpen(s, b.id) ? `· ${LEVELS[b.level]}解锁` : ''}</small></span>${s.research[b.id] ? '<i class="live-dot"></i>' : ''}</button>`).join('')}</nav><div class="research-main"><div class="research-summary"><div><span class="eyebrow">${branch.name}研究所</span><h2>${esc(branch.description)}</h2><p>${branchOpen(s, branch.id) ? `研究人员 ${s.workers[branch.id]} · 年度工作量 ${speed} · ${s.pace === 'expedition' ? '远征节奏 ×3' : '经典节奏'}` : `文明达到${LEVELS[branch.level]}后开放。需要文化 ${THRESHOLDS[branch.level]}。`}</p></div>${button('部署研究人员', 'panel:population', 'command', 'users')}</div>${project ? `<div class="active-project"><span class="eyebrow">${project.paused ? 'PAUSED' : 'RESEARCH IN PROGRESS'}</span><h3>${esc(project.tech)}</h3>${meter(project.progress, TECH[project.tech].work, project.tech)}<div class="spread"><small>${project.progress} / ${TECH[project.tech].work} · ${project.paused ? '暂停中' : speed ? `预计 ${Math.ceil((TECH[project.tech].work - project.progress) / speed)} 年` : '没有工作量，请部署人员'}</small>${command(project.paused ? '恢复研究' : '暂停研究', { type: 'pause-research', branch: branch.id }, { class: 'text-button' })}</div></div>` : ''}<div class="tech-tree">${technologies
    .map((t, i) => {
      const done = hasTech(s, t.id),
        active = project?.tech === t.id,
        reason = researchReason(s, t.id);
      const depth = (() => {
        let d = 0,
          parent = t.parent;
        while (parent) {
          d++;
          parent = TECH[parent]?.parent;
        }
        return d;
      })();
      return `<article class="tech-node ${done ? 'complete' : active ? 'researching' : reason ? 'locked' : 'available'}" style="--depth:${Math.min(3, depth)}"><div class="tech-connector"></div><div class="tech-number">${done ? icon('check') : String(i + 1).padStart(2, '0')}</div><div class="tech-content"><div class="eyebrow">${t.parent ? `前置 / ${esc(t.parent)}` : '基础理论'}</div><h3>${esc(t.id)}</h3><p>${esc(t.description)}</p><div class="tech-footer"><small>${t.cost} 经济 · ${t.work} 工作量</small>${done ? '<span class="status-text">已掌握</span>' : active ? '<span class="status-text">当前项目</span>' : command('启动研究', { type: 'research', tech: t.id }, { class: 'small-button', disabled: reason })}</div>${!done && !active && reason ? `<small class="lock-reason">${esc(reason)}</small>` : ''}</div></article>`;
    })
    .join('')}</div></div></div>`;
}
export function populationPanel(s: GameState): string {
  const forecast = economicForecast(s);
  return `${heading('CIVILIZATION DEVELOPMENT', '文明的力量，来自每一个人', '人口在部门与驻军之间共享。先调回人员，再分配到其他岗位；新生人口会进入待命池。')}<div class="population-overview"><div><span>总人口</span><strong>${population(s)}</strong></div><div><span>待命人口</span><strong>${idle(s)}</strong></div><div><span>现役驻军</span><strong>${soldiers(s)}</strong></div><div><span>年度人口增长</span><strong>${signed(forecast.population)}</strong></div></div><div class="toolbar"><span class="eyebrow">部署预案</span>${(['balanced', 'science', 'culture', 'industry'] as const).map((preset, i) => command(['均衡发展', '科研优先', '文化优先', '工业优先'][i], { type: 'preset', preset }, { class: 'small-button' })).join('')}</div><div class="development-layout"><div class="labor-list">${JOBS.map(
    (job) => {
      const branch = BRANCHES.find((b) => b.id === job.id),
        locked = branch && !branchOpen(s, branch.id);
      return `<form class="labor-row" data-form="workers"><input type="hidden" name="job" value="${job.id}">${icon(job.icon)}<label for="worker-${job.id}"><strong>${job.name}</strong><small>${locked ? `${LEVELS[branch.level]}文明解锁` : branch ? (s.research[branch.id] ? `${esc(s.research[branch.id]!.tech)} · ${researchRate(s, branch.id)} 工作量/年` : '暂无研究项目') : job.id === 'mining' ? `预计开采 ${forecast.mining} 资源/年` : job.id === 'industry' ? `预计生产 ${forecast.production} 经济/年` : `预计增长 ${forecast.culture} 文化/年`}</small></label><input id="worker-${job.id}" name="count" type="number" min="0" max="${s.workers[job.id] + idle(s)}" value="${s.workers[job.id]}" required ${locked ? 'disabled' : ''}><button class="small-button" ${locked ? 'disabled' : ''}>部署</button></form>`;
    },
  ).join(
    '',
  )}</div><aside class="development-aside"><h2>保持文明的方向</h2><p>逃亡主义降低科研与经济效率，达到 100 将失去民众支持。教育每年可进行一次。</p>${meter(s.unrest, 100, '逃亡主义', 'warning')}<div class="spread"><span>逃亡主义</span><strong>${s.unrest}%</strong></div>${command('全民教育 · 10 经济', { type: 'educate' }, { class: 'command wide', icon: 'landmark', disabled: s.educated === s.year ? '本年已教育' : s.economy < 10 ? '经济不足' : null })}${command('军事训练 · 10 经济', { type: 'train' }, { class: 'command wide', icon: 'shield', disabled: s.trained === s.year ? '本年已训练' : s.economy < 10 ? '经济不足' : null })}<hr><h3>本年度经济预测</h3><dl class="planet-facts"><div><dt>矿藏开采</dt><dd>+${forecast.mining}</dd></div><div><dt>工业产出</dt><dd>+${forecast.production}</dd></div><div><dt>资源净变化</dt><dd>${signed(forecast.resource)}</dd></div><div><dt>文化增长</dt><dd>+${forecast.culture}</dd></div></dl><p class="note">预测不含科研完成后的效率变化、随机事件与战争损失。${hasTech(s, '质能转换') ? '已掌握质能转换，生产不消耗资源。' : '每生产 1 经济消耗 2 资源。矿藏枯竭后应建设其他星球矿场。'}</p></aside></div>`;
}
export function peoplePanel(s: GameState): string {
  const discovered = s.people.filter((p) => p.discovered);
  const assignments = [
    ['', '解除任命 / 待命'],
    ['administration', '人力资源部'],
    ...JOBS.map((j) => [j.id, j.name]),
    ...owned(s)
      .filter((star) => complete(star, 'base'))
      .map((star) => [`base:${star.id}`, `${star.name} · 指挥官`]),
  ];
  return `${heading('PEOPLE OF EARTH', '把未来，交给他们', `已找到 ${discovered.length} / 28 位人物。能力数值来自原作 person.ini；人物简介为重制补充。`)}<div class="toolbar">${command('公开征召 · 15 经济', { type: 'recruit-person' }, { icon: 'users', disabled: s.recruited === s.year ? '本年已征召' : s.economy < 15 ? '经济不足' : discovered.length === 28 ? '已找到所有人物' : null })}<span class="note">重制扩展：每年保证找到一人。免费城市寻访保留原作 25% 成功率。</span></div><div class="person-list">${discovered.map((p) => `<article class="person"><img src="${portrait(p.id)}" alt="${esc(p.id)}原作头像" width="64" height="64"><div class="person-bio"><div class="eyebrow">${esc(p.role)}</div><h2>${esc(p.id)}<small>${esc(assignmentLabel(p))}</small></h2><p>${esc(p.description)}</p><dl class="person-stats">${(['science', 'economy', 'leadership', 'army', 'social', 'art', 'treachery'] as const).map((key, i) => `<div><dt>${['科学', '经济', '统率', '军事', '社会', '艺术', '叛逆'][i]}</dt><dd>${p[key]}</dd></div>`).join('')}</dl></div><form data-form="assign" class="appointment"><input type="hidden" name="person" value="${esc(p.id)}"><label for="assignment-${s.people.indexOf(p)}">任命岗位</label><select id="assignment-${s.people.indexOf(p)}" name="assignment">${assignments.map(([value, label]) => `<option value="${esc(value)}" ${p.assignment === value || (!p.assignment && !value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><button class="small-button">确认任命</button></form></article>`).join('')}</div>`;
}
export function fleetPanel(s: GameState, view: ViewState): string {
  const bases = owned(s).filter((star) => complete(star, 'base'));
  const base = bases.find((star) => star.id === view.base) ?? bases[0];
  const targets = s.stars.filter(
    (star) => star.exists && star.discovered && star.owner && star.owner !== 'earth',
  );
  return `${heading('EARTH SPACE FORCE', '在沉默的宇宙中，守住家园', `现役驻军 ${soldiers(s)} · 完成武器 ${activeWeaponCount(s)} · 军事基地 ${bases.length}。作战会造成永久损失。`)}${
    !base
      ? empty('尚无军事基地', '在己方或无主行星上建设军事基地，等待施工完成。')
      : `<div class="toolbar"><label for="base-select">出发基地</label><select id="base-select" data-select="base">${bases.map((b) => `<option value="${b.id}" ${b.id === base.id ? 'selected' : ''}>${esc(b.name)} · 驻军 ${b.soldiers}</option>`).join('')}</select><span class="muted">指挥官 ${esc(base.commander ?? '未任命')}</span>${button('任命指挥官', 'panel:people', 'text-button')}</div><div class="fleet-layout"><div><section class="garrison"><h2>${esc(base.name)}驻军</h2><form data-form="garrison" class="inline-form"><input type="hidden" name="star" value="${base.id}"><label for="soldier-count">总人数</label><input id="soldier-count" type="number" name="count" min="0" max="${base.soldiers + idle(s)}" value="${base.soldiers}" required><button class="small-button">部署驻军</button></form><p class="note">可以增加 ${idle(s)} 人。军队使用全文明的人口池；解除驻军后人口回到待命池。</p></section><section class="arsenal"><div class="section-label">武器生产 <span>数值源自原作</span></div>${WEAPONS.map((w) => `<article class="weapon-blueprint"><div>${icon(w.kind === 'unit' ? 'shield' : w.kind === 'spy' ? 'atom' : 'star')}</div><div><h3>${esc(w.id)}</h3><p>${w.kind === 'spy' ? '消耗后揭示敌方兵力' : w.kind === 'singularity' ? '消耗后永久摧毁目标星球' : `兵力 ${w.hp} · 攻击 ${w.attack} · 先手 ${w.priority}${w.kind === 'bomb' ? ' · 一次性全体伤害' : ''}`}</p><small>${w.cost} 经济 · ${Math.ceil(w.work / (w.perRound * rate(s)))} 年建造${!hasTech(s, w.tech) ? ` · 需要 ${esc(w.tech)}` : ''}</small></div>${command('生产', { type: 'weapon', star: base.id, weapon: w.id }, { class: 'small-button', disabled: !hasTech(s, w.tech) ? `需要 ${w.tech}` : s.economy < w.cost ? '经济不足' : base.weapons.length >= 40 ? '基地已满' : null })}</article>`).join('')}</section></div><aside class="fleet-orders"><div class="section-label">基地整备 <span>${base.weapons.length} / 40</span></div>${base.weapons.length ? base.weapons.map((w) => `<div class="production-item"><div class="spread"><strong>${esc(w.def)}</strong><small>${w.progress >= WEAPON[w.def].work ? `就绪 · HP ${w.hp}` : `${w.progress}%`}</small></div>${meter(w.progress, WEAPON[w.def].work, `${w.def}生产进度`)}</div>`).join('') : '<p class="note">生产队列为空。先研究「10%光速飞船」并生产小型战舰，为第一次入侵做好准备。</p>'}<hr><h2>星际行动</h2>${targets.length ? `<form data-form="operation"><input type="hidden" name="from" value="${base.id}"><label for="operation-target">目标星球</label><select id="operation-target" name="to">${targets.map((t) => `<option value="${t.id}" ${view.selected === t.id ? 'selected' : ''}>${esc(t.name)} · ${esc(s.aliens.find((a) => a.id === t.owner)?.name)}${reachable(s, t) ? '' : '（航程外）'}</option>`).join('')}</select><div class="operation-buttons"><button name="operation" value="spy" class="command">智子侦察</button><button name="operation" value="attack" class="primary">舰队进攻</button><button name="operation" value="singularity" class="danger-button">奇点打击</button></div></form><p class="note">进攻与奇点打击需要再次确认。舰队抵达需相应航程科技。</p>` : '<p class="note">没有已探索的外星目标。先解锁望远镜与飞船，探索其他星域。</p>'}<hr><h3>基地间调动</h3>${
          bases.length > 1
            ? `<form data-form="transfer"><input type="hidden" name="from" value="${base.id}"><label for="transfer-to">目的地</label><select id="transfer-to" name="to">${bases
                .filter((b) => b.id !== base.id)
                .map((b) => `<option value="${b.id}">${esc(b.name)}</option>`)
                .join(
                  '',
                )}</select><label for="transfer-count">调动驻军</label><input id="transfer-count" type="number" name="soldiers" min="0" max="${base.soldiers}" value="0" required><label class="checkbox"><input type="checkbox" name="weapons" checked>带上全部已完成武器</label><button class="command wide">下达调动指令</button></form>`
            : '<p class="note">需要至少两个已建成的己方军事基地。</p>'
        }</aside></div>`
  }`;
}
export function diplomacyPanel(s: GameState, view: ViewState): string {
  const known = s.aliens.filter((a) => a.discovered);
  const selected = known.find((a) => a.id === view.alien) ?? known[0];
  return `${heading('INTERSTELLAR DIPLOMACY', '另一种文明，另一种可能', '战争并非唯一的道路。理解问题背后的宇宙社会学理论，让一次谈判改变两个世界的关系。')}<div class="alliance-progress"><span>亲密同盟</span><strong>${s.aliens.filter((a) => a.relation === 4).length}<small> / 11</small></strong>${meter(s.aliens.filter((a) => a.relation === 4).length, 11, '同盟数量')}</div>${
    !selected
      ? empty(
          '星空尚未回答',
          '危机纪元第 2 年将收到第一份外星通讯。研究望远镜与飞船，还可以主动探索其他文明。',
        )
      : `<div class="diplomacy-layout"><nav class="alien-list" aria-label="已知文明">${known.map((a) => `<button class="${selected.id === a.id ? 'active' : ''}" data-action="alien:${a.id}">${icon('signal')}<span>${esc(a.name)}<small>${s.stars.some((t) => t.exists && t.owner === a.id) ? RELATIONS[a.relation] : '文明已消亡'}</small></span></button>`).join('')}</nav><article class="alien-detail"><div class="alien-emblem">${icon('orbit')}</div><div class="eyebrow">${esc(selected.title)} / ${LEVELS[selected.level]}文明</div><h2>${esc(selected.name)}</h2><p class="alien-lore">${esc(selected.description)}</p><div class="relation-track">${RELATIONS.map((r, i) => `<span class="${i <= selected.relation ? 'lit' : ''}"><i></i>${r}</span>`).join('')}</div><form data-form="diplomacy" class="envoy-form"><input name="alien" type="hidden" value="${selected.id}"><label for="envoy">派遣使者 <small>精神 = 统率 × 40% + 社会 × 60%</small></label><select id="envoy" name="person">${s.people
          .filter((p) => p.discovered)
          .sort(
            (a, b) => b.leadership * 0.4 + b.social * 0.6 - (a.leadership * 0.4 + a.social * 0.6),
          )
          .map(
            (p) =>
              `<option value="${esc(p.id)}">${esc(p.id)} · 精神 ${Math.floor(p.leadership * 0.4 + p.social * 0.6)}</option>`,
          )
          .join(
            '',
          )}</select><button class="primary wide" ${!hasTech(s, '宇宙社会学公理') || selected.lastDiplomacy === s.year || selected.relation === 4 || !s.stars.some((t) => t.exists && t.owner === selected.id) ? 'disabled' : ''}>开启和平谈判 ${icon('arrow')}</button><p class="note">${!hasTech(s, '宇宙社会学公理') ? '需要风暴文明（文化 200）并研究「宇宙社会学公理」。' : selected.relation === 4 ? '已经结为亲密同盟。' : selected.lastDiplomacy === s.year ? '本年度已谈判，下一年可以再次派遣使者。' : '每年可与每个文明谈判一次。说服值达到 100，关系提升一级。'}</p></form>${button('向这个文明宣战', `war:${selected.id}`, 'text-button danger-text')}</article></div>`
  }`;
}
export function historyPanel(s: GameState): string {
  return `${heading('CHRONICLES OF EARTH', '那些年，我们仰望星空', `危机纪元 ${s.year} 年 · 执政官 ${s.player} · 宇宙种子 ${s.seed}`)}<ol class="chronicle">${[
    ...s.history,
  ]
    .reverse()
    .map(
      (h) =>
        `<li><time><strong>${String(h.year).padStart(3, '0')}</strong>危机纪元</time><div><span class="eyebrow">${{ info: 'CIVILIZATION', science: 'BREAKTHROUGH', discovery: 'DISCOVERY', war: 'EARTH SPACE FORCE', diplomacy: 'DIPLOMATIC RECORD', warning: 'ALERT' }[h.kind]}</span><p>${esc(h.text)}</p></div></li>`,
    )
    .join('')}</ol>`;
}
export function guidePanel(): string {
  return `${heading('THE CIVILIZATION ARCHIVE', '群星之间的生存手册', '一部关于科学、战争、思想与文明的策略游戏。原作机制与文本，现代实时宇宙。')}<div class="guide-prose"><h2>01 / 从地球出发</h2><p>每次「结束年度」推进一年。研究、经济、文化、建设与外星活动依次结算。开局先在科研中启动「10%光速飞船」以解锁小型战舰，发展页面分配人员；在舰队页面生产战舰、部署驻军。<strong>第 17 年吞食帝国将进攻地球。</strong>训练提升战力，章北海可担任指挥官。不要把所有经济耗在研究上。</p><h2>02 / 文明的五个阶梯</h2><p>文化达到 70 / 200 / 500 / 1000，文明依次进入起源、风暴、逐鹿、霸王。每升一级战力 +20。核技术与天体物理在起源开放；质子与宇宙社会学在风暴开放。逃亡主义每年增长 0–2，降低生产与科研效率；每年教育花费 10 经济，降低 5–9 点逃亡。</p><h2>03 / 经济与殖民</h2><p>矿场消耗本星有限矿藏，工厂消耗 2 资源产生 1 经济；质能转换免除资源消耗。新城市在容量允许时增长人口。矿场、军事基地、工厂、城市分别需要 100 / 100 / 200 / 400 工作量，均花费 20 经济。每种设施每星最多一个。建造首个设施即宣示主权。</p><p>望远镜开放星域，飞船允许抵达。太阳电波放大技术可以在对应可见星域远程识别天体归属，并在年度结算时发现文明信号，无需登陆。实地探索也能直接识别归属，智子则提供详细军情。每年最多探索 3 颗新天体。恒星只能建设矿场。</p><h2>04 / 战斗不是点击数字</h2><p>驻军与完成的舰船构成作战单位。双方按先手降序交锋，同先手按单位编号排序；默认随机选择存活目标，也可以手动指定。攻击产生 85%–115% 的波动。消耗武器对敌方全部作战单位造成标称伤害并消失。单独的炸弹无法守住阵地。士气、收买、恐吓每场各一次，使用后敌军仍会行动；撤退只能用于进攻战。</p><p>进攻胜利获得星球与设施，但不会凭空得到人口；守土失败丢失该星球。驻军伤亡扣除文明人口。智子用于一次性侦察，奇点炸弹永久移除敌方星球。盟友必须先宣战才能攻击。</p><h2>05 / 在黑暗森林中交流</h2><p>说服从 50 开始，达到 100 关系提高一级，降至 0 关系降低一级。五种理论依次消耗精神 20 / 26 / 32 / 35 / 40，答对提升 10 / 14 / 17 / 20 / 25；答错下降该值的三分之二（向下取整）。精神每秒恢复 2，也可暂时让步换取 25 精神。默认不计时；设置中可开启原作式 10 秒应答。切到其他标签页会暂停谈判时间。</p><h2>06 / 胜负与节奏</h2><p>全部外星文明成为亲密同盟或失去全部领土即胜利。失去所有领土、或逃亡主义达到 100 则失败。评分 = 人口 + 文化 + 战力 − 逃亡 × 2。经典节奏保留年度速度；远征节奏把科研、文化、设施与武器建造速度乘以 3，经济、人口、敌人增长与剧情年份不加速。</p><h2>07 / 操作与存档</h2><p>1–8 切换指挥面板，N 结束年度，Esc 关闭辅助窗口，M 切换声音。星图拖动旋转、滚轮缩放；触屏可双指缩放，也可完全通过星球目录操作。每次指令后自动存档，另有三个手动槽位及 JSON 导入导出。浏览器清理站点数据会删除本机存档，请定期导出。旧版 .lsv 不兼容。减少动画、低画质与静音可以在设置中调整。WebGL 失效时星球目录仍然可玩。</p><h2>08 / 原作与重制</h2><p>原作《刘慈欣群星传》由傲雪小组 / Tormoo 制作（2008/2009），人物与世界观来自刘慈欣作品。本重制恢复 ${TECHNOLOGIES.length} 项科技、${runtime.people.length} 位人物、${runtime.aliens.length} 个文明、${runtime.weapons.length} 种武器、${runtime.events.length} 个剧情事件与 ${runtime.randomEvents.length} 个随机事件。剧情对白和数值来自提供的源码与发行版 INI，头像、星球贴图及音乐来自发行资源。没有执行或传播原目录中的 EXE、DLL、第三方安装器。</p><p>现代 HUD、人物短传、文明简介、提前提供四位顾问、保证成功的人才征召、远征节奏及其第 5/12 年事件属于重制扩展。随机星图可由种子复现；修复了原作部分边界条件、人口与资源负数问题。原作对白中的旧窗口位置指引保留为历史原文，实际操作以此手册为准。</p><p class="note">本项目不声称拥有原作文本、角色或音乐的版权，不将其重新许可为开源资源。完整来源、版权说明与机制差异见仓库 CREDITS.md。</p></div>`;
}
export function panelContent(s: GameState, view: ViewState): string {
  switch (view.panel) {
    case 'map':
      return mapPanel(s, view);
    case 'science':
      return sciencePanel(s, view);
    case 'population':
      return populationPanel(s);
    case 'people':
      return peoplePanel(s);
    case 'fleet':
      return fleetPanel(s, view);
    case 'diplomacy':
      return diplomacyPanel(s, view);
    case 'history':
      return historyPanel(s);
    case 'guide':
      return guidePanel();
  }
}
