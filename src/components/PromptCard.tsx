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
  IconSparkles
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
    prompt.fields.forEach(field => {
      initialValues[field.id] = '';
    });
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
    const baseInputClass = "w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all text-sm";

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

  return (
    <div className={`
      bg-white rounded-2xl border transition-all duration-300
      ${featured
        ? 'border-2 border-wizdi-gold shadow-md shadow-wizdi-gold/10'
        : 'border-slate-200 hover:border-wizdi-royal/30 hover:shadow-lg'
      }
    `}>
      {/* Header */}
      <div className={`${featured ? 'p-3' : 'p-4'} border-b border-slate-100`}>
        {/* Featured: Compact horizontal layout */}
        {featured ? (
          <div className="flex items-start gap-4">
            {/* Left side - Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-wizdi-gold/20 text-wizdi-gold rounded-full text-xs font-medium flex items-center gap-1">
                  <IconSparkles className="w-3 h-3" />
                  פרומפט השבוע
                </span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-500">
                  {prompt.category}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-0.5">{prompt.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{prompt.description}</p>
            </div>
            {/* Right side - Stats */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1">
                {renderStars(prompt.averageRating)}
                <span className="text-xs text-slate-500">({prompt.averageRating.toFixed(1)})</span>
              </div>
              <span className="text-xs text-slate-400">{prompt.usageCount} שימושים</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Rating */}
                <div className="flex items-center gap-1">
                  {renderStars(prompt.averageRating)}
                  <span className="text-sm text-slate-600 mr-1">
                    ({prompt.averageRating.toFixed(1)})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{prompt.usageCount} שימושים</span>
              </div>
            </div>

            {/* Category tag */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">
                {prompt.category} &gt; {prompt.subcategory}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-slate-800 mb-1">{prompt.title}</h3>

            {/* Creator */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>מאת: {prompt.creatorName || 'מערכת Wizdi'}</span>
              {isCreatorRecommended && (
                <span className="flex items-center gap-1 text-wizdi-gold">
                  <IconCrown className="w-4 h-4" />
                  <span className="text-xs">מורה מומלץ</span>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-slate-500 mt-2">{prompt.description}</p>

            {/* Target tools */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-400">מתאים ל:</span>
              <div className="flex gap-1">
                {prompt.targetTools.map(tool => (
                  <span
                    key={tool}
                    className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dynamic Fields */}
      <div className={`${featured ? 'p-3' : 'p-4'} bg-slate-50/50`}>
        <div className={`grid ${featured ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          {prompt.fields.map(field => (
            <div key={field.id} className={!featured && field.type === 'text' && !field.options ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 mr-1">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className={`${featured ? 'p-3' : 'p-4'} border-t border-slate-100`}>
        <div className={`bg-slate-800 rounded-xl ${featured ? 'p-3 max-h-24' : 'p-4 max-h-40'} text-white text-sm font-mono leading-relaxed overflow-y-auto`}>
          <pre className="whitespace-pre-wrap text-right" dir="rtl">
            {getFilledPrompt()}
          </pre>
        </div>

        {/* Tips - hidden in featured mode */}
        {!featured && prompt.tips && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>טיפ:</strong> {prompt.tips}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`${featured ? 'p-3' : 'p-4'} border-t border-slate-100 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
              ${copied
                ? 'bg-green-500 text-white'
                : 'bg-wizdi-lime text-slate-800 hover:bg-wizdi-lime/80'
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
            className="flex items-center gap-1 px-3 py-2 text-slate-600 hover:text-wizdi-royal hover:bg-slate-100 rounded-xl transition-all"
          >
            <IconStar className="w-5 h-5" />
            <span className="text-sm">דרגו</span>
          </button>

          {/* Comments toggle */}
          <button
            onClick={handleLoadComments}
            className="flex items-center gap-1 px-3 py-2 text-slate-600 hover:text-wizdi-royal hover:bg-slate-100 rounded-xl transition-all"
          >
            <IconMessage className="w-5 h-5" />
            <span className="text-sm">{prompt.ratingCount} תגובות</span>
            {showComments ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Rating Input */}
      {showRatingInput && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4 bg-slate-50">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">הדירוג שלך:</span>
              {renderStars(userRating, true)}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="הוסף תגובה (אופציונלי)..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-wizdi-royal focus:ring-2 focus:ring-wizdi-royal/20 outline-none transition-all text-sm resize-none"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRatingInput(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                ביטול
              </button>
              <button
                onClick={handleRatingSubmit}
                disabled={userRating === 0 || isSubmittingRating}
                className="px-4 py-2 text-sm bg-wizdi-royal text-white rounded-lg hover:bg-wizdi-royal/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRating ? 'שולח...' : 'שלח דירוג'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {commentsWithText.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              אין תגובות עדיין. היו הראשונים לדרג ולהגיב!
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {commentsWithText.map((rating) => (
                <div key={rating.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{rating.userName}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <IconStarFilled
                          key={i}
                          className={`w-3 h-3 ${i < rating.rating ? 'text-yellow-400' : 'text-slate-200'}`}
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
