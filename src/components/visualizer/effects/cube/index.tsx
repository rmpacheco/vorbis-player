import { lazy, Suspense, useMemo } from "react";
import { type TVisualProps } from "../models";

const ReactiveComponent = (props: TVisualProps) => {
  const VisualComponent = useMemo(
    () =>
      lazy(
        async () => await import(`./reactive`),
      ),
    [],
  );
  return (
    <Suspense fallback={null}>
      <VisualComponent {...props} />
    </Suspense>
  );
};

const ControlsComponent = () => {
  const ControlsComponent = useMemo(
    () =>
      lazy(
        async () => await import(`./controls`),
      ),
    [],
  );
  return (
    <Suspense fallback={null}>
      <ControlsComponent />
    </Suspense>
  );
};

export default {
  id: "cube",
  name: "Cube",
  ReactiveComponent,
  ControlsComponent,
} as const;