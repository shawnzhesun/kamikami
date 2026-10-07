import React from "react";
import { Composition as RemotionComposition, registerRoot } from "remotion";
import { Composition } from "./Composition";
import { initialProject } from "./model";
registerRoot(() => (
  <RemotionComposition
    id="KamiKami"
    component={Composition}
    width={1920}
    height={1080}
    fps={24}
    durationInFrames={360}
    defaultProps={{
      project: initialProject,
      mediaOrigin: "http://127.0.0.1:4318",
    }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round(props.project.duration * props.project.fps),
      fps: props.project.fps,
      width: props.project.width,
      height: props.project.height,
    })}
  />
));
