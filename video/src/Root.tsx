import React from 'react';
import {Composition, Folder} from 'remotion';
import {Explainer, explainerFrames, ExplainerProps} from './Explainer';
import {FPS, timeline} from './timeline';

const all = timeline.chapters.map((c) => c.id);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NetTools-Full"
      component={Explainer}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={explainerFrames({chapters: all, intro: true})}
      defaultProps={{chapters: all, intro: true} satisfies ExplainerProps}
    />
    <Folder name="Chapters">
      {timeline.chapters.map((c) => (
        <Composition
          key={c.id}
          id={`NetTools-${c.id}`}
          component={Explainer}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={explainerFrames({chapters: [c.id], intro: false})}
          defaultProps={{chapters: [c.id], intro: false} satisfies ExplainerProps}
        />
      ))}
    </Folder>
  </>
);
