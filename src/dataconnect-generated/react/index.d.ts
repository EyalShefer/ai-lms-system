import { CreateNewUserData, CreateNewUserVariables, GetCoursesData, EnrollUserInCourseData, EnrollUserInCourseVariables, GetMyEnrollmentsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateNewUser(options?: useDataConnectMutationOptions<CreateNewUserData, FirebaseError, CreateNewUserVariables>): UseDataConnectMutationResult<CreateNewUserData, CreateNewUserVariables>;
export function useCreateNewUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewUserData, FirebaseError, CreateNewUserVariables>): UseDataConnectMutationResult<CreateNewUserData, CreateNewUserVariables>;

export function useGetCourses(options?: useDataConnectQueryOptions<GetCoursesData>): UseDataConnectQueryResult<GetCoursesData, undefined>;
export function useGetCourses(dc: DataConnect, options?: useDataConnectQueryOptions<GetCoursesData>): UseDataConnectQueryResult<GetCoursesData, undefined>;

export function useEnrollUserInCourse(options?: useDataConnectMutationOptions<EnrollUserInCourseData, FirebaseError, EnrollUserInCourseVariables>): UseDataConnectMutationResult<EnrollUserInCourseData, EnrollUserInCourseVariables>;
export function useEnrollUserInCourse(dc: DataConnect, options?: useDataConnectMutationOptions<EnrollUserInCourseData, FirebaseError, EnrollUserInCourseVariables>): UseDataConnectMutationResult<EnrollUserInCourseData, EnrollUserInCourseVariables>;

export function useGetMyEnrollments(options?: useDataConnectQueryOptions<GetMyEnrollmentsData>): UseDataConnectQueryResult<GetMyEnrollmentsData, undefined>;
export function useGetMyEnrollments(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyEnrollmentsData>): UseDataConnectQueryResult<GetMyEnrollmentsData, undefined>;
