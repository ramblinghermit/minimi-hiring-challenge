import path from 'path';

/**
 * Returns the active storage directory for Memory System persistence files.
 * Uses .data/test_vault when running in test mode (NODE_ENV=test, MEMORY_DIR or BRAIN_VAULT_DIR set,
 * or when executing via test files in test/), preserving live user chat history in .data/brain_vault.
 */
export function getDefaultStorageDir(): string {
  if (process.env.MEMORY_DIR) {
    return process.env.MEMORY_DIR;
  }
  if (process.env.BRAIN_VAULT_DIR) {
    return process.env.BRAIN_VAULT_DIR;
  }
  if (process.env.NODE_ENV === 'test') {
    return path.join(process.cwd(), '.data', 'test_vault');
  }

  // Automatic detection of test execution from argv
  const isTestArgv = process.argv.some(
    (arg) =>
      arg.includes('/test/') ||
      arg.includes('\\test\\') ||
      arg.includes('test.') ||
      arg.includes('.test.ts') ||
      arg.includes('test/') ||
      arg.includes('test\\')
  );
  if (isTestArgv) {
    return path.join(process.cwd(), '.data', 'test_vault');
  }

  return path.join(process.cwd(), '.data', 'brain_vault');
}
