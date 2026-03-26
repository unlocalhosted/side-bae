export interface TourEdge {
  target: string;
  label: string;
}

export interface TourNode {
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  explanation: string;
  edges: TourEdge[];
}

export interface TrackedFile {
  path: string;
  lastCommit: string;
}

export interface TourDocument {
  version: 1;
  id: string;
  name: string;
  query: string;
  generatedAt: string;
  trackedFiles: TrackedFile[];
  entryNode: string;
  nodes: Record<string, TourNode>;
}
