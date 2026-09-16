#!/usr/bin/env node
import { createCli, packageVersion } from './core.js';
const { program, args } = createCli({
  name: 'lat-core',
  version: packageVersion(import.meta.url),
});
await program.parseAsync(args, { from: 'user' });
