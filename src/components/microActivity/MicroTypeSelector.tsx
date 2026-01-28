import React from 'react';
import {
  IconCards,
  IconLink,
  IconCategory,
  IconListNumbers,
  IconPencil,
  IconHandMove,
  IconForms,
  IconCircleCheck,
  IconChecks,
  IconMessageQuestion,
  IconTable,
  IconHighlight,
  IconSelect,
  IconTablePlus,
  IconHierarchy2,
  IconChartInfographic
} from '@tabler/icons-react';
import type { MicroActivityType, MicroActivityTypeInfo } from '../../shared/types/microActivityTypes';
import { MICRO_ACTIVITY_TYPES, getMicroActivityTypesByCategory } from '../../shared/types/microActivityTypes';

// Map activity types to Tabler icons
const TYPE_ICONS: Record<MicroActivityType, React.ReactNode> = {
  memory_game: <IconCards className="w-6 h-6" />,
  matching: <IconLink className="w-6 h-6" />,
  categorization: <IconCategory className="w-6 h-6" />,
  ordering: <IconListNumbers className="w-6 h-6" />,
  sentence_builder: <IconPencil className="w-6 h-6" />,
  drag_and_drop: <IconHandMove className="w-6 h-6" />,
  fill_in_blanks: <IconForms className="w-6 h-6" />,
  multiple_choice: <IconCircleCheck className="w-6 h-6" />,
  true_false: <IconChecks className="w-6 h-6" />,
  open_question: <IconMessageQuestion className="w-6 h-6" />,
  matrix: <IconTable className="w-6 h-6" />,
  highlight: <IconHighlight className="w-6 h-6" />,
  text_selection: <IconSelect className="w-6 h-6" />,
  table_completion: <IconTablePlus className="w-6 h-6" />,
  mindmap: <IconHierarchy2 className="w-6 h-6" />,
  infographic: <IconChartInfographic className="w-6 h-6" />
};

interface MicroTypeSelectorProps {
  onSelect: (type: MicroActivityType) => void;
  selectedType: MicroActivityType | null;
}

// Category labels and colors
const CATEGORIES = {
  game: {
    label: 'משחקים',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-700'
  },
  question: {
    label: 'שאלות',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700'
  },
  text: {
    label: 'עבודה עם טקסט',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700'
  },
  visual: {
    label: 'ויזואלי',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700'
  }
};

export default function MicroTypeSelector({ onSelect, selectedType }: MicroTypeSelectorProps) {
  // Group types by category
  const gameTypes = getMicroActivityTypesByCategory('game');
  const questionTypes = getMicroActivityTypesByCategory('question');
  const textTypes = getMicroActivityTypesByCategory('text');
  const visualTypes = getMicroActivityTypesByCategory('visual');

  return (
    <div className="space-y-4">
      {/* Games */}
      <TypeCategory
        label={CATEGORIES.game.label}
        types={gameTypes}
        onSelect={onSelect}
        selectedType={selectedType}
        {...CATEGORIES.game}
      />

      {/* Questions */}
      <TypeCategory
        label={CATEGORIES.question.label}
        types={questionTypes}
        onSelect={onSelect}
        selectedType={selectedType}
        {...CATEGORIES.question}
      />

      {/* Text */}
      <TypeCategory
        label={CATEGORIES.text.label}
        types={textTypes}
        onSelect={onSelect}
        selectedType={selectedType}
        {...CATEGORIES.text}
      />

      {/* Visual */}
      <TypeCategory
        label={CATEGORIES.visual.label}
        types={visualTypes}
        onSelect={onSelect}
        selectedType={selectedType}
        {...CATEGORIES.visual}
      />
    </div>
  );
}

interface TypeCategoryProps {
  label: string;
  types: MicroActivityTypeInfo[];
  onSelect: (type: MicroActivityType) => void;
  selectedType: MicroActivityType | null;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

function TypeCategory({
  label,
  types,
  onSelect,
  selectedType,
  bgColor,
  borderColor,
  textColor
}: TypeCategoryProps) {
  if (types.length === 0) return null;

  return (
    <div>
      <h3 className={`text-xs font-medium ${textColor} mb-2`}>{label}</h3>
      <div className="flex flex-wrap gap-2">
        {types.map((typeInfo) => (
          <TypeCard
            key={typeInfo.type}
            typeInfo={typeInfo}
            isSelected={selectedType === typeInfo.type}
            onClick={() => onSelect(typeInfo.type)}
            bgColor={bgColor}
            borderColor={borderColor}
          />
        ))}
      </div>
    </div>
  );
}

interface TypeCardProps {
  typeInfo: MicroActivityTypeInfo;
  isSelected: boolean;
  onClick: () => void;
  bgColor: string;
  borderColor: string;
}

function TypeCard({ typeInfo, isSelected, onClick, bgColor, borderColor }: TypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg border transition-all duration-200
        flex items-center gap-2
        hover:shadow-sm
        ${isSelected
          ? `${bgColor} ${borderColor} ring-2 ring-offset-1 ring-blue-400`
          : 'bg-white border-gray-200 hover:border-gray-300'
        }
      `}
      title={typeInfo.description}
    >
      <span className="text-gray-700">{TYPE_ICONS[typeInfo.type]}</span>
      <span className="font-medium text-gray-900 text-sm whitespace-nowrap">{typeInfo.name}</span>
    </button>
  );
}
