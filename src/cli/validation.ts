import { join } from 'node:path';
import { findProjectRoot } from '@lat.md/core/project-discovery';
import {
  readInitValidation,
  type InitValidation,
} from '@lat.md/core/init-version';

/**
 * The validation workflow `lat init` recorded for a project, read on each call
 * so hooks follow the latest setup. Null when init has not recorded one, as in
 * setups from versions that validated only when the agent finished.
 */
export function recordedValidation(
  root: string | null = findProjectRoot(),
): InitValidation | null {
  return root === null ? null : readInitValidation(join(root, 'lat.md'));
}
