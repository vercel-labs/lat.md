import { type MouseEvent } from 'react';
import type { ViewExternalFile, ViewGitFileStatus, ViewIndex } from '../../src/view/protocol';
type FileTreeProps = {
    activePath: string | null;
    activeExternalTarget: string | null;
    errorCounts: Record<string, number>;
    externalFiles: ViewExternalFile[];
    files: string[];
    directoryOrder: ViewIndex['directoryOrder'];
    entry: string;
    gitFiles: Record<string, ViewGitFileStatus>;
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
};
export declare function FileTree({ activePath, activeExternalTarget, errorCounts, externalFiles, files, directoryOrder, entry, gitFiles, onNavigate, }: FileTreeProps): import("react").JSX.Element;
export {};
