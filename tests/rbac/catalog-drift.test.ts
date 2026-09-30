import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PERMISSION_CATALOG } from '../../src/constants/permission-catalog';

describe('Permission Catalog Drift Guard', () => {
  it('should contain all permissions requested in routes', () => {
    const routesDir = path.join(__dirname, '../../src/routes');
    const catalogKeys = new Set(PERMISSION_CATALOG.map((p) => p.key));
    const missingKeys = new Set<string>();

    const checkFile = (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf8');
      // Matches requirePermission('key') or requireAnyPermission('key1', 'key2')
      const regex = /(?:requirePermission|requireAnyPermission|requireAllPermissions)\s*\(\s*([^)]+)\)/g;
      
      let match;
      while ((match = regex.exec(content)) !== null) {
        const args = match[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
        for (const key of args) {
          if (key && !catalogKeys.has(key)) {
            missingKeys.add(key);
          }
        }
      }
    };

    const scanDir = (dir: string) => {
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          checkFile(fullPath);
        }
      }
    };

    scanDir(routesDir);

    expect(
      Array.from(missingKeys),
      'Found permissions in routes that are missing from the catalog'
    ).toEqual([]);
  });
});
