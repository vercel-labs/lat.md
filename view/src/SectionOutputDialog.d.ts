export type SectionOutputPresentation = 'raw' | 'formatted';
export declare const DEFAULT_SECTION_OUTPUT_PRESENTATION = "formatted";
export declare function SectionOutputDialog({ onClose, sectionId, }: {
    onClose: () => void;
    sectionId: string | null;
}): import("react").JSX.Element | null;
