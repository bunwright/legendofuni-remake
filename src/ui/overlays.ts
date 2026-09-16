import {
  LEVELS,
  PERSUASION,
  RELATIONS,
  SPIRIT_COST,
  THEORIES,
  asset,
  portrait,
  runtime,
} from '../content/world';
import { questionText } from '../game/diplomacy';
import { honor, population, score } from '../game/state';
import { loadSlot } from '../game/save';
import type { BattleUnit, GameState, Settings } from '../game/types';
import { button, command, esc, icon, meter, number, signed } from './html';

export function menu(hasSave: boolean, inProgress: boolean): string {
  return `<section class="main-menu"><div class="menu-top"><span>${icon('orbit')} A CIVILIZATION AMONG THE STARS</span><span>原作 · 傲雪小组 / TORMOO</span></div><div class="menu-copy"><div class="eyebrow">刘慈欣群星传 · 现代重制</div><h1><span>群星</span><span>传<span class="title-seal">危机纪元</span></span></h1><div class="title-english">LEGEND OF UNI</div><p class="menu-quote">宇宙很大，生活更大。<br><span>从一颗蓝色星球，写下文明的下一页。</span></p><nav class="menu-actions" aria-label="主菜单">${inProgress ? button('返回当前文明', 'resume', 'menu-primary', 'arrow') : hasSave ? button('继续文明', 'continue', 'menu-primary', 'arrow') : button('开启危机纪元', 'modal:new', 'menu-primary', 'arrow')}${inProgress || hasSave ? button('新的文明', 'modal:new', 'menu-secondary') : ''}${button('读取记录', 'modal:saves', 'menu-secondary')}${button('观测设置', 'modal:settings', 'menu-secondary')}${button('关于这片星空', 'modal:credits', 'menu-secondary')}</nav></div><div class="menu-coordinate"><span class="live-dot"></span> SOL / EARTH<small>第三行星 · 人类文明</small><div>30° 00′ N &nbsp; 120° 00′ E</div></div><footer class="menu-footer"><span>实时三维宇宙 · 七条科技谱系 · 十一个异星文明</span><span>2008 → 2026 <b>REIMAGINED</b></span></footer></section>`;
}
export function newGameForm(): string {
  return `<div class="eyebrow">A NEW CIVILIZATION</div><h2 id="modal-title">你的第一道指令</h2><p>65 人口单位，100 经济，100 资源。前方是一片还未回答的星空。</p><form data-form="new"><label for="player-name">执政官姓名</label><input id="player-name" name="player" maxlength="24" value="执政官" required autocomplete="off"><fieldset class="pace-options"><legend>时间的步伐</legend><label><input type="radio" name="pace" value="expedition" checked><span><strong>远征节奏</strong><small>推荐 · 科研、文化与建造 ×3。保留全部剧情。</small></span></label><label><input type="radio" name="pace" value="classic"><span><strong>经典节奏</strong><small>原作年度速度，适合长线经营。</small></span></label></fieldset><label for="world-seed">宇宙种子 <small>留空生成新星图；相同种子可重现宇宙</small></label><input id="world-seed" name="seed" type="number" min="0" max="4294967295" step="1" placeholder="随机星图"><p class="note">开始新文明会覆盖自动存档。已有进度请先手动保存或导出。</p><button class="primary wide">就任地球执政官 ${icon('arrow')}</button></form>`;
}
export function settingsForm(settings: Settings): string {
  return `<div class="eyebrow">OBSERVATORY SETTINGS</div><h2 id="modal-title">让星空适合你</h2><form data-form="settings"><label class="setting-toggle"><span><strong>原作音乐与音效</strong><small>首次点击启用声音后播放，不会自动打扰。</small></span><input type="checkbox" name="sound" ${settings.sound ? 'checked' : ''}></label><label for="volume">音量 <span>${Math.round(settings.volume * 100)}%</span></label><input id="volume" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" name="volume"><label for="quality">渲染质量</label><select id="quality" name="quality"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>高 · 辉光后处理与高像素密度</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>低 · 关闭后处理，降低 GPU 消耗</option></select><label class="setting-toggle"><span><strong>减少动画</strong><small>立即切换镜头，停止自转与战斗火线。</small></span><input type="checkbox" name="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></label><label class="setting-toggle"><span><strong>外交应答计时</strong><small>开启原作式 10 秒时限；默认关闭。后台暂停。</small></span><input type="checkbox" name="timedDiplomacy" ${settings.timedDiplomacy ? 'checked' : ''}></label><button class="primary wide">应用设置</button></form>${button('返回主菜单', 'menu', 'text-button wide')}`;
}
export function savesPanel(current: boolean): string {
  return `<div class="eyebrow">CIVILIZATION RECORDS</div><h2 id="modal-title">把这一刻，交给未来</h2><p>记录只保存在当前浏览器。建议导出一份备份。</p><div class="save-slots">${(
    ['auto', '1', '2', '3'] as const
  )
    .map((slot) => {
      let state: GameState | null = null,
        error = '';
      try {
        state = loadSlot(slot);
      } catch (e) {
        error = e instanceof Error ? e.message : '无法读取';
      }
      return `<div class="save-slot"><div><span class="eyebrow">${slot === 'auto' ? 'AUTO SAVE' : `RECORD 0${slot}`}</span><h3>${state ? esc(state.player) : error ? '存档损坏' : '空白记录'}</h3><small>${state ? `危机纪元 ${state.year} 年 · ${LEVELS[state.level]} · ${state.pace === 'classic' ? '经典' : '远征'}` : esc(error || '尚未保存文明')}</small></div><div>${state ? button('读取', `load:${slot}`, 'small-button') : ''}${slot !== 'auto' && current ? button('保存', `save:${slot}`, 'small-button') : ''}</div></div>`;
    })
    .join(
      '',
    )}</div><div class="toolbar">${current ? button('导出 JSON', 'export', 'command', 'save') : ''}<label class="command file-label">${icon('book')}导入 JSON<input type="file" id="import-save" accept=".json,application/json" aria-label="导入 JSON 存档"></label></div><p class="note">不支持原版 .lsv。导入经过结构和状态一致性校验；失败时不会覆盖当前进度。</p>`;
}
export function credits(): string {
  return `<div class="eyebrow">ACROSS GENERATIONS</div><h2 id="modal-title">同一片星空，新的航程</h2><p>《刘慈欣群星传》原作：傲雪小组 / Tormoo，2008–2009。世界观、人物和相关文学内容来自刘慈欣作品。</p><p>本重制以 Three.js、TypeScript 和 Web Audio 重建实时宇宙与游戏交互。51 项科技、28 位人物、11 个文明及完整发行版事件数据得到恢复。原作头像、星球纹理和音乐直接用于新的场景。</p><p>重制新增的人物简介、现代指引及远征事件均与原始对白分开标注。不执行或分发原目录中的程序、DLL 与捆绑安装器。</p><p class="note">原作内容的权利归相应权利人所有，本项目不对其重新授权。源码、机制差异与资源来源见项目仓库。</p><a class="command" href="https://github.com/bunwright/legendofuni-remake" target="_blank" rel="noopener noreferrer">查看项目与来源 ${icon('arrow')}</a>`;
}
export function storyOverlay(s: GameState): string {
  const event = s.events[0],
    page = event.page ?? 0,
    talk = event.talks?.[page];
  const last = !event.talks || page >= event.talks.length - 1;
  const sourcePortrait = talk && (runtime.portraits as Record<string, string>)[talk.portrait];
  return `<section class="story-overlay" role="dialog" aria-modal="true" aria-labelledby="story-title"><div class="story-stardate"><span>危机纪元</span><strong>${String(s.year).padStart(3, '0')}</strong><small>${event.source === 'legacy' ? '原作剧情 · 原文保留' : '重制扩展剧情'}</small></div><div class="story-transmission"><header><div class="eyebrow">INCOMING TRANSMISSION / ${page + 1} OF ${event.talks?.length ?? 1}</div><h1 id="story-title">${esc(event.title)}</h1></header><div class="dialogue"><div class="speaker"><img src="${sourcePortrait ? asset(sourcePortrait) : portrait(talk?.speaker ?? event.speaker)}" width="72" height="72" alt="${esc(talk?.speaker ?? event.speaker)}头像"><span>${esc(talk?.speaker ?? event.speaker)}</span><small>通信链路已建立</small></div><div class="dialogue-text">${esc(talk?.text ?? event.text).replace(/\n/g, '<br>')}</div></div>${event.id === 'legacy-1' ? '<p class="historical-note">历史原文中的窗口位置指原版 MFC 界面。重制版操作请见之后的指挥指引。</p>' : ''}<div class="story-controls">${!last ? `${command('跳至最后一段', { type: 'event-next', skip: true }, { class: 'text-button' })}${command('继续通讯', { type: 'event-next' }, { class: 'primary', icon: 'arrow' })}` : event.choices.map((choice, i) => `<button class="story-choice" data-command="${esc(JSON.stringify({ type: 'event-choice', choice: i }))}" ${event.source !== 'legacy' && (s.economy + (choice.economy ?? 0) < 0 || s.resource + (choice.resource ?? 0) < 0) ? 'disabled' : ''}><strong>${esc(choice.label)} ${icon('arrow')}</strong><small>${esc(choice.description)}</small></button>`).join('')}</div></div></section>`;
}
export function tutorialOverlay(s: GameState): string {
  const steps = [
    [
      '你的文明，不是一个控制面板',
      '星图里的每一颗天体都可以选择。拖拽旋转视角，滚轮缩放；触屏和键盘也可通过星球目录完成操作。',
    ],
    [
      '先让实验室运转',
      '打开「科研」，选择航天技术，启动「10%光速飞船」，完成后即可生产小型战舰。研究与建设需要结束年度后才推进。丁仪已经在航天研究所等待。',
    ],
    [
      '人口是共享的力量',
      '「发展」中可将人口分配到矿场、工业、文化与研究所。每年新增的人口会待命。驻军也占用这个人口池。',
    ],
    [
      '第十七年，敌人将抵达',
      '保留经济生产战舰，在「舰队」部署地球驻军，并适度训练。守土战无法撤退。章北海已被任命为地球指挥官。',
    ],
    [
      '不止有战争这一条路',
      '文化 200 解锁宇宙社会学。研究相关理论后，可以用谈判改善关系。探索新的星域需要望远镜与飞船两种科技。',
    ],
    [
      '现在，写下自己的文明史',
      'N 结束年度，1–8 切换面板。指令后自动存档；「存档」中可导出 JSON。百科完整记录所有规则，随时可以回来查阅。',
    ],
  ];
  const [title, text] = steps[Math.min(s.tutorial, 5)];
  return `<div class="modal-backdrop tutorial-backdrop"><section class="modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div class="eyebrow">COMMANDER ORIENTATION / ${s.tutorial + 1} OF 6</div><div class="tutorial-orbit">${icon('orbit')}</div><h2 id="tutorial-title">${title}</h2><p>${text}</p><div class="tutorial-dots">${steps.map((_, i) => `<i class="${i === s.tutorial ? 'active' : ''}"></i>`).join('')}</div><div class="spread">${command('跳过指引', { type: 'tutorial', step: 6 }, { class: 'text-button' })}${command(s.tutorial === 5 ? '进入指挥中心' : '下一步', { type: 'tutorial', step: s.tutorial + 1 }, { class: 'primary', icon: 'arrow' })}</div></section></div>`;
}
export function annualReport(s: GameState): string {
  const r = s.report!;
  return `<aside class="annual-report" aria-label="年度结算"><div class="spread"><span class="eyebrow">YEAR ${r.year} / ANNUAL REPORT</span>${command('关闭年度报告', { type: 'dismiss-report' }, { class: 'icon-button', icon: 'close' })}</div><h2>又一年，星光抵达</h2><div class="report-deltas">${(['economy', 'resource', 'culture', 'population', 'unrest'] as const).map((key, i) => `<div><small>${['经济', '资源', '文化', '人口', '逃亡'][i]}</small><strong>${signed(r[key])}</strong></div>`).join('')}</div>${
    r.messages.length
      ? `<ul>${r.messages
          .slice(-5)
          .map((text) => `<li>${esc(text)}</li>`)
          .join('')}</ul>`
      : '<p class="note">各部门按计划运转。新的年度已经开始。</p>'
  }</aside>`;
}
export function battleOverlay(s: GameState): string {
  const battle = s.battle!;
  const units = (list: BattleUnit[], friendly: boolean) =>
    list
      .map(
        (unit) =>
          `<article class="battle-unit ${unit.hp <= 0 ? 'destroyed' : ''}"><div class="spread"><strong>${esc(unit.name)}</strong><small>${unit.kind === 'bomb' ? '一次性武器' : `先手 ${unit.priority}`}</small></div>${meter(unit.hp, unit.maxHp, `${friendly ? '我方' : '敌方'}${unit.name}兵力`, friendly ? '' : 'warning')}<div class="spread"><small>兵力 ${unit.hp} / ${unit.maxHp}</small><small>攻击 ${unit.attack}</small></div>${
            friendly && unit.kind === 'unit' && unit.hp > 0 && !battle.outcome
              ? `<label>攻击目标<select data-target-unit="${unit.uid}" aria-label="${esc(unit.name)}攻击目标"><option value="">自动选择</option>${battle.enemy
                  .filter((u) => u.hp > 0 && u.kind === 'unit')
                  .map(
                    (enemy) =>
                      `<option value="${enemy.uid}" ${unit.target === enemy.uid ? 'selected' : ''}>${esc(enemy.name)} · ${enemy.hp}</option>`,
                  )
                  .join('')}</select></label>`
              : ''
          }</article>`,
      )
      .join('');
  return `<section class="battle-overlay" aria-label="战术战场"><header class="battle-heading"><div class="eyebrow">TACTICAL ENGAGEMENT / ROUND ${battle.round}</div><h1>${esc(s.stars[battle.defensive ? battle.myStar : battle.enemyStar].name)}${battle.defensive ? '保卫战' : '进攻战'}</h1><p>${battle.defensive ? '这里是我们的家园。没有撤退的航线。' : '舰队已经抵达。所有决定，都将留下痕迹。'}</p></header><aside class="battle-force mine"><div class="section-label">地球舰队 <span>EARTH</span></div>${units(battle.mine, true)}</aside><aside class="battle-force enemy"><div class="section-label">异星舰队 <span>HOSTILE</span></div>${units(battle.enemy, false)}</aside><div class="battle-log" role="log" aria-label="交战记录">${battle.log
    .slice(-5)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('')}</div><footer class="battle-controls">${
    battle.outcome
      ? `<div><span class="eyebrow">ENGAGEMENT CONCLUDED</span><h2>${battle.outcome === 'victory' ? '我们守住了未来' : battle.outcome === 'retreat' ? '为了下一次归来' : '记住这片星空'}</h2></div>${command('完成战斗 · 返回指挥', { type: 'close-battle' }, { class: 'primary', icon: 'arrow' })}`
      : `${command('全军攻击', { type: 'battle-act', action: 'attack' }, { class: 'primary', icon: 'shield' })}${battle.mine
          .filter((u) => u.kind === 'bomb' && u.hp > 0)
          .map((u) =>
            command(
              `投放 ${u.name}`,
              { type: 'battle-act', action: 'bomb', weapon: u.uid },
              { class: 'danger-button' },
            ),
          )
          .join(
            '',
          )}${(['morale', 'bribe', 'intimidate'] as const).map((action, i) => command(['鼓舞士气', '收买 · 30 经济', '恐吓敌军'][i], { type: 'battle-act', action }, { class: 'command', disabled: battle.usedSkills.includes(action) ? '本场已使用' : !s.stars[battle.myStar].commander ? '需要指挥官' : null })).join('')}${!battle.defensive ? button('撤退', 'retreat', 'text-button') : '<span class="note">守土战 · 不可撤退</span>'}`
  }</footer></section>`;
}
export function negotiationOverlay(s: GameState, settings: Settings): string {
  const d = s.diplomacy!,
    alien = s.aliens.find((a) => a.id === d.alien)!;
  return `<section class="negotiation-overlay" role="dialog" aria-modal="true" aria-labelledby="negotiation-title"><header><div class="eyebrow">DIPLOMATIC CHANNEL / ${esc(alien.name)}</div><h1 id="negotiation-title">让思想，越过光年</h1><p>地球使者 ${esc(d.person)} · 当前关系 ${RELATIONS[alien.relation]}</p></header><div class="negotiation-content"><div class="negotiation-orbit">${icon('signal')}</div><div class="negotiation-meters"><div><span>说服进度 <strong id="dip-progress">${d.progress} / 100</strong></span><div id="dip-progress-meter">${meter(d.progress, 100, '说服进度')}</div></div><div><span>精神储备 <strong id="dip-spirit">${d.spirit} / ${d.maxSpirit}</strong></span><div id="dip-spirit-meter">${meter(d.spirit, d.maxSpirit, '精神储备')}</div></div></div><div class="question"><div class="eyebrow">${d.outcome ? 'TRANSMISSION COMPLETE' : `对方的第 ${d.rounds} 个问题`}</div><blockquote id="dip-question">${esc(d.outcome ? (d.outcome === 'victory' ? '我们愿意重新理解你们的文明。' : '这次通讯，到此为止吧。') : questionText(s))}</blockquote><span class="dip-timer" id="dip-timer">${d.outcome ? '' : settings.timedDiplomacy ? `${d.seconds} 秒` : '不计时 · 精神每秒恢复 2'}</span></div>${d.outcome ? `<h2>${d.outcome === 'victory' ? '理解，成为新的桥梁' : '沉默，重新笼罩星空'}</h2>${command('结束通讯', { type: 'close-diplomacy' }, { class: 'primary', icon: 'arrow' })}` : `<div class="theory-answers">${THEORIES.map((theory, i) => `<button data-theory="${i}" data-command="${esc(JSON.stringify({ type: 'dip-answer', theory: i }))}" ${!s.finished.includes(theory) || d.spirit < SPIRIT_COST[i] ? 'disabled' : ''}><span class="theory-index">0${i + 1}</span><strong>${theory}</strong><small>${!s.finished.includes(theory) ? '尚未研究' : `精神 −${SPIRIT_COST[i]} · 答对 +${PERSUASION[i]}`}</small></button>`).join('')}</div><div class="spread">${command('暂时让步 · 恢复精神', { type: 'dip-answer', theory: -1 }, { class: 'text-button' })}${button('结束本次谈判', 'leave-diplomacy', 'text-button')}</div>`}<div class="negotiation-log">${d.log
    .slice(-2)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('')}</div></div></section>`;
}
export function endingOverlay(s: GameState): string {
  const title =
    s.ending === 'victory'
      ? '星海，记住了我们的名字'
      : s.ending === 'revolt'
        ? '我们失去了共同的未来'
        : '最后一盏灯，熄灭了';
  return `<section class="ending-overlay"><div class="eyebrow">THE CHRONICLE IS COMPLETE</div><div class="ending-symbol">${icon('orbit')}</div><h1>${title}</h1><p>${s.ending === 'victory' ? '所有文明已经成为同盟，或不再构成威胁。人类的故事，仍将继续。' : s.ending === 'revolt' ? '逃亡主义达到 100。执政官的时代结束了，但下一次选择仍在等待。' : '地球文明失去了全部领土。让这段历史，成为下一次远航的星图。'}</p><div class="ending-score"><span>文明评分</span><strong>${number(score(s))}</strong><small>${s.ending === 'victory' ? `称号 · ${honor(s)}` : `坚持了 ${s.year} 年`}</small></div><p class="note">人口 ${population(s)} + 文化 ${s.culture} + 战力 ${s.army} − 逃亡 ${s.unrest} × 2</p><div class="toolbar">${button('保存这段文明史', 'export', 'command', 'save')}${button('重返星海', 'modal:new', 'primary', 'arrow')}${button('主菜单', 'menu', 'text-button')}</div></section>`;
}
