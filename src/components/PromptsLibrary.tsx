import React, { useState, useEffect, useMemo } from 'react';
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconArrowRight,
  IconSparkles,
  IconSortDescending,
  IconX,
  IconRefresh,
  IconClipboardCheck,
  IconSchool,
  IconMessage,
  IconDeviceGamepad2,
  IconTarget,
  IconWand,
  IconUsers,
  IconChartBar,
  IconHeartHandshake,
  IconCalendarEvent,
  IconMailHeart,
  IconFlame,
  IconTrophy
} from '@tabler/icons-react';
import PromptCard from './PromptCard';
import SubmitPromptModal from './SubmitPromptModal';
import AdminPromptSeeder from './AdminPromptSeeder';
import { useAuth } from '../context/AuthContext';
import type { Prompt } from '../services/promptsService';
import {
  PROMPT_CATEGORIES,
  subscribeToPrompts,
  getFeaturedPrompt,
  searchPrompts,
  getMostUsedPrompts
} from '../services/promptsService';

interface PromptsLibraryProps {
  onBack: () => void;
}

type SortOption = 'newest' | 'rating' | 'popular';

// Map category IDs to Tabler Icons (matching the main app design)
const getCategoryIcon = (categoryId: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'popular': <IconFlame className="w-4 h-4" />,
    'exams': <IconClipboardCheck className="w-4 h-4" />,
    'lessons': <IconSchool className="w-4 h-4" />,
    'feedback': <IconMessage className="w-4 h-4" />,
    'activities': <IconDeviceGamepad2 className="w-4 h-4" />,
    'adaptations': <IconTarget className="w-4 h-4" />,
    'content': <IconWand className="w-4 h-4" />,
    'management': <IconUsers className="w-4 h-4" />,
    'assessment': <IconChartBar className="w-4 h-4" />,
    'sel': <IconHeartHandshake className="w-4 h-4" />,
    'planning': <IconCalendarEvent className="w-4 h-4" />,
    'communication': <IconMailHeart className="w-4 h-4" />
  };
  return iconMap[categoryId] || <IconSparkles className="w-4 h-4" />;
};

// Map category IDs to colors for visual distinction
const getCategoryColor = (categoryId: string, isSelected: boolean) => {
  if (isSelected) {
    return 'text-white';
  }
  const colorMap: Record<string, string> = {
    'popular': 'text-orange-500',
    'exams': 'text-cyan-600',
    'lessons': 'text-blue-600',
    'feedback': 'text-indigo-600',
    'activities': 'text-emerald-600',
    'adaptations': 'text-orange-600',
    'content': 'text-purple-600',
    'management': 'text-slate-600',
    'assessment': 'text-teal-600',
    'sel': 'text-pink-600',
    'planning': 'text-amber-600',
    'communication': 'text-rose-600'
  };
  return colorMap[categoryId] || 'text-slate-600';
};

export default function PromptsLibrary({ onBack }: PromptsLibraryProps) {
  const { isAdmin } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [popularPrompts, setPopularPrompts] = useState<Prompt[]>([]);
  const [featuredPrompt, setFeaturedPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Subscribe to prompts
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToPrompts((fetchedPrompts) => {
      setPrompts(fetchedPrompts);
      setLoading(false);
    });

    // Load featured prompt
    getFeaturedPrompt().then(setFeaturedPrompt);

    // Load top 10 most popular prompts
    getMostUsedPrompts(10).then(setPopularPrompts);

    return () => unsubscribe();
  }, []);

  // Check if the 'popular' special category is selected
  const isPopularCategory = selectedCategory === 'popular';

  // Filter and sort prompts
  const filteredPrompts = useMemo(() => {
    // Special case: "Most Popular" category - show top 10 by copy count
    if (isPopularCategory) {
      let result = [...popularPrompts];

      // Apply search filter even in popular category
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(p =>
          p.title.toLowerCase().includes(lowerSearch) ||
          p.description.toLowerCase().includes(lowerSearch) ||
          p.category.toLowerCase().includes(lowerSearch) ||
          p.subcategory.toLowerCase().includes(lowerSearch)
        );
      }

      return result;
    }

    let result = [...prompts];

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(lowerSearch) ||
        p.description.toLowerCase().includes(lowerSearch) ||
        p.category.toLowerCase().includes(lowerSearch) ||
        p.subcategory.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by category (skip for special categories)
    if (selectedCategory) {
      const category = PROMPT_CATEGORIES.find(c => c.id === selectedCategory);
      if (category && !('isSpecial' in category)) {
        result = result.filter(p => p.category === category.name);
      }
    }

    // Filter by subcategory
    if (selectedSubcategory) {
      result = result.filter(p => p.subcategory === selectedSubcategory);
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'popular':
        result.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'newest':
      default:
        // Already sorted by createdAt desc from Firestore
        break;
    }

    // Exclude featured from list (it's shown separately)
    if (featuredPrompt) {
      result = result.filter(p => p.id !== featuredPrompt.id);
    }

    return result;
  }, [prompts, popularPrompts, searchTerm, selectedCategory, selectedSubcategory, sortBy, featuredPrompt, isPopularCategory]);

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory(null); // Reset subcategory when category changes
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSortBy('newest');
  };

  const hasActiveFilters = searchTerm || selectedCategory || selectedSubcategory || sortBy !== 'newest';

  const selectedCategoryData = selectedCategory
    ? PROMPT_CATEGORIES.find(c => c.id === selectedCategory)
    : null;

  const handlePromptSubmitted = () => {
    setShowSubmitModal(false);
    // Prompts will auto-refresh via subscription
  };

  const refreshData = () => {
    setLoading(true);
    getFeaturedPrompt().then(setFeaturedPrompt);
    getMostUsedPrompts(10).then(setPopularPrompts);
    // Subscription will handle the rest
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20" dir="rtl">
      {/* Header with Search & Filters */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Top row - Title and actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <IconArrowRight className="w-6 h-6 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <IconSparkles className="w-7 h-7 text-wizdi-gold" />
                  מאגר פרומפטים AI
                </h1>
                <p className="text-sm text-slate-500">מגוון פרומפטים מוכנים לצורכי ההוראה</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refreshData}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600"
                title="רענן"
              >
                <IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-wizdi-royal text-white rounded-xl hover:bg-wizdi-royal/90 transition-all font-medium"
              >
                <IconPlus className="w-5 h-5" />
                <span>הצע פרומפט</span>
              </button>
            </div>
          </div>

          {/* Search Bar - Prominent */}
          <div className="relative mb-4">
            <IconSearch className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש פרומפט לפי שם, תיאור או קטגוריה..."
              className="w-full pr-12 pl-4 py-3.5 bg-gradient-to-r from-slate-50 to-blue-50/50 border-2 border-slate-200 rounded-2xl focus:border-wizdi-royal focus:ring-4 focus:ring-wizdi-royal/10 outline-none transition-all text-lg placeholder:text-slate-400"
            />
          </div>

          {/* Category Quick Filters - Prominent placement */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                !selectedCategory
                  ? 'bg-gradient-to-r from-wizdi-royal to-blue-600 text-white shadow-md'
                  : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-wizdi-royal hover:text-wizdi-royal hover:bg-blue-50/50'
              }`}
            >
              הכל
            </button>
            {PROMPT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-wizdi-royal to-blue-600 text-white shadow-md'
                    : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-wizdi-royal hover:text-wizdi-royal hover:bg-blue-50/50'
                }`}
              >
                <span className={getCategoryColor(cat.id, selectedCategory === cat.id)}>
                  {getCategoryIcon(cat.id)}
                </span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Filter Controls Row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            {/* Subcategory Filter (only if category selected and not a special category) */}
            {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
              <div className="relative">
                <select
                  value={selectedSubcategory || ''}
                  onChange={(e) => setSelectedSubcategory(e.target.value || null)}
                  className="appearance-none px-4 py-2 pr-4 pl-9 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-800 font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none transition-all cursor-pointer text-sm"
                >
                  <option value="">כל תתי-הקטגוריות</option>
                  {selectedCategoryData.subcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <IconFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 pointer-events-none" />
              </div>
            )}

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none px-4 py-2 pr-4 pl-9 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-700 font-medium focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all cursor-pointer text-sm"
              >
                <option value="newest">החדשים</option>
                <option value="rating">הכי מדורגים</option>
                <option value="popular">הפופולריים</option>
              </select>
              <IconSortDescending className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all border border-red-200"
              >
                <IconX className="w-4 h-4" />
                <span>נקה הכל</span>
              </button>
            )}

            {/* Results count - inline */}
            <div className="mr-auto text-sm text-slate-500 font-medium">
              {loading ? 'טוען...' : `${filteredPrompts.length} פרומפטים`}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Admin Seeder - only shown to admins */}
        <AdminPromptSeeder isAdmin={isAdmin} />

        {/* Popular Section Header - when popular category is selected */}
        {isPopularCategory && (
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <IconTrophy className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                  <IconFlame className="w-5 h-5" />
                  העשירייה הפופולרית
                </h2>
                <p className="text-sm text-orange-600">
                  הפרומפטים הכי פופולריים במאגר
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Featured Prompt - hide when any category is selected */}
        {featuredPrompt && !selectedCategory && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <IconSparkles className="w-5 h-5 text-wizdi-gold" />
              <h2 className="text-lg font-bold text-slate-800">פרומפט השבוע</h2>
            </div>
            <PromptCard prompt={featuredPrompt} featured onRatingChange={refreshData} />
          </div>
        )}

        {/* Prompts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-6 bg-slate-200 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="h-20 bg-slate-100 rounded mb-4"></div>
                <div className="h-32 bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <IconSearch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">לא נמצאו פרומפטים</h3>
            <p className="text-slate-500 mb-6">נסה לשנות את הסינון או החיפוש</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-wizdi-royal text-white rounded-xl hover:bg-wizdi-royal/90 transition-all"
            >
              נקה סינון
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPrompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onRatingChange={refreshData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <SubmitPromptModal
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handlePromptSubmitted}
        />
      )}
    </div>
  );
}
