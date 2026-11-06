import { dirname, relative, resolve } from 'node:path';
import { toPosix } from '@lat.md/core/path';
import { documentUrl } from './document-route.js';
/** Convert one graph section match into the browser search protocol. */
export function viewSearchResult(latDir, match, documentPaths) {
    const section = match.section;
    const projectRoot = dirname(latDir);
    const path = documentPaths?.get(section.id.toLowerCase()) ??
        toPosix(relative(latDir, resolve(projectRoot, section.filePath)));
    const fileBreadcrumbs = path.replace(/\.md$/i, '').split('/');
    return {
        sectionId: section.id,
        title: section.heading,
        path,
        breadcrumbs: [...fileBreadcrumbs, ...section.id.split('#').slice(1)],
        description: match.evidence?.[0]?.text ?? section.firstParagraph,
        introduction: section.firstParagraph,
        evidence: match.evidence ?? [],
        semanticSimilarity: match.semanticSimilarity,
        semanticRank: match.semanticRank,
        lexicalRank: match.lexicalRank,
        url: documentUrl(path, section.githubSlug ?? ''),
        rankScore: match.rankScore ?? 0,
    };
}
