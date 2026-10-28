import { pathToFileURL } from 'node:url';

/**
 * Petits utilitaires communs aux scripts executables (seeds, demos).
 */

/** true si le module passe est celui lance directement par Node. */
export function isMainModule(importMetaUrl: string): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;
  return pathToFileURL(entryPoint).href === importMetaUrl;
}

/**
 * Execute un script en gerant proprement la sortie :
 * code 0 en cas de succes, 1 en cas d'erreur, avec un message lisible.
 */
export async function runScript(
  name: string,
  work: () => Promise<void>,
  cleanup?: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`\nEchec du script "${name}" :`);
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack.split('\n').slice(1, 4).join('\n'));
    }
    if (cleanup) await cleanup().catch(() => undefined);
    process.exit(1);
  }

  if (cleanup) await cleanup();
  process.exit(0);
}

// --- Aides d'affichage pour la console --------------------------------------

const LINE_WIDTH = 78;

export function title(text: string): void {
  console.log(`\n${'='.repeat(LINE_WIDTH)}`);
  console.log(text.toUpperCase());
  console.log('='.repeat(LINE_WIDTH));
}

export function step(index: number, text: string): void {
  console.log(`\n[${index}] ${text}`);
  console.log('-'.repeat(LINE_WIDTH));
}

export function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(38, '.')} ${String(value)}`);
}

export function note(text: string): void {
  console.log(`  > ${text}`);
}
