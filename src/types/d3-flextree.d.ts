declare module 'd3-flextree' {
  import type { HierarchyNode } from 'd3-hierarchy';

  export interface FlextreeLayout<T> {
    (root: HierarchyNode<T>): HierarchyNode<T>;
    nodeSize(): ((node: HierarchyNode<T>) => [number, number]) | [number, number];
    nodeSize(size: [number, number] | ((node: HierarchyNode<T>) => [number, number])): this;
    spacing(): number | ((a: HierarchyNode<T>, b: HierarchyNode<T>) => number);
    spacing(s: number | ((a: HierarchyNode<T>, b: HierarchyNode<T>) => number)): this;
    children(fn: (d: T) => T[] | undefined): this;
    hierarchy(data: T): HierarchyNode<T>;
  }
  export function flextree<T = unknown>(opts?: Record<string, unknown>): FlextreeLayout<T>;
}
