export const BACKUP_IMPORT_CHUNK_BYTES = 512 * 1024;
export const BACKUP_IMPORT_MAX_BYTES = 256 * 1024 * 1024;

export const BACKUP_IMPORT_ACTION_HEADER = "x-go-nav-backup-action";
export const BACKUP_IMPORT_UPLOAD_ID_HEADER = "x-go-nav-backup-upload-id";
export const BACKUP_IMPORT_CHUNK_INDEX_HEADER = "x-go-nav-backup-chunk-index";
export const BACKUP_IMPORT_CHUNK_COUNT_HEADER = "x-go-nav-backup-chunk-count";
export const BACKUP_IMPORT_FILE_SIZE_HEADER = "x-go-nav-backup-file-size";

export type BackupImportAction = "chunk" | "complete";
