import type { TeamTree } from '../model/types';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type Shape =
  | ({ kind: 'rect' } & Rect)
  | { kind: 'circle' | 'dot'; cx: number; cy: number; r: number };

export interface LabelPlacement {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rotate: number;
}

export type Direction = 'down' | 'right' | 'outward' | 'none';

export interface PlacedNode {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  hiddenDescendants: number;
  stacked: boolean;
  shape: Shape;
  label: LabelPlacement;
}

export interface NodeLayoutResult {
  nodes: PlacedNode[];
  bounds: Rect;
  direction: Direction;
  hasEdges: boolean;
  origin: Point | null;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';
export interface AnchorPoint extends Point { side: Side | 'center' | 'boundary' }
export interface Edge { child: PlacedNode; from: AnchorPoint; to: AnchorPoint }
export interface EdgeGroup { parent: PlacedNode; edges: Edge[] }
export interface RoutedPath { fromId: string; toId: string; d: string }

export interface Scene {
  nodes: PlacedNode[];
  edges: RoutedPath[];
  bounds: Rect;
  hasEdges: boolean;
  style: { fontSize: number; lineWidth: number; palette: readonly string[] };
}

export type OptionSpec =
  | { key: string; label: string; type: 'number'; min: number; max: number; step: number; default: number }
  | { key: string; label: string; type: 'select'; choices: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: 'boolean'; default: boolean };
export type OptionsSchema = readonly OptionSpec[];
export type Options = Record<string, unknown>;

export type Measure = (text: string, fontSize: number) => { width: number; height: number };
export interface Ctx { measure: Measure; fontSize: number }

export interface Plugin<In, Out> {
  id: string;
  name: string;
  optionsSchema: OptionsSchema;
  run(input: In, options: Options, ctx: Ctx): Out;
}

export interface AnchorInput { parent: PlacedNode; children: PlacedNode[]; direction: Direction }
export interface RouterInput { group: EdgeGroup; direction: Direction; origin: Point | null }

export type NodeLayoutPlugin = Plugin<TeamTree, NodeLayoutResult>;
export type AnchorPlugin = Plugin<AnchorInput, EdgeGroup>;
export type RouterPlugin = Plugin<RouterInput, RoutedPath[]>;
