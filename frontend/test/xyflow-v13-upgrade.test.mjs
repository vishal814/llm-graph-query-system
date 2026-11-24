import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

test('@xyflow/react is pinned to the v13.0.3 release', () => {
    const pkg = readJson('package.json');
    const lock = readJson('package-lock.json');

    assert.equal(pkg.dependencies['@xyflow/react'], '^13.0.3');
    assert.equal(lock.packages['node_modules/@xyflow/react'].version, '13.0.3');
    assert.equal(lock.packages['node_modules/@xyflow/system'].version, '1.0.1');
});

test('fitView padding uses percentage units required by @xyflow/react v13', () => {
    const page = readFileSync(join(root, 'src/app/page.tsx'), 'utf8');
    const paddings = [...page.matchAll(/fitView\(\{\s*padding:\s*([^,}]+)/g)].map((match) => match[1].trim());

    assert.equal(paddings.length, 2);
    for (const padding of paddings) {
        assert.match(padding, /^'\d+(\.\d+)?%'$/, `expected a percentage padding, received ${padding}`);
    }
});
