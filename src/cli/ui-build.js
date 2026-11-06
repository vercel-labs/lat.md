import { buildStaticView, } from '../view/static-build.js';
/** Export the current vault as a serverless, read-only Lat UI. */
export async function uiBuildCommand(ctx, output = '.lat-build/static', options = {}) {
    try {
        const result = await buildStaticView(ctx, output, options);
        return {
            output: `Built ${result.documents} documents and ${result.sources} source views at ${result.outputDir}`,
        };
    }
    catch (error) {
        return { output: error.message, isError: true };
    }
}
