import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { buildExternalFileTree, buildFileTree, directoryIndex, expandDirectory, fileTreeErrorCount, fileTreeGitStatus, } from './file-tree';
import { documentUrl, externalUrl } from './navigation';
function isActiveFile(node, activePath, activeExternalTarget) {
    if (!node.externalTarget)
        return node.path === activePath;
    const baseTarget = activeExternalTarget?.split('#', 1)[0] ?? null;
    return (baseTarget === node.externalTarget || baseTarget === node.externalPathTarget);
}
function containsActiveFile(node, activePath, activeExternalTarget) {
    if (node.kind === 'file') {
        return isActiveFile(node, activePath, activeExternalTarget);
    }
    return node.children.some((child) => containsActiveFile(child, activePath, activeExternalTarget));
}
function fileUrl(node) {
    return node.externalTarget
        ? externalUrl(node.externalTarget)
        : documentUrl(node.path);
}
function TreeNode({ activePath, activeExternalTarget, errorCounts, gitFiles, node, onNavigate, }) {
    if (node.kind === 'directory') {
        const index = directoryIndex(node);
        const errorCount = fileTreeErrorCount(node, errorCounts);
        const gitStatus = fileTreeGitStatus(node, gitFiles);
        return (_jsxs("details", { className: "tree-directory", open: containsActiveFile(node, activePath, activeExternalTarget) ||
                undefined, children: [_jsx("summary", { children: index ? (_jsxs("a", { href: fileUrl(index), onClick: (event) => {
                            expandDirectory(event.currentTarget.closest('details'));
                            onNavigate(event);
                        }, children: [_jsx("span", { className: "document-link-name", children: node.name }), (errorCount > 0 || gitStatus) && (_jsx(FileStateDisc, { errorCount: errorCount, gitStatus: gitStatus }))] })) : (_jsxs("span", { children: [_jsx("span", { className: "document-link-name", children: node.name }), (errorCount > 0 || gitStatus) && (_jsx(FileStateDisc, { errorCount: errorCount, gitStatus: gitStatus }))] })) }), _jsx("div", { className: "tree-children", children: node.children.map((child) => (_jsx(TreeNode, { activePath: activePath, activeExternalTarget: activeExternalTarget, errorCounts: errorCounts, gitFiles: gitFiles, node: child, onNavigate: onNavigate }, child.path))) })] }));
    }
    const errorCount = fileTreeErrorCount(node, errorCounts);
    const gitStatus = fileTreeGitStatus(node, gitFiles);
    return (_jsxs("a", { className: isActiveFile(node, activePath, activeExternalTarget)
            ? 'document-link active'
            : 'document-link', href: fileUrl(node), onClick: onNavigate, children: [_jsx("span", { className: "document-link-name", children: node.name.replace(/\.md$/i, '') }), (errorCount > 0 || gitStatus) && (_jsx(FileStateDisc, { errorCount: errorCount, gitStatus: gitStatus }))] }));
}
function FileStateDisc({ errorCount, gitStatus, }) {
    const labels = [
        errorCount > 0
            ? `${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'}`
            : '',
        gitStatus ? `${gitStatus} in Git` : '',
    ].filter(Boolean);
    const label = labels.join('; ');
    return (_jsx("span", { "aria-label": label, className: `document-state-disc${errorCount > 0 ? ' has-errors' : ''}${gitStatus ? ` git-${gitStatus}` : ''}`, role: "img", title: label }));
}
export function FileTree({ activePath, activeExternalTarget, errorCounts, externalFiles, files, directoryOrder, entry, gitFiles, onNavigate, }) {
    const tree = useMemo(() => buildFileTree(files, directoryOrder, entry), [files, directoryOrder, entry]);
    const externalTree = useMemo(() => buildExternalFileTree(externalFiles), [externalFiles]);
    return (_jsxs("div", { className: "file-tree", children: [tree.map((node) => (_jsx(TreeNode, { activePath: activePath, activeExternalTarget: activeExternalTarget, errorCounts: errorCounts, gitFiles: gitFiles, node: node, onNavigate: onNavigate }, node.path))), externalTree.length > 0 && (_jsxs("div", { className: "file-tree-section-label", children: [_jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "12", cy: "12", r: "8.5" }), _jsx("path", { d: "M3.5 12h17M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5s-1.2 6.2-3.4 8.5M12 3.5C9.8 5.8 8.6 8.6 8.6 12s1.2 6.2 3.4 8.5" })] }), _jsx("span", { children: "External Sources" })] })), externalTree.map((node) => (_jsx(TreeNode, { activePath: activePath, activeExternalTarget: activeExternalTarget, errorCounts: errorCounts, gitFiles: gitFiles, node: node, onNavigate: onNavigate }, node.path)))] }, activePath ?? activeExternalTarget ?? undefined));
}
