import {
  createContext,
  createElement,
  useContext,
  type ComponentType
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlaywrightDriver,
  type HtmlFrameRenderer,
  type PlaywrightDriverOptions
} from "@kitsra/kavio-render";
import type { KavioDocument } from "@kitsra/kavio-schema";

export const KAVIO_REACT_PACKAGE = "@kitsra/kavio-react";

export interface ReactVideoConfig {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  composition: KavioDocument;
}

interface ReactFrameContextValue extends ReactVideoConfig {
  frame: number;
}

const ReactFrameContext = createContext<ReactFrameContextValue | null>(null);

export function useCurrentFrame(): number {
  return useReactFrameContext().frame;
}

export function useVideoConfig(): ReactVideoConfig {
  const { frame: _frame, ...config } = useReactFrameContext();
  return config;
}

export interface CreateReactFrameRendererOptions<Props extends object> {
  component: ComponentType<Props>;
  props: Props;
}

export function createReactFrameRenderer<Props extends object>(
  options: CreateReactFrameRendererOptions<Props>
): HtmlFrameRenderer {
  return (frame, composition) => renderToStaticMarkup(
    createElement(
      ReactFrameContext.Provider,
      { value: createFrameContext(frame, composition) },
      createElement(options.component, options.props)
    )
  );
}

export interface CreateReactPlaywrightDriverOptions<Props extends object>
  extends CreateReactFrameRendererOptions<Props> {
  styles?: string;
  playwright?: Omit<PlaywrightDriverOptions, "renderHtmlFrame" | "htmlStyles">;
}

export function createReactPlaywrightDriver<Props extends object>(
  options: CreateReactPlaywrightDriverOptions<Props>
): PlaywrightDriver {
  return new PlaywrightDriver({
    ...options.playwright,
    renderHtmlFrame: createReactFrameRenderer(options),
    ...(options.styles === undefined ? {} : { htmlStyles: options.styles })
  });
}

function useReactFrameContext(): ReactFrameContextValue {
  const value = useContext(ReactFrameContext);
  if (value === null) {
    throw new Error("Kavio React frame hooks must be used inside a React frame renderer.");
  }
  return value;
}

function createFrameContext(frame: number, composition: KavioDocument): ReactFrameContextValue {
  return {
    frame,
    width: composition.composition.width,
    height: composition.composition.height,
    fps: composition.composition.fps,
    durationFrames: composition.composition.durationFrames,
    composition
  };
}

export type ReactFrameComponent<Props extends object = Record<string, never>> = ComponentType<Props>;
