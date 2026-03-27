export interface FeatureTreeNode {
  name: string;
  description: string;
  children?: FeatureTreeNode[];
  path?: string;
  icon?: string;
}
