export interface TeamNode {
  id: string;
  name: string;
  children: TeamNode[];
  /** 1-based source line */
  line: number;
  hiddenDescendants: number;
}

export interface TeamTree {
  roots: TeamNode[];
}

export interface ParseError {
  message: string;
  /** 1-based source line */
  line: number;
}
