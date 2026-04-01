import type { TreeNode, ChildrenMap } from "@/types/tree";
import type { ExportedTree } from "@/types/export";

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

export function findDeepestLeaf(
  nodeId: string,
  childrenMap: ChildrenMap
): string {
  let current = nodeId;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const children = childrenMap.get(current) ?? [];
    if (children.length === 0) return current;
    current = children[0];
  }
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

export function validateTreeIntegrity(nodes: ExportedTree["nodes"]): void {
  // 1. Exactly one root (parentId === null)
  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1) throw new Error("Must have exactly one root node");

  // 2. All parentIds reference existing nodes
  const ids = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) {
      throw new Error(
        `Node ${node.id} references non-existent parent ${node.parentId}`
      );
    }
  }

  // 3. All nodes reachable from root via BFS
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!childrenMap.has(node.id)) childrenMap.set(node.id, []);
    if (node.parentId !== null) {
      if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
      childrenMap.get(node.parentId)!.push(node.id);
    }
  }

  const reachable = new Set<string>();
  const queue = [roots[0].id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    reachable.add(currentId);
    for (const childId of childrenMap.get(currentId) || []) {
      queue.push(childId);
    }
  }

  if (reachable.size !== nodes.length) {
    throw new Error("Tree contains disconnected nodes");
  }
}
