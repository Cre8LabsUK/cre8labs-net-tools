import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {
  APP_H, APP_W, Box, cardFrames, Chapter, chapterFrames, FPS, frameAt, INTRO, leadFrames, OUTRO, Step, stepFrames, timeline,
  VO_DELAY, voFrames, zoomRect,
} from './timeline';

const {fontFamily: display} = loadPoppins('normal', {weights: ['500', '600', '700'], subsets: ['latin']});
const {fontFamily: body} = loadInter('normal', {weights: ['400', '500', '600'], subsets: ['latin']});

// Cre8Labs palette, from the logo
const TEAL = '#14AFCB';
const PURPLE = '#7F23A6';
const MAGENTA = '#AE2BB3';
const NAVY = '#0E2744';
const GRADIENT = `linear-gradient(120deg, ${TEAL} 0%, ${PURPLE} 62%, ${MAGENTA} 100%)`;
const BACKDROP = `radial-gradient(circle at 12% 88%, rgba(20,175,203,0.32), transparent 45%),
  radial-gradient(circle at 88% 8%, rgba(174,43,179,0.30), transparent 45%),
  linear-gradient(135deg, #0E2744 0%, #104F85 52%, #3B1F6E 100%)`;

const DOWNLOAD = 'github.com/Cre8LabsUK/cre8labs-net-tools';

// The app sits in a framed window; captions sit underneath it.
const VIEW_W = 1504;
const VIEW_H = (VIEW_W * APP_H) / APP_W; // 846
const VIEW_X = (1920 - VIEW_W) / 2;
const VIEW_Y = 70;

const ease = Easing.bezier(0.33, 0, 0.2, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ------------------------------------------------------------------ sound

/** A voiceover line from voiceover.json, starting just after its scene does. */
const Voice: React.FC<{line: string}> = ({line}) => (
  <Sequence from={VO_DELAY} layout="none">
    <Audio src={staticFile(`vo/${line}.mp3`)} />
  </Sequence>
);

const Sfx: React.FC<{name: string; from: number; frames: number; volume: number; loop?: boolean}> = ({name, from, frames, volume, loop}) => (
  <Sequence from={from} durationInFrames={frames} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} loop={loop} />
  </Sequence>
);

/** Music volume: quiet under the voice, a little fuller in the gaps, faded in and out at the ends. */
const musicVolume = (frame: number, total: number, speech: [number, number][]) => {
  const ramp = 10;
  let duck = 0;
  for (const [a, b] of speech) {
    if (frame > a - ramp && frame < b + ramp) {
      duck = Math.max(duck, Math.min(1, (frame - (a - ramp)) / ramp, (b + ramp - frame) / ramp));
    }
  }
  const fade = Math.min(1, frame / 30, (total - frame) / 45);
  return Math.max(0, fade) * (0.3 - 0.17 * duck);
};

// ------------------------------------------------------------------ title cards

const Logo: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.24, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)'}}>
    <Img src={staticFile('mark.png')} style={{width: size * 0.82}} />
  </div>
);

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 200}});
  const rise = (delay: number) => spring({frame: frame - delay, fps, config: {damping: 200}});
  const out = interpolate(frame, [INTRO - 12, INTRO], [1, 0], clamp);
  return (
    <AbsoluteFill style={{background: BACKDROP, alignItems: 'center', justifyContent: 'center', opacity: out}}>
      <Sfx name="whoosh" from={0} frames={24} volume={0.5} />
      <Voice line="intro" />
      <div style={{transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop}}>
        <Logo size={150} />
      </div>
      <div style={{fontFamily: display, color: 'rgba(255,255,255,0.8)', fontSize: 34, fontWeight: 600, marginTop: 40, opacity: rise(8), transform: `translateY(${20 * (1 - rise(8))}px)`}}>
        Cre8Labs
      </div>
      <div style={{fontFamily: display, color: 'white', fontSize: 110, fontWeight: 700, lineHeight: 1.05, opacity: rise(14), transform: `translateY(${24 * (1 - rise(14))}px)`}}>
        Net Tools
      </div>
      <div style={{fontFamily: body, color: 'rgba(255,255,255,0.82)', fontSize: 34, marginTop: 22, opacity: rise(24), transform: `translateY(${20 * (1 - rise(24))}px)`}}>
        Switch IPs, serve DHCP, find cameras and monitor a site, in one app
      </div>
    </AbsoluteFill>
  );
};

const ChapterCard: React.FC<{chapter: Chapter; index: number}> = ({chapter, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const length = cardFrames(chapter);
  const inn = spring({frame, fps, config: {damping: 200}});
  const out = interpolate(frame, [length - 10, length], [1, 0], clamp);
  return (
    <AbsoluteFill style={{background: BACKDROP, alignItems: 'center', justifyContent: 'center', opacity: out}}>
      <Sfx name="whoosh" from={0} frames={24} volume={0.5} />
      <Voice line={`${chapter.id}-card`} />
      <div style={{fontFamily: display, fontSize: 30, fontWeight: 600, color: 'white', background: GRADIENT, padding: '10px 26px', borderRadius: 999, opacity: inn}}>
        Part {index + 1}
      </div>
      <div style={{fontFamily: display, color: 'white', fontSize: 92, fontWeight: 700, marginTop: 28, opacity: inn, transform: `translateY(${30 * (1 - inn)}px)`}}>
        {chapter.title}
      </div>
      <div style={{fontFamily: body, color: 'rgba(255,255,255,0.8)', fontSize: 36, marginTop: 14, opacity: spring({frame: frame - 8, fps, config: {damping: 200}})}}>
        {chapter.subtitle}
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = (delay: number) => spring({frame: frame - delay, fps, config: {damping: 200}});
  const fadeIn = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: BACKDROP, alignItems: 'center', justifyContent: 'center', opacity: fadeIn}}>
      <Sfx name="whoosh" from={0} frames={24} volume={0.5} />
      <Voice line="outro" />
      <Logo size={120} />
      <div style={{fontFamily: display, color: 'white', fontSize: 80, fontWeight: 700, marginTop: 36, opacity: rise(4)}}>Get Net Tools free</div>
      <div style={{fontFamily: body, color: 'rgba(255,255,255,0.85)', fontSize: 34, marginTop: 14, opacity: rise(10)}}>
        Windows 10 and 11. Open source. Made by Cre8Labs.
      </div>
      <div style={{fontFamily: body, fontWeight: 600, color: 'white', fontSize: 34, marginTop: 40, padding: '18px 34px', borderRadius: 18, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', opacity: rise(18)}}>
        {DOWNLOAD}
      </div>
      <div style={{fontFamily: display, color: 'rgba(255,255,255,0.75)', fontSize: 28, marginTop: 30, opacity: rise(24)}}>cre8labs.uk</div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ the app view

type Camera = {scale: number; tx: number; ty: number};

const cameraFor = (r: Box): Camera => {
  const scale = Math.min(VIEW_W / r.w, VIEW_H / r.h);
  let tx = VIEW_W / 2 - scale * (r.x + r.w / 2);
  let ty = VIEW_H / 2 - scale * (r.y + r.h / 2);
  tx = Math.min(0, Math.max(VIEW_W - scale * APP_W, tx));
  ty = Math.min(0, Math.max(VIEW_H - scale * APP_H, ty));
  return {scale, tx, ty};
};

const centre = (b: Box | null, fallback: {x: number; y: number}) => (b ? {x: b.x + b.w / 2, y: b.y + b.h / 2} : fallback);

const Cursor: React.FC<{x: number; y: number; press: number}> = ({x, y, press}) => (
  <svg width={36} height={36} viewBox="0 0 24 24" style={{position: 'absolute', left: x - 4, top: y - 2, transform: `scale(${1 - 0.15 * press})`, transformOrigin: '4px 2px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))'}}>
    <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.6 L14.6 20.3 L11.5 13.6 L17.6 13.6 Z" fill="white" stroke={NAVY} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** One step: the camera eases to its area, the cursor travels to the target, clicks, and the app responds. */
const StepScene: React.FC<{step: Step; prev: Step | null; chapterIndex: number; stepIndex: number; total: number}> = ({step, prev, chapterIndex, stepIndex, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lead = leadFrames(step);

  // Camera
  const from = cameraFor(prev ? zoomRect(prev) : {x: 0, y: 0, w: APP_W, h: APP_H});
  const to = cameraFor(zoomRect(step));
  const move = spring({frame, fps, config: {damping: 200}, durationInFrames: Math.max(18, lead)});
  const cam = {
    scale: from.scale + (to.scale - from.scale) * move,
    tx: from.tx + (to.tx - from.tx) * move,
    ty: from.ty + (to.ty - from.ty) * move,
  };

  // Cursor, in app pixels
  const start = centre(prev?.target ?? null, {x: APP_W * 0.55, y: APP_H * 0.6});
  const end = centre(step.target, start);
  const travel = interpolate(frame, [2, lead - 4], [0, 1], {...clamp, easing: ease});
  const cx = start.x + (end.x - start.x) * travel;
  const cy = start.y + (end.y - start.y) * travel;
  const clicking = step.kind !== 'none';
  const press = clicking ? interpolate(frame, [lead - 4, lead, lead + 5], [0, 1, 0], clamp) : 0;
  const ripple = clicking ? interpolate(frame, [lead, lead + 16], [0, 1], clamp) : 0;
  const highlight = clicking ? interpolate(frame, [lead - 8, lead, lead + 30, lead + 44], [0, 1, 1, 0], clamp) : 0;

  // Caption
  const capIn = spring({frame: frame - 2, fps, config: {damping: 200}});
  const capOut = interpolate(frame, [stepFrames(step) - 6, stepFrames(step)], [1, 0], clamp);

  // A whoosh when the camera moves somewhere noticeably different
  const moves = Math.abs(to.scale - from.scale) > 0.15 || Math.hypot(to.tx - from.tx, to.ty - from.ty) > 150;
  const typing = step.kind === 'type' ? Math.ceil((step.text ?? '').length * 0.11 * FPS) : 0;

  return (
    <AbsoluteFill>
      <Voice line={step.vo} />
      {moves ? <Sfx name="whoosh" from={0} frames={22} volume={0.25} /> : null}
      {step.kind === 'click' ? <Sfx name="click" from={lead - 1} frames={6} volume={0.8} /> : null}
      {typing > 0 ? <Sfx name="keys" from={lead} frames={typing} volume={0.7} loop /> : null}
      <div style={{position: 'absolute', left: VIEW_X, top: VIEW_Y, width: VIEW_W, height: VIEW_H, borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.10)', background: '#F3F5FA'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: APP_W, height: APP_H, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`}}>
          <Img src={staticFile(frameAt(step, frame))} style={{width: APP_W, height: APP_H, display: 'block'}} />
          {step.target && clicking ? (
            <div style={{position: 'absolute', left: step.target.x - 6, top: step.target.y - 6, width: step.target.w + 12, height: step.target.h + 12, borderRadius: 14, border: `3px solid ${TEAL}`, boxShadow: `0 0 0 6px rgba(20,175,203,0.18)`, opacity: highlight}} />
          ) : null}
          {clicking && ripple > 0 && ripple < 1 ? (
            <div style={{position: 'absolute', left: end.x - 40 * ripple, top: end.y - 40 * ripple, width: 80 * ripple, height: 80 * ripple, borderRadius: '50%', border: `4px solid ${TEAL}`, opacity: 1 - ripple}} />
          ) : null}
          {step.target ? <Cursor x={cx} y={cy} press={press} /> : null}
        </div>
      </div>

      {/* Caption */}
      <div style={{position: 'absolute', left: 0, right: 0, top: VIEW_Y + VIEW_H + 26, display: 'flex', justifyContent: 'center', opacity: capIn * capOut, transform: `translateY(${14 * (1 - capIn)}px)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '14px 28px 14px 16px', borderRadius: 999, background: 'rgba(14,39,68,0.78)', border: '1px solid rgba(255,255,255,0.18)'}}>
          <div style={{fontFamily: display, fontWeight: 700, fontSize: 24, color: 'white', background: GRADIENT, borderRadius: 999, minWidth: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px'}}>
            {stepIndex + 1}
          </div>
          <div style={{fontFamily: body, fontWeight: 500, fontSize: 34, color: 'white', maxWidth: 1500}}>{step.caption}</div>
        </div>
      </div>

      {/* Chapter label */}
      <div style={{position: 'absolute', left: VIEW_X, top: 22, fontFamily: display, fontWeight: 600, fontSize: 24, color: 'rgba(255,255,255,0.9)'}}>
        Part {chapterIndex + 1}: {timeline.chapters[chapterIndex].title}
        <span style={{color: 'rgba(255,255,255,0.55)', fontWeight: 500}}>{`   Step ${stepIndex + 1} of ${total}`}</span>
      </div>
      <div style={{position: 'absolute', right: VIEW_X, top: 20, display: 'flex', alignItems: 'center', gap: 10}}>
        <Img src={staticFile('mark.png')} style={{height: 30}} />
        <div style={{fontFamily: display, fontWeight: 700, fontSize: 24, color: 'white'}}>Net Tools</div>
      </div>
    </AbsoluteFill>
  );
};

const ChapterScenes: React.FC<{chapter: Chapter; index: number}> = ({chapter, index}) => {
  const {fps} = useVideoConfig();
  let at = cardFrames(chapter);
  return (
    <AbsoluteFill style={{background: BACKDROP}}>
      <Sequence durationInFrames={cardFrames(chapter)} premountFor={fps}>
        <ChapterCard chapter={chapter} index={index} />
      </Sequence>
      {chapter.steps.map((step, i) => {
        const from = at;
        at += stepFrames(step);
        return (
          <Sequence key={i} from={from} durationInFrames={stepFrames(step)} premountFor={fps}>
            <StepScene step={step} prev={i > 0 ? chapter.steps[i - 1] : null} chapterIndex={index} stepIndex={i} total={chapter.steps.length} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const Progress: React.FC<{total: number}> = ({total}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 0, bottom: 0, height: 6, width: `${(100 * frame) / total}%`, background: GRADIENT}} />
  );
};

// ------------------------------------------------------------------ compositions

export type ExplainerProps = {chapters: string[]; intro: boolean};

export const explainerFrames = ({chapters, intro}: ExplainerProps) =>
  (intro ? INTRO : 0) +
  timeline.chapters.filter((c) => chapters.includes(c.id)).reduce((sum, c) => sum + chapterFrames(c), 0) +
  OUTRO;

export const Explainer: React.FC<ExplainerProps> = ({chapters, intro}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const selected = timeline.chapters.map((c, i) => ({c, i})).filter(({c}) => chapters.includes(c.id));

  // When the voice is speaking, so the music can dip under it
  const speech: [number, number][] = [];
  const said = (start: number, line: string) => speech.push([start + VO_DELAY, start + VO_DELAY + voFrames(line)]);
  let t = 0;
  if (intro) {
    said(0, 'intro');
    t = INTRO;
  }
  for (const {c} of selected) {
    said(t, `${c.id}-card`);
    t += cardFrames(c);
    for (const s of c.steps) {
      said(t, s.vo);
      t += stepFrames(s);
    }
  }
  said(t, 'outro');

  let at = intro ? INTRO : 0;
  return (
    <AbsoluteFill style={{background: BACKDROP}}>
      <Audio src={staticFile('sfx/music.wav')} loop volume={(f) => musicVolume(f, durationInFrames, speech)} />
      {intro ? (
        <Sequence durationInFrames={INTRO} premountFor={fps}>
          <Intro />
        </Sequence>
      ) : null}
      {selected.map(({c, i}) => {
        const from = at;
        at += chapterFrames(c);
        return (
          <Sequence key={c.id} from={from} durationInFrames={chapterFrames(c)} premountFor={fps}>
            <ChapterScenes chapter={c} index={i} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={OUTRO} premountFor={fps}>
        <Outro />
      </Sequence>
      <Progress total={durationInFrames} />
    </AbsoluteFill>
  );
};
