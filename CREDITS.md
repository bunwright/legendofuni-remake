# 原作、资源与重制差异

## 原作

**《刘慈欣群星传》**，傲雪小组 / Tormoo，2008–2009。

- 源码发行版本标记：2009-04-19。
- 发行包中的《作者的话》署名：Tormoo，2009-01-11，于杭州。
- 原作者历史主页：<http://www.ourshow2003.com>；原作历史页面：<http://www.ourshow2003.com/lou>。这些地址来自原始文档，不保证当前仍可访问。
- 人物、文明与科幻世界观源自**刘慈欣**作品；部分人物以现实人物为原型。

本重制使用提供的 `lengendofuni_src` 源码包和 `lou_game` 发行资源。源码包本身不带运行时媒体及 INI，后者从发行包恢复。原作者说明全文保留在 `src/content/runtime.generated.json` 的 `provenance` 字段中。

## 内容来源

| 内容                                       | 原始来源                                                          | 本项目位置                            |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------- |
| 51 项科技及前置、费用、工作量、说明        | `TecTreeManager.cpp`                                              | `src/content/legacy.generated.json`   |
| 人物、文明、武器名称                       | `PersonManager.cpp`、`AlienCiviManager.cpp`、`WeaponManager.cpp`  | 同上                                  |
| 城市人物发现文本、外交问题                 | `City.cpp`、`AlignmentDlg.cpp`                                    | 同上                                  |
| 28 位人物数值                              | `data/person.ini`                                                 | `src/content/runtime.generated.json`  |
| 23 个具名天体配置、11 个文明、10 种武器    | `data/star.ini`、`alien.ini`、`weapon.ini`                        | 同上                                  |
| 13 个剧情事件、8 个随机事件                | `data/gameevent.ini`、`randomevent.ini`                           | 同上                                  |
| 人物头像                                   | `images/*.bmp`，转为 PNG                                          | `public/assets/legacy/portrait-*.png` |
| 地球、火星、木星、土星、天王星、海王星贴图 | `images/*.jpg`                                                    | `public/assets/legacy/*.jpg`          |
| 五首背景音乐                               | `music/prelude.mp3`、`1.mp3`、`2.mp3`、`3.mp3`、`4.wma`，转为 MP3 | `public/assets/legacy/music-*.mp3`    |

输入源码及 INI 的 SHA-256 保存在两个生成文件的 `provenance.sha256` 中。导入工具分别为 `scripts/extract-legacy.py` 和 `scripts/import-runtime.py`。未包含原程序、DirectX DLL 或发行目录中的第三方安装器。

规则参考原作的年度结算、部门、行星设施、人物任命、战斗及外交实现，包括 `Game.cpp`、`EarthCivilization.cpp`、`Department.cpp`、`Stope.cpp`、`Factory.cpp`、`City.cpp`、`StarManager.cpp`、`Architecture.cpp`、`Barback.cpp`、`BattleDlg.cpp` 和 `AlignmentDlg.cpp`。这是以 TypeScript 重新实现的游戏，不是对旧可执行文件的封装。

## 保留与调整

### 保留

- 四层星域的 9 / 40 / 60 / 100 个天体规模。
- 原作科技谱系、人物属性、武器费用与生产速度、具名天体配置和文明初始参数。
- 有限矿藏、2 资源转换 1 经济、文明文化门槛 70 / 200 / 500 / 1000。
- 原作剧情年份和逐页对白、随机事件、外交五种理论及问题。
- 占领、战损、关系等级、结盟或消灭其他文明的胜利目标，以及原作评分与称号。

### 重制版调整

- Three.js 三维宇宙、现代 HUD、战术展示、键盘与触屏交互、无 WebGL 可玩回退。
- 可复现的种子随机世界，现代星图布局。并不复现旧版随机数序列。
- 开局提供丁仪、罗辑、章北海、叶文洁四位顾问及初始岗位，降低学习成本。
- 每年可支付 15 经济保证征召一人；原作城市寻访的 25% 成功率仍然保留。
- 人物短传、文明简介、新手指引、百科、年度报告及现代化提示为新写内容。
- 远征节奏将科研、文化、设施与武器生产乘以三，并加入第 5、12 年的两段新事件。经济、人口、敌方增长与原作剧情年份不加速。
- 外交计时默认关闭，可在设置中开启 10 秒应答；隐藏标签页时暂停。
- 单场战斗、明确的指令锁和二次确认，避免相互覆盖的行动；统一人口与驻军分配，防止负资源、负人口和非法调动。
- 自动存档、三个手动槽、带版本与结构校验的 JSON 导入导出。旧版 `.lsv` 不兼容。

原作对白中提到旧窗口位置、菜单名称或旧版操作方式的内容仍作为原文保留，现代界面的实际操作以游戏内百科为准。经典节奏只保留年度速度，不意味着取消上述交互及规则边界修正。

## 版权与使用范围

原作者在发行包《修改游戏》中鼓励修改数据、图片和源码，并称原作为开源游戏；随附材料中未确认到标准许可证文本。此说明不能推导为对所有文本、角色、肖像和音乐的无限再授权。

图片和音乐沿用发行包文件，未能从该包确认每项素材的最初作者、曲名或独立许可。其权利仍归各自权利人；本项目不声称拥有这些资源，也不为其附加 MIT、CC0 或其他开放许可证。仓库目前不提供覆盖全部内容的统一开源许可。再发行、商业使用或抽取素材前，应另行核实并取得必要授权。

如有署名补充或权利问题，请通过 [仓库 Issues](https://github.com/bunwright/legendofuni-remake/issues) 联系维护者。

## 技术依赖

- [Three.js](https://threejs.org/) — MIT，实时渲染、控制器与后期处理。
- [Zod](https://zod.dev/) — MIT，存档及设置校验。
- [Vite](https://vite.dev/)、[Vitest](https://vitest.dev/)、[Prettier](https://prettier.io/) — MIT，构建、测试与格式化。
- [TypeScript](https://www.typescriptlang.org/) 与 [Playwright](https://playwright.dev/) — Apache-2.0，类型检查与浏览器测试。

行星大气、星空、恒星着色、飞船几何、界面图标与交互音效在重制代码中实现；没有调用在线图像、字体或音效服务。
