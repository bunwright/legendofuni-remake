import './styles/game.css';
import './styles/responsive.css';
import { SECTORS, SPIRIT_COST, THEORIES } from './content/world';
import { execute } from './game/actions';
import { createGame, visibleSector } from './game/state';
import { decodeSave, encodeSave, loadSettings, loadSlot, SAVE_PREFIX, saveSlot } from './game/save';
import type { Branch, Command, GameState, Job, Pace, Person, Settings } from './game/types';
import { Universe } from './render/universe';
import { AudioDirector } from './render/audio';
import { NAV, hud, panelContent, type Panel, type ViewState } from './ui/panels';
import {
  annualReport,
  battleOverlay,
  credits,
  endingOverlay,
  menu,
  negotiationOverlay,
  newGameForm,
  savesPanel,
  settingsForm,
  storyOverlay,
  tutorialOverlay,
} from './ui/overlays';
import { button, esc, meter } from './ui/html';

const app = document.querySelector<HTMLElement>('#app')!;
const notifications = document.querySelector<HTMLElement>('#notifications')!;
let state: GameState | null = null;
let settings = loadSettings();
let inMenu = true;
let modal: 'new' | 'settings' | 'saves' | 'credits' | null = null;
let confirmation: { title: string; message: string; run: () => void } | null = null;
let saved = false;
let savingErrorShown = false;
const view: ViewState = {
  panel: 'map',
  sector: 0,
  selected: 0,
  branch: 'spaceflight',
  base: 0,
  alien: 'alien-0',
  directory: false,
};
try {
  saved = !!loadSlot('auto');
} catch {
  saved = false;
}
const audio = new AudioDirector(settings);
const universe = new Universe(
  document.querySelector('#universe')!,
  document.querySelector('#star-labels')!,
  settings,
  (id) => {
    if (
      inMenu ||
      modal ||
      confirmation ||
      state?.events.length ||
      state?.battle ||
      state?.diplomacy ||
      state?.tutorial !== 6
    )
      return;
    select(id);
  },
);
function toast(message: string, error = false): void {
  if (!message) return;
  const element = document.createElement('div');
  element.className = `toast ${error ? 'error' : ''}`;
  element.textContent = message;
  notifications.append(element);
  setTimeout(() => element.remove(), 5000);
  while (notifications.children.length > 4) notifications.firstElementChild?.remove();
}
function persist(): void {
  if (!state) return;
  try {
    saveSlot(state, 'auto');
    saved = true;
    savingErrorShown = false;
  } catch {
    if (!savingErrorShown) {
      toast('自动存档失败：浏览器存储不可用或空间不足。请使用导出 JSON 备份。', true);
      savingErrorShown = true;
    }
  }
}
function run(cmd: Command): void {
  if (!state) return;
  const result = execute(state, cmd);
  if (!result.ok) {
    toast(result.message, true);
    audio.tone('error');
    return;
  }
  if (cmd.type === 'battle-act') {
    universe.fire();
    audio.tone('fire');
  } else audio.tone('success');
  persist();
  render();
  if (
    ![
      'event-next',
      'event-choice',
      'tutorial',
      'dismiss-report',
      'dip-answer',
      'battle-target',
    ].includes(cmd.type)
  )
    toast(result.message);
}
function confirmAction(title: string, message: string, action: () => void): void {
  confirmation = { title, message, run: action };
  render();
}
function select(id: number): void {
  if (!state?.stars[id]?.exists || !visibleSector(state, state.stars[id].sector)) return;
  view.selected = id;
  view.sector = state.stars[id].sector;
  view.panel = 'map';
  render();
}
function enter(loaded: GameState): void {
  state = loaded;
  inMenu = false;
  modal = null;
  confirmation = null;
  Object.assign(view, {
    panel: 'map',
    sector: 0,
    selected: loaded.stars.find((s) => s.owner === 'earth' && s.exists)?.id ?? 0,
    base: 0,
    directory: false,
  });
  view.sector = loaded.stars[view.selected].sector;
  if (!visibleSector(loaded, view.sector)) {
    view.sector = 0;
    view.selected = 0;
  }
  persist();
  render();
}
let previousDialog = '';
function render(): void {
  const focused = document.activeElement as HTMLElement | null;
  const focusId = focused?.id;
  const focusCommand = focused?.getAttribute('data-command');
  const focusAction = focused?.getAttribute('data-action');
  const scroll = app.querySelector<HTMLElement>('.workspace')?.scrollTop ?? 0;
  const oldPanel = app.querySelector('.workspace')?.getAttribute('data-panel');
  const blocked =
    !inMenu &&
    state &&
    (state.battle || state.diplomacy || state.events.length || state.tutorial < 6 || state.ending);
  document.body.classList.toggle('menu-mode', inMenu);
  document.body.classList.toggle('overlay-open', !!(modal || confirmation || blocked));
  document.body.classList.toggle('map-mode', !inMenu && view.panel === 'map' && !blocked);
  if (inMenu || !state) {
    app.innerHTML = menu(saved, !!state);
    audio.scene('menu');
    if (app.dataset.scene !== 'menu') universe.menu();
    app.dataset.scene = 'menu';
  } else {
    app.dataset.scene = 'game';
    app.innerHTML = `<div class="game-shell" ${blocked || modal || confirmation ? 'inert' : ''}>${hud(state, view, settings.sound)}<div class="workspace ${view.panel === 'map' ? 'map-workspace' : ''}" data-panel="${view.panel}">${panelContent(state, view)}</div>${state.report && !blocked ? annualReport(state) : ''}</div>`;
    universe.sync(state, view.sector, view.selected);
    audio.scene(state.battle ? 'battle' : state.diplomacy ? 'diplomacy' : 'map');
    if (state.battle) app.insertAdjacentHTML('beforeend', battleOverlay(state));
    else if (state.diplomacy)
      app.insertAdjacentHTML('beforeend', negotiationOverlay(state, settings));
    else if (state.events.length) app.insertAdjacentHTML('beforeend', storyOverlay(state));
    else if (state.ending) app.insertAdjacentHTML('beforeend', endingOverlay(state));
    else if (state.tutorial < 6) app.insertAdjacentHTML('beforeend', tutorialOverlay(state));
  }
  if (modal || confirmation) {
    for (const child of Array.from(app.children)) (child as HTMLElement).inert = true;
    const content = confirmation
      ? `<div class="eyebrow">CONFIRM YOUR DIRECTIVE</div><h2 id="modal-title">${esc(confirmation.title)}</h2><p>${esc(confirmation.message)}</p><div class="toolbar">${button('取消', 'cancel', 'command')}${button('确认执行', 'confirm', 'primary')}</div>`
      : modal === 'new'
        ? newGameForm()
        : modal === 'settings'
          ? settingsForm(settings)
          : modal === 'saves'
            ? savesPanel(!!state)
            : credits();
    app.insertAdjacentHTML(
      'beforeend',
      `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${button('关闭窗口', confirmation ? 'cancel' : 'close', 'modal-close icon-button', 'close')}${content}</section></div>`,
    );
  }
  const workspace = app.querySelector<HTMLElement>('.workspace');
  if (workspace && oldPanel === view.panel) workspace.scrollTop = scroll;
  const dialog = [...app.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1);
  const key = confirmation
    ? 'confirm'
    : (modal ??
      (state?.battle
        ? 'battle'
        : state?.diplomacy
          ? 'diplomacy'
          : (state?.events[0]?.id ?? (state && state.tutorial < 6 && !inMenu ? 'tutorial' : ''))));
  if (dialog && key !== previousDialog)
    dialog
      .querySelector<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')
      ?.focus({ preventScroll: true });
  else {
    const candidate = focusId
      ? document.getElementById(focusId)
      : focusCommand
        ? [...app.querySelectorAll<HTMLElement>('[data-command]')].find(
            (e) => e.getAttribute('data-command') === focusCommand,
          )
        : focusAction
          ? [...app.querySelectorAll<HTMLElement>('[data-action]')].find(
              (e) => e.getAttribute('data-action') === focusAction,
            )
          : null;
    if (candidate && !candidate.closest('[inert]')) candidate.focus({ preventScroll: true });
  }
  previousDialog = key;
}
function saveSettings(next: Settings): void {
  settings = next;
  universe.applySettings(settings);
  audio.apply(settings);
  audio.gesture();
  try {
    localStorage.setItem(`${SAVE_PREFIX}settings`, JSON.stringify(settings));
  } catch {
    toast('设置无法保存，当前会话仍然生效。', true);
  }
}
function action(value: string): void {
  const [name, parameter] = value.split(':');
  if (name === 'panel') {
    view.panel = parameter as Panel;
    view.directory = false;
    render();
    return;
  }
  if (name === 'branch') {
    view.branch = parameter as Branch;
    render();
    return;
  }
  if (name === 'sector' && state) {
    const sector = Number(parameter);
    if (!visibleSector(state, sector)) {
      toast(`需要先研究「${SECTORS[sector].telescope}」。`, true);
      return;
    }
    view.sector = sector;
    view.panel = 'map';
    view.selected = state.stars.find((s) => s.sector === sector && s.exists)?.id ?? 0;
    render();
    return;
  }
  if (name === 'select') {
    select(Number(parameter));
    return;
  }
  if (name === 'focus') {
    universe.focus(Number(parameter));
    return;
  }
  if (name === 'camera') {
    universe.resetCamera();
    return;
  }
  if (name === 'directory') {
    view.directory = !view.directory;
    render();
    return;
  }
  if (name === 'base') {
    view.base = Number(parameter);
    view.panel = 'fleet';
    render();
    return;
  }
  if (name === 'target') {
    view.selected = Number(parameter);
    view.panel = 'fleet';
    render();
    return;
  }
  if (name === 'alien') {
    view.alien = parameter;
    view.panel = 'diplomacy';
    render();
    return;
  }
  if (name === 'modal') {
    modal = parameter as typeof modal;
    render();
    return;
  }
  if (name === 'close') {
    modal = null;
    render();
    return;
  }
  if (name === 'cancel') {
    confirmation = null;
    render();
    return;
  }
  if (name === 'confirm' && confirmation) {
    const callback = confirmation.run;
    confirmation = null;
    callback();
    return;
  }
  if (name === 'sound') {
    saveSettings({ ...settings, sound: !settings.sound });
    render();
    return;
  }
  if (name === 'menu') {
    modal = null;
    inMenu = true;
    persist();
    render();
    return;
  }
  if (name === 'resume') {
    inMenu = false;
    render();
    return;
  }
  if (name === 'continue' || name === 'load') {
    try {
      const loaded = loadSlot(
        name === 'continue' ? 'auto' : (parameter as 'auto' | '1' | '2' | '3'),
      );
      if (!loaded) {
        toast('这个槽位没有存档。', true);
        return;
      }
      if (state)
        confirmAction(
          '读取另一段文明史？',
          '当前进度会被替换，自动存档也将更新。未保存到手动槽的变动无法恢复。',
          () => enter(loaded),
        );
      else enter(loaded);
    } catch (error) {
      toast(error instanceof Error ? error.message : '读取失败', true);
    }
    return;
  }
  if (name === 'save' && state) {
    const save = () => {
      try {
        saveSlot(state!, parameter as '1' | '2' | '3');
        render();
        toast('文明记录已保存。');
      } catch {
        toast('保存失败，请导出 JSON 备份。', true);
      }
    };
    let exists = false;
    try {
      exists = !!localStorage.getItem(`${SAVE_PREFIX}${parameter}`);
    } catch {
      /* Save reports the storage error. */
    }
    if (exists) confirmAction('覆盖这份记录？', '此槽位的旧记录将被当前文明替换。', save);
    else save();
    return;
  }
  if (name === 'export' && state) {
    const blob = new Blob([encodeSave(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `群星传-危机纪元${state.year}-${state.seed}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('文明记录已导出。');
    return;
  }
  if (name === 'war' && state) {
    confirmAction('打破文明间的和平？', '宣战会将关系降为仇恨。必须重新谈判才能恢复同盟。', () =>
      run({ type: 'declare-war', alien: parameter }),
    );
    return;
  }
  if (name === 'retreat') {
    confirmAction('下令舰队撤退？', '已经发生的损失不会恢复。舰队返回出发基地。', () =>
      run({ type: 'battle-act', action: 'retreat' }),
    );
    return;
  }
  if (name === 'leave-diplomacy') {
    confirmAction('结束本次谈判？', '本年度的谈判机会已经使用。可以在下一年再试。', () =>
      run({ type: 'dip-leave' }),
    );
    return;
  }
}
app.addEventListener('click', (event) => {
  audio.gesture();
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-action], [data-command]',
  );
  if (!target || target.closest('[inert]') || target.hasAttribute('disabled')) return;
  if (target.dataset.command) run(JSON.parse(target.dataset.command) as Command);
  else if (target.dataset.action) {
    audio.tone('click');
    action(target.dataset.action);
  }
});
app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (!form.dataset.form) return;
  event.preventDefault();
  audio.gesture();
  const data = new FormData(form),
    text = (key: string) => String(data.get(key) ?? ''),
    count = (key: string) => Number(text(key));
  switch (form.dataset.form) {
    case 'new': {
      const start = () =>
        enter(
          createGame(
            text('player'),
            text('pace') as Pace,
            text('seed') === '' ? crypto.getRandomValues(new Uint32Array(1))[0] : count('seed'),
          ),
        );
      if (state || saved)
        confirmAction('开启新的危机纪元？', '新文明将覆盖自动存档，三个手动存档不会改变。', start);
      else start();
      break;
    }
    case 'settings':
      saveSettings({
        sound: data.has('sound'),
        volume: count('volume') / 100,
        quality: text('quality') as 'high' | 'low',
        reducedMotion: data.has('reducedMotion'),
        timedDiplomacy: data.has('timedDiplomacy'),
      });
      modal = null;
      render();
      toast('观测设置已应用。');
      break;
    case 'workers':
      run({ type: 'workers', job: text('job') as Job, count: count('count') });
      break;
    case 'assign':
      run({
        type: 'assign',
        person: text('person'),
        assignment: (text('assignment') || null) as Person['assignment'],
      });
      break;
    case 'garrison':
      run({ type: 'recruit-soldiers', star: count('star'), count: count('count') });
      break;
    case 'transfer':
      run({
        type: 'transfer',
        from: count('from'),
        to: count('to'),
        soldiers: count('soldiers'),
        weapons: data.has('weapons'),
      });
      break;
    case 'diplomacy':
      run({ type: 'diplomacy', alien: text('alien'), person: text('person') });
      break;
    case 'operation': {
      const operation = (event as SubmitEvent).submitter?.getAttribute('value') as
        'attack' | 'spy' | 'singularity';
      if (!operation) break;
      const cmd: Command = { type: operation, from: count('from'), to: count('to') };
      if (operation === 'spy') run(cmd);
      else
        confirmAction(
          operation === 'singularity' ? '永久摧毁目标星球？' : '下令舰队进攻？',
          operation === 'singularity'
            ? '奇点炸弹将消耗，星球与一切设施将永久消失，无法撤回。'
            : '战斗可能造成永久的舰船与人口损失。请确认出发基地已做好准备。',
          () => run(cmd),
        );
      break;
    }
  }
});
app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.select === 'base') {
    view.base = Number(input.value);
    render();
  }
  if (input.dataset.targetUnit)
    run({
      type: 'battle-target',
      unit: Number(input.dataset.targetUnit),
      target: input.value === '' ? null : Number(input.value),
    });
  if (input.id === 'import-save' && input.files?.[0]) {
    const file = input.files[0];
    if (file.size > 5_000_000) {
      toast('存档文件超过 5 MB 限制。', true);
      input.value = '';
      return;
    }
    try {
      const loaded = decodeSave(await file.text());
      confirmAction(
        '导入这份文明记录？',
        `危机纪元 ${loaded.year} 年 · ${loaded.player}。导入将替换当前进度与自动存档，手动槽位不变。`,
        () => enter(loaded),
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : '无法读取该文件。', true);
      input.value = '';
    }
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    const dialog = [...app.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1);
    if (dialog) {
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if (event.key === 'Escape') {
    if (confirmation) {
      confirmation = null;
      render();
    } else if (modal) {
      modal = null;
      render();
    } else if (view.directory) {
      view.directory = false;
      render();
    } else if (!inMenu && !state?.battle && !state?.diplomacy && !state?.events.length) {
      modal = 'settings';
      render();
    }
    return;
  }
  if (
    (event.target as HTMLElement).closest('input,select,textarea') ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    modal ||
    confirmation
  )
    return;
  if (event.key.toLowerCase() === 'm') {
    action('sound');
    return;
  }
  if (
    inMenu ||
    !state ||
    state.battle ||
    state.diplomacy ||
    state.events.length ||
    state.tutorial < 6 ||
    state.ending
  )
    return;
  const navigation = NAV.find((n) => n.key === event.key);
  if (navigation) {
    action(`panel:${navigation.id}`);
    return;
  }
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    run({ type: 'next-year' });
  }
});
setInterval(() => {
  if (
    !state?.diplomacy ||
    state.diplomacy.outcome ||
    inMenu ||
    modal ||
    confirmation ||
    document.hidden
  )
    return;
  const beforeQuestion = state.diplomacy.rounds;
  execute(state, { type: 'dip-tick', timed: settings.timedDiplomacy });
  const d = state.diplomacy;
  if (d.outcome || d.rounds !== beforeQuestion) {
    persist();
    render();
    return;
  }
  const spirit = document.querySelector('#dip-spirit'),
    spiritMeter = document.querySelector('#dip-spirit-meter'),
    timer = document.querySelector('#dip-timer');
  if (spirit) spirit.textContent = `${d.spirit} / ${d.maxSpirit}`;
  if (spiritMeter) spiritMeter.innerHTML = meter(d.spirit, d.maxSpirit, '精神储备');
  if (timer && settings.timedDiplomacy) timer.textContent = `${d.seconds} 秒`;
  for (const element of app.querySelectorAll<HTMLButtonElement>('[data-theory]')) {
    const i = Number(element.dataset.theory);
    element.disabled = !state.finished.includes(THEORIES[i]) || d.spirit < SPIRIT_COST[i];
  }
}, 1000);
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});
render();
