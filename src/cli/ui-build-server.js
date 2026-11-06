import { buildServerView, } from '../view/server-build.js';
const defaultDependencies = {
    buildNode: buildServerView,
};
/** Export immutable UI data with a Node or Vercel semantic-search service. */
export async function uiBuildServerCommand(ctx, output, options = {}, dependencies = defaultDependencies) {
    try {
        const { target = 'node', ...buildOptions } = options;
        const resolvedOutput = output ?? (target === 'vercel' ? '.vercel/output' : '.lat-build/server');
        let result;
        if (target === 'vercel') {
            const buildVercel = dependencies.buildVercel ??
                (await import('../view/vercel-server-build.js')).buildVercelServerView;
            result = await buildVercel(ctx, resolvedOutput, buildOptions);
        }
        else {
            result = await dependencies.buildNode(ctx, resolvedOutput, buildOptions);
        }
        return {
            output: `Built ${result.documents} documents and ${result.sources} source views for ${target} at ${result.outputDir}`,
        };
    }
    catch (error) {
        return { output: error.message, isError: true };
    }
}
