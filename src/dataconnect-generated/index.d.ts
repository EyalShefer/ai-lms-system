import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface CreateNewUserData {
  user_insert: User_Key;
}

export interface CreateNewUserVariables {
  displayName: string;
  email: string;
}

export interface EnrollUserInCourseData {
  enrollment_insert: Enrollment_Key;
}

export interface EnrollUserInCourseVariables {
  courseId: UUIDString;
}

export interface Enrollment_Key {
  userId: UUIDString;
  courseId: UUIDString;
  __typename?: 'Enrollment_Key';
}

export interface GetCoursesData {
  courses: ({
    id: UUIDString;
    title: string;
    description: string;
    imageUrl?: string | null;
  } & Course_Key)[];
}

export interface GetMyEnrollmentsData {
  enrollments: ({
    course: {
      id: UUIDString;
      title: string;
      description: string;
    } & Course_Key;
      enrollmentDate: TimestampString;
      status: string;
  })[];
}

export interface Lesson_Key {
  id: UUIDString;
  __typename?: 'Lesson_Key';
}

export interface Recommendation_Key {
  userId: UUIDString;
  courseId: UUIDString;
  __typename?: 'Recommendation_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateNewUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewUserVariables): MutationRef<CreateNewUserData, CreateNewUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNewUserVariables): MutationRef<CreateNewUserData, CreateNewUserVariables>;
  operationName: string;
}
export const createNewUserRef: CreateNewUserRef;

export function createNewUser(vars: CreateNewUserVariables): MutationPromise<CreateNewUserData, CreateNewUserVariables>;
export function createNewUser(dc: DataConnect, vars: CreateNewUserVariables): MutationPromise<CreateNewUserData, CreateNewUserVariables>;

interface GetCoursesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCoursesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCoursesData, undefined>;
  operationName: string;
}
export const getCoursesRef: GetCoursesRef;

export function getCourses(): QueryPromise<GetCoursesData, undefined>;
export function getCourses(dc: DataConnect): QueryPromise<GetCoursesData, undefined>;

interface EnrollUserInCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: EnrollUserInCourseVariables): MutationRef<EnrollUserInCourseData, EnrollUserInCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: EnrollUserInCourseVariables): MutationRef<EnrollUserInCourseData, EnrollUserInCourseVariables>;
  operationName: string;
}
export const enrollUserInCourseRef: EnrollUserInCourseRef;

export function enrollUserInCourse(vars: EnrollUserInCourseVariables): MutationPromise<EnrollUserInCourseData, EnrollUserInCourseVariables>;
export function enrollUserInCourse(dc: DataConnect, vars: EnrollUserInCourseVariables): MutationPromise<EnrollUserInCourseData, EnrollUserInCourseVariables>;

interface GetMyEnrollmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyEnrollmentsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyEnrollmentsData, undefined>;
  operationName: string;
}
export const getMyEnrollmentsRef: GetMyEnrollmentsRef;

export function getMyEnrollments(): QueryPromise<GetMyEnrollmentsData, undefined>;
export function getMyEnrollments(dc: DataConnect): QueryPromise<GetMyEnrollmentsData, undefined>;

