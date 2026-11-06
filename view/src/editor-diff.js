import { Chunk } from '@codemirror/merge';
import { RangeSet, StateEffect, StateField, Text, } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter, } from '@codemirror/view';
const DIFF_CONFIG = { scanLimit: 500, timeout: 50 };
class EditorDiffMarker extends GutterMarker {
    kind;
    constructor(kind) {
        super();
        this.kind = kind;
    }
    eq(other) {
        return other instanceof EditorDiffMarker && other.kind === this.kind;
    }
    toDOM() {
        const marker = document.createElement('span');
        marker.className = `cm-editor-diff-marker cm-editor-diff-marker-${this.kind}`;
        if (this.kind !== 'spacer') {
            marker.title = `${this.kind[0].toUpperCase()}${this.kind.slice(1)} since opening the editor`;
        }
        return marker;
    }
}
const diffMarkers = {
    added: new EditorDiffMarker('added'),
    modified: new EditorDiffMarker('modified'),
    deleted: new EditorDiffMarker('deleted'),
};
const spacerMarker = new EditorDiffMarker('spacer');
function text(source) {
    return Text.of(source.split(/\r\n?|\n/));
}
function strongerKind(previous, next) {
    if (!previous || previous === next)
        return next;
    return 'modified';
}
function presentDiff(original, current, chunks) {
    const changedLines = new Map();
    for (const chunk of chunks) {
        const kind = chunk.fromB === chunk.toB
            ? 'deleted'
            : chunk.fromA === chunk.toA
                ? 'added'
                : 'modified';
        const firstLine = current.lineAt(Math.min(chunk.fromB, current.length));
        if (kind === 'deleted') {
            changedLines.set(firstLine.from, strongerKind(changedLines.get(firstLine.from), kind));
            continue;
        }
        const lastLine = current.lineAt(Math.min(chunk.endB, current.length));
        for (let number = firstLine.number; number <= lastLine.number; number++) {
            const position = current.line(number).from;
            changedLines.set(position, strongerKind(changedLines.get(position), kind));
        }
    }
    const markers = [...changedLines]
        .sort(([left], [right]) => left - right)
        .map(([position, kind]) => diffMarkers[kind].range(position));
    const decorations = [...changedLines]
        .filter(([, kind]) => kind !== 'deleted')
        .sort(([left], [right]) => left - right)
        .map(([position, kind]) => Decoration.line({
        class: `cm-editor-diff-line cm-editor-diff-line-${kind}`,
    }).range(position));
    return {
        original,
        chunks,
        markers: RangeSet.of(markers),
        decorations: Decoration.set(decorations),
    };
}
export const setEditorDiffOriginal = StateEffect.define();
export function editorDiff(originalSource) {
    const initialOriginal = text(originalSource);
    return StateField.define({
        create(state) {
            const chunks = Chunk.build(initialOriginal, state.doc, DIFF_CONFIG);
            return presentDiff(initialOriginal, state.doc, chunks);
        },
        update(value, transaction) {
            const replacement = transaction.effects.find((effect) => effect.is(setEditorDiffOriginal));
            if (replacement) {
                const original = text(replacement.value);
                return presentDiff(original, transaction.state.doc, Chunk.build(original, transaction.state.doc, DIFF_CONFIG));
            }
            if (!transaction.docChanged)
                return value;
            const chunks = Chunk.updateB(value.chunks, value.original, transaction.state.doc, transaction.changes, DIFF_CONFIG);
            return presentDiff(value.original, transaction.state.doc, chunks);
        },
        provide: (field) => [
            gutter({
                class: 'cm-editorDiffGutter',
                initialSpacer: () => spacerMarker,
                markers: (view) => view.state.field(field).markers,
            }),
            EditorView.decorations.from(field, (value) => value.decorations),
        ],
    });
}
