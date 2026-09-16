import { expect } from 'vitest';
import { execute } from '../src/game/actions';
import { createGame } from '../src/game/state';
import { validateSave } from '../src/game/save';
import type { Command, GameState, Pace } from '../src/game/types';

export function game(pace: Pace = 'expedition', seed = 12345): GameState {
  const s = createGame('测试执政官', pace, seed);
  s.tutorial = 6;
  resolveEvents(s);
  return s;
}
export function act(s: GameState, cmd: Command): void {
  const result = execute(s, cmd);
  expect(result.ok, `${JSON.stringify(cmd)}: ${result.message}`).toBe(true);
}
export function resolveEvents(s: GameState): void {
  while (s.events.length && !s.battle && !s.diplomacy) {
    const event = s.events[0];
    if (event.talks) act(s, { type: 'event-next', skip: true });
    const choice = event.choices.findIndex(
      (c) => s.economy + (c.economy ?? 0) >= 0 && s.resource + (c.resource ?? 0) >= 0,
    );
    act(s, { type: 'event-choice', choice: Math.max(0, choice) });
  }
}
export function year(s: GameState): void {
  act(s, { type: 'next-year' });
  resolveEvents(s);
}
export function valid(s: GameState): void {
  expect(() => validateSave(s)).not.toThrow();
}
