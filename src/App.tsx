import CourseBuilder from './components/CourseBuilder';
import { mockCourse } from './mockData';

function App() {
  return (
    <CourseBuilder course={mockCourse} />
  );
}

export default App;
