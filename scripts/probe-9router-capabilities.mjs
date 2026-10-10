import fs from 'node:fs';
import path from 'node:path';

// Read config from .env
const envFile = fs.readFileSync('.env', 'utf-8');
let apiKey = '';
let baseUrl = 'https://9router.duwn.id.vn/v1';
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k === 'AI_API_KEY' || k === 'AI_IMAGE_API_KEY') {
    apiKey = v.join('=').trim();
  }
  if (k === 'AI_BASE_URL' || k === 'AI_IMAGE_BASE_URL') {
    baseUrl = v.join('=').trim();
  }
}

console.log('--- 9ROUTER LIVE CAPABILITY PROBE ---');
console.log('Base URL:', baseUrl);
console.log('API Key present:', Boolean(apiKey));

const model = 'ag/gemini-3.1-flash-image';

// Small 1x1 test JPEG
const tinyJpegB64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function testModels() {
  console.log('\n[1] Testing GET /models...');
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log('Status:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      const modelIds = (data.data || []).map((m) => m.id);
      console.log('Total models:', modelIds.length);
      const matches = modelIds.filter((id) => id.includes('gemini') || id.includes('image'));
      console.log('Matching models:', matches);
    } else {
      console.log('Error body:', await res.text());
    }
  } catch (err) {
    console.error('Error fetching /models:', err.message);
  }
}

async function testImagesGenerationsTextOnly() {
  console.log('\n[2] Testing POST /images/generations (text only)...');
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: 'A simple red apple on white background',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testImagesGenerationsWithImageRef() {
  console.log('\n[3] Testing POST /images/generations with image parameter...');
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: 'Turn this apple blue',
        image: `data:image/jpeg;base64,${tinyJpegB64}`,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testImagesEditsJson() {
  console.log('\n[4] Testing POST /images/edits (JSON)...');
  try {
    const res = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: 'Change dress to red',
        image: `data:image/jpeg;base64,${tinyJpegB64}`,
        response_format: 'b64_json',
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testImagesEditsMultipart() {
  console.log('\n[5] Testing POST /images/edits (multipart/form-data)...');
  try {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const imageBuf = Buffer.from(tinyJpegB64, 'base64');

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nMake dress red\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="input.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ];

    const bodyBuf = Buffer.concat([
      Buffer.from(bodyParts[0]),
      Buffer.from(bodyParts[1]),
      Buffer.from(bodyParts[2]),
      imageBuf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${apiKey}`,
      },
      body: bodyBuf,
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testChatCompletionsWithImage() {
  console.log('\n[6] Testing POST /chat/completions with image_url and model:', model);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Generate an illustration of a woman wearing an Ao Dai matching this face.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${tinyJpegB64}`,
                },
              },
            ],
          },
        ],
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 500));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  await testModels();
  await testImagesGenerationsTextOnly();
  await testImagesGenerationsWithImageRef();
  await testImagesEditsJson();
  await testImagesEditsMultipart();
  await testChatCompletionsWithImage();
}

main().catch(console.error);
