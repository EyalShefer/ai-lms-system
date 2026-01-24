import React, { useState, useEffect } from 'react';
import {
  IconCopy,
  IconStar,
  IconStarFilled,
  IconMessage,
  IconChevronDown,
  IconChevronUp,
  IconCrown,
  IconCheck,
  IconBrandOpenai,
  IconSparkles,
  IconUser
} from '@tabler/icons-react';
import type {
  Prompt,
  PromptField,
  PromptRating
} from '../services/promptsService';
import {
  fillPromptTemplate,
  trackPromptUsage,
  ratePrompt,
  getPromptRatings,
  getUserRatingForPrompt,
  isTeacherRecommended,
  COMMON_FIELD_OPTIONS
} from '../services/promptsService';
import { useAuth } from '../context/AuthContext';

interface PromptCardProps {
  prompt: Prompt;
  featured?: boolean;
  onRatingChange?: () => void;
}

export default function PromptCard({ prompt, featured = false, onRatingChange }: PromptCardProps) {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(featured); // Featured cards start expanded
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PromptRating[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isCreatorRecommended, setIsCreatorRecommended] = useState(false);
  const [showRatingInput, setShowRatingInput] = useState(false);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Initialize field values with empty strings only when prompt changes
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    // Safety check: only iterate if fields exists and is an array
    if (prompt.fields && Array.isArray(prompt.fields)) {
      prompt.fields.forEach(field => {
        initialValues[field.id] = '';
      });
    }
    setFieldValues(initialValues);
  }, [prompt.id]); // Only reset when switching to a different prompt

  // Check if creator is recommended
  useEffect(() => {
    if (prompt.createdBy) {
      isTeacherRecommended(prompt.createdBy).then(setIsCreatorRecommended);
    }
  }, [prompt.createdBy]);

  // Load user's existing rating
  useEffect(() => {
    if (currentUser?.uid) {
      getUserRatingForPrompt(prompt.id, currentUser.uid).then(rating => {
        if (rating) {
          setUserRating(rating.rating);
          setRatingComment(rating.comment || '');
        }
      });
    }
  }, [prompt.id, currentUser?.uid]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const getFilledPrompt = () => {
    return fillPromptTemplate(prompt.promptTemplate, fieldValues);
  };

  const handleCopy = async () => {
    const filledPrompt = getFilledPrompt();
    await navigator.clipboard.writeText(filledPrompt);
    setCopied(true);
    trackPromptUsage(prompt.id);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadComments = async () => {
    if (!showComments) {
      const ratings = await getPromptRatings(prompt.id);
      setComments(ratings.filter(r => r.comment)); // Only show ratings with comments
    }
    setShowComments(!showComments);
  };

  const handleRatingSubmit = async () => {
    if (!currentUser || userRating === 0) return;

    setIsSubmittingRating(true);
    try {
      await ratePrompt(
        prompt.id,
        currentUser.uid,
        currentUser.displayName || 'מורה אנונימי',
        userRating,
        ratingComment
      );
      setShowRatingInput(false);
      onRatingChange?.();
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const renderField = (field: PromptField) => {
    const baseInputClass = "w-full px-3 py-2.5 rounded-xl border-2 border-slate-200/80 bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-sm font-medium hover:border-slate-300";

    switch (field.type) {
      case 'select':
        return (
          <select
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={baseInputClass}
          >
            <option value="">{field.placeholder}</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
            min={1}
          />
        );
      default:
        return (
          <input
            type="text"
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isFilled = interactive ? i <= (hoverRating || userRating) : i <= rating;
      stars.push(
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && setUserRating(i)}
          onMouseEnter={() => interactive && setHoverRating(i)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          {isFilled ? (
            <IconStarFilled className="w-5 h-5 text-yellow-400" />
          ) : (
            <IconStar className="w-5 h-5 text-slate-300" />
          )}
        </button>
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const commentsWithText = comments.filter(c => c.comment);

  // Collapsed compact view for non-featured cards - AI-Native Bento Style
  if (!isExpanded && !featured) {
    return (
      <div
        className="bento-card bento-static bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-slate-200/60 hover:border-violet-300/60 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        onClick={() => setIsExpanded(true)}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="p-5">
          {/* Top row - Category and Stats */}
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1.5 bg-gradient-to-br from-violet-100 to-cyan-100 rounded-xl text-xs font-semibold text-violet-700 border border-violet-200/50">
              {prompt.category}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {renderStars(prompt.averageRating)}
                <span className="text-xs text-slate-500 font-medium">({prompt.averageRating.toFixed(1)})</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">{prompt.usageCount} שימושים</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-violet-700 transition-colors">{prompt.title}</h3>

          {/* Creator */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <IconUser className="w-3 h-3 text-slate-600" />
            </div>
            <span className="font-medium">{prompt.creatorName || 'מערכת Wizdi'}</span>
            {isCreatorRecommended && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg border border-amber-200/50">
                <IconCrown className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
          </div>

          {/* Description - truncated */}
          <p className="text-sm text-slate-500 line-clamp-2 mb-4">{prompt.description}</p>

          {/* Bottom row - Tools and Expand */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {prompt.targetTools.map(tool => (
                <span
                  key={tool}
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-600"
                >
                  {tool}
                </span>
              ))}
            </div>
            <button className="flex items-center gap-1.5 text-sm font-bold text-violet-600 group-hover:text-violet-700 transition-colors">
              <span>הרחב</span>
              <IconChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view (also used for featured cards) - AI-Native Bento Style
  return (
    <div className={`
      bento-card bento-static bg-white/95 backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 relative overflow-hidden
      ${featured
        ? 'border-amber-300/60 shadow-xl shadow-amber-500/15'
        : 'border-slate-200/60 hover:border-violet-300/60 hover:shadow-xl hover:shadow-violet-500/10'
      }
    `}>
      {/* Top gradient line */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        featured
          ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400'
          : 'bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400'
      }`}></div>
      {/* Header - AI-Native Style */}
      <div className={`${featured ? 'p-4 pt-5' : 'p-5 pt-6'} border-b border-slate-100/80`}>
        {/* Featured: Compact horizontal layout */}
        {featured ? (
          <div className="flex items-start gap-4">
            {/* Left side - Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-200/50 shadow-sm shadow-amber-200/20">
                  <IconSparkles className="w-3.5 h-3.5" />
                  פרומפט השבוע
                </span>
                <span className="px-2.5 py-1 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl text-xs font-medium text-slate-600 border border-slate-200/50">
                  {prompt.category}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">{prompt.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{prompt.description}</p>
            </div>
            {/* Right side - Stats */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                {renderStars(prompt.averageRating)}
                <span className="text-xs text-slate-500 font-medium">({prompt.averageRating.toFixed(1)})</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">{prompt.usageCount} שימושים</span>
            </div>
          </div>
        ) : (
          <>
            {/* Collapse button for expanded non-featured cards */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Rating */}
                <div className="flex items-center gap-1.5">
                  {renderStars(prompt.averageRating)}
                  <span className="text-sm text-slate-600 font-medium mr-1">
                    ({prompt.averageRating.toFixed(1)})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">{prompt.usageCount} שימושים</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all font-medium"
                >
                  <span>צמצם</span>
                  <IconChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category tag */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1.5 bg-gradient-to-br from-violet-100 to-cyan-100 rounded-xl text-xs font-semibold text-violet-700 border border-violet-200/50">
                {prompt.category} &gt; {prompt.subcategory}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-black text-slate-800 mb-1.5">{prompt.title}</h3>

            {/* Creator */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                <IconUser className="w-3 h-3 text-slate-600" />
              </div>
              <span className="font-medium">מאת: {prompt.creatorName || 'מערכת Wizdi'}</span>
              {isCreatorRecommended && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg border border-amber-200/50">
                  <IconCrown className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700">מורה מומלץ</span>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-slate-500 mt-3">{prompt.description}</p>

            {/* Target tools */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs text-slate-400 font-medium">מתאים ל:</span>
              <div className="flex gap-2">
                {prompt.targetTools.map(tool => (
                  <span
                    key={tool}
                    className="px-2.5 py-1 bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-600"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dynamic Fields - AI-Native Style */}
      {prompt.fields && Array.isArray(prompt.fields) && prompt.fields.length > 0 && (
        <div className={`${featured ? 'p-4' : 'p-5'} bg-gradient-to-br from-slate-50/80 to-violet-50/30`}>
          <div className={`grid ${featured ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            {prompt.fields.map(field => (
              <div key={field.id} className={!featured && field.type === 'text' && !field.options ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-rose-400 mr-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview - AI-Native Dark Style */}
      <div className={`${featured ? 'p-4' : 'p-5'} border-t border-slate-100/80`}>
        <div className={`bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl ${featured ? 'p-4 max-h-28' : 'p-5 max-h-44'} text-white text-sm font-mono leading-relaxed overflow-y-auto border border-slate-700/50 shadow-inner`}>
          <pre className="whitespace-pre-wrap text-right" dir="rtl">
            {getFilledPrompt()}
          </pre>
        </div>

        {/* Tips - AI-Native Style, hidden in featured mode */}
        {!featured && prompt.tips && (
          <div className="mt-4 p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200/60">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <IconSparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm text-cyan-800 font-medium">
                <strong className="text-cyan-900">טיפ:</strong> {prompt.tips}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions - AI-Native Style */}
      <div className={`${featured ? 'p-4' : 'p-5'} border-t border-slate-100/80 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border-2
              ${copied
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/25'
                : 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-white/20 hover:shadow-lg hover:shadow-violet-500/25'
              }
            `}
          >
            {copied ? (
              <>
                <IconCheck className="w-5 h-5" />
                <span>הועתק!</span>
              </>
            ) : (
              <>
                <IconCopy className="w-5 h-5" />
                <span>העתק פרומפט</span>
              </>
            )}
          </button>

          {/* Rate button */}
          <button
            onClick={() => setShowRatingInput(!showRatingInput)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all font-medium border-2 border-transparent hover:border-amber-200/50"
          >
            <IconStar className="w-5 h-5" />
            <span className="text-sm">דרגו</span>
          </button>

          {/* Comments toggle */}
          <button
            onClick={handleLoadComments}
            className="flex items-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all font-medium border-2 border-transparent hover:border-violet-200/50"
          >
            <IconMessage className="w-5 h-5" />
            <span className="text-sm">{prompt.ratingCount} תגובות</span>
            {showComments ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Rating Input - AI-Native Style */}
      {showRatingInput && (
        <div className="px-5 pb-5 border-t border-slate-100/80 pt-5 bg-gradient-to-br from-amber-50/50 to-yellow-50/30">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">הדירוג שלך:</span>
              {renderStars(userRating, true)}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="הוסיפו תגובה (אופציונלי)..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200/80 bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-sm resize-none font-medium placeholder:text-slate-400"
              rows={2}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRatingInput(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                ביטול
              </button>
              <button
                onClick={handleRatingSubmit}
                disabled={userRating === 0 || isSubmittingRating}
                className="px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
              >
                {isSubmittingRating ? 'שולח...' : 'שלח דירוג'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section - AI-Native Style */}
      {showComments && (
        <div className="px-5 pb-5 border-t border-slate-100/80 pt-5">
          {commentsWithText.length === 0 ? (
            <div className="text-center py-6 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mx-auto mb-3">
                <IconMessage className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                אין תגובות עדיין. היו הראשונים לדרג ולהגיב!
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {commentsWithText.map((rating) => (
                <div key={rating.id} className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center">
                        <IconUser className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{rating.userName}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <IconStarFilled
                          key={i}
                          className={`w-3.5 h-3.5 ${i < rating.rating ? 'text-amber-400' : 'text-slate-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{rating.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
