import { runIndex } from '../cli/search.js';
process.once('message', async (request) => {
    try {
        await runIndex(request.latDir, undefined, request.project, {
            cacheDir: request.cacheDir,
        });
        // Process exit releases native database handles before staging is renamed.
        process.exit(0);
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
});
