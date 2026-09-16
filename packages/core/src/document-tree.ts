export type ViewDocumentProperty =
  | string
  | number
  | boolean
  | null
  | (string | number)[];

export type ViewDocumentText = {
  type: 'text';
  value: string;
};

export type ViewDocumentElement = {
  type: 'element';
  tagName: string;
  properties: Record<string, ViewDocumentProperty>;
  children: ViewDocumentNode[];
};

export type ViewDocumentNode = ViewDocumentText | ViewDocumentElement;

/** Versioned, parser-neutral presentation tree sent to the browser. */
export type ViewDocumentTree = {
  version: 1;
  type: 'root';
  children: ViewDocumentNode[];
};
