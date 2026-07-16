import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import postcssNested from 'postcss-nested';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appDir, '..', '..');
const vendorRoot = path.join(appDir, 'public', 'vendor');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const resetDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
};

const requireExisting = (target, description) => {
  if (!fs.existsSync(target)) {
    throw new Error(`${description} not found: ${target}`);
  }
  return target;
};

const copyFile = (source, destination) => {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
};

const copyDirContents = (sourceDir, destinationDir) => {
  ensureDir(destinationDir);
  for (const entry of fs.readdirSync(sourceDir)) {
    const source = path.join(sourceDir, entry);
    const destination = path.join(destinationDir, entry);
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      fs.cpSync(source, destination, { recursive: true });
    } else {
      copyFile(source, destination);
    }
  }
};

const flattenCss = async (source, destination) => {
  const input = fs.readFileSync(source, 'utf8');
  const result = await postcss([postcssNested]).process(input, {
    from: source,
    to: destination,
    map: false,
  });
  fs.writeFileSync(destination, result.css);
};

const stagePdfJs = async () => {
  const pdfjsDir = path.join(vendorRoot, 'pdfjs');
  resetDir(pdfjsDir);

  const buildDir = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'node_modules', 'pdfjs-dist', 'legacy', 'build'),
    'pdfjs build output',
  );
  const wasmDir = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'node_modules', 'pdfjs-dist', 'wasm'),
    'pdfjs wasm output',
  );
  const cmapsDir = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'node_modules', 'pdfjs-dist', 'cmaps'),
    'pdfjs cmaps output',
  );
  const fontsDir = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'node_modules', 'pdfjs-dist', 'standard_fonts'),
    'pdfjs standard fonts output',
  );
  const annotationCss = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'vendor', 'pdfjs', 'annotation_layer_builder.css'),
    'pdfjs annotation layer css',
  );
  const textCss = requireExisting(
    path.join(repoRoot, 'packages', 'foliate-js', 'vendor', 'pdfjs', 'text_layer_builder.css'),
    'pdfjs text layer css',
  );

  for (const fileName of ['pdf.worker.min.mjs', 'pdf.min.mjs', 'pdf.d.mts']) {
    copyFile(path.join(buildDir, fileName), path.join(pdfjsDir, fileName));
  }

  copyDirContents(wasmDir, pdfjsDir);
  copyDirContents(cmapsDir, pdfjsDir);
  copyDirContents(fontsDir, pdfjsDir);
  await flattenCss(annotationCss, path.join(pdfjsDir, 'annotation_layer_builder.css'));
  await flattenCss(textCss, path.join(pdfjsDir, 'text_layer_builder.css'));
};

const stageSimpleCc = () => {
  const simpleccDir = path.join(vendorRoot, 'simplecc');
  resetDir(simpleccDir);
  const sourceDir = requireExisting(
    path.join(repoRoot, 'packages', 'simplecc-wasm', 'dist', 'web'),
    'simplecc wasm build output',
  );
  copyDirContents(sourceDir, simpleccDir);
};

const stageJieba = () => {
  const jiebaDir = path.join(vendorRoot, 'jieba');
  resetDir(jiebaDir);
  const sourceDir = requireExisting(
    path.join(appDir, 'node_modules', 'jieba-wasm', 'pkg', 'web'),
    'jieba wasm build output',
  );
  copyDirContents(sourceDir, jiebaDir);
};

const main = async () => {
  ensureDir(vendorRoot);
  await stagePdfJs();
  stageSimpleCc();
  stageJieba();
  console.log('Staged public/vendor assets');
};

await main();
