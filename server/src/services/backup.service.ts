import { copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import cron from 'node-cron';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BACKUP_DIR = process.env.BACKUP_DIR || resolve(__dirname, '../../backups');
const USB_BACKUP_DIR = process.env.USB_BACKUP_DIR || '/media/usb/pos-backups';
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

// Ensure backup directory exists
function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// Create a backup
export function createBackup(): BackupInfo {
  ensureBackupDir();

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filename = `restaurant_backup_${timestamp}.db`;
  const backupPath = join(BACKUP_DIR, filename);

  // Copy database file
  copyFileSync(DB_PATH, backupPath);

  const stats = statSync(backupPath);

  // Try to copy to USB if available
  if (existsSync(USB_BACKUP_DIR)) {
    try {
      const usbPath = join(USB_BACKUP_DIR, filename);
      copyFileSync(DB_PATH, usbPath);
      console.log(`📀 USB backup created: ${usbPath}`);
    } catch (error) {
      console.warn('⚠️  Failed to create USB backup:', error);
    }
  }

  // Cleanup old backups
  cleanupOldBackups();

  return {
    filename,
    path: backupPath,
    size: stats.size,
    createdAt: new Date(),
  };
}

// List available backups
export function listBackups(): BackupInfo[] {
  ensureBackupDir();

  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('restaurant_backup_') && f.endsWith('.db'))
    .map(filename => {
      const path = join(BACKUP_DIR, filename);
      const stats = statSync(path);
      return {
        filename,
        path,
        size: stats.size,
        createdAt: stats.mtime,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return files;
}

// Restore from a backup
export function restoreFromBackup(filename: string): void {
  const backupPath = join(BACKUP_DIR, filename);

  if (!existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }

  // Create a backup of current database before restore
  const preRestoreFilename = `pre_restore_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.db`;
  const preRestorePath = join(BACKUP_DIR, preRestoreFilename);
  copyFileSync(DB_PATH, preRestorePath);

  // Restore
  copyFileSync(backupPath, DB_PATH);
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
    try {
      const backup = createBackup();
      console.log(`✅ Scheduled backup created: ${backup.filename} (${(backup.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.error('❌ Scheduled backup failed:', error);
    }
  });

  // Daily backup at 2 AM
  cron.schedule('0 2 * * *', () => {
    console.log('🌙 Running daily backup...');
    try {
      const backup = createBackup();
      console.log(`✅ Daily backup created: ${backup.filename}`);
    } catch (error) {
      console.error('❌ Daily backup failed:', error);
    }
  });

  console.log('📅 Backup scheduler initialized (every 4 hours + daily at 2 AM)');
}
