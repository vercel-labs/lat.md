import { type MouseEvent } from 'react';
import type { ViewDocumentTocItem } from '../../src/view/protocol';
export declare function DocumentToc({ gitEnabled, items, onNavigate, }: {
    gitEnabled: boolean;
    items: ViewDocumentTocItem[];
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}): import("react").JSX.Element | null;
