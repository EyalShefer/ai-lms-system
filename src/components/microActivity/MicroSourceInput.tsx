import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  IconCloudUpload,
  IconSparkles,
  IconLoader2,
  IconBook,
  IconBrain,
  IconCheck
} from '@tabler/icons-react';
import type { MicroActivityType, MicroActivitySource } from '../../shared/types/microActivityTypes';
import { getMicroActivityTypeInfo } from '../../shared/types/microActivityTypes';

// Grade levels
const GRADES = [
  "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
  "כיתה ז׳", "כיתה ח׳", "כיתה ט׳",
  "כיתה י׳", "כיתה י״א", "כיתה י״ב"
];

const SUBJECTS = [
  "חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה",
  "היסטוריה", "אזרחות", "תנ״ך", "ספרות", "גיאוגרפיה",
  "פיזיקה", "כימיה", "ביולוגיה", "מדעי המחשב", "אחר"
];

// Theme colors for cards
const THEMES: Record<string, any> = {
  blue: {
    active: "border-blue-500 bg-blue-50 ring-blue-200",
    hover: "hover:border-blue-400",
    iconActive: "bg-blue-100 text-blue-600",
    iconHover: "group-hover:bg-blue-50 group-hover:text-blue-600",
    check: "text-blue-500"
  },
  green: {
    active: "border-green-500 bg-green-50 ring-green-200",
    hover: "hover:border-green-400",
    iconActive: "bg-green-100 text-green-600",
    iconHover: "group-hover:bg-green-50 group-hover:text-green-600",
    check: "text-green-500"
  },
  purple: {
    active: "border-purple-500 bg-purple-50 ring-purple-200",
    hover: "hover:border-purple-400",
    iconActive: "bg-purple-100 text-purple-600",
    iconHover: "group-hover:bg-purple-50 group-hover:text-purple-600",
    check: "text-purple-500"
  }
};

// Source Card Component (matching IngestionWizard style)
const SourceCard = ({ label, icon: Icon, color, isActive, onClick, children, disabled, ...props }: any) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div
      {...props}
      onClick={disabled ? undefined : onClick}
      className={`
        group relative p-6 rounded-2xl border transition-all duration-200 overflow-hidden
        flex flex-col items-center text-center gap-4 h-full
        ${disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : isActive
            ? `${theme.active} shadow-md ring-1 cursor-pointer`
            : `border-slate-200 bg-white ${theme.hover} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
        }
      `}
    >
      <div className={`
        w-16 h-16 rounded-full flex items-center justify-center transition-transform ${disabled ? '' : 'group-hover:scale-110'}
        ${isActive ? theme.iconActive : `bg-slate-50 text-slate-500 ${disabled ? '' : theme.iconHover}`}
      `}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <h4 className={`text-lg font-bold mb-1 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{label}</h4>
        <div className="text-sm text-slate-500">{children}</div>
      </div>
      {isActive && <div className={`absolute top-3 right-3 ${theme.check}`}><IconCheck className="w-5 h-5" /></div>}
    </div>
  );
};

interface MicroSourceInputProps {
  type: MicroActivityType;
  gradeLevel: string;
  onGradeLevelChange: (level: string) => void;
  onSubmit: (source: MicroActivitySource, subject: string) => void;
  isLoading: boolean;
}

export default function MicroSourceInput({
  type,
  gradeLevel,
  onGradeLevelChange,
  onSubmit,
  isLoading
}: MicroSourceInputProps) {
  const [mode, setMode] = useState<'upload' | 'topic' | 'text' | null>(null);
  const [topicValue, setTopicValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('חינוך לשוני (עברית)');
  const [grade, setGrade] = useState(gradeLevel ? `כיתה ${gradeLevel}׳` : GRADES[5]);
  const [isExtractingText, setIsExtractingText] = useState(false);

  const typeInfo = getMicroActivityTypeInfo(type);

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const f = acceptedFiles[0];
    setIsExtractingText(true);

    try {
      setFile(f);
      setMode('upload');
    } catch (error) {
      console.error('Error reading file:', error);
      alert('שגיאה בקריאת הקובץ');
    } finally {
      setIsExtractingText(false);
    }
  }, []);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true
  });

  // Read file content based on type
  async function readFileContent(f: File): Promise<string> {
    if (f.type === 'text/plain') {
      return await f.text();
    }
    // For PDF/DOC files, read as text - in production, use a proper extraction service
    return await f.text();
  }

  // Handle submit
  const handleSubmit = async () => {
    let source: MicroActivitySource;

    if (mode === 'topic' && topicValue.trim()) {
      source = { type: 'topic', content: topicValue.trim() };
    } else if (mode === 'text' && textValue.trim()) {
      source = { type: 'text', content: textValue.trim() };
    } else if (mode === 'upload' && file) {
      const content = await readFileContent(file);
      source = { type: 'file', content, fileName: file.name };
    } else {
      return; // No valid input
    }

    // Update grade level
    const gradeMatch = grade.match(/[א-ת]+/);
    if (gradeMatch) {
      onGradeLevelChange(gradeMatch[0]);
    }

    onSubmit(source, subject);
  };

  // Check if can submit
  const canSubmit = (
    (mode === 'topic' && topicValue.trim().length > 0) ||
    (mode === 'text' && textValue.trim().length > 0) ||
    (mode === 'upload' && file !== null)
  ) && !isLoading;

  return (
    <div className="space-y-6">
      {/* Type indicator banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl">
          {typeInfo?.icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{typeInfo?.name}</h3>
          <p className="text-sm text-slate-500">{typeInfo?.description}</p>
        </div>
      </div>

      {/* Source Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(() => {
          const dropzoneProps = getRootProps();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { ref, ...spreadProps } = dropzoneProps as any;

          return (
            <div ref={ref}>
              <SourceCard
                label="העלאת קובץ"
                icon={IconCloudUpload}
                color="blue"
                isActive={mode === 'upload'}
                {...spreadProps}
                onClick={(e: any) => {
                  e.stopPropagation();
                  open();
                }}
              >
                {file ? <span className="text-blue-600 font-bold">{file.name}</span> : "PDF, Word, TXT"}
                <input {...getInputProps()} />
              </SourceCard>
            </div>
          );
        })()}

        <SourceCard
          label="הדבקת טקסט"
          icon={IconBook}
          color="green"
          isActive={mode === 'text'}
          onClick={() => setMode('text')}
        >
          הדבקת מאמר או סיכום
        </SourceCard>

        <SourceCard
          label="לפי נושא"
          icon={IconBrain}
          color="purple"
          isActive={mode === 'topic'}
          onClick={() => setMode('topic')}
        >
          מחולל AI חופשי
        </SourceCard>
      </div>

      {/* Input area based on selection */}
      <div className="min-h-[120px]">
        {mode === 'text' && (
          <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none"
              placeholder="הדביקו כאן את הטקסט..."
              autoFocus
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className={`font-medium ${textValue.length > 15000 ? 'text-orange-600' : 'text-slate-400'}`}>
                {textValue.length.toLocaleString()} תווים
                {textValue.length > 15000 && (
                  <span className="text-orange-500 mr-2">
                    ⚠️ יחתך ל-15,000 תווים
                  </span>
                )}
              </span>
              <span className="text-slate-400">מקסימום: 15,000 תווים</span>
            </div>
          </div>
        )}

        {mode === 'topic' && (
          <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <input
              type="text"
              value={topicValue}
              onChange={(e) => setTopicValue(e.target.value)}
              className="w-full p-4 text-lg border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="על מה תרצו ליצור את הפעילות?"
              autoFocus
            />
          </div>
        )}

        {mode === 'upload' && file && (
          <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <IconCloudUpload className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => { setFile(null); setMode(null); }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                הסר
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings - Grade and Subject (like IngestionWizard Step 3, but simplified) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">תחום דעת</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white focus:ring-2 focus:ring-emerald-500"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">קהל יעד</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white focus:ring-2 focus:ring-emerald-500"
            >
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`
          w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 shadow-lg
          ${canSubmit
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl hover:scale-[1.02]'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isLoading ? (
          <>
            <IconLoader2 className="w-6 h-6 animate-spin" />
            <span>יוצר פעילות...</span>
          </>
        ) : (
          <>
            <IconSparkles className="w-6 h-6" />
            <span>צור פעילות</span>
          </>
        )}
      </button>
    </div>
  );
}
