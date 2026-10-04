// Pre-commit formatting (run by .husky/pre-commit).
//
// Files under any `gen/` dir are skipped: biome.json already excludes
// `**/gen/**`, but lint-staged re-stages every file a task touched with a
// plain `git add`, and git refuses that for force-tracked files inside the
// gitignored `src-tauri/gen` (e.g. the iOS AppIcon catalog), failing the hook.
const quote = (file) => `"${file.replace(/(["\\$`])/g, '\\$1')}"`;

export default {
  '**/*.{js,jsx,ts,tsx,css,json}': (files) => {
    const kept = files.filter((file) => !/[\\/]gen[\\/]/.test(file));
    return kept.length > 0
      ? `biome format --write --no-errors-on-unmatched ${kept.map(quote).join(' ')}`
      : [];
  },
};
