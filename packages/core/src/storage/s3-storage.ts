/**
 * S3 Storage utilities for images and overlays
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface S3StorageConfig {
  bucketName: string;
  region?: string;
}

export class S3Storage {
  private client: S3Client;
  private bucketName: string;

  constructor(config: S3StorageConfig) {
    this.bucketName = config.bucketName;
    this.client = new S3Client({
      region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
    });
  }

  /**
   * Upload image buffer to S3 and return the key
   */
  async uploadImage(
    buffer: Buffer,
    contentType: string,
    prefix = 'images'
  ): Promise<string> {
    const key = `${prefix}/${Date.now()}-${randomUUID()}.jpg`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return key;
  }

  /**
   * Get presigned URL for an object
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Get public URL for an object (if bucket is public)
   */
  getPublicUrl(key: string): string {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }
}
