import {
  type Look,
  getModelCapability,
  COLLAR_LABELS,
  SLEEVE_LABELS,
  FABRIC_LABELS,
  PATTERN_LABELS,
  BODY_SHAPE_LABELS,
  ACCESSORY_LABELS,
  type CollarStyle,
  type SleeveStyle,
  type Fabric,
  type Pattern,
  type BodyShape,
  type AccessoryId,
} from '@dangviet/contracts';

export interface ExportImageOptions {
  look: Look;
  canvasElement?: HTMLCanvasElement | null;
  svgElement?: SVGSVGElement | null;
  eventLabel?: string;
  styleLabel?: string;
  cameraViewLabel?: string;
  triggerDownload?: boolean;
}

/**
 * Checks whether a given canvas contains actual rendered non-transparent content
 */
export function isCanvasValid(canvas: HTMLCanvasElement): boolean {
  try {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 16;
    testCanvas.height = 16;
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
    if (!testCtx) return true;
    testCtx.drawImage(canvas, 0, 0, 16, 16);
    const imgData = testCtx.getImageData(0, 0, 16, 16);
    const data = imgData.data;
    let nonZeroAlpha = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) nonZeroAlpha++;
    }
    return nonZeroAlpha > 3;
  } catch {
    return false;
  }
}

/**
 * Draws the official Dáng Việt vector logo matching BrandLogo.tsx
 */
function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 64): void {
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 32;
  ctx.scale(scale, scale);

  // Background badge: #F5ECE9 with 8px radius
  ctx.fillStyle = '#F5ECE9';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, 32, 32, 8);
  } else {
    ctx.rect(0, 0, 32, 32);
  }
  ctx.fill();

  // Front flap (D curve): #9E2A2B
  const dPath = new Path2D('M8 5C14.5 5 21 8.5 21 16C21 23.5 14.5 27 8 27C9.8 20 9.8 12 8 5Z');
  ctx.fillStyle = '#9E2A2B';
  ctx.fill(dPath);

  // Back flap & hem (V curve): #D4A373
  const vPath = new Path2D('M15 9.5L19.2 22.5C19.7 24 20.8 24 21.3 22.5L25.5 11.5C23.8 13 22.2 14.5 20.6 17.5L18.2 10.5C17.5 9 16 9 15 9.5Z');
  ctx.fillStyle = '#D4A373';
  ctx.fill(vPath);

  // Traditional collar button: #D4A373
  ctx.fillStyle = '#D4A373';
  ctx.beginPath();
  ctx.arc(8.5, 5.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Word wrap helper for canvas text rendering
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
        if (lines.length === maxLines - 1) {
          break;
        }
      } else {
        lines.push(word);
        currentLine = '';
        if (lines.length === maxLines - 1) {
          break;
        }
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If text exceeded max lines, add ellipsis
  const coveredWords = lines.join(' ').split(' ').length;
  if (coveredWords < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + '...').width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + '...';
  }

  return lines;
}

/**
 * Exports a high-resolution (1200x1600) branded PNG image of an Ao Dai customization snapshot.
 */
export async function exportCustomizationPng(options: ExportImageOptions): Promise<string> {
  const {
    look,
    canvasElement,
    svgElement,
    eventLabel,
    styleLabel,
    cameraViewLabel,
    triggerDownload = true,
  } = options;

  // A. Freeze snapshot: deeply clone look to ensure consistency across async operations
  const snapshot: Look = JSON.parse(JSON.stringify(look));

  // Wait for fonts to load with safe timeout
  try {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      await Promise.race([
        (document as any).fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    }
  } catch {
    // Continue with system fallback fonts
  }

  const width = 1200;
  const height = 1600;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo 2D Canvas context để xuất ảnh.');
  }

  // 1. Draw elegant background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#FBF9F5');
  bgGrad.addColorStop(0.5, '#F5EFE6');
  bgGrad.addColorStop(1, '#EDE5D8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw traditional border frame
  ctx.save();
  ctx.strokeStyle = '#D8CEBE';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  ctx.strokeStyle = '#B83A24';
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.restore();

  // 3. Header: Brand Logo & Title
  const logoX = 60;
  const logoY = 60;
  const logoSize = 64;
  drawBrandLogo(ctx, logoX, logoY, logoSize);

  // Brand Name
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1E1B18';
  ctx.font = 'bold 36px "Playfair Display", "Times New Roman", serif';
  ctx.fillText('DÁNG VIỆT', logoX + logoSize + 20, logoY + 36);

  // Slogan
  ctx.fillStyle = '#7C7267';
  ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Khám phá Việt phục, tạo nên dáng riêng', logoX + logoSize + 20, logoY + 62);
  ctx.restore();

  // Determine source type: 3D vs 2D
  let is3D = false;
  let renderDrawn = false;
  let blobURL: string | null = null;

  const renderX = 80;
  const renderY = 160;
  const renderW = width - 160; // 1040px
  const renderH = 960;         // 960px

  try {
    if (canvasElement && isCanvasValid(canvasElement)) {
      // 3D Canvas rendering with aspect ratio preservation (fit)
      const sw = canvasElement.width || 1;
      const sh = canvasElement.height || 1;
      const scale = Math.min(renderW / sw, renderH / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = renderX + (renderW - dw) / 2;
      const dy = renderY + (renderH - dh) / 2;

      // Soft shadow under model
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(
        width / 2,
        renderY + renderH - 40,
        20,
        width / 2,
        renderY + renderH - 40,
        340
      );
      shadowGrad.addColorStop(0, 'rgba(30, 27, 24, 0.22)');
      shadowGrad.addColorStop(0.5, 'rgba(30, 27, 24, 0.08)');
      shadowGrad.addColorStop(1, 'rgba(30, 27, 24, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(width / 2 - 360, renderY + renderH - 70, 720, 60);
      ctx.restore();

      ctx.drawImage(canvasElement, dx, dy, dw, dh);
      renderDrawn = true;
      is3D = true;
    }

    if (!renderDrawn && svgElement) {
      // 2D SVG vector rendering fallback
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || (window as any).webkitURL || window;
      blobURL = URLObj.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Hết thời gian chờ render SVG (4s)')), 4000);
        img.onload = () => {
          clearTimeout(timer);
          const sw = img.naturalWidth || 600;
          const sh = img.naturalHeight || 800;
          const scale = Math.min(renderW / sw, renderH / sh);
          const dw = sw * scale;
          const dh = sh * scale;
          const dx = renderX + (renderW - dw) / 2;
          const dy = renderY + (renderH - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Lỗi load SVG vào Image element'));
        };
        img.src = blobURL!;
      });
      renderDrawn = true;
      is3D = false;
    }
  } finally {
    if (blobURL) {
      try {
        (window.URL || (window as any).webkitURL || window).revokeObjectURL(blobURL);
      } catch {}
    }
  }

  if (!renderDrawn) {
    throw new Error('Không thể kết xuất hình ảnh: Canvas 3D chưa sẵn sàng và không có nguồn SVG dự phòng hợp lệ.');
  }

  // Draw Technical Badge with accurate 2D/3D classification
  const cap = getModelCapability(snapshot.config.modelId || 'aodai_traditional_v2');
  let badgeText: string;
  if (is3D) {
    badgeText = cameraViewLabel
      ? `Hình minh họa 3D (${cameraViewLabel}) — ${cap.name}`
      : `Hình minh họa 3D — ${cap.name}`;
  } else {
    badgeText = 'Hình minh họa 2D — Bản vẽ Vector';
  }

  ctx.save();
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeWidth = badgeMetrics.width + 36;
  const badgeX = width - 60 - badgeWidth;
  const badgeY = logoY + 12;

  ctx.fillStyle = is3D ? 'rgba(184, 58, 36, 0.08)' : 'rgba(31, 78, 91, 0.08)';
  ctx.strokeStyle = is3D ? '#B83A24' : '#1F4E5B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, badgeWidth, 38, 19);
  } else {
    ctx.rect(badgeX, badgeY, badgeWidth, 38);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = is3D ? '#B83A24' : '#1F4E5B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 19);
  ctx.restore();

  // 5. Bottom Metadata Card
  const cardX = 60;
  const cardY = 1140;
  const cardW = width - 120;
  const cardH = 380;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#E6DFD5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.stroke();
  ctx.restore();

  // Card Content
  ctx.save();
  ctx.textBaseline = 'top';

  // Look Title with wrap protection
  ctx.fillStyle = '#1E1B18';
  ctx.font = 'bold 30px "Playfair Display", "Times New Roman", serif';
  const titleLines = wrapText(ctx, snapshot.title || 'Bản phối Áo dài Dáng Việt', cardW - 70, 1);
  ctx.fillText(titleLines[0] || 'Bản phối Áo dài Dáng Việt', cardX + 35, cardY + 28);

  // Context Tag
  const eventText = eventLabel ? `Sự kiện: ${eventLabel}` : `Sự kiện: ${snapshot.eventId}`;
  const styleText = styleLabel ? `Phong cách: ${styleLabel}` : `Phong cách: ${snapshot.styleId}`;
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#1F4E5B';
  ctx.fillText(`${eventText}  •  ${styleText}`, cardX + 35, cardY + 70);

  // Divider
  ctx.strokeStyle = '#F0EBE1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 35, cardY + 104);
  ctx.lineTo(cardX + cardW - 35, cardY + 104);
  ctx.stroke();

  // 3-Column Info Layout
  const col1X = cardX + 35;
  const col2X = cardX + 370;
  const col3X = cardX + 710;
  const infoRowY = cardY + 120;

  // Column 1: Colors
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('BẢNG MÀU PHỐI', col1X, infoRowY);

  // Primary color swatch & label
  ctx.fillStyle = snapshot.config.primaryColor.hex;
  ctx.beginPath();
  ctx.arc(col1X + 12, infoRowY + 36, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D8D0C3';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1E1B18';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Áo: ${snapshot.config.primaryColor.name}`, col1X + 34, infoRowY + 28);
  ctx.font = '500 13px monospace';
  ctx.fillStyle = '#7C7267';
  ctx.fillText(snapshot.config.primaryColor.hex, col1X + 34, infoRowY + 46);

  // Pants color swatch & label
  ctx.fillStyle = snapshot.config.pantsColor.hex;
  ctx.beginPath();
  ctx.arc(col1X + 12, infoRowY + 84, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D8D0C3';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1E1B18';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Quần: ${snapshot.config.pantsColor.name}`, col1X + 34, infoRowY + 76);
  ctx.font = '500 13px monospace';
  ctx.fillStyle = '#7C7267';
  ctx.fillText(snapshot.config.pantsColor.hex, col1X + 34, infoRowY + 94);

  // Column 2: Vietnamese Garment Specs
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('PHOM DÁNG & CHẤT LIỆU', col2X, infoRowY);

  const collarName = COLLAR_LABELS[snapshot.config.collarStyle as CollarStyle] || snapshot.config.collarStyle;
  const sleeveName = SLEEVE_LABELS[snapshot.config.sleeveStyle as SleeveStyle] || snapshot.config.sleeveStyle;
  const fabricName = FABRIC_LABELS[snapshot.config.fabric as Fabric] || snapshot.config.fabric;
  const patternName = PATTERN_LABELS[snapshot.config.pattern as Pattern] || snapshot.config.pattern;

  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#2C2723';
  ctx.fillText(`• Cổ áo: ${collarName}`, col2X, infoRowY + 28);
  ctx.fillText(`• Tay áo: ${sleeveName}`, col2X, infoRowY + 54);
  ctx.fillText(`• Chất liệu: ${fabricName}`, col2X, infoRowY + 80);
  ctx.fillText(`• Họa tiết: ${patternName}`, col2X, infoRowY + 106);

  // Column 3: Vietnamese Accessories & Body Shape
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('PHỤ KIỆN & VÓC DÁNG', col3X, infoRowY);

  const bodyShapeName = BODY_SHAPE_LABELS[snapshot.config.bodyShape as BodyShape] || 'Dáng cơ bản (1.66m)';
  const accList = snapshot.config.accessories.map((id) => ACCESSORY_LABELS[id as AccessoryId] || id);
  const accFullText = accList.length > 0 ? accList.join(', ') : 'Không có phụ kiện';

  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#2C2723';
  ctx.fillText(`• Vóc dáng: ${bodyShapeName}`, col3X, infoRowY + 28);

  // Wrapped accessories text
  const accLines = wrapText(ctx, `• Phụ kiện: ${accFullText}`, cardW - 710 - 35, 2);
  ctx.fillText(accLines[0] || '• Phụ kiện: Không có', col3X, infoRowY + 54);
  if (accLines[1]) {
    ctx.fillText(`  ${accLines[1]}`, col3X, infoRowY + 74);
  }

  const revisionY = accLines[1] ? infoRowY + 102 : infoRowY + 84;
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText(`• Dữ liệu: Snapshot v${snapshot.revision}`, col3X, revisionY);

  // Footer inside card
  const today = new Date().toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#9C9286';
  ctx.textAlign = 'right';
  ctx.fillText(`Dáng Việt — Bảo tồn & Sáng tạo Việt phục  |  Xuất ngày ${today}`, cardX + cardW - 35, cardY + cardH - 26);
  ctx.restore();

  // Export to blob and trigger download if requested
  const dataUrl = exportCanvas.toDataURL('image/png');

  if (triggerDownload) {
    let downloadBlobUrl: string | null = null;
    try {
      const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        downloadBlobUrl = (window.URL || (window as any).webkitURL || window).createObjectURL(blob);
        const link = document.createElement('a');
        const safeTitle = (snapshot.title || 'Ban_phoi_Ao_dai')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `DangViet_${safeTitle}_${Date.now()}.png`;
        link.href = downloadBlobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (downloadErr) {
      console.warn('Lỗi khi kích hoạt tải file:', downloadErr);
    } finally {
      if (downloadBlobUrl) {
        setTimeout(() => {
          try {
            (window.URL || (window as any).webkitURL || window).revokeObjectURL(downloadBlobUrl!);
          } catch {}
        }, 1500);
      }
    }
  }

  return dataUrl;
}
