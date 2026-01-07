import React, { useState, useEffect, useMemo } from 'react';
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconArrowRight,
  IconSparkles,
  IconSortDescending,
  IconX,
  IconRefresh
} from '@tabler/icons-react';
import PromptCard from './PromptCard';
import SubmitPromptModal from './SubmitPromptModal';
import type { Prompt } from '../services/promptsService';
import {
  PROMPT_CATEGORIES,
  subscribeToPrompts,
  getFeaturedPrompt,
  searchPrompts
} from '../services/promptsService';

interface PromptsLibraryProps {
  onBack: () => void;
}

type SortOption = 'newest' | 'rating' | 'popular';

export default function PromptsLibrary({ onBack }: PromptsLibraryProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
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

    return () => unsubscribe();
  }, []);

  // Filter and sort prompts
  const filteredPrompts = useMemo(() => {
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

    // Filter by category
    if (selectedCategory) {
      const category = PROMPT_CATEGORIES.find(c => c.id === selectedCategory);
      if (category) {
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
  }, [prompts, searchTerm, selectedCategory, selectedSubcategory, sortBy, featuredPrompt]);

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
    // Subscription will handle the rest
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <p className="text-sm text-slate-500">פרומפטים מוכנים לכל צורך הוראתי</p>
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Featured Prompt */}
        {featuredPrompt && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <IconSparkles className="w-5 h-5 text-wizdi-gold" />
              <h2 className="text-lg font-bold text-slate-800">פרומפט השבוע</h2>
            </div>
            <PromptCard prompt={featuredPrompt} featured onRatingChange={refreshData} />
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש פרומפטים..."
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory || ''}
                onChange={(e) => handleCategoryChange(e.target.value || null)}
                className="appearance-none w-full lg:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all cursor-pointer"
              >
                <option value="">כל הקטגוריות</option>
                {PROMPT_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              <IconFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>

            {/* Subcategory Filter (only if category selected) */}
            {selectedCategoryData && (
              <div className="relative">
                <select
                  value={selectedSubcategory || ''}
                  onChange={(e) => setSelectedSubcategory(e.target.value || null)}
                  className="appearance-none w-full lg:w-56 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all cursor-pointer"
                >
                  <option value="">כל תתי-הקטגוריות</option>
                  {selectedCategoryData.subcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none w-full lg:w-40 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all cursor-pointer"
              >
                <option value="newest">החדשים</option>
                <option value="rating">הכי מדורגים</option>
                <option value="popular">הפופולריים</option>
              </select>
              <IconSortDescending className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-4 py-3 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <IconX className="w-4 h-4" />
                <span>נקה</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleCategoryChange(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !selectedCategory
                ? 'bg-wizdi-royal text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-wizdi-royal hover:text-wizdi-royal'
            }`}
          >
            הכל
          </button>
          {PROMPT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                selectedCategory === cat.id
                  ? 'bg-wizdi-royal text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-wizdi-royal hover:text-wizdi-royal'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-500">
          {loading ? (
            'טוען...'
          ) : (
            `נמצאו ${filteredPrompts.length} פרומפטים`
          )}
        </div>

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
