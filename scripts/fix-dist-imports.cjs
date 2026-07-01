const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

const knownExtensions = new Set(['.js', '.mjs', '.cjs', '.json']);
const isPathWithExtension = (specifier) => {
  const ext = path.extname(specifier);
  return knownExtensions.has(ext);
};

const resolveSpecifier = (filePath, specifier) => {
  if (!specifier.startsWith('.')) return specifier;
  if (isPathWithExtension(specifier)) return specifier;

  const fromDir = path.dirname(filePath);
  const absoluteBase = path.resolve(fromDir, specifier);

  const fileCandidate = `${absoluteBase}.js`;
  if (fs.existsSync(fileCandidate)) {
    return `${specifier}.js`;
  }

  const indexCandidate = path.join(absoluteBase, 'index.js');
  if (fs.existsSync(indexCandidate)) {
    return `${specifier}/index.js`;
  }

  return specifier;
};

const rewriteFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = content;

  const staticRegex = /(\bimport\s+[^'"\n;]+?\s+from\s+|\bexport\s+[^'"\n;]+?\s+from\s+|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]+)(\2)/g;
  updated = updated.replace(staticRegex, (match, prefix, quote, spec, suffix) => {
    const next = resolveSpecifier(filePath, spec);
    if (next === spec) return match;
    return `${prefix}${quote}${next}${suffix}`;
  });

  const dynamicRegex = /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+)(\2\s*\))/g;
  updated = updated.replace(dynamicRegex, (match, prefix, quote, spec, suffix) => {
    const next = resolveSpecifier(filePath, spec);
    if (next === spec) return match;
    return `${prefix}${quote}${next}${suffix}`;
  });

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
};

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      rewriteFile(fullPath);
    }
  }
};

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run the build first.');
  process.exit(1);
}

walk(distDir);
