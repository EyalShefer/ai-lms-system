/**
 * Interactive Chat Block
 * Placeholder - actual implementation should be extracted from CoursePlayer
 */
import { memo } from 'react';

interface InteractiveChatBlockProps {
  block: any;
  context: {
    topic: string;
    step: number;
  };
  readOnly?: boolean;
  answer?: any;
  onAnswerChange?: (answer: any) => void;
}

const InteractiveChatBlock = memo(function InteractiveChatBlock(props: InteractiveChatBlockProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-bold mb-4">💬 צ'אט אינטראקטיבי</h3>
      <p className="text-gray-600">
        קומפוננטת צ'אט - יש להעתיק את הקוד מ-CoursePlayer
      </p>
    </div>
  );
});

export default InteractiveChatBlock;
