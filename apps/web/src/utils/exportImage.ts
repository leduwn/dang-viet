import { type Look, getModelCapability } from '@dangviet/contracts';

export interface ExportImageOptions {
  look: Look;
  canvasElement?: HTMLCanvasElement | null;
  svgElement?: SVGSVGElement | null;
  eventLabel?: string;
  styleLabel?: string;
}

/**
 * Exports a high-resolution (1200x1600) branded PNG image of the current Ao Dai customization.
 * Features:
 * - Brand header with Dáng Việt typography and slogan
 * - Technical disclaimer badge ("Hình minh họa 3D")
 * - Centered high-fidelity 3D/2D model rendering
 * - Look metadata: Event, Style, Color palette with hex & swatches, collar, sleeve, fabric, accessories
 * - Formatted date and cultural authenticity watermark
 */
export async function exportCustomizationPng(options: ExportImageOptions): Promise<string> {
  const { look, canvasElement, svgElement, eventLabel, styleLabel } = options;

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
  ctx.save();
  // Logo Icon Badge
  const logoX = 60;
  const logoY = 60;
  const logoSize = 64;
  ctx.fillStyle = '#9E2A2B';
  ctx.beginPath();
  ctx.roundRect(logoX, logoY, logoSize, logoSize, 14);
  ctx.fill();

  // Inner stylized V / D motif
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ĐV', logoX + logoSize / 2, logoY + logoSize / 2 + 2);

  // Brand Name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1E1B18';
  ctx.font = 'bold 38px "Playfair Display", "Times New Roman", serif';
  ctx.fillText('DÁNG VIỆT', logoX + logoSize + 20, logoY + 36);

  // Slogan
  ctx.fillStyle = '#7C7267';
  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Khám phá Việt phục, tạo nên dáng riêng', logoX + logoSize + 20, logoY + 62);

  // Technical Badge
  const cap = getModelCapability(look.config.modelId || 'aodai_traditional_v2');
  const badgeText = `Hình minh họa 3D — ${cap.name}`;
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 32;
  const badgeX = width - 60 - badgeWidth;
  const badgeY = logoY + 12;

  ctx.fillStyle = 'rgba(184, 58, 36, 0.08)';
  ctx.strokeStyle = '#B83A24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, 38, 19);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#B83A24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 19);
  ctx.restore();

  // 4. Render Centerpiece (3D WebGL Canvas or 2D SVG)
  let renderDrawn = false;
  if (canvasElement) {
    try {
      const renderX = 80;
      const renderY = 160;
      const renderW = width - 160;
      const renderH = 960;

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

      // Draw the canvas
      ctx.drawImage(canvasElement, renderX, renderY, renderW, renderH);
      renderDrawn = true;
    } catch {
      renderDrawn = false;
    }
  }

  if (!renderDrawn && svgElement) {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 150, 160, width - 300, 960);
          URL.revokeObjectURL(blobURL);
          resolve();
        };
        img.onerror = reject;
        img.src = blobURL;
      });
      renderDrawn = true;
    } catch {
      // Fallback
    }
  }

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
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#E6DFD5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.stroke();
  ctx.restore();

  // Card Content
  ctx.save();
  ctx.textBaseline = 'top';

  // Look Title
  ctx.fillStyle = '#1E1B18';
  ctx.font = 'bold 32px "Playfair Display", "Times New Roman", serif';
  ctx.fillText(look.title || 'Bản phối Áo dài Dáng Việt', cardX + 35, cardY + 30);

  // Context Tag
  const eventText = eventLabel ? `Sự kiện: ${eventLabel}` : `Sự kiện: ${look.eventId}`;
  const styleText = styleLabel ? `Phong cách: ${styleLabel}` : `Phong cách: ${look.styleId}`;
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#1F4E5B';
  ctx.fillText(`${eventText}  •  ${styleText}`, cardX + 35, cardY + 75);

  // Divider
  ctx.strokeStyle = '#F0EBE1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 35, cardY + 110);
  ctx.lineTo(cardX + cardW - 35, cardY + 110);
  ctx.stroke();

  // Grid Info: Colors & Garment Specs
  const col1X = cardX + 35;
  const col2X = cardX + 380;
  const col3X = cardX + 720;
  const infoRowY = cardY + 130;

  // Col 1: Colors
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('BẢNG MÀU PHỐI', col1X, infoRowY);

  // Primary color swatch & label
  ctx.fillStyle = look.config.primaryColor.hex;
  ctx.beginPath();
  ctx.arc(col1X + 12, infoRowY + 38, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D8D0C3';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1E1B18';
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Áo: ${look.config.primaryColor.name} (${look.config.primaryColor.hex})`, col1X + 34, infoRowY + 30);

  // Pants color swatch & label
  ctx.fillStyle = look.config.pantsColor.hex;
  ctx.beginPath();
  ctx.arc(col1X + 12, infoRowY + 78, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D8D0C3';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1E1B18';
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Quần: ${look.config.pantsColor.name} (${look.config.pantsColor.hex})`, col1X + 34, infoRowY + 70);

  // Col 2: Phom dáng & Chất liệu
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('PHOM DÁNG & CHẤT LIỆU', col2X, infoRowY);

  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#2C2723';
  ctx.fillText(`• Cổ áo: ${look.config.collarStyle}`, col2X, infoRowY + 30);
  ctx.fillText(`• Tay áo: ${look.config.sleeveStyle}`, col2X, infoRowY + 58);
  ctx.fillText(`• Vải: ${look.config.fabric}`, col2X, infoRowY + 86);
  ctx.fillText(`• Họa tiết: ${look.config.pattern}`, col2X, infoRowY + 114);

  // Col 3: Phụ kiện & Vóc dáng
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#7C7267';
  ctx.fillText('PHỤ KIỆN & VÓC DÁNG', col3X, infoRowY);

  const accText = look.config.accessories.length > 0 ? look.config.accessories.join(', ') : 'Không có phụ kiện';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#2C2723';
  ctx.fillText(`• Phụ kiện: ${accText}`, col3X, infoRowY + 30);
  ctx.fillText(`• Vóc dáng: ${look.config.bodyShape || 'standard'}`, col3X, infoRowY + 58);
  ctx.fillText(`• Phiên bản dữ liệu: Snapshot v${look.revision}`, col3X, infoRowY + 86);

  // Footer inside card
  const today = new Date().toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#9C9286';
  ctx.textAlign = 'right';
  ctx.fillText(`Dáng Việt — Bảo tồn & Sáng tạo Việt phục  |  Xuất ngày ${today}`, cardX + cardW - 35, cardY + cardH - 28);
  ctx.restore();

  // Convert to PNG Data URL
  const dataUrl = exportCanvas.toDataURL('image/png');

  // Trigger download in browser
  const link = document.createElement('a');
  const safeTitle = (look.title || 'Ban_phoi_Ao_dai')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `DangViet_${safeTitle}_${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}
