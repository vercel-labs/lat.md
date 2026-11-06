import { type MouseEvent } from 'react';
import type { ViewSourceDocument } from '../../src/view/protocol';
export declare const sourceLineId: (line: number) => string;
export declare function SourceView({ onContentClick, source, }: {
    onContentClick: (event: MouseEvent<HTMLElement>) => void;
    source: ViewSourceDocument;
}): import("react").JSX.Element;
