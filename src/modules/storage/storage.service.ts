import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  folder?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

type StorageBackend = 'blomp' | 'r2' | 's3' | 'local';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private backend: StorageBackend = 'local';
  private client: S3Client | null = null;
  private bucket: string = 'uploads';
  private publicUrl: string = '';
  private uploadsDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    const accountId = this.configService.get<string>('BLOMP_ACCOUNT_ID') || this.configService.get<string>('R2_ACCOUNT_ID') || this.configService.get<string>('S3_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('BLOMP_ACCESS_KEY_ID') || this.configService.get<string>('R2_ACCESS_KEY_ID') || this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('BLOMP_SECRET_ACCESS_KEY') || this.configService.get<string>('R2_SECRET_ACCESS_KEY') || this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('BLOMP_ENDPOINT') || this.configService.get<string>('R2_ENDPOINT') || this.configService.get<string>('S3_ENDPOINT');
    this.bucket = this.configService.get<string>('BLOMP_BUCKET_NAME') || this.configService.get<string>('R2_BUCKET_NAME') || this.configService.get<string>('S3_BUCKET_NAME', 'uploads');
    this.publicUrl = this.configService.get<string>('BLOMP_PUBLIC_URL') || this.configService.get<string>('R2_PUBLIC_URL') || this.configService.get<string>('S3_PUBLIC_URL', '');

    if (accountId && accessKeyId && secretAccessKey && endpoint) {
      if (this.configService.get<string>('BLOMP_ACCOUNT_ID')) {
        this.backend = 'blomp';
      } else if (this.configService.get<string>('R2_ACCOUNT_ID')) {
        this.backend = 'r2';
      } else {
        this.backend = 's3';
      }
      this.client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });
      this.logger.log(`Storage initialized: ${this.backend.toUpperCase()} (${endpoint}), Bucket: ${this.bucket}`);
    } else {
      this.backend = 'local';
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
      this.logger.log(`Storage initialized: local disk (${this.uploadsDir})`);
    }
  }

  private generateKey(filename: string, folder?: string): string {
    const ext = filename.split('.').pop() || '';
    const key = `${uuidv4()}.${ext}`;
    return folder ? `${folder}/${key}` : key;
  }

  private getLocalPath(key: string): string {
    return path.join(this.uploadsDir, key.replace(/\.\./g, ''));
  }

  async upload(file: Buffer | Readable, filename: string, options?: UploadOptions): Promise<{ key: string; url: string }> {
    const key = this.generateKey(filename, options?.folder);

    if (this.backend !== 'local') {
      return this.uploadToRemote(file, key, options);
    }

    return this.uploadToLocal(file, key, options);
  }

  private async uploadToRemote(file: Buffer | Readable, key: string, options?: UploadOptions): Promise<{ key: string; url: string }> {
    if (!this.client) throw new Error('Storage client not initialized');

    if (file instanceof Buffer) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        }),
      );
    } else {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        },
      });

      await upload.done();
    }

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    this.logger.debug(`File uploaded to ${this.backend} - Key: ${key}, Public URL: ${url}`);

    return { key, url };
  }

  private async uploadToLocal(file: Buffer | Readable, key: string, _options?: UploadOptions): Promise<{ key: string; url: string }> {
    const filePath = this.getLocalPath(key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let buffer: Buffer;
    if (file instanceof Buffer) {
      buffer = file;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of file) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    fs.writeFileSync(filePath, buffer);
    this.logger.debug(`File uploaded to local storage - Key: ${key}, Path: ${filePath}`);

    return { key, url: `/uploads/${key}` };
  }

  async uploadWithKey(file: Buffer, key: string, options?: Omit<UploadOptions, 'folder'>): Promise<{ key: string; url: string }> {
    if (this.backend !== 'local') {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        }),
      );

      const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
      return { key, url };
    }

    const filePath = this.getLocalPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, file);
    this.logger.debug(`File uploaded with key: ${key}`);
    return { key, url: `/uploads/${key}` };
  }

  async download(key: string): Promise<Buffer> {
    if (this.backend !== 'local') {
      const response = await this.client!.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    }

    const filePath = this.getLocalPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  async getStream(key: string): Promise<Readable> {
    if (this.backend !== 'local') {
      const response = await this.client!.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return response.Body as Readable;
    }

    const filePath = this.getLocalPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    if (this.backend !== 'local') {
      await this.client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.debug(`File deleted: ${key}`);
      return;
    }

    const filePath = this.getLocalPath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.debug(`File deleted: ${key}`);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
    this.logger.debug(`${keys.length} files deleted`);
  }

  async exists(key: string): Promise<boolean> {
    if (this.backend !== 'local') {
      try {
        await this.client!.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    return fs.existsSync(this.getLocalPath(key));
  }

  async getInfo(key: string): Promise<FileInfo | null> {
    if (this.backend !== 'local') {
      try {
        const response = await this.client!.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );

        return {
          key,
          size: response.ContentLength || 0,
          lastModified: response.LastModified || new Date(),
          contentType: response.ContentType,
        };
      } catch {
        return null;
      }
    }

    const filePath = this.getLocalPath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      key,
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  async list(prefix?: string, maxKeys = 1000): Promise<FileInfo[]> {
    if (this.backend !== 'local') {
      const response = await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        }),
      );

      return (response.Contents || []).map((obj) => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    }

    const results: FileInfo[] = [];
    const searchDir = prefix ? path.join(this.uploadsDir, prefix.replace(/\.\./g, '')) : this.uploadsDir;

    if (!fs.existsSync(searchDir)) {
      return results;
    }

    const walk = (dir: string, depth = 0) => {
      if (depth > 5) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const relativePath = path.relative(this.uploadsDir, fullPath).replace(/\\/g, '/');
          const stats = fs.statSync(fullPath);
          results.push({
            key: relativePath,
            size: stats.size,
            lastModified: stats.mtime,
          });
          if (results.length >= maxKeys) break;
        }
      }
    };

    walk(searchDir);
    return results;
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    if (this.backend !== 'local') {
      await this.client!.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${sourceKey}`,
          Key: destinationKey,
        }),
      );
      this.logger.debug(`File copied: ${sourceKey} -> ${destinationKey}`);
      return;
    }

    const sourcePath = this.getLocalPath(sourceKey);
    const destPath = this.getLocalPath(destinationKey);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(sourcePath, destPath);
    this.logger.debug(`File copied: ${sourceKey} -> ${destinationKey}`);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    this.logger.debug(`File moved: ${sourceKey} -> ${destinationKey}`);
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    if (this.backend !== 'local') {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      return getSignedUrl(this.client!, command, { expiresIn });
    }

    return `/uploads/${key}`;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.backend !== 'local') {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return getSignedUrl(this.client!, command, { expiresIn });
    }

    return `/uploads/${key}`;
  }

  getPublicUrl(key: string): string {
    if (this.backend !== 'local') {
      return this.publicUrl ? `${this.publicUrl}/${key}` : key;
    }

    return `/uploads/${key}`;
  }

  extractKeyFromUrl(url: string): string {
    if (this.backend !== 'local' && this.publicUrl && url.startsWith(this.publicUrl)) {
      return url.replace(`${this.publicUrl}/`, '');
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
    }

    if (url.startsWith('/uploads/')) {
      return url.replace('/uploads/', '');
    }

    return url;
  }

  async healthCheck(): Promise<boolean> {
    if (this.backend !== 'local') {
      try {
        await this.client!.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            MaxKeys: 1,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    return fs.existsSync(this.uploadsDir);
  }

  getBackendType(): StorageBackend {
    return this.backend;
  }
}
