import data from './timeline.json';

export const FPS = 30;
export const APP_W = 1600;
export const APP_H = 900;

export type Box = {x: number; y: number; w: number; h: number};
export type Frame = {file: string; ms: number};
export type Step = {
  caption: string;
  kind: 'click' | 'type' | 'none';
  text?: string;
  target: Box | null;
  zoom: 'target' | 'none' | Box;
  /** Frames captured during the step; ms is time since the step began. */
  frames: Frame[];
  /** When the click or typing started, in ms since the step began. */
  actionMs: number;
  /** How long the step was filmed for, in ms. */
  durationMs: number;
};
export type Chapter = {id: string; title: string; subtitle: string; steps: Step[]};
export type Timeline = {chapters: Chapter[]};

export const timeline = data as unknown as Timeline;

/** Frames for the cursor to travel to its target before the click lands. */
export const leadFrames = (step: Step) => (step.kind === 'click' ? 30 : step.kind === 'type' ? 26 : 8);
const HOLD = 24;

export const stepFrames = (step: Step) =>
  leadFrames(step) + Math.ceil(((step.durationMs - step.actionMs) / 1000) * FPS) + HOLD;

export const INTRO = 120;
export const CHAPTER_CARD = 84;
export const OUTRO = 150;

export const chapterFrames = (chapter: Chapter) =>
  CHAPTER_CARD + chapter.steps.reduce((sum, s) => sum + stepFrames(s), 0);

/** The frame of the app to show for a time within a step (video frames since the step began). */
export const frameAt = (step: Step, local: number): string => {
  const lead = leadFrames(step);
  const realMs = local < lead ? step.actionMs : step.actionMs + ((local - lead) / FPS) * 1000;
  let chosen = step.frames[0].file;
  for (const f of step.frames) {
    if (f.ms <= realMs) chosen = f.file;
    else break;
  }
  return chosen;
};

/** The area of the app the camera frames for a step, widened to 16:9. */
export const zoomRect = (step: Step): Box => {
  let r: Box;
  if (step.zoom === 'none') return {x: 0, y: 0, w: APP_W, h: APP_H};
  if (step.zoom === 'target') {
    if (!step.target) return {x: 0, y: 0, w: APP_W, h: APP_H};
    const t = step.target;
    const w = Math.max(760, t.w + 420);
    r = {x: t.x + t.w / 2 - w / 2, y: t.y + t.h / 2 - (w * 9) / 32, w, h: (w * 9) / 16};
  } else {
    r = step.zoom;
  }
  // Widen the shorter side so the area matches the 16:9 frame, then keep it inside the app.
  const aspect = APP_W / APP_H;
  if (r.w / r.h > aspect) {
    const h = r.w / aspect;
    r = {x: r.x, y: r.y - (h - r.h) / 2, w: r.w, h};
  } else {
    const w = r.h * aspect;
    r = {x: r.x - (w - r.w) / 2, y: r.y, w, h: r.h};
  }
  r.w = Math.min(r.w, APP_W);
  r.h = Math.min(r.h, APP_H);
  r.x = Math.min(Math.max(r.x, 0), APP_W - r.w);
  r.y = Math.min(Math.max(r.y, 0), APP_H - r.h);
  return r;
};
