export type Point = { x: number; y: number };

export type Segment =
  | { type: 'line'; start: Point; end: Point }
  | { type: 'arc'; start: Point; end: Point; bulge: number };

export type ElementKind = 'point' | 'linear' | 'annotation';
export type CeilingElementType =
  | 'spot'
  | 'chandelier'
  | 'cornice'
  | 'light-line'
  | 'profile'
  | 'niche'
  | 'opening'
  | 'sensor'
  | 'smoke-detector'
  | 'annotation';

export type DrawingElement = {
  id: number;
  type: CeilingElementType;
  kind: ElementKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  name?: string;
  label?: string;
  color?: string;
  size?: number;
  quantity?: number;
  unit?: 'шт' | 'м' | 'м²';
  manualLength?: number;
  price?: number;
  materialOrWork?: 'material' | 'work';
};

export type CeilingVariant = {
  id: string;
  name: string;
  description?: string;
  points: Point[];
  segments?: Segment[];
  elements: DrawingElement[];
  backgroundImage?: {
    name?: string;
    dataUrl?: string;
    opacity?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  category?: string;
  materialOrWork: 'material' | 'work';
  unit: 'шт' | 'м' | 'м²';
  salePrice: number;
  costPrice?: number;
  color?: string;
  shape?: 'circle' | 'square' | 'line' | 'text' | 'diamond';
  size?: number;
  active?: boolean;
};

export type ProjectTransaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  date: string;
};

export type ProjectTask = {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  dueAt?: string;
};

export type ProjectEvent = {
  id: string;
  type: 'measurement' | 'installation' | 'task';
  title: string;
  startAt: string;
  endAt?: string;
};

export type ProjectStatus = 'lead' | 'measurement' | 'calculation' | 'approved' | 'production' | 'installation' | 'completed' | 'cancelled';
