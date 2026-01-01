import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECT_DATA_PATH = path.join(PROJECT_ROOT, 'project_data.json');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'project_brain_backup');

// Load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const KEY_FILE_PATH = path.join(PROJECT_ROOT, 'service-account-key.json');

interface ModuleData {
    id: string;
    name: string;
    version: string;
    last_updated: string;
    status: string;
    dependencies: string[];
    summary: string;
}

interface ProjectData {
    project_name: string;
    last_global_update: string;
    modules: Record<string, ModuleData>;
}

// --- Tools ---

function loadProjectData(): ProjectData {
    if (!fs.existsSync(PROJECT_DATA_PATH)) {
        throw new Error(`Project data file not found at ${PROJECT_DATA_PATH}`);
    }
    const raw = fs.readFileSync(PROJECT_DATA_PATH, 'utf-8');
    return JSON.parse(raw);
}

function saveProjectData(data: ProjectData) {
    fs.writeFileSync(PROJECT_DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`Updated project_data.json`);
}

/**
 * Authenticate with Google Drive
 */
async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
}

/**
 * Update the registry for a specific module.
 */
export function updateRegistry(moduleName: string, changeSummary: string) {
    const data = loadProjectData();
    const moduleId = `module_${moduleName.toLowerCase().replace(/\s+/g, '_')}`;

    const now = new Date().toISOString();

    if (!data.modules[moduleId]) {
        // Create new entry
        data.modules[moduleId] = {
            id: moduleId,
            name: moduleName,
            version: "1.0.0",
            last_updated: now,
            status: "Active",
            dependencies: [],
            summary: changeSummary
        };
        console.log(`Created new module entry: ${moduleName}`);
    } else {
        // Update existing
        const mod = data.modules[moduleId];
        // Simple version bump logic: Patch update for now
        const [major, minor, patch] = mod.version.split('.').map(Number);
        mod.version = `${major}.${minor}.${patch + 1}`;
        mod.last_updated = now;
        mod.summary = changeSummary;
        console.log(`Updated module entry: ${moduleName} to version ${mod.version}`);
    }

    data.last_global_update = now;
    saveProjectData(data);
}

/**
 * Backup a file to Google Drive (and local mirror).
 */
export async function backupToDrive(filePath: string) {
    // 1. Local Backup (Mirror)
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR);
    }
    const fileName = path.basename(filePath);
    const localDestPath = path.join(BACKUP_DIR, fileName);
    fs.copyFileSync(filePath, localDestPath);
    console.log(`[Local] Backed up ${fileName} to ${BACKUP_DIR}`);

    // 2. Cloud Backup (Google Drive)
    const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID;
    if (!folderId) {
        console.warn("[Cloud] GDRIVE_BACKUP_FOLDER_ID not found in .env. Skipping Cloud upload.");
        return localDestPath;
    }

    if (!fs.existsSync(KEY_FILE_PATH)) {
        console.warn("[Cloud] service-account-key.json not found. Skipping Cloud upload.");
        return localDestPath;
    }

    try {
        const drive = await getDriveClient();

        // Search for existing file
        const res = await drive.files.list({
            q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
        });

        const existingFile = res.data.files?.[0];

        const fileMetadata = {
            name: fileName,
            parents: existingFile ? undefined : [folderId],
        };

        const media = {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(filePath),
        };

        let fileId = '';
        if (existingFile) {
            // Update existing
            console.log(`[Cloud] Updating existing file: ${fileName} (${existingFile.id})...`);
            const updateRes = await drive.files.update({
                fileId: existingFile.id!,
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });
            fileId = updateRes.data.id!;
            console.log(`[Cloud] Update Successful. ID: ${fileId}`);
        } else {
            // Create new
            console.log(`[Cloud] Uploading new file: ${fileName}...`);
            const createRes = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });
            fileId = createRes.data.id!;
            console.log(`[Cloud] Upload Successful. ID: ${fileId}`);
        }

    } catch (error: any) {
        // Soft fail - do not stop the process if cloud fails
        console.warn("\n[Cloud] ⚠️  Google Drive Sync Skipped/Failed (Permissions/Network).");
        console.warn(`[Cloud] Error Details: ${error.message || error}`);
        console.warn("[Cloud] Continuing with Local Backup only.\n");
    }
}

// --- CLI Entry Point (for manual testing) ---
// Usage: ts-node scripts/project_brain_guardian.ts <moduleName> <summary> <filePath>

// Check if file is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
    (async () => {
        const args = process.argv.slice(2);
        if (args.length < 3) {
            console.log("Usage: ts-node project_brain_guardian.ts <moduleName> <summary> <filePathToBackup>");
            process.exit(1);
        }

        const [modName, summary, fileToBackup] = args;

        try {
            updateRegistry(modName, summary);
            await backupToDrive(fileToBackup);
            // Also always backup the registry itself
            await backupToDrive(PROJECT_DATA_PATH);
        } catch (error) {
            console.error("Guardian Error:", error);
        }
    })();
}
