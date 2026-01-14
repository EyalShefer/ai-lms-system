import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a generated image (AI image or infographic) to Firebase Storage.
 * @param blob The image blob to upload
 * @param type Type of image ('ai-image' or 'infographic')
 * @param courseId Optional course ID for organization
 * @param unitId Optional unit ID for organization
 * @returns Download URL of the uploaded image
 */
export const uploadGeneratedImage = async (
    blob: Blob,
    type: 'ai-image' | 'infographic',
    courseId?: string,
    unitId?: string
): Promise<string> => {
    // 1. Size validation (10MB max for images)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (blob.size > MAX_SIZE_BYTES) {
        throw new Error(`Image size too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). Max allowed is 10MB.`);
    }

    // 2. Determine file extension from mime type
    const mimeType = blob.type || 'image/png';
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';

    // 3. Path construction
    const filename = `${uuidv4()}.${extension}`;
    const folder = type === 'infographic' ? 'infographics' : 'ai_images';
    const basePath = courseId && unitId
        ? `generated_images/${folder}/${courseId}/${unitId}/${filename}`
        : `generated_images/${folder}/${filename}`;

    const storageRef = ref(storage, basePath);

    // 4. Upload
    try {
        const snapshot = await uploadBytes(storageRef, blob, {
            contentType: mimeType,
            customMetadata: {
                type,
                generatedAt: new Date().toISOString()
            }
        });
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`✅ Image uploaded to Storage: ${basePath}`);
        return downloadURL;
    } catch (error) {
        console.error("Image Upload Failed:", error);
        throw new Error("Failed to upload generated image.");
    }
};

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
