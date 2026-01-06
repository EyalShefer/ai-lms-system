/**
 * GeometryShapes Component Library
 *
 * SVG-based geometric shapes for elementary math education.
 * All shapes support labels, measurements, and interactive features.
 *
 * Usage:
 *   <Rectangle width={8} height={5} showDimensions />
 *   <Triangle type="equilateral" sideLength={6} showAngles />
 *   <Circle radius={4} showRadius />
 */

import React from 'react';

// Common props for all shapes
interface BaseShapeProps {
  /** Width of the SVG container */
  svgWidth?: number;
  /** Height of the SVG container */
  svgHeight?: number;
  /** Fill color */
  fill?: string;
  /** Stroke color */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Show dimension labels */
  showDimensions?: boolean;
  /** Additional class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether this shape is selected/highlighted */
  isSelected?: boolean;
}

// ============================================================
// RECTANGLE / SQUARE
// ============================================================

interface RectangleProps extends BaseShapeProps {
  /** Width value (for display) */
  width: number;
  /** Height value (for display) */
  height: number;
  /** Unit label */
  unit?: string;
  /** Show area calculation */
  showArea?: boolean;
  /** Show perimeter calculation */
  showPerimeter?: boolean;
}

export function Rectangle({
  width,
  height,
  unit = 'ס"מ',
  svgWidth = 200,
  svgHeight = 150,
  fill = '#E0E7FF',
  stroke = '#4F46E5',
  strokeWidth = 2,
  showDimensions = true,
  showArea = false,
  showPerimeter = false,
  className = '',
  onClick,
  isSelected = false,
}: RectangleProps) {
  const padding = 30;
  const rectWidth = svgWidth - padding * 2;
  const rectHeight = svgHeight - padding * 2;

  const area = width * height;
  const perimeter = 2 * (width + height);

  return (
    <div className={`inline-block ${className}`} onClick={onClick}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={`${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 rounded' : ''}`}
      >
        {/* Rectangle */}
        <rect
          x={padding}
          y={padding}
          width={rectWidth}
          height={rectHeight}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          rx={2}
        />

        {showDimensions && (
          <>
            {/* Width label (bottom) */}
            <text
              x={svgWidth / 2}
              y={svgHeight - 8}
              textAnchor="middle"
              className="text-sm font-medium fill-gray-700"
            >
              {width} {unit}
            </text>

            {/* Height label (right) */}
            <text
              x={svgWidth - 8}
              y={svgHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90, ${svgWidth - 8}, ${svgHeight / 2})`}
              className="text-sm font-medium fill-gray-700"
            >
              {height} {unit}
            </text>

            {/* Dimension lines */}
            <line
              x1={padding}
              y1={svgHeight - 18}
              x2={svgWidth - padding}
              y2={svgHeight - 18}
              stroke="#6B7280"
              strokeWidth={1}
              markerEnd="url(#arrowhead)"
              markerStart="url(#arrowhead)"
            />
          </>
        )}

        {/* Area label (center) */}
        {showArea && (
          <text
            x={svgWidth / 2}
            y={svgHeight / 2}
            textAnchor="middle"
            className="text-base font-bold fill-indigo-700"
          >
            S = {area} {unit}²
          </text>
        )}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 6 3, 0 6" fill="#6B7280" />
          </marker>
        </defs>
      </svg>

      {/* Info below */}
      {(showArea || showPerimeter) && (
        <div className="text-center text-sm text-gray-600 mt-1">
          {showArea && <span>שטח: {area} {unit}²</span>}
          {showArea && showPerimeter && <span className="mx-2">|</span>}
          {showPerimeter && <span>היקף: {perimeter} {unit}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TRIANGLE
// ============================================================

interface TriangleProps extends BaseShapeProps {
  /** Triangle type */
  type?: 'equilateral' | 'isosceles' | 'right' | 'scalene';
  /** Base length */
  base?: number;
  /** Height (for area calculation) */
  height?: number;
  /** Side lengths [a, b, c] */
  sides?: [number, number, number];
  /** Show angles */
  showAngles?: boolean;
  /** Unit label */
  unit?: string;
}

export function Triangle({
  type = 'equilateral',
  base = 6,
  height: heightValue,
  sides,
  svgWidth = 180,
  svgHeight = 160,
  fill = '#FEE2E2',
  stroke = '#DC2626',
  strokeWidth = 2,
  showDimensions = true,
  showAngles = false,
  unit = 'ס"מ',
  className = '',
  onClick,
  isSelected = false,
}: TriangleProps) {
  const padding = 25;

  // Calculate points based on type
  let points: string;
  const cx = svgWidth / 2;
  const bottom = svgHeight - padding;
  const top = padding + 10;

  switch (type) {
    case 'right':
      // Right triangle (right angle at bottom-left)
      points = `${padding},${bottom} ${svgWidth - padding},${bottom} ${padding},${top}`;
      break;
    case 'isosceles':
      // Isosceles triangle
      points = `${padding},${bottom} ${svgWidth - padding},${bottom} ${cx},${top}`;
      break;
    case 'equilateral':
    default:
      // Equilateral triangle
      points = `${padding},${bottom} ${svgWidth - padding},${bottom} ${cx},${top}`;
      break;
  }

  return (
    <div className={`inline-block ${className}`} onClick={onClick}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={`${isSelected ? 'ring-2 ring-red-500 ring-offset-2 rounded' : ''}`}
      >
        {/* Triangle */}
        <polygon
          points={points}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* Right angle marker */}
        {type === 'right' && (
          <rect
            x={padding}
            y={bottom - 15}
            width={15}
            height={15}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          />
        )}

        {showDimensions && (
          <>
            {/* Base label */}
            <text
              x={cx}
              y={svgHeight - 5}
              textAnchor="middle"
              className="text-sm font-medium fill-gray-700"
            >
              {base} {unit}
            </text>

            {/* Height label (if provided) */}
            {heightValue && (
              <>
                <line
                  x1={cx}
                  y1={top}
                  x2={cx}
                  y2={bottom}
                  stroke="#6B7280"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
                <text
                  x={cx + 15}
                  y={(top + bottom) / 2}
                  className="text-xs fill-gray-600"
                >
                  h={heightValue}
                </text>
              </>
            )}
          </>
        )}

        {showAngles && type === 'equilateral' && (
          <>
            <text x={padding + 5} y={bottom - 5} className="text-xs fill-gray-500">60°</text>
            <text x={svgWidth - padding - 20} y={bottom - 5} className="text-xs fill-gray-500">60°</text>
            <text x={cx - 10} y={top + 20} className="text-xs fill-gray-500">60°</text>
          </>
        )}

        {showAngles && type === 'right' && (
          <>
            <text x={padding + 20} y={bottom - 5} className="text-xs fill-gray-500">90°</text>
          </>
        )}
      </svg>
    </div>
  );
}

// ============================================================
// CIRCLE
// ============================================================

interface CircleProps extends BaseShapeProps {
  /** Radius value */
  radius: number;
  /** Show radius line */
  showRadius?: boolean;
  /** Show diameter */
  showDiameter?: boolean;
  /** Show circumference formula */
  showCircumference?: boolean;
  /** Show area formula */
  showArea?: boolean;
  /** Unit label */
  unit?: string;
}

export function Circle({
  radius,
  svgWidth = 160,
  svgHeight = 160,
  fill = '#DBEAFE',
  stroke = '#2563EB',
  strokeWidth = 2,
  showRadius = true,
  showDiameter = false,
  showCircumference = false,
  showArea = false,
  unit = 'ס"מ',
  className = '',
  onClick,
  isSelected = false,
}: CircleProps) {
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;
  const r = Math.min(svgWidth, svgHeight) / 2 - 25;

  const diameter = radius * 2;
  const circumference = (2 * Math.PI * radius).toFixed(2);
  const area = (Math.PI * radius * radius).toFixed(2);

  return (
    <div className={`inline-block ${className}`} onClick={onClick}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={`${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 rounded-full' : ''}`}
      >
        {/* Circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        {/* Center point */}
        <circle cx={cx} cy={cy} r={3} fill={stroke} />

        {showRadius && (
          <>
            {/* Radius line */}
            <line
              x1={cx}
              y1={cy}
              x2={cx + r}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {/* Radius label */}
            <text
              x={cx + r / 2}
              y={cy - 8}
              textAnchor="middle"
              className="text-sm font-medium fill-gray-700"
            >
              r = {radius} {unit}
            </text>
          </>
        )}

        {showDiameter && (
          <>
            {/* Diameter line */}
            <line
              x1={cx - r}
              y1={cy}
              x2={cx + r}
              y2={cy}
              stroke="#6B7280"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            {/* Diameter label */}
            <text
              x={cx}
              y={cy + r / 2 + 10}
              textAnchor="middle"
              className="text-xs fill-gray-600"
            >
              d = {diameter} {unit}
            </text>
          </>
        )}
      </svg>

      {/* Info below */}
      {(showCircumference || showArea) && (
        <div className="text-center text-sm text-gray-600 mt-1">
          {showCircumference && <div>היקף: 2πr = {circumference} {unit}</div>}
          {showArea && <div>שטח: πr² = {area} {unit}²</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ANGLE
// ============================================================

interface AngleProps extends BaseShapeProps {
  /** Angle in degrees */
  degrees: number;
  /** Label for the angle */
  label?: string;
  /** Show arc */
  showArc?: boolean;
}

export function Angle({
  degrees,
  label,
  svgWidth = 120,
  svgHeight = 120,
  stroke = '#059669',
  strokeWidth = 2,
  showArc = true,
  className = '',
  onClick,
  isSelected = false,
}: AngleProps) {
  const cx = 20;
  const cy = svgHeight - 20;
  const lineLength = 80;

  // Calculate end point of the angled line
  const radians = (degrees * Math.PI) / 180;
  const endX = cx + lineLength * Math.cos(radians);
  const endY = cy - lineLength * Math.sin(radians);

  // Arc path
  const arcRadius = 25;
  const arcEndX = cx + arcRadius * Math.cos(radians);
  const arcEndY = cy - arcRadius * Math.sin(radians);
  const largeArcFlag = degrees > 180 ? 1 : 0;

  return (
    <div className={`inline-block ${className}`} onClick={onClick}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={`${isSelected ? 'ring-2 ring-green-500 ring-offset-2 rounded' : ''}`}
      >
        {/* Horizontal line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + lineLength}
          y2={cy}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        {/* Angled line */}
        <line
          x1={cx}
          y1={cy}
          x2={endX}
          y2={endY}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />

        {/* Angle arc */}
        {showArc && (
          <path
            d={`M ${cx + arcRadius} ${cy} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 0 ${arcEndX} ${arcEndY}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          />
        )}

        {/* Degree label */}
        <text
          x={cx + arcRadius + 10}
          y={cy - 10}
          className="text-sm font-medium fill-gray-700"
        >
          {degrees}°
        </text>

        {/* Custom label */}
        {label && (
          <text
            x={cx + 5}
            y={cy - arcRadius - 5}
            className="text-xs fill-gray-600"
          >
            {label}
          </text>
        )}

        {/* Right angle marker */}
        {degrees === 90 && (
          <rect
            x={cx}
            y={cy - 15}
            width={15}
            height={15}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  );
}

// ============================================================
// SHAPE GALLERY (for selection)
// ============================================================

interface ShapeGalleryProps {
  onSelect: (shape: string) => void;
  selectedShape?: string;
  className?: string;
}

export function ShapeGallery({
  onSelect,
  selectedShape,
  className = '',
}: ShapeGalleryProps) {
  const shapes = [
    { id: 'rectangle', label: 'מלבן', icon: '▭' },
    { id: 'square', label: 'ריבוע', icon: '□' },
    { id: 'triangle', label: 'משולש', icon: '△' },
    { id: 'circle', label: 'עיגול', icon: '○' },
    { id: 'right-triangle', label: 'משולש ישר', icon: '◺' },
    { id: 'parallelogram', label: 'מקבילית', icon: '▱' },
  ];

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {shapes.map((shape) => (
        <button
          key={shape.id}
          onClick={() => onSelect(shape.id)}
          className={`
            p-3 rounded-lg border-2 transition-all
            ${selectedShape === shape.id
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
            }
          `}
        >
          <div className="text-2xl mb-1">{shape.icon}</div>
          <div className="text-xs text-gray-600">{shape.label}</div>
        </button>
      ))}
    </div>
  );
}

export default {
  Rectangle,
  Triangle,
  Circle,
  Angle,
  ShapeGallery,
};
