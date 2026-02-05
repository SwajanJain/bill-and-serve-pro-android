import Database from 'better-sqlite3';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, existsSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import cron from 'node-cron';
import { createHash } from 'crypto';
import { sqlite } from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BACKUP_DIR = process.env.BACKUP_DIR || resolve(__dirname, '../../backups');
const USB_BACKUP_DIR = process.env.USB_BACKUP_DIR || '/media/usb/pos-backups';
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  checksum: string;
  createdAt: Date;
  metadataPath: string;
}

let backupLock = false;

// Ensure backup directory exists
function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function computeFileChecksum(path: string): string {
  const file = readFileSync(path);
  return createHash('sha256').update(file).digest('hex');
}

function writeBackupMetadata(backup: BackupInfo): void {
  const metadata = {
    filename: backup.filename,
    checksum: backup.checksum,
    size: backup.size,
    createdAt: backup.createdAt.toISOString(),
  };
  writeFileSync(backup.metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

// Create a backup
export async function createBackup(): Promise<BackupInfo> {
  ensureBackupDir();
  if (backupLock) {
    throw new Error('Backup/restore operation already in progress');
  }
  backupLock = true;

  try {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const filename = `restaurant_backup_${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, filename);
    const metadataPath = `${backupPath}.json`;

    await sqlite.backup(backupPath);
    const stats = statSync(backupPath);
    const checksum = computeFileChecksum(backupPath);
    const backup: BackupInfo = {
      filename,
      path: backupPath,
      size: stats.size,
      checksum,
      createdAt: new Date(),
      metadataPath,
    };
    writeBackupMetadata(backup);

    // Try to copy to USB if available
    if (existsSync(USB_BACKUP_DIR)) {
      try {
        const usbPath = join(USB_BACKUP_DIR, filename);
        copyFileSync(backupPath, usbPath);
        copyFileSync(metadataPath, `${usbPath}.json`);
        console.log(`📀 USB backup created: ${usbPath}`);
      } catch (error) {
        console.warn('⚠️  Failed to create USB backup:', error);
      }
    }

    // Cleanup old backups
    cleanupOldBackups();

    return backup;
  } finally {
    backupLock = false;
  }
}

// List available backups
export function listBackups(): BackupInfo[] {
  ensureBackupDir();

  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('restaurant_backup_') && f.endsWith('.db'))
    .map(filename => {
      const path = join(BACKUP_DIR, filename);
      const stats = statSync(path);
      const metadataPath = `${path}.json`;
      let checksum = '';
      if (existsSync(metadataPath)) {
        try {
          const metadataRaw = JSON.parse(readFileSync(metadataPath, 'utf-8')) as { checksum?: string };
          checksum = metadataRaw.checksum || '';
        } catch {
          checksum = '';
        }
      }
      if (!checksum) {
        checksum = computeFileChecksum(path);
      }
      return {
        filename,
        path,
        size: stats.size,
        checksum,
        createdAt: stats.mtime,
        metadataPath,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return files;
}

// Restore from a backup
export async function restoreFromBackup(filename: string): Promise<void> {
  if (filename.includes('..') || filename.includes('/')) {
    throw new Error('Invalid backup filename');
  }

  if (backupLock) {
    throw new Error('Backup/restore operation already in progress');
  }
  backupLock = true;

  const backupPath = join(BACKUP_DIR, filename);

  if (!existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }

  try {
    // Create a backup of current database before restore
    const preRestoreFilename = `pre_restore_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.db`;
    const preRestorePath = join(BACKUP_DIR, preRestoreFilename);
    await sqlite.backup(preRestorePath);
    const preRestoreInfo: BackupInfo = {
      filename: preRestoreFilename,
      path: preRestorePath,
      size: statSync(preRestorePath).size,
      checksum: computeFileChecksum(preRestorePath),
      createdAt: new Date(),
      metadataPath: `${preRestorePath}.json`,
    };
    writeBackupMetadata(preRestoreInfo);

    // Restore via SQLite backup API for WAL-safe consistency
    const source = new Database(backupPath, { readonly: true });
    try {
      await source.backup(DB_PATH);
    } finally {
      source.close();
    }

    sqlite.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    backupLock = false;
  }
}

// Cleanup old backups
function cleanupOldBackups(): void {
  const backups = listBackups();

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      try {
        unlinkSync(backup.path);
        console.log(`🗑️  Deleted old backup: ${backup.filename}`);
      } catch (error) {
        console.warn(`⚠️  Failed to delete backup: ${backup.filename}`);
      }
    }
  }
}

// Schedule automatic backups
export function scheduleBackups(): void {
  // Backup every 4 hours
  cron.schedule('0 */4 * * *', () => {
    console.log('⏰ Running scheduled backup...');
    createBackup()
      .then((backup) => {
        console.log(`✅ Scheduled backup created: ${backup.filename} (${(backup.size / 1024 / 1024).toFixed(2)} MB)`);
      })
      .catch((error) => {
        console.error('❌ Scheduled backup failed:', error);
      });
  });

  // Daily backup at 2 AM
  cron.schedule('0 2 * * *', () => {
    console.log('🌙 Running daily backup...');
    createBackup()
      .then((backup) => {
        console.log(`✅ Daily backup created: ${backup.filename}`);
      })
      .catch((error) => {
        console.error('❌ Daily backup failed:', error);
      });
  });

  console.log('📅 Backup scheduler initialized (every 4 hours + daily at 2 AM)');
}
