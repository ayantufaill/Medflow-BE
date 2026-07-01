import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const outDir = path.join(rootDir, 'docs', 'schema-map');

const schema = fs.readFileSync(schemaPath, 'utf8');

const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g;
const models = [];
const relations = [];

let modelMatch;
while ((modelMatch = modelRegex.exec(schema)) !== null) {
  const modelName = modelMatch[1];
  const body = modelMatch[2];

  models.push(modelName);

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) {
      continue;
    }
    if (!line.includes('@relation(')) {
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }

    const fieldName = parts[0];
    const targetModel = parts[1].replace(/[?\[\]]/g, '');
    const relationArgs = line.slice(line.indexOf('@relation(') + '@relation('.length, line.lastIndexOf(')'));

    const relationNameMatch = relationArgs.match(/^"([^"]+)"/);
    const fkFieldsMatch = relationArgs.match(/fields:\s*\[([^\]]*)\]/);
    const refFieldsMatch = relationArgs.match(/references:\s*\[([^\]]*)\]/);
    const constraintMapMatch = relationArgs.match(/map:\s*"([^"]+)"/);

    const fkFields = fkFieldsMatch?.[1]
      ? fkFieldsMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const refFields = refFieldsMatch?.[1]
      ? refFieldsMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    relations.push({
      sourceModel: modelName,
      targetModel,
      relationField: fieldName,
      relationName: relationNameMatch?.[1] ?? null,
      foreignKeyFields: fkFields,
      referenceFields: refFields,
      constraintMap: constraintMapMatch?.[1] ?? null,
      raw: line,
    });
  }
}

models.sort((a, b) => a.localeCompare(b));
relations.sort((a, b) => {
  const keyA = `${a.sourceModel}.${a.relationField}.${a.targetModel}`;
  const keyB = `${b.sourceModel}.${b.relationField}.${b.targetModel}`;
  return keyA.localeCompare(keyB);
});

const uniqueNodes = new Set(models);
const uniqueEdges = new Set(relations.map((r) => `${r.sourceModel}->${r.targetModel}`));

fs.mkdirSync(outDir, { recursive: true });

const jsonOutput = {
  generatedAt: new Date().toISOString(),
  schemaPath: 'prisma/schema.prisma',
  modelCount: models.length,
  relationFieldCount: relations.length,
  uniqueDirectedEdgeCount: uniqueEdges.size,
  models,
  relations,
};

fs.writeFileSync(path.join(outDir, 'schema-relations.json'), JSON.stringify(jsonOutput, null, 2));

const dotLines = [];
dotLines.push('digraph PrismaSchemaRelations {');
dotLines.push('  rankdir=LR;');
dotLines.push('  graph [fontsize=10, fontname="Helvetica"];');
dotLines.push('  node [shape=box, style=rounded, fontsize=9, fontname="Helvetica"];');
dotLines.push('  edge [fontsize=8, fontname="Helvetica"];');
dotLines.push('');

for (const modelName of models) {
  dotLines.push(`  "${modelName}";`);
}

dotLines.push('');

for (const relation of relations) {
  const relationLabelParts = [];
  relationLabelParts.push(relation.relationField);

  if (relation.foreignKeyFields.length || relation.referenceFields.length) {
    relationLabelParts.push(
      `${relation.foreignKeyFields.join(', ') || '(none)'} -> ${relation.referenceFields.join(', ') || '(none)'}`
    );
  }

  if (relation.constraintMap) {
    relationLabelParts.push(relation.constraintMap);
  }

  const relationLabel = relationLabelParts.join('\\n').replace(/"/g, '\\"');
  dotLines.push(`  "${relation.sourceModel}" -> "${relation.targetModel}" [label="${relationLabel}"];`);
}

dotLines.push('}');
dotLines.push('');

fs.writeFileSync(path.join(outDir, 'schema-relations.dot'), dotLines.join('\n'));

const mermaidLines = [];
mermaidLines.push('flowchart LR');
for (const relation of relations) {
  const safeLabel = relation.relationField.replace(/"/g, '\\"');
  mermaidLines.push(`  ${relation.sourceModel} -->|"${safeLabel}"| ${relation.targetModel}`);
}
mermaidLines.push('');
fs.writeFileSync(path.join(outDir, 'schema-relations.mmd'), mermaidLines.join('\n'));

const csvLines = [];
csvLines.push(
  [
    'sourceModel',
    'targetModel',
    'relationField',
    'relationName',
    'foreignKeyFields',
    'referenceFields',
    'constraintMap',
  ].join(',')
);
for (const relation of relations) {
  const row = [
    relation.sourceModel,
    relation.targetModel,
    relation.relationField,
    relation.relationName ?? '',
    relation.foreignKeyFields.join('|'),
    relation.referenceFields.join('|'),
    relation.constraintMap ?? '',
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
  csvLines.push(row.join(','));
}
csvLines.push('');
fs.writeFileSync(path.join(outDir, 'schema-relations.csv'), csvLines.join('\n'));

const readme = [
  '# Schema Relation Map',
  '',
  `- Generated: ${jsonOutput.generatedAt}`,
  `- Models: ${jsonOutput.modelCount}`,
  `- Relation fields (@relation): ${jsonOutput.relationFieldCount}`,
  `- Unique directed model edges: ${jsonOutput.uniqueDirectedEdgeCount}`,
  '',
  '## Files',
  '',
  '- `schema-relations.json`: Complete machine-readable relation inventory.',
  '- `schema-relations.dot`: Graphviz map of the whole schema.',
  '- `schema-relations.mmd`: Mermaid flowchart map of the whole schema.',
  '- `schema-relations.csv`: Flat relation list (source -> target + fields).',
  '',
  '## Render graph',
  '',
  'If Graphviz is installed:',
  '',
  '```bash',
  'dot -Tsvg docs/schema-map/schema-relations.dot -o docs/schema-map/schema-relations.svg',
  '```',
  '',
  'Then open `docs/schema-map/schema-relations.svg` in your browser/editor.',
  '',
].join('\n');

fs.writeFileSync(path.join(outDir, 'README.md'), readme);

console.log(
  `Generated schema map: models=${jsonOutput.modelCount}, relationFields=${jsonOutput.relationFieldCount}, uniqueEdges=${jsonOutput.uniqueDirectedEdgeCount}`
);
console.log(`Output directory: ${path.relative(rootDir, outDir)}`);
console.log(`Unique nodes: ${uniqueNodes.size}`);
