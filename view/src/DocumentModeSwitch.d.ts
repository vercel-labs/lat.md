export type DocumentMode = 'view' | 'edit';
export declare function DocumentModeSwitch({ mode, onChange, }: {
    mode: DocumentMode;
    onChange: (mode: DocumentMode) => void;
}): import("react").JSX.Element;
