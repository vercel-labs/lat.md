export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Discard them?';
export function confirmDiscardUnsavedChanges(dirty, confirm) {
    return !dirty || confirm(UNSAVED_CHANGES_MESSAGE);
}
export function blockUnsavedChangesUnload(dirty, event) {
    if (!dirty)
        return false;
    event.preventDefault();
    event.returnValue = '';
    return true;
}
