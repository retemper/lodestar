/**
 * Simple glob matching — supports * and ** wildcards.
 * @param path - file path to test
 * @param pattern - glob pattern (e.g., 'src/domain/**')
 */
function matchGlob(path: string, pattern: string): boolean {
  const regex = pattern
    .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**/', '{{GLOBSTAR_SLASH}}')
    .replaceAll('**', '{{GLOBSTAR}}')
    .replaceAll('*', '[^/]*')
    .replaceAll('{{GLOBSTAR_SLASH}}', '(?:.*/)?')
    .replaceAll('{{GLOBSTAR}}', '.*');
  return new RegExp(`^${regex}$`).test(path);
}

export { matchGlob };
