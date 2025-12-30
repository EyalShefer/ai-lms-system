import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a student's audio response to Firebase Storage.
 * @param blob The audio blob to upload
 * @param userId The ID of the student (or 'guest' if not auth)
 * @param assignmentId Context ID for strict organization
 */
export const uploadStudentAudio = async (
    blob: Blob,
    userId: string,
    assignmentId: string
): Promise<string> => {

    // 1. Cost Control Validation
    const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
    if (blob.size > MAX_SIZE_BYTES) {
        throw new Error(`File size too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). Max allowed is 3MB.`);
    }

    // 2. Path Construction
    const filename = `${uuidv4()}.webm`;
    const storagePath = `student_uploads/${userId}/assignments/${assignmentId}/audio/${filename}`;
    const storageRef = ref(storage, storagePath);

    // 3. Upload
    try {
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Audio Upload Failed:", error);
        throw new Error("Failed to upload audio recording.");
    }
};
