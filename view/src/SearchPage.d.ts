import { type MouseEvent } from 'react';
import { type ViewScrollPosition } from './navigation';
export declare function SearchPage({ onClose, onNavigate, onScrollRestored, markdownGeneration, restoreScroll, }: {
    onClose: () => void;
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
    onScrollRestored: () => void;
    markdownGeneration: number;
    restoreScroll: ViewScrollPosition | null;
}): import("react").JSX.Element;
