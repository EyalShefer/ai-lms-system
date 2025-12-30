
const BASE_URL = 'https://classroom.googleapis.com/v1';

export interface ClassroomCourse {
    id: string;
    name: string;
    section?: string;
    descriptionHeading?: string;
    alternateLink: string;
    courseState: string;
}

export interface ClassroomAssignment {
    title: string;
    description: string;
    workType: 'ASSIGNMENT';
    state: 'PUBLISHED' | 'DRAFT';
    maxPoints: number;
    materials?: Array<{
        link: {
            url: string;
            title: string;
        }
    }>;
}

export const googleClassroomService = {
    /**
     * Lists all active courses for the teacher
     */
    async listCourses(accessToken: string): Promise<ClassroomCourse[]> {
        const response = await fetch(`${BASE_URL}/courses?courseStates=ACTIVE`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to list courses: ${response.statusText}`);
        }

        const data = await response.json();
        return data.courses || [];
    },

    /**
     * Creates a new assignment in a specific course
     */
    async createAssignment(accessToken: string, courseId: string, assignment: ClassroomAssignment) {
        const response = await fetch(`${BASE_URL}/courses/${courseId}/courseWork`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignment)
        });

        if (!response.ok) {
            throw new Error(`Failed to create assignment: ${response.statusText}`);
        }

        return await response.json();
    },

    /**
     * Lists all submissions for a specific assignment
     */
    async listSubmissions(accessToken: string, courseId: string, courseWorkId: string) {
        const response = await fetch(`${BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to list submissions: ${response.statusText}`);
        }

        const data = await response.json();
        return data.studentSubmissions || [];
    },

    /**
     * Updates a student's grade
     */
    async patchGrade(accessToken: string, courseId: string, courseWorkId: string, submissionId: string, grade: number) {
        const response = await fetch(
            `${BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}?updateMask=assignedGrade,draftGrade`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assignedGrade: grade,
                    draftGrade: grade
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update grade: ${response.statusText}`);
        }

        return await response.json();
    }
};
