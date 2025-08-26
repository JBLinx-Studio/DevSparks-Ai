import { App } from "app";

/**
 * Handles file operations
 * @tweakable maxFileSizeKB - Maximum file size in KB
 */
export class FileManager {
    constructor(app) {
        this.app = app;
        /* @tweakable */ this.maxFileSizeKB = 500;
    }

    async addFile(filename) {
        if (!filename.trim()) {
            throw new Error("File name cannot be empty");
        }

        const content = '';
        const fileExtension = filename.split('.').pop();
        const isMediaFile = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'webp', 'ico', 'avif'].includes(fileExtension);

        if (isMediaFile) {
            this.app.addConsoleMessage('info', `Adding new media file: ${filename}`);
        } else {
            this.app.addConsoleMessage('info', `Adding new file: ${filename}`);
        }

        this.app.currentFiles[filename] = content;
        this.app.currentFile = filename;
        await this.app.saveCurrentProject();
        this.app.renderFileTree();
        this.app.updateCodeEditor();

        this.app.addMessage('assistant', `Added new file: ${filename}`);
        this.app.showTemporaryFeedback(`File '${filename}' added.`, 'success');
    }

    async uploadFile(file) {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = false;

        input.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                this.app.addConsoleMessage('info', 'File upload cancelled.');
                return;
            }

            let filename = file.name;
            const fileExtension = filename.split('.').pop();
            const isMediaFile = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'webp', 'ico', 'avif'].includes(fileExtension);

            if (this.app.currentFiles[filename]) {
                const newName = await this.app.showCustomPrompt(
                    'File Exists',
                    `A file named '${filename}' already exists. Enter a new name or cancel to replace (this will overwrite the existing file):`,
                    filename
                );
                if (newName === null) {
                    this.app.addConsoleMessage('info', 'File upload cancelled due to existing filename.');
                    return;
                }
                filename = newName.trim();
                if (filename === '') {
                    this.app.showTemporaryFeedback('Filename cannot be empty.', 'warn');
                    this.app.addConsoleMessage('warn', 'File upload cancelled due to empty new filename.');
                    return;
                }
            }

            this.app.addConsoleMessage('info', `Uploading file: ${filename}...`);
            this.app.showTemporaryFeedback(`Uploading '${filename}'...`, 'info');

            const isExternalUrl = typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'));
            const isLargeForLocalStorage = typeof file === 'string' && file.length > this.maxFileSizeKB * 1024;

            if (isExternalUrl) {
                this.app.currentFiles[filename] = file;
                this.app.currentFile = filename;
                await this.app.saveCurrentProject();
                this.app.renderFileTree();
                this.app.updateCodeEditor();
                this.app.addMessage('assistant', `Uploaded and added file: ${filename}`);
                this.app.showTemporaryFeedback(`File '${filename}' uploaded and added to project.`, 'success');
            } else if (isLargeForLocalStorage && !this.app.puterEnabled) {
                this.app.currentFiles[filename] = null;
                this.app.currentFile = filename;
                await this.app.saveCurrentProject();
                this.app.renderFileTree();
                this.app.updateCodeEditor();
                this.app.addConsoleMessage('warn', `File "${filename}" (size: ${file.length} chars) is too large for local storage and Puter.AI is not connected. Its content will not be saved locally and might appear empty when loading this project later without re-syncing from GitHub.`);
                this.app.showTemporaryFeedback('File is too large for local storage and Puter.AI is not connected.', 'warn');
            } else {
                try {
                    const fileContent = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsText(file);
                    });
                    this.app.currentFiles[filename] = fileContent;
                    this.app.currentFile = filename;
                    await this.app.saveCurrentProject();
                    this.app.renderFileTree();
                    this.app.updateCodeEditor();
                    this.app.addMessage('assistant', `Uploaded and added file: ${filename}`);
                    this.app.showTemporaryFeedback(`File '${filename}' uploaded and added to project.`, 'success');
                } catch (error) {
                    this.app.addConsoleMessage('error', `Failed to upload file ${filename}: ${error.message}`);
                    this.app.showTemporaryFeedback(`Failed to upload '${filename}': ${error.message}`, 'error');
                    console.error('File upload/read error:', error);
                }
            }
        });

        input.click();
    }

    getMimeType(filename) {
        if (filename.endsWith('.html')) return 'text/html';
        if (filename.endsWith('.css')) return 'text/css';
        if (filename.endsWith('.js')) return 'application/javascript';
        if (filename.endsWith('.json')) return 'application/json';
        if (filename.endsWith('.md')) return 'text/markdown';
        if (filename.endsWith('.txt')) return 'text/plain';
        if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.gif') || filename.endsWith('.svg') || filename.endsWith('.mp4') || filename.endsWith('.webm') || filename.endsWith('.ogg') || filename.endsWith('.mov') || filename.endsWith('.webp') || filename.endsWith('.ico') || filename.endsWith('.avif')) return 'application/octet-stream';
        return 'text/plain';
    }
}