import type { TreeNode, ChildrenMap } from "@/types/tree";

export function getPathToRoot(
  nodeId: string,
  nodesMap: Map<string, TreeNode>
): TreeNode[] {
  const path: TreeNode[] = [];
  let currentId: string | null = nodeId;

  while (currentId !== null) {
    const node = nodesMap.get(currentId);
    if (!node) throw new Error(`Node not found: ${currentId}`);
    path.push(node);
    currentId = node.parentId;
  }

  path.reverse();
  return path;
}

export function buildChildrenMap(nodes: Map<string, TreeNode>): ChildrenMap {
  const childrenMap: ChildrenMap = new Map();

  for (const [nodeId, node] of nodes) {
    if (!childrenMap.has(nodeId)) childrenMap.set(nodeId, []);
    if (node.parentId !== null) {
      if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
      childrenMap.get(node.parentId)!.push(nodeId);
    }
  }

  return childrenMap;
}

export function findDescendants(
  nodeId: string,
  childrenMap: ChildrenMap
): string[] {
  const descendants: string[] = [];
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId) ?? [];
    for (const childId of children) {
      descendants.push(childId);
      queue.push(childId);
    }
  }

  return descendants;
}
