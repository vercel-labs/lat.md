export declare class ViewDocumentConflictError extends Error {
}
export type AppliedDocumentEdit = {
    content: string;
    merged: boolean;
};
/** Apply the user's base-to-edited patch to the latest content on disk. */
export declare function applyDocumentEdit(baseContent: string, editedContent: string, currentContent: string): AppliedDocumentEdit;
