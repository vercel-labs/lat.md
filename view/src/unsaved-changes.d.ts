export declare const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Discard them?";
export declare function confirmDiscardUnsavedChanges(dirty: boolean, confirm: (message: string) => boolean): boolean;
export declare function blockUnsavedChangesUnload(dirty: boolean, event: BeforeUnloadEvent): boolean;
