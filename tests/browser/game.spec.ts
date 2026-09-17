import { expect, test, type Page } from '@playwright/test';
import { createGame, upgrade } from '../../src/game/state';
import { execute } from '../../src/game/actions';
import { startBattle } from '../../src/game/combat';
import { encodeSave } from '../../src/game/save';
import { TECHNOLOGIES } from '../../src/content/world';
import type { GameState } from '../../src/game/types';

async function seedGame(page: Page, s: GameState) {
  await page.addInitScript((raw) => {
    localStorage.setItem('legendofuni:v1:auto', raw);
    localStorage.setItem(
      'legendofuni:v1:settings',
      JSON.stringify({ quality: 'low', sound: false, reducedMotion: true }),
    );
  }, encodeSave(s));
  await page.goto('/');
  await page.getByRole('button', { name: '继续文明', exact: true }).click();
}
function fixture(): GameState {
  const s = createGame('测试执政官', 'expedition', 12345);
  execute(s, { type: 'event-next', skip: true });
  execute(s, { type: 'event-choice', choice: 0 });
  s.tutorial = 6;
  return s;
}
async function choosePanel(page: Page, name: string) {
  await page.locator(`.command-nav [data-action="panel:${name}"]`).click();
}
async function readSave(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('legendofuni:v1:auto')!).game);
}
async function settleDialogue(page: Page) {
  while (await page.locator('.story-overlay').count()) {
    const skip = page.getByRole('button', { name: '跳至最后一段' });
    if (await skip.count()) await skip.click();
    await page.locator('.story-choice').first().click();
  }
}

test('new civilization, research, annual progression and reload', async ({ page }) => {
  // This full journey initializes high-quality WebGL twice on CI's software GPU.
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '开启危机纪元' }).click();
  await page.getByLabel('执政官姓名', { exact: true }).fill('远航者');
  await page.locator('#world-seed').fill('12345');
  await page.getByRole('button', { name: /就任地球执政官/ }).click();
  await expect(page.locator('#story-title')).toHaveText('执政官的使命');
  await settleDialogue(page);
  await page.getByRole('button', { name: '跳过指引' }).click();
  await expect(page.locator('.planet-title h2')).toHaveText('地球');
  await choosePanel(page, 'science');
  await page
    .locator('.tech-node')
    .filter({ has: page.getByRole('heading', { name: '10%光速飞船', exact: true }) })
    .getByRole('button', { name: '启动研究' })
    .click();
  await expect(page.locator('.active-project h3')).toHaveText('10%光速飞船');
  await page.getByRole('button', { name: '结束年度', exact: true }).click();
  await settleDialogue(page);
  await page.getByRole('button', { name: '结束年度', exact: true }).click();
  await settleDialogue(page);
  expect((await readSave(page)).finished).toContain('10%光速飞船');
  await page.reload();
  await page.getByRole('button', { name: '继续文明', exact: true }).click();
  expect((await readSave(page)).player).toBe('远航者');
  expect((await readSave(page)).year).toBe(3);
  await choosePanel(page, 'fleet');
  await expect(page.getByRole('heading', { name: '地球驻军' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('population, construction, personnel and manual saves', async ({ page }) => {
  const s = fixture();
  s.finished = ['行星开发Ⅰ'];
  s.stars[0].population = 80;
  await seedGame(page, s);
  await choosePanel(page, 'population');
  await page.locator('#worker-industry').fill('20');
  await page
    .locator('form[data-form="workers"]')
    .filter({ has: page.locator('#worker-industry') })
    .getByRole('button')
    .click();
  expect((await readSave(page)).workers.industry).toBe(20);
  await choosePanel(page, 'map');
  await page.getByRole('button', { name: '星球目录', exact: true }).click();
  await page.locator('.star-directory [data-action="select:4"]').click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page
    .locator('.building-item')
    .filter({ hasText: '采矿工厂' })
    .getByRole('button', { name: '建造' })
    .click();
  expect((await readSave(page)).stars[4].owner).toBe('earth');
  await choosePanel(page, 'people');
  await page.getByRole('button', { name: /公开征召/ }).click();
  expect((await readSave(page)).people.filter((p) => p.discovered)).toHaveLength(5);
  await page.locator('.nav-bottom [data-action="modal:saves"]').click();
  await page.locator('[data-action="save:1"]').click();
  await expect(page.locator('.save-slot').nth(1)).toContainText('测试执政官');
  await page.getByRole('button', { name: '关闭窗口' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('tactical selection and offensive victory', async ({ page }) => {
  const s = fixture();
  s.stars[0].weapons.push({ uid: s.nextUid++, def: '小型战舰', hp: 100, progress: 100 });
  const target = s.stars[s.aliens[0].home];
  target.soldiers = 1;
  target.discovered = true;
  startBattle(s, 0, target.id);
  await seedGame(page, s);
  await expect(page.locator('.battle-heading h1')).toContainText('进攻战');
  await page.locator('[data-target-unit]').selectOption(String(-target.id - 1));
  await page.locator('[data-target-unit]').selectOption('');
  expect((await readSave(page)).battle!.mine[0].target).toBeNull();
  await page.getByRole('button', { name: '全军攻击', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我们守住了未来' })).toBeVisible();
  await page.getByRole('button', { name: '完成战斗 · 返回指挥' }).click();
  expect((await readSave(page)).stars[target.id].owner).toBe('earth');
});

test('diplomatic answers update the live negotiation', async ({ page }) => {
  const s = fixture();
  s.finished = TECHNOLOGIES.filter((t) => t.branch === 'sociology').map((t) => t.id);
  s.culture = 200;
  upgrade(s);
  s.aliens[0].discovered = true;
  execute(s, { type: 'diplomacy', alien: 'alien-0', person: '罗辑' });
  await seedGame(page, s);
  await expect(page.locator('#negotiation-title')).toHaveText('让思想，越过光年');
  await page.locator(`[data-theory="${s.diplomacy!.question}"]`).click();
  expect((await readSave(page)).diplomacy!.progress).toBeGreaterThan(50);
  await page.getByRole('button', { name: '结束本次谈判' }).click();
  await page.getByRole('button', { name: '确认执行' }).click();
  await page.getByRole('button', { name: '结束通讯', exact: true }).click();
  expect((await readSave(page)).diplomacy).toBeNull();
});

test('import rejects malformed records and cannot inject HTML', async ({ page }) => {
  await seedGame(page, fixture());
  await page.locator('.nav-bottom [data-action="modal:saves"]').click();
  await page.locator('#import-save').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"OldGame"}'),
  });
  await expect(page.locator('.toast.error')).toContainText('不是');
  expect((await readSave(page)).player).toBe('测试执政官');
  const imported = fixture();
  imported.player = '<img src=x onerror=1>';
  await page.locator('#import-save').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(encodeSave(imported)),
  });
  await expect(page.locator('.modal')).toContainText(imported.player);
  await expect(page.locator('.modal img')).toHaveCount(0);
  await page.getByRole('button', { name: '取消', exact: true }).click();
});

test('WebGL fallback is playable and settings persist', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes('webgl')) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await seedGame(page, fixture());
  await expect(page.locator('#universe')).toHaveAttribute('data-renderer', '2d');
  await page.getByRole('button', { name: '星球目录', exact: true }).click();
  await page.locator('.star-directory [data-action="select:4"]').click();
  await expect(page.locator('.planet-title h2')).toHaveText('火星');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('.nav-bottom [data-action="modal:settings"]').click();
  await page.getByLabel('减少动画').check();
  await page.getByRole('button', { name: '应用设置' }).click();
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('legendofuni:v1:settings')!).reducedMotion,
    ),
  ).toBe(true);
});
