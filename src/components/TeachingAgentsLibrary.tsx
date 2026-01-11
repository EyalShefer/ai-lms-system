// TeachingAgentsLibrary.tsx - Teaching Agents Discovery & Management
import React, { useState, useMemo } from 'react';
import {
  IconArrowRight,
  IconSearch,
  IconSparkles,
  IconStar,
  IconUsers,
  IconFilter,
  IconPlus,
  IconMessageCircle,
  IconBrain,
  IconSchool,
  IconBooks,
  IconChevronDown
} from '@tabler/icons-react';
import {
  TeachingAgent,
  MOCK_AGENTS,
  AGENT_CATEGORIES,
  CAPABILITY_LABELS,
  SUBJECT_LABELS,
  AgentCategory
} from '../types/teachingAgent';
import { Timestamp } from 'firebase/firestore';

interface TeachingAgentsLibraryProps {
  onBack?: () => void;
  onSelectAgent?: (agent: TeachingAgent) => void;
}

// Convert mock data to full TeachingAgent with timestamps
const getAgentsWithTimestamps = (): TeachingAgent[] => {
  return MOCK_AGENTS.map(agent => ({
    ...agent,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }));
};

const TeachingAgentsLibrary: React.FC<TeachingAgentsLibraryProps> = ({ onBack, onSelectAgent }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');

  const agents = useMemo(() => getAgentsWithTimestamps(), []);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.topics.some(t => t.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory) {
      const category = AGENT_CATEGORIES.find(c => c.id === selectedCategory);
      if (category) {
        result = result.filter(agent => category.subjects.includes(agent.subject));
      }
    }

    // Grade filter
    if (selectedGrade) {
      result = result.filter(agent => agent.gradeRange.includes(selectedGrade as any));
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'rating':
        result.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'newest':
        result.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        break;
    }

    return result;
  }, [agents, searchQuery, selectedCategory, selectedGrade, sortBy]);

  // Featured agents (first 2 with isFeatured)
  const featuredAgents = useMemo(() =>
    agents.filter(a => a.isFeatured).slice(0, 2),
    [agents]
  );

  const handleAgentClick = (agent: TeachingAgent) => {
    if (onSelectAgent) {
      onSelectAgent(agent);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wizdi-cloud via-white to-blue-50" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Back & Title */}
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  aria-label="חזרה"
                >
                  <IconArrowRight className="w-6 h-6 text-slate-600" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-wizdi-royal flex items-center gap-2">
                  <IconBrain className="w-7 h-7" />
                  סוכני הוראה
                </h1>
                <p className="text-slate-500 text-sm">עוזרי AI מותאמים לנושאים ספציפיים</p>
              </div>
            </div>

            {/* Create Agent Button */}
            <button
              className="btn-lip-action flex items-center gap-2 px-4 py-2.5"
              onClick={() => alert('יצירת סוכן חדש - בקרוב!')}
            >
              <IconPlus className="w-5 h-5" />
              <span className="hidden sm:inline">צור סוכן</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Featured Agents Section */}
        {featuredAgents.length > 0 && !searchQuery && !selectedCategory && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-wizdi-royal mb-4 flex items-center gap-2">
              <IconSparkles className="w-5 h-5 text-wizdi-gold" />
              סוכנים מומלצים
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredAgents.map(agent => (
                <FeaturedAgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => handleAgentClick(agent)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="חפש סוכן לפי נושא, מקצוע או תיאור..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-wizdi-cyan focus:border-transparent transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  !selectedCategory
                    ? 'bg-wizdi-royal text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                הכל
              </button>
              {AGENT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1 ${
                    selectedCategory === cat.id
                      ? 'bg-wizdi-royal text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
            {/* Grade Filter */}
            <div className="relative">
              <select
                value={selectedGrade || ''}
                onChange={(e) => setSelectedGrade(e.target.value || null)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-10 text-slate-700 focus:ring-2 focus:ring-wizdi-cyan focus:border-transparent"
              >
                <option value="">כל הכיתות</option>
                <option value="ה">כיתה ה'</option>
                <option value="ו">כיתה ו'</option>
                <option value="ז">כיתה ז'</option>
                <option value="ח">כיתה ח'</option>
                <option value="ט">כיתה ט'</option>
                <option value="י">כיתה י'</option>
                <option value="יא">כיתה י"א</option>
                <option value="יב">כיתה י"ב</option>
              </select>
              <IconChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-10 text-slate-700 focus:ring-2 focus:ring-wizdi-cyan focus:border-transparent"
              >
                <option value="popular">הכי פופולרי</option>
                <option value="rating">דירוג גבוה</option>
                <option value="newest">חדש ביותר</option>
              </select>
              <IconChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => handleAgentClick(agent)}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <IconBrain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">לא נמצאו סוכנים</h3>
            <p className="text-slate-500">נסה לשנות את החיפוש או הסינון</p>
          </div>
        )}

        {/* Coming Soon Banner */}
        <div className="mt-8 bg-gradient-to-l from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">בקרוב: שתף את הסוכנים שלך!</h3>
              <p className="opacity-90">
                בנית סוכן מדהים? בקרוב תוכל לשתף אותו עם מורים אחרים ולקבל פידבק.
              </p>
            </div>
            <IconSchool className="w-16 h-16 opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Featured Agent Card - Larger, more prominent
const FeaturedAgentCard: React.FC<{ agent: TeachingAgent; onClick: () => void }> = ({ agent, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group text-right w-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-gold"
    >
      <div className="flex items-start gap-4">
        <div className="text-5xl">{agent.avatar}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <IconSparkles className="w-4 h-4 text-wizdi-gold" />
            <span className="text-xs font-medium opacity-80">מומלץ</span>
          </div>
          <h3 className="text-xl font-bold mb-2">{agent.name}</h3>
          <p className="text-sm opacity-90 mb-3 line-clamp-2">{agent.description}</p>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <IconStar className="w-4 h-4 fill-wizdi-gold text-wizdi-gold" />
              <span>{agent.averageRating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 opacity-80">
              <IconUsers className="w-4 h-4" />
              <span>{agent.usageCount} שימושים</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-2">
        {agent.topics.slice(0, 3).map((topic, i) => (
          <span
            key={i}
            className="px-2 py-1 bg-white/20 rounded-lg text-xs"
          >
            {topic}
          </span>
        ))}
        {agent.topics.length > 3 && (
          <span className="px-2 py-1 bg-white/10 rounded-lg text-xs">
            +{agent.topics.length - 3}
          </span>
        )}
      </div>
    </button>
  );
};

// Regular Agent Card
const AgentCard: React.FC<{ agent: TeachingAgent; onClick: () => void }> = ({ agent, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group text-right w-full card-glass rounded-2xl p-5 hover:shadow-lg transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan border border-slate-200 hover:border-wizdi-royal/30"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="text-4xl p-2 bg-slate-100 rounded-xl group-hover:bg-wizdi-royal/10 transition-colors">
          {agent.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-wizdi-royal truncate">{agent.name}</h3>
          <p className="text-sm text-slate-500">
            {SUBJECT_LABELS[agent.subject]} | כיתות {agent.gradeRange[0]}'-{agent.gradeRange[agent.gradeRange.length - 1]}'
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{agent.description}</p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-4">
        {agent.capabilities.slice(0, 3).map((cap, i) => (
          <span
            key={i}
            className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs"
          >
            {CAPABILITY_LABELS[cap]}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <IconStar className="w-4 h-4 fill-wizdi-gold text-wizdi-gold" />
            <span className="font-medium text-slate-700">{agent.averageRating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <IconUsers className="w-4 h-4" />
            <span>{agent.usageCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-wizdi-royal font-medium text-sm group-hover:gap-2 transition-all">
          <span>התחל שיחה</span>
          <IconMessageCircle className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
};

export default TeachingAgentsLibrary;
