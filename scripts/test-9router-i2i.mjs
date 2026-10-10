import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.AI_IMAGE_BASE_URL || 'https://9router.duwn.id.vn/v1').replace(/\/+$/, '');
const API_KEY = process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || '';
const MODEL = process.env.AI_IMAGE_MODEL || 'ag/gemini-3.1-flash-image';

console.log('Testing 9router gateway:');
console.log('BASE_URL:', BASE_URL);
console.log('MODEL:', MODEL);
console.log('API_KEY length:', API_KEY.length);

async function testModelsEndpoint() {
  console.log('\n--- Test 1: GET /v1/models ---');
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log('Status:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      const models = data.data?.map(m => m.id) || [];
      console.log('Available models count:', models.length);
      const matched = models.filter(m => m.includes('image') || m.includes('flash') || m.includes('gemini'));
      console.log('Matched image/gemini models:', matched.slice(0, 15));
    } else {
      console.log('Body:', await res.text());
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testImageGenerations() {
  console.log('\n--- Test 2: POST /v1/images/generations ---');
  try {
    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: 'Minh hoa ao dai truyen thong 2D don gian mau xanh',
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response length:', text.length);
    try {
      const json = JSON.parse(text);
      if (json.data?.[0]?.b64_json) {
        console.log('Success! Received b64_json length:', json.data[0].b64_json.length);
      } else if (json.data?.[0]?.url) {
        console.log('Success! Received url:', json.data[0].url);
      } else {
        console.log('Parsed JSON keys:', Object.keys(json), json.error || '');
      }
    } catch {
      console.log('Raw output:', text.slice(0, 300));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

function createTestPng(colorHex) {
  if (colorHex === 'red') {
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
  }
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function testChatCompletionsImageToImage() {
  console.log('\n--- Test 3: POST /v1/chat/completions with image_url (Base64 data URI) ---');
  const redPng = createTestPng('red');
  const dataUri = `data:image/png;base64,${redPng.toString('base64')}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Dua tren buc anh mau do nay, tao mot buc tranh minh hoa ao dai mau do tuong tu.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUri,
                },
              },
            ],
          },
        ],
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response length:', text.length);
    console.log('Response preview:', text.slice(0, 500));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function testImagesEdits() {
  console.log('\n--- Test 4: POST /v1/images/edits ---');
  try {
    const redPng = createTestPng('red');
    const formData = new FormData();
    const blob = new Blob([redPng], { type: 'image/png' });
    formData.append('image', blob, 'test.png');
    formData.append('prompt', 'Change to blue aodai');
    formData.append('model', MODEL);

    const res = await fetch(`${BASE_URL}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      body: formData,
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response preview:', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function run() {
  await testModelsEndpoint();
  await testImageGenerations();
  await testChatCompletionsImageToImage();
  await testImagesEdits();
}

run();
