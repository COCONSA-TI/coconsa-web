import { GoogleAIFileManager } from '@google/generative-ai/server';

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

async function test() {
  try {
    const buf = Buffer.from('hello world', 'utf8');
    const result = await fileManager.uploadFile(buf, {
      mimeType: 'text/plain',
      displayName: 'test_file',
    });
    console.log('Success:', result);
    await fileManager.deleteFile(result.file.name);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
