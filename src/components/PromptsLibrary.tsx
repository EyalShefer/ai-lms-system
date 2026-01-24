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
        // Sort by createdAt descending (newest first)
        result.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-cyan-50/20" dir="rtl">
      {/* AI Particles Background */}
      <div className="ai-particles opacity-20 fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="ai-particle"></div>
        <div className="ai-particle"></div>
        <div className="ai-particle"></div>
      </div>

      {/* Header Section - Consistent with Bento Design */}
      <div className="sticky top-0 z-40 bg-gradient-to-br from-slate-50 via-violet-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 pt-4">
          {/* Hero Banner Card */}
          <div className="relative overflow-hidden rounded-3xl mb-4 p-6 bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 shadow-xl shadow-violet-500/20">
            {/* Decorative elements */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-48 h-48 bg-white/30 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-cyan-300/40 rounded-full blur-2xl"></div>
            </div>

            <div className="relative flex items-center justify-between">
              {/* Right side - Back button and title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                >
                  <IconArrowRight className="w-6 h-6 text-white" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg flex-shrink-0">
                    <IconSparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">מאגר פרומפטים AI</h1>
                    <p className="text-sm text-white/80 mt-0.5">מגוון פרומפטים מוכנים לצורכי ההוראה</p>
                  </div>
                </div>
              </div>

              {/* Left side - Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={refreshData}
                  className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white border border-white/20"
                  title="רענן"
                >
                  <IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-violet-600 rounded-xl hover:shadow-lg hover:shadow-white/25 transition-all font-bold"
                >
                  <IconPlus className="w-5 h-5" />
                  <span>הציעו פרומפט</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filters Card - Bento Style */}
          <div className="bento-card bento-static bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg shadow-slate-200/20 p-4">

          {/* Search Bar - AI-Native Style */}
          <div className="relative mb-5">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-cyan-100 flex items-center justify-center">
              <IconSearch className="w-5 h-5 text-violet-500" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפשו פרומפט לפי שם, תיאור או קטגוריה..."
              className="w-full pr-16 pl-4 py-4 bg-white border-2 border-slate-200/80 rounded-2xl focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-lg placeholder:text-slate-400 shadow-sm hover:shadow-md hover:border-slate-300"
            />
          </div>

          {/* Category Quick Filters - AI-Native Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                !selectedCategory
                  ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50 hover:shadow-md'
              }`}
            >
              הכל
            </button>
            {PROMPT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50 hover:shadow-md'
                }`}
              >
                <span className={getCategoryColor(cat.id, selectedCategory === cat.id)}>
                  {getCategoryIcon(cat.id)}
                </span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Filter Controls Row - AI-Native Design */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200/50">
            {/* Subcategory Filter (only if category selected and not a special category) */}
            {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
              <div className="relative group">
                <select
                  value={selectedSubcategory || ''}
                  onChange={(e) => setSelectedSubcategory(e.target.value || null)}
                  className="appearance-none px-4 py-2.5 pr-4 pl-10 bg-gradient-to-br from-violet-50 to-cyan-50 border-2 border-violet-200/60 rounded-xl text-violet-700 font-semibold focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all cursor-pointer text-sm hover:shadow-md hover:border-violet-300"
                >
                  <option value="">כל תתי-הקטגוריות</option>
                  {selectedCategoryData.subcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center pointer-events-none">
                  <IconFilter className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            )}

            {/* Sort - AI-Native Style */}
            <div className="relative group">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none px-4 py-2.5 pr-4 pl-10 bg-white border-2 border-slate-200/80 rounded-xl text-slate-700 font-semibold focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all cursor-pointer text-sm hover:shadow-md hover:border-slate-300"
              >
                <option value="newest">החדשים</option>
                <option value="rating">הכי מדורגים</option>
                <option value="popular">הפופולריים</option>
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center pointer-events-none">
                <IconSortDescending className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Clear Filters - AI-Native */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 bg-gradient-to-br from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 rounded-xl transition-all border-2 border-rose-200/60 hover:border-rose-300 hover:shadow-md"
              >
                <IconX className="w-4 h-4" />
                <span>נקה הכל</span>
              </button>
            )}

            {/* Results count - AI styled */}
            <div className="mr-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200/60">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 animate-pulse"></div>
              <span className="text-sm text-slate-600 font-semibold">
                {loading ? 'טוען...' : `${filteredPrompts.length} פרומפטים`}
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Popular Section Header - AI-Native Bento Style */}
        {isPopularCategory && (
          <div className="mb-6 relative overflow-hidden">
            <div className="bento-card bento-static p-5 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-2 border-orange-200/60 rounded-2xl">
              {/* Decorative gradient line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400"></div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-400/30">
                    <IconTrophy className="w-7 h-7 text-white" />
                  </div>
                  {/* Glow effect */}
                  <div className="absolute inset-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-400 blur-xl opacity-40 -z-10"></div>
                </div>
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">העשירייה הפופולרית</span>
                    <IconFlame className="w-5 h-5 text-orange-500 animate-pulse" />
                  </h2>
                  <p className="text-sm text-orange-600/80 font-medium">
                    הפרומפטים הכי מועתקים ומשומשים במאגר
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Featured Prompt - AI-Native Bento Style */}
        {featuredPrompt && !selectedCategory && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
                <IconSparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 bg-clip-text text-transparent">פרומפט השבוע</h2>
                <p className="text-xs text-slate-500 font-medium">נבחר במיוחד עבורכם</p>
              </div>
            </div>
            <PromptCard prompt={featuredPrompt} featured onRatingChange={refreshData} />
          </div>
        )}

        {/* Prompts Grid - AI-Native Loading & Empty States */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bento-card bento-static bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 overflow-hidden">
                {/* Shimmer gradient line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-300 via-cyan-300 to-violet-300 animate-pulse"></div>

                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-6 bg-gradient-to-br from-violet-200 to-cyan-200 rounded-lg animate-pulse"></div>
                  <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-24 animate-pulse"></div>
                </div>
                <div className="h-6 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-3/4 mb-3 animate-pulse"></div>
                <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg w-1/2 mb-4 animate-pulse"></div>
                <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl mb-4 animate-pulse"></div>
                <div className="h-28 bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="bento-card bento-static text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 opacity-60"></div>

            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-5">
              <IconSearch className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-black text-slate-700 mb-2">לא נמצאו פרומפטים</h3>
            <p className="text-slate-500 mb-6 font-medium">נסו לשנות את הסינון או החיפוש</p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all border border-white/20"
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
