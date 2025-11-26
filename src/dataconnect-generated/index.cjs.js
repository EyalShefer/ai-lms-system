const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'ai-lms-system',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const createNewUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewUser', inputVars);
}
createNewUserRef.operationName = 'CreateNewUser';
exports.createNewUserRef = createNewUserRef;

exports.createNewUser = function createNewUser(dcOrVars, vars) {
  return executeMutation(createNewUserRef(dcOrVars, vars));
};

const getCoursesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCourses');
}
getCoursesRef.operationName = 'GetCourses';
exports.getCoursesRef = getCoursesRef;

exports.getCourses = function getCourses(dc) {
  return executeQuery(getCoursesRef(dc));
};

const enrollUserInCourseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'EnrollUserInCourse', inputVars);
}
enrollUserInCourseRef.operationName = 'EnrollUserInCourse';
exports.enrollUserInCourseRef = enrollUserInCourseRef;

exports.enrollUserInCourse = function enrollUserInCourse(dcOrVars, vars) {
  return executeMutation(enrollUserInCourseRef(dcOrVars, vars));
};

const getMyEnrollmentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyEnrollments');
}
getMyEnrollmentsRef.operationName = 'GetMyEnrollments';
exports.getMyEnrollmentsRef = getMyEnrollmentsRef;

exports.getMyEnrollments = function getMyEnrollments(dc) {
  return executeQuery(getMyEnrollmentsRef(dc));
};
