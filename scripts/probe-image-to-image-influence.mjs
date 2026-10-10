import fs from 'node:fs';
import { PNG } from 'pngjs';

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

const model = 'ag/gemini-3.1-flash-image';

// Distinct 100x100 test image: Magenta background with Cyan circle
const png = new PNG({ width: 100, height: 100 });
for (let y = 0; y < 100; y++) {
  for (let x = 0; x < 100; x++) {
    const idx = (100 * y + x) << 2;
    const dx = x - 50;
    const dy = y - 50;
    if (dx * dx + dy * dy < 400) {
      png.data[idx] = 0;       // R
      png.data[idx + 1] = 255; // G (Cyan)
      png.data[idx + 2] = 255; // B
      png.data[idx + 3] = 255;
    } else {
      png.data[idx] = 255;     // R (Magenta)
      png.data[idx + 1] = 0;   // G
      png.data[idx + 2] = 255; // B
      png.data[idx + 3] = 255;
    }
  }
}
const pngBuffer = PNG.sync.write(png);
const pngB64 = pngBuffer.toString('base64');
const dataUri = `data:image/png;base64,${pngB64}`;

console.log('--- TEST 1: POST /images/generations with { image: dataUri } ---');
async function testGenerations() {
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: 'Modify the attached image: add text "VERIFIED" right inside the center cyan circle on magenta background',
      image: dataUri,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });
  console.log('POST /images/generations status:', res.status);
  const json = await res.json().catch(() => null);
  if (json?.data?.[0]?.b64_json) {
    const buf = Buffer.from(json.data[0].b64_json, 'base64');
    fs.writeFileSync('test-gen-out.jpg', buf);
    console.log('Saved test-gen-out.jpg, size:', buf.length);
  } else {
    console.log('Error/Response:', json);
  }
}

console.log('\n--- TEST 2: POST /chat/completions with image_url ---');
async function testChatCompletions() {
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
            {
              type: 'text',
              text: 'Look at the provided image (which has a cyan circle on magenta background). Generate an illustration of a woman wearing an Ao Dai with the exact same color scheme: magenta tunic bodice and bright cyan lotus in center. Output only the image.',
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
  console.log('POST /chat/completions status:', res.status);
  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content || '';
  console.log('Content preview:', content.slice(0, 200));
  const match = content.match(/data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)/);
  if (match) {
    const buf = Buffer.from(match[1], 'base64');
    fs.writeFileSync('test-chat-out.jpg', buf);
    console.log('Saved test-chat-out.jpg, size:', buf.length);
  } else {
    console.log('No image data uri found in content');
  }
}

async function run() {
  await testGenerations();
  await testChatCompletions();
}
run().catch(console.error);
