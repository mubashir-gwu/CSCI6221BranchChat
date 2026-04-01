import { describe, it, expect } from "vitest";
import {
  getPathToRoot,
  buildChildrenMap,
  findDescendants,
  validateTreeIntegrity,
} from "@/lib/tree";
import type { TreeNode } from "@/types/tree";

function makeNode(
  id: string,
  parentId: string | null,
  role: "user" | "assistant" | "system" = "user"
): TreeNode {
  return {
    id,
    parentId,
    role,
    content: `content-${id}`,
    provider: null,
    model: null,
    createdAt: new Date().toISOString(),
  };
}

// Build a linear chain: root -> a -> b -> c
function buildLinearTree(): Map<string, TreeNode> {
  const nodes = new Map<string, TreeNode>();
  nodes.set("root", makeNode("root", null));
  nodes.set("a", makeNode("a", "root"));
  nodes.set("b", makeNode("b", "a"));
  nodes.set("c", makeNode("c", "b"));
  return nodes;
}

// Build a branching tree:
//       root
//      /    \
//     a      b
//    / \
//   c   d
function buildBranchingTree(): Map<string, TreeNode> {
  const nodes = new Map<string, TreeNode>();
  nodes.set("root", makeNode("root", null));
  nodes.set("a", makeNode("a", "root"));
  nodes.set("b", makeNode("b", "root"));
  nodes.set("c", makeNode("c", "a"));
  nodes.set("d", makeNode("d", "a"));
  return nodes;
}

describe("getPathToRoot", () => {
  it("returns root-first path for a leaf node", () => {
    const nodes = buildLinearTree();
    const path = getPathToRoot("c", nodes);
    expect(path.map((n) => n.id)).toEqual(["root", "a", "b", "c"]);
  });

  it("returns [root] for root node", () => {
    const nodes = buildLinearTree();
    const path = getPathToRoot("root", nodes);
    expect(path.map((n) => n.id)).toEqual(["root"]);
  });

  it("throws for non-existent node", () => {
    const nodes = buildLinearTree();
    expect(() => getPathToRoot("missing", nodes)).toThrow(
      "Node not found: missing"
    );
  });

  it("returns correct path in a branching tree", () => {
    const nodes = buildBranchingTree();
    const path = getPathToRoot("d", nodes);
    expect(path.map((n) => n.id)).toEqual(["root", "a", "d"]);
  });
});

describe("buildChildrenMap", () => {
  it("correctly maps parent to children in linear tree", () => {
    const nodes = buildLinearTree();
    const cm = buildChildrenMap(nodes);
    expect(cm.get("root")).toEqual(["a"]);
    expect(cm.get("a")).toEqual(["b"]);
    expect(cm.get("b")).toEqual(["c"]);
    expect(cm.get("c")).toEqual([]);
  });

  it("correctly maps parent to children in branching tree", () => {
    const nodes = buildBranchingTree();
    const cm = buildChildrenMap(nodes);
    expect(cm.get("root")!.sort()).toEqual(["a", "b"]);
    expect(cm.get("a")!.sort()).toEqual(["c", "d"]);
    expect(cm.get("b")).toEqual([]);
    expect(cm.get("c")).toEqual([]);
    expect(cm.get("d")).toEqual([]);
  });

  it("returns empty children for all nodes in single-node tree", () => {
    const nodes = new Map<string, TreeNode>();
    nodes.set("root", makeNode("root", null));
    const cm = buildChildrenMap(nodes);
    expect(cm.get("root")).toEqual([]);
  });

  it("handles empty map", () => {
    const nodes = new Map<string, TreeNode>();
    const cm = buildChildrenMap(nodes);
    expect(cm.size).toBe(0);
  });
});

describe("findDescendants", () => {
  it("returns empty array for leaf nodes", () => {
    const nodes = buildLinearTree();
    const cm = buildChildrenMap(nodes);
    expect(findDescendants("c", cm)).toEqual([]);
  });

  it("returns all descendants in linear chain", () => {
    const nodes = buildLinearTree();
    const cm = buildChildrenMap(nodes);
    const desc = findDescendants("root", cm);
    expect(desc.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns all descendants in branching tree", () => {
    const nodes = buildBranchingTree();
    const cm = buildChildrenMap(nodes);
    const desc = findDescendants("root", cm);
    expect(desc.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("returns subtree descendants only", () => {
    const nodes = buildBranchingTree();
    const cm = buildChildrenMap(nodes);
    const desc = findDescendants("a", cm);
    expect(desc.sort()).toEqual(["c", "d"]);
  });

  it("does not include the node itself", () => {
    const nodes = buildBranchingTree();
    const cm = buildChildrenMap(nodes);
    const desc = findDescendants("root", cm);
    expect(desc).not.toContain("root");
  });

  it("handles node not in children map", () => {
    const cm = new Map<string, string[]>();
    expect(findDescendants("unknown", cm)).toEqual([]);
  });
});

function makeExportNode(
  id: string,
  parentId: string | null,
  childrenIds: string[] = []
) {
  return {
    id,
    parentId,
    childrenIds,
    role: "user" as const,
    content: `content-${id}`,
    provider: null,
    model: null,
    createdAt: new Date().toISOString(),
  };
}

describe("validateTreeIntegrity", () => {
  it("accepts a valid tree", () => {
    const nodes = [
      makeExportNode("root", null, ["a", "b"]),
      makeExportNode("a", "root", ["c"]),
      makeExportNode("b", "root"),
      makeExportNode("c", "a"),
    ];
    expect(() => validateTreeIntegrity(nodes)).not.toThrow();
  });

  it("accepts a single-node tree", () => {
    const nodes = [makeExportNode("root", null)];
    expect(() => validateTreeIntegrity(nodes)).not.toThrow();
  });

  it("throws for multiple roots", () => {
    const nodes = [
      makeExportNode("root1", null),
      makeExportNode("root2", null),
    ];
    expect(() => validateTreeIntegrity(nodes)).toThrow("exactly one root");
  });

  it("throws for zero roots", () => {
    const nodes = [
      makeExportNode("a", "b"),
      makeExportNode("b", "a"),
    ];
    expect(() => validateTreeIntegrity(nodes)).toThrow("exactly one root");
  });

  it("throws for orphaned parentId references", () => {
    const nodes = [
      makeExportNode("root", null),
      makeExportNode("child", "nonexistent"),
    ];
    expect(() => validateTreeIntegrity(nodes)).toThrow("non-existent parent");
  });

  it("throws for disconnected nodes", () => {
    const nodes = [
      makeExportNode("root", null),
      makeExportNode("island-a", "island-b"),
      makeExportNode("island-b", "island-a"),
    ];
    expect(() => validateTreeIntegrity(nodes)).toThrow("disconnected");
  });
});
