import { runtime } from './world';
import type { EventChoice, StoryEvent } from '../game/types';

type RuntimeEvent = (typeof runtime.events)[number];
const TITLES: Record<string, string> = {
  '1': '执政官的使命',
  '2': '吞食帝国的使者',
  '17': '决战的时刻',
  '20': '诗云',
  '25': '不要回答',
  '50': '赡养上帝',
  '55': '上帝的告别',
  '63': '来自作者的彩蛋',
  '70': '赡养人类',
  '83': '宇宙的目的',
  '97': '一句咒语',
  '107': '猎人开枪了',
  end: '终极思想家',
};
const EFFECT_NAMES = ['', '经济', '文化', '人口', '逃亡主义'];
export function originalEvent(raw: RuntimeEvent): StoryEvent {
  const choice: EventChoice = {
    label:
      raw.name === '1'
        ? '接过文明的火炬'
        : raw.effect === 5
          ? '进入战场'
          : raw.name === 'end'
            ? '书写文明的下一页'
            : '继续我们的旅程',
    description:
      raw.effect > 0 && raw.effect < 5
        ? `原版事件效果：${EFFECT_NAMES[raw.effect]} ${raw.value >= 0 ? '+' : ''}${raw.value}`
        : '对话与剧情保留自原版发行数据。',
  };
  const key = (['', 'economy', 'culture', 'population', 'unrest'] as const)[raw.effect];
  if (key) choice[key] = raw.value;
  return {
    id: `legacy-${raw.name}`,
    title: TITLES[raw.name] ?? '地球晨报',
    speaker: raw.talks[0].speaker,
    text: raw.talks[0].text,
    source: 'legacy',
    choices: [choice],
    talks: structuredClone(raw.talks),
    page: 0,
    ...(raw.effect === 5 ? { warTarget: runtime.stars[raw.value].name } : {}),
  };
}
export function yearEvents(year: number): StoryEvent[] {
  return runtime.events.filter((e) => e.type === 0 && Number(e.name) === year).map(originalEvent);
}
export function finalEvent(): StoryEvent {
  return originalEvent(runtime.events.find((e) => e.name === 'end')!);
}
export const ORIGINAL_TITLES = TITLES;
