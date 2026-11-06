import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
const serializer = unified().use(rehypeStringify);
/** Test-only projection used to keep exact rendering parity assertions. */
export function documentTreeToHtml(tree) {
    return serializer.stringify({ type: 'root', children: tree.children });
}
