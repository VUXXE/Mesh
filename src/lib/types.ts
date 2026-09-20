export type ShapeType = 'path' | 'rectangle' | 'ellipse' | 'text' | 'sticky_note';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';
export type CornerRoundness = 'sharp' | 'round';
export type GridMode = 'dots' | 'lines' | 'none';

export interface PathPoint {
	x: number;
	y: number;
	pressure?: number;
}

export interface PathData {
	points: PathPoint[];
}

export interface TextData {
	text: string;
	fontSize?: number;
	fontFamily?: string;
	align?: 'left' | 'center' | 'right';
}

export interface StickyNoteData {
	text: string;
	color?: string;
}

export interface ShapeRecord {
	id: string;
	type: ShapeType;
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	rotation: number;
	zIndex: number;
	data?: any;
	createdBy: string;
	updatedAt: number;
}

export interface PeerPresence {
	userId: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
	selectedIds: string[];
}

export type C2SMessage =
	| {
			type: 'presence:update';
			userId: string;
			name: string;
			color: string;
			cursor: { x: number; y: number } | null;
			selectedIds: string[];
	  }
	| {
			type: 'room:auth';
			password: string;
	  }
	| {
			type: 'room:set_password';
			password: string;
	  }
	| {
			type: 'shape:upsert';
			shapes: Array<{
				id: string;
				type: ShapeType;
				x: number;
				y: number;
				width?: number;
				height?: number;
				fill?: string;
				stroke?: string;
				strokeWidth?: number;
				rotation?: number;
				zIndex?: number;
				data?: any;
				updatedAt: number;
			}>;
	  }
	| {
			type: 'shape:delete';
			ids: string[];
	  }
	| {
			type: 'canvas:clear';
	  };

export type S2CMessage =
	| {
			type: 'sync:init';
			roomId: string;
			serverTime: number;
			shapes: ShapeRecord[];
			peers: PeerPresence[];
			requiresPassword?: boolean;
	  }
	| {
			type: 'room:auth_ok';
	  }
	| {
			type: 'room:auth_failed';
	  }
	| {
			type: 'room:password_set';
	  }
	| {
			type: 'presence:peer';
			userId: string;
			name: string;
			color: string;
			cursor: { x: number; y: number } | null;
			selectedIds: string[];
	  }
	| {
			type: 'shapes:upserted';
			shapes: ShapeRecord[];
	  }
	| {
			type: 'shapes:deleted';
			ids: string[];
	  }
	| {
			type: 'peer:left';
			userId: string;
	  }
	| {
			type: 'canvas:cleared';
	  };
