import { type MouseEvent } from 'react';
import type { ViewSearchResult } from '../../src/view/protocol';
export declare function SearchResultCard({ result, rank, onNavigate, }: {
    result: ViewSearchResult;
    rank: number;
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}): import("react").JSX.Element;
