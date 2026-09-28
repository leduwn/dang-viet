import React, { useState } from 'react';
import {
  type GarmentConfig,
  type EventItem,
  type StyleItem,
} from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { Sparkles, BookmarkPlus, ArrowRight, Wand2, AlertCircle } from 'lucide-react';

interface DesignStudioProps {
  events: EventItem[];
  styles: StyleItem[];
  onRequestDesign: (prompt: string, eventId: string, styleId: string) => Promise<{ config: GarmentConfig; title: string; explanation: string; mode?: 'mock' | 'live'; model?: string }>;
  onSaveDesignToLookbook: (title: string, config: GarmentConfig, explanation: string, eventId: string, styleId: string) => Promise<void>;
  onApplyToStudio: (config: GarmentConfig, title: string, explanation: string, eventId: string, styleId: string) => void;
}

export const DesignStudio: React.FC<DesignStudioProps> = ({
  events,
  styles,
  onRequestDesign,
  onSaveDesignToLookbook,
  onApplyToStudio,
}) => {
  const [prompt, setPrompt] = useState('Phối màu tương phản Gen Z với gam xanh ngọc và hồng sen, họa tiết kỷ hà trẻ trung');
  const [selectedEvent, setSelectedEvent] = useState<string>('ngay_hoi_truong');
  const [selectedStyle, setSelectedStyle] = useState<string>('tuoi_tre');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<{
    title: string;
    config: GarmentConfig;
    explanation: string;
    mode?: 'mock' | 'live';
    model?: string;
  }>({
    title: 'Thiết kế Remix: Sen Ngọc & Hồng Phấn',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' },
      pantsColor: { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' },
      collarStyle: 'v_neck',
      sleeveStyle: 'slit',
      fabric: 'voile_chiffon',
      pattern: 'geometric_genz',
      accessories: ['quat_xep', 'tui_coi'],
    },
    explanation: 'Thiết kế cách điệu lấy cảm hứng từ trang phục lễ hội trường học, ứng dụng đường xẻ tà tay bay bổng và bảng màu color-block đậm chất Gen Z.',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const res = await onRequestDesign(prompt, selectedEvent, selectedStyle);
      setCurrentDesign(res);
      const modeLabel = res.mode === 'live' ? `[Model thực tế: ${res.model}]` : `[Mô phỏng: ${res.model || 'Mock'}]`;
      setStatusMessage(`Đã tạo thiết kế có cấu trúc mới thành công! ${modeLabel}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage(`Lỗi sinh thiết kế: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSaveDesignToLookbook(
        currentDesign.title,
        currentDesign.config,
        currentDesign.explanation,
        selectedEvent,
        selectedStyle
      );
      setStatusMessage('Đã lưu thiết kế vào Lookbook!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage(`Lỗi lưu Lookbook: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="design-studio" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Studio Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Sparkles className="text-accent-red" size={24} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text-primary)' }}>
            Xưởng thiết kế AI (Remix Studio)
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Sáng tạo thiết kế áo dài cách tân có cấu trúc chuẩn mực — Tham số hợp lệ được kết xuất trực tiếp bằng mô hình SVG an toàn.
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            background: 'var(--accent-red-soft)',
            color: 'var(--accent-red)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Main Grid: Inputs on Left, Visual Mockup on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem' }}>
        {/* Left: Design Prompt & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              1. Nhập ý tưởng sáng tạo
            </h3>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ví dụ: Phối áo xanh ngọc với quần hồng sen phấn, tà tay xẻ hiện đại, quạt xếp và túi cói mộc..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
              }}
            />

            {/* Event selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                Bối cảnh áp dụng:
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-subtle)',
                  fontSize: '0.85rem',
                }}
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>

            {/* Style selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                Định hướng phong cách:
              </label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-subtle)',
                  fontSize: '0.85rem',
                }}
              >
                {styles.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>

            {/* Quick Prompt Ideas */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Gợi ý chủ đề nhanh:
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPrompt('Sắc lam di sản gấm hoa vân mây phối vàng hoàng yến sang trọng')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)' }}
                >
                  Sắc lam di sản
                </button>
                <button
                  onClick={() => setPrompt('Hồng sen phấn thanh thuần vải voan nhẹ nhàng cho kỷ yếu')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)' }}
                >
                  Sen hồng thanh xuân
                </button>
                <button
                  onClick={() => setPrompt('Phối màu son đỏ hoàng gia và vàng mai đón Tết phúc lộc')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)' }}
                >
                  Son đỏ khai xuân
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              style={{
                width: '100%',
                padding: '0.8rem',
                background: 'var(--accent-red)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              <Wand2 size={18} />
              <span>{isGenerating ? 'AI đang sinh thiết kế...' : 'Tạo thiết kế có cấu trúc'}</span>
            </button>
          </div>

          {/* Section: Concept Images disclaimer and status */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <AlertCircle size={16} className="text-accent-blue" />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Quy chuẩn thẩm mỹ & Bản rập
              </h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Mọi thiết kế sinh ra đều được gắn nhãn: <br />
              <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
                "Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."
              </span><br />
              Dáng Việt đảm bảo thông số kết xuất luôn nằm trong bảng màu và chi tiết văn hóa hợp lệ.
            </p>
          </div>
        </div>

        {/* Right: Rendered Mockup & Output Summary */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
            <span
              style={{
                fontSize: '0.75rem',
                background: 'var(--accent-red-soft)',
                color: 'var(--accent-red)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '0.35rem',
              }}
            >
              Thiết kế cách điệu do AI hỗ trợ
            </span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
              {currentDesign.title}
            </h3>
          </div>

          {/* SVG Canvas */}
          <div style={{ padding: '0.5rem 0' }}>
            <AoDaiVisualizer config={currentDesign.config} size="md" mode="detail" />
          </div>

          {/* Details & Explanation */}
          <div
            style={{
              width: '100%',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginTop: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong>Giải trình sáng tạo: </strong>
            {currentDesign.explanation}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '1.25rem' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '0.7rem',
                background: 'var(--accent-red)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                opacity: isSaving ? 0.7 : 1,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <BookmarkPlus size={16} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu vào Lookbook'}</span>
            </button>

            <button
              onClick={() => onApplyToStudio(currentDesign.config, currentDesign.title, currentDesign.explanation, selectedEvent, selectedStyle)}
              style={{
                flex: 1,
                padding: '0.7rem',
                background: 'var(--accent-blue)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>Mở trong Phòng phối</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
