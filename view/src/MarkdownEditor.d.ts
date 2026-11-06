export declare function MarkdownEditor({ active, onDirtyChange, path, revision, }: {
    active: boolean;
    onDirtyChange?: (dirty: boolean) => void;
    path: string;
    revision: number;
}): import("react").JSX.Element | null;
export default MarkdownEditor;
