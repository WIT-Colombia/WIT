import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Simulate AWS S3 in-memory: no credentials, buckets or network calls.
process.env.PHOTO_STORAGE_BACKEND = 's3';
process.env.PHOTO_S3_BUCKET = 'xamuko-photo-regression-test';
process.env.AWS_REGION = 'us-east-2';
const { readPhoto, removePhoto, savePhoto } = await import('./photo-storage.js');

test('S3 backend saves, reads and removes photographs without local disk storage', async (t) => {
  const commands: unknown[] = [];
  t.mock.method(S3Client.prototype, 'send', (async (command: unknown) => {
    commands.push(command);
    if (command instanceof GetObjectCommand) {
      return { Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } };
    }
    return {};
  }) as any);

  const file = await savePhoto('business-test', Buffer.from([1, 2, 3]), 'image/png');
  assert.equal(file.path, file.storageKey);
  assert.ok(file.storageKey.startsWith('business-test/'));
  assert.ok(file.storageKey.endsWith('.png'));
  assert.deepEqual(await readPhoto(file.storageKey), Buffer.from([1, 2, 3]));
  await removePhoto(file.storageKey);

  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal((commands[0] as PutObjectCommand).input.Bucket, 'xamuko-photo-regression-test');
  assert.equal((commands[0] as PutObjectCommand).input.ServerSideEncryption, 'AES256');
  assert.ok(commands[1] instanceof GetObjectCommand);
  assert.equal((commands[1] as GetObjectCommand).input.Key, file.storageKey);
  assert.ok(commands[2] instanceof DeleteObjectCommand);
});
