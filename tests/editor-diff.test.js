// @vitest-environment jsdom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { editorDiff } from '../view/src/editor-diff.js';
Object.assign(Range.prototype, {
    getBoundingClientRect: () => new DOMRect(),
    getClientRects: () => [],
});
describe('CodeMirror editor diff', () => {
    const views = [];
    afterEach(() => {
        for (const view of views)
            view.destroy();
        views.length = 0;
        document.body.replaceChildren();
    });
    function diffClass(original, current) {
        const parent = document.createElement('div');
        document.body.append(parent);
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc: current,
                extensions: editorDiff(original),
            }),
        });
        views.push(view);
        return parent.innerHTML;
    }
    it('distinguishes added, modified, and deleted lines in the gutter', () => {
        expect(diffClass('one\ntwo\nthree', 'one\nadded\ntwo\nthree')).toContain('cm-editor-diff-marker-added');
        expect(diffClass('one\ntwo\nthree', 'one\nTWO\nthree')).toContain('cm-editor-diff-marker-modified');
        expect(diffClass('one\ntwo\nthree', 'one\nthree')).toContain('cm-editor-diff-marker-deleted');
        expect(diffClass('one\ntwo\nthree', 'one\ntwo\nthree')).not.toMatch(/cm-editor-diff-marker-(?:added|modified|deleted)/);
    });
});
