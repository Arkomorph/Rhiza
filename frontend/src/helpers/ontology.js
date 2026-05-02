// ─── Opérations sur l'arbre ontologique ──────────────────────────────

// Aplatit l'arbre en chemins navigables : { "Acteur:Humain:Individu": {key, label, path, depth, parents[]}, ... }
export const flattenOntology = (tree, path = [], result = {}) => {
  for (const [key, node] of Object.entries(tree)) {
    const newPath = [...path, key];
    const pathKey = newPath.join(":");
    result[pathKey] = {
      key: node.key,
      label: node.label,
      description: node.description,
      path: newPath,
      depth: newPath.length - 1,
      parents: path,
      hasChildren: !!node.children,
    };
    if (node.children) flattenOntology(node.children, newPath, result);
  }
  return result;
};

// Cherche récursivement le chemin d'un type dans l'arbre.
export const findPathForType = (tree, type, prefix = []) => {
  for (const [key, node] of Object.entries(tree || {})) {
    const path = [...prefix, key];
    if (key === type) return path;
    if (node.children) {
      const found = findPathForType(node.children, type, path);
      if (found) return found;
    }
  }
  return prefix.length === 0 ? [type] : null;
};

// Propriétés effectives d'un nœud en remontant l'héritage.
export const getEffectiveProps = (tree, path) => {
  const result = [];
  let currentLevel = tree;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const node = currentLevel[key];
    if (!node) break;
    const isOwn = i === path.length - 1;
    const inheritedFrom = isOwn ? null : node.label;
    const inheritedFromKey = isOwn ? null : node.key;
    const inheritedDistance = path.length - 1 - i;
    if (node.props) {
      for (const prop of node.props) {
        const idx = result.findIndex(p => p.key === prop.key);
        const enriched = { ...prop, inheritedFrom, inheritedFromKey, inheritedDistance };
        if (idx >= 0) result[idx] = enriched;
        else result.push(enriched);
      }
    }
    currentLevel = node.children || {};
  }
  return result;
};

// ─── Mutations immutables ────────────────────────────────────────────

export const updateNodeAtPath = (tree, path, mutator) => {
  if (path.length === 0) return tree;
  if (path.length === 1) {
    return { ...tree, [path[0]]: mutator(tree[path[0]]) };
  }
  const [head, ...rest] = path;
  return {
    ...tree,
    [head]: {
      ...tree[head],
      children: updateNodeAtPath(tree[head].children || {}, rest, mutator),
    },
  };
};

// Props
export const treeAddProp    = (tree, path, prop)         => updateNodeAtPath(tree, path, n => ({ ...n, props: [...(n.props || []), prop] }));
export const treeUpdateProp = (tree, path, key, newProp) => updateNodeAtPath(tree, path, n => ({ ...n, props: (n.props || []).map(p => p.key === key ? newProp : p) }));
export const treeRemoveProp = (tree, path, key)          => updateNodeAtPath(tree, path, n => ({ ...n, props: (n.props || []).filter(p => p.key !== key) }));

// Sous-types
export const treeAddSubtype = (tree, parentPath, subtype) => updateNodeAtPath(tree, parentPath, n => ({
  ...n,
  children: { ...(n.children || {}), [subtype.key]: subtype },
}));

export const treeUpdateSubtype = (tree, path, partial) => updateNodeAtPath(tree, path, n => ({ ...n, ...partial }));

export const treeRenameSubtype = (tree, path, newKey, partial) => {
  if (path.length === 0) return tree;
  const parentPath = path.slice(0, -1);
  const oldKey = path[path.length - 1];
  if (newKey === oldKey) {
    return updateNodeAtPath(tree, path, n => ({ ...n, ...partial, key: newKey }));
  }
  const mutateParentChildren = (parent) => {
    const oldNode = parent.children[oldKey];
    const updated = { ...oldNode, ...partial, key: newKey };
    const newChildren = { ...parent.children };
    delete newChildren[oldKey];
    newChildren[newKey] = updated;
    return { ...parent, children: newChildren };
  };
  if (parentPath.length === 0) {
    return mutateParentChildren({ children: tree }).children;
  }
  return updateNodeAtPath(tree, parentPath, mutateParentChildren);
};

export const treeRemoveSubtype = (tree, path) => {
  if (path.length === 0) return tree;
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const mutateParent = (parent) => {
    const newChildren = { ...(parent.children || {}) };
    delete newChildren[key];
    return { ...parent, children: newChildren };
  };
  if (parentPath.length === 0) {
    const newTree = { ...tree };
    delete newTree[key];
    return newTree;
  }
  return updateNodeAtPath(tree, parentPath, mutateParent);
};

export const countDescendants = (node) => {
  if (!node || !node.children) return 0;
  let count = 0;
  for (const child of Object.values(node.children)) {
    count += 1 + countDescendants(child);
  }
  return count;
};

// ─── Attentes (expectedEdges) ────────────────────────────────────────

export const expectationSignature = (exp) =>
  `${exp.edgeKey}|${exp.direction}|${(exp.otherSide || []).join(":")}`;

export const getEffectiveExpectations = (tree, path) => {
  const result = [];
  let currentLevel = tree;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const node = currentLevel[key];
    if (!node) break;
    const isOwn = i === path.length - 1;
    const inheritedFrom = isOwn ? null : node.label;
    const inheritedFromKey = isOwn ? null : node.key;
    const inheritedDistance = path.length - 1 - i;
    if (node.expectedEdges) {
      for (const exp of node.expectedEdges) {
        const sig = expectationSignature(exp);
        const idx = result.findIndex(e => expectationSignature(e) === sig);
        const enriched = { ...exp, inheritedFrom, inheritedFromKey, inheritedDistance };
        if (idx >= 0) {
          enriched.overridesAncestor = result[idx].inheritedFrom || result[idx].label;
          result[idx] = enriched;
        } else {
          result.push(enriched);
        }
      }
    }
    currentLevel = node.children || {};
  }
  return result;
};

export const treeAddExpectation    = (tree, path, exp)        => updateNodeAtPath(tree, path, n => ({ ...n, expectedEdges: [...(n.expectedEdges || []), exp] }));
export const treeUpdateExpectation = (tree, path, sig, newExp) => updateNodeAtPath(tree, path, n => ({ ...n, expectedEdges: (n.expectedEdges || []).map(e => expectationSignature(e) === sig ? newExp : e) }));
export const treeRemoveExpectation = (tree, path, sig)        => updateNodeAtPath(tree, path, n => ({ ...n, expectedEdges: (n.expectedEdges || []).filter(e => expectationSignature(e) !== sig) }));

// Propriétés dérivées applicables à un chemin (héritage descendant)
export const getEffectiveDerivedProps = (allDerived, path) => {
  return allDerived
    .filter(dp => dp.targetPath.length <= path.length && dp.targetPath.every((seg, i) => path[i] === seg))
    .map(dp => ({
      ...dp,
      inheritedDistance: path.length - dp.targetPath.length,
      isOwn: dp.targetPath.length === path.length,
    }));
};
