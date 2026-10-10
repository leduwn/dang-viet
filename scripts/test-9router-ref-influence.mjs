import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.AI_IMAGE_BASE_URL || 'https://9router.duwn.id.vn/v1').replace(/\/+$/, '');
const API_KEY = process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || '';
const MODEL = process.env.AI_IMAGE_MODEL || 'ag/gemini-3.1-flash-image';

// Test with real PNG image from repository
async function testRealImageVision() {
  const filePath = path.resolve('screenshots/visualizer-2d/2d-fabric-silk.png');
  console.log(`\n=== REAL IMAGE VISION TEST: ${filePath} ===`);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const buf = fs.readFileSync(filePath);
  const dataUri = `data:image/png;base64,${buf.toString('base64')}`;

  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Mô tả thật ngắn gọn và chính xác: Bức ảnh này vẽ cái gì? Màu sắc chủ đạo của trang phục là gì? Có chữ gì trên ảnh không?',
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
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('HTTP Status:', res.status, res.statusText);
  if (res.ok) {
    const json = await res.json();
    console.log('Gemini Vision text response:');
    console.log(json.choices?.[0]?.message?.content);
  } else {
    console.error('Error:', await res.text());
  }
}

async function sendChatImageQuery(label, imageBuf, mime, textPrompt) {
  console.log(`\n=== Running Test: ${label} ===`);
  const dataUri = `data:${mime};base64,${imageBuf.toString('base64')}`;

  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: textPrompt,
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
  };

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const duration = Date.now() - startTime;
  console.log(`HTTP ${res.status} ${res.statusText} (${duration}ms)`);

  if (!res.ok) {
    console.error('Error body:', await res.text());
    return null;
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';
  console.log('Response content length:', content.length);

  const match = content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/);
  if (match) {
    const imgBuf = Buffer.from(match[1], 'base64');
    console.log(`Extracted image buffer: ${imgBuf.length} bytes`);
    return { imgBuf, text: content.replace(match[0], '[IMAGE_DATA]') };
  } else {
    console.log('No image extracted. Text preview:', content.slice(0, 300));
    return { imgBuf: null, text: content };
  }
}

async function testRealImageToAodaiIllustration() {
  const filePath = path.resolve('screenshots/visualizer-2d/2d-fabric-silk.png');
  console.log(`\n=== REAL IMAGE REFERENCE TO 2D AODAI TEST: ${filePath} ===`);
  const buf = fs.readFileSync(filePath);
  const dataUri = `data:image/png;base64,${buf.toString('base64')}`;

  const promptText = `Bạn là họa sĩ minh họa thời trang Áo dài Việt Nam 2D.
Dưới đây là ảnh chân dung người mẫu tham chiếu.
Nhiệm vụ: Vẽ một bức tranh minh họa thời trang 2D TOÀN THÂN (full-body fashion illustration) của người phụ nữ trong ảnh tham chiếu đang mặc Áo dài truyền thống Việt Nam.
YÊU CẦU BẮT BUỘC:
1. KHUÔN MẶT: Giữ các đặc điểm nhận dạng khuôn mặt, nét mặt, nụ cười và kiểu tóc từ ảnh tham chiếu sang phong cách minh họa 2D thanh lịch.
2. TRANG PHỤC: Áo dài lụa màu đỏ ruby tươi sáng, quần lụa bóng màu vàng hoàng yến, cổ cao truyền thống 3cm, tay dài raglan duyên dáng, 2 tà áo xẻ cao từ eo, dài thướt tha chạm mu bàn chân.
3. BỐ CỤC: Minh họa toàn thân đứng thẳng từ đầu tới chân, không cắt đầu hay chân, phong cách runway fashion lookbook 2D thanh lịch.
4. XUẤT RA: Vẽ và xuất ra bức ảnh hoàn chỉnh.`;

  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText,
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
  };

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const duration = Date.now() - startTime;
  console.log(`HTTP ${res.status} ${res.statusText} (${duration}ms)`);

  if (!res.ok) {
    console.error('Error body:', await res.text());
    return;
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';
  console.log('Response content length:', content.length);

  const match = content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/);
  if (match) {
    const imgBuf = Buffer.from(match[1], 'base64');
    fs.mkdirSync('./temp', { recursive: true });
    const outPath = './temp/test-face-to-aodai.jpg';
    fs.writeFileSync(outPath, imgBuf);
    console.log(`SUCCESS! Generated image saved to ${outPath} (${imgBuf.length} bytes)`);
    return imgBuf;
  } else {
    console.log('No image extracted. Text preview:', content.slice(0, 500));
    return null;
  }
}

async function runInfluenceTests() {
  await testRealImageVision();
  const generatedImg = await testRealImageToAodaiIllustration();

  if (generatedImg) {
    console.log('\n=== TESTING CONVERSATIONAL EDITING OF THE GENERATED IMAGE ===');
    const editDataUri = `data:image/jpeg;base64,${generatedImg.toString('base64')}`;
    const editPayload = {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Dựa trên bức ảnh áo dài 2D vừa tạo ở lượt trước, hãy giữ nguyên người phụ nữ, khuôn mặt và vóc dáng, nhưng đổi màu áo dài từ đỏ sang màu xanh ngọc bích (emerald green) và thêm hoa sen thêu tay nhỏ ở ngực áo.',
            },
            {
              type: 'image_url',
              image_url: {
                url: editDataUri,
              },
            },
          ],
        },
      ],
    };

    const editStartTime = Date.now();
    const editRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(editPayload),
    });

    console.log(`Edit HTTP ${editRes.status} ${editRes.statusText} (${Date.now() - editStartTime}ms)`);
    if (editRes.ok) {
      const editJson = await editRes.json();
      const editContent = editJson.choices?.[0]?.message?.content || '';
      const editMatch = editContent.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/);
      if (editMatch) {
        const editBuf = Buffer.from(editMatch[1], 'base64');
        const editOutPath = './temp/test-face-to-aodai-edited-green.jpg';
        fs.writeFileSync(editOutPath, editBuf);
        console.log(`SUCCESS! Edited image saved to ${editOutPath} (${editBuf.length} bytes)`);
      } else {
        console.log('No edit image returned. Content:', editContent.slice(0, 300));
      }
    }
  }
}

runInfluenceTests().catch(console.error);
