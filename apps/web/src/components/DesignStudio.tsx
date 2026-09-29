import React, { useState } from 'react';
import {
  type Look,
  type GarmentConfig,
  type EventItem,
  type StyleItem,
  type DesignProposal,
} from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { AoDai3DViewer } from './AoDai3DViewer.tsx';
import { Sparkles, BookmarkPlus, ArrowRight, Wand2, AlertCircle, CheckCircle2, History, RotateCcw } from 'lucide-react';

interface DesignStudioProps {
  currentLook: Look;
  events: EventItem[];
  styles: StyleItem[];
  onRequestProposal: (
    prompt: string,
    eventId: string,
    styleId: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    activeProposalConfig?: GarmentConfig
  ) => Promise<DesignProposal>;
  onApplyProposal: (
    proposal: DesignProposal,
    eventId: string,
    styleId: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSaveDesignToLookbook: (
    title: string,
    config: GarmentConfig,
    explanation: string,
    eventId: string,
    styleId: string
  ) => Promise<void>;
  onApplyToStudio: (
    config: GarmentConfig,
    title: string,
    explanation: string,
    eventId: string,
    styleId: string
  ) => void;
}

export const DesignStudio: React.FC<DesignStudioProps> = ({
  currentLook,
  events,
  styles,
  onRequestProposal,
  onApplyProposal,
  onSaveDesignToLookbook,
  onApplyToStudio,
}) => {
  const [prompt, setPrompt] = useState('Phối màu tương phản Gen Z với gam xanh ngọc và hồng sen, họa tiết kỷ hà trẻ trung');
  const [selectedEvent, setSelectedEvent] = useState<string>(currentLook.eventId || 'ngay_hoi_truong');
  const [selectedStyle, setSelectedStyle] = useState<string>(currentLook.styleId || 'tuoi_tre');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeProposal, setActiveProposal] = useState<DesignProposal | null>(null);
  const [previewConfig, setPreviewConfig] = useState<GarmentConfig>(currentLook.config);
  const [visualizerMode, setVisualizerMode] = useState<'3d' | '2d'>('3d');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const isStale = Boolean(activeProposal && activeProposal.baseRevision !== currentLook.revision);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const proposal = await onRequestProposal(
        prompt,
        selectedEvent,
        selectedStyle,
        undefined,
        activeProposal?.proposedConfig
      );
      setActiveProposal(proposal);
      setPreviewConfig(proposal.proposedConfig);

      const modeLabel = proposal.mode === 'live' ? `[AI Trực tuyến - 9router: ${proposal.model}]` : `[Mô phỏng an toàn - Mock Rules]`;
      setStatusMessage({
        text: `Đã sinh đề xuất thiết kế thành công! ${modeLabel}. Bạn đang ở chế độ xem trước (Preview) - chưa ghi vào cơ sở dữ liệu.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi sinh đề xuất: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!activeProposal || isApplying) return;
    setIsApplying(true);
    setStatusMessage(null);

    try {
      const result = await onApplyProposal(activeProposal, selectedEvent, selectedStyle);
      if (result.success) {
        setStatusMessage({
          text: 'Đã áp dụng thành công thiết kế vào bộ phối chính!',
          type: 'success',
        });
        setActiveProposal(null);
      } else {
        setStatusMessage({
          text: `Không thể áp dụng: ${result.error}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi khi áp dụng: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelPreview = () => {
    setActiveProposal(null);
    setPreviewConfig(currentLook.config);
    setStatusMessage({
      text: 'Đã hủy xem trước. Đã phục hồi về trạng thái đã lưu.',
      type: 'warning',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setStatusMessage(null);

    const title = activeProposal?.title || `${currentLook.title} - Bản thiết kế`;
    const explanation = activeProposal?.explanation || currentLook.explanation;

    try {
      await onSaveDesignToLookbook(
        title,
        previewConfig,
        explanation,
        selectedEvent,
        selectedStyle
      );
      setStatusMessage({
        text: 'Đã lưu thiết kế vào Lookbook thành công!',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi lưu Lookbook: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="design-studio" style={{ maxWidth: '1240px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Studio Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Sparkles className="text-accent-red" size={24} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text-primary)' }}>
            Xưởng thiết kế AI (Remix Studio)
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Sáng tạo thiết kế áo dài 3D thông qua hợp đồng dữ liệu chuẩn — Hỗ trợ xem trước (Preview), so sánh khác biệt (Diff) và áp dụng an toàn.
        </p>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            background:
              statusMessage.type === 'error'
                ? '#FEE2E2'
                : statusMessage.type === 'warning'
                ? '#FEF3C7'
                : 'var(--accent-red-soft)',
            color:
              statusMessage.type === 'error'
                ? '#991B1B'
                : statusMessage.type === 'warning'
                ? '#92400E'
                : 'var(--accent-red)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {statusMessage.type === 'success' && <CheckCircle2 size={18} />}
          {statusMessage.type === 'error' && <AlertCircle size={18} />}
          {statusMessage.type === 'warning' && <History size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Inputs on Left, 3D Preview on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem' }}>
        {/* Left Column: Form & Design Diff */}
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
              placeholder="Ví dụ: Phối áo xanh ngọc bích với quần hồng sen phấn, tà tay xẻ hiện đại, quạt xếp và túi cói mộc..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
                boxSizing: 'border-box',
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
                Gợi ý chủ đề & Yêu cầu tiếp nối:
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPrompt('Giữ màu áo, đổi quần trắng và bớt phụ kiện')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
                >
                  Giữ áo, đổi quần trắng
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt('Chỉnh phương án vừa đề xuất cho thanh lịch hơn với lụa Hà Đông')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
                >
                  Chỉnh tiếp thanh lịch hơn
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt('Sắc lam di sản gấm hoa vân mây phối vàng hoàng yến sang trọng')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
                >
                  Lam di sản gấm mây
                </button>
                <button
                  type="button"
                  onClick={() => setPrompt('Hồng sen phấn thanh thuần vải voan nhẹ nhàng cho kỷ yếu')}
                  style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
                >
                  Sen hồng kỷ yếu
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
                border: 'none',
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
              <span>{isGenerating ? 'AI đang lập đề xuất thiết kế...' : 'Tạo đề xuất thiết kế 3D'}</span>
            </button>
          </div>

          {/* Active Proposal Diff Panel */}
          {activeProposal && (
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                border: isStale ? '1px solid #DC2626' : '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  2. Khác biệt thiết kế (Diff)
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: isStale ? '#FEE2E2' : '#E0F2FE',
                      color: isStale ? '#991B1B' : '#0369A1',
                      fontWeight: 600,
                    }}
                  >
                    v{activeProposal.baseRevision} → v{currentLook.revision + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: activeProposal.mode === 'live' ? '#D1FAE5' : '#FEF3C7',
                      color: activeProposal.mode === 'live' ? '#065F46' : '#92400E',
                      fontWeight: 700,
                    }}
                  >
                    {activeProposal.mode === 'live' ? `[AI Trực tuyến: ${activeProposal.model}]` : `[Mô phỏng an toàn: Mock Rules]`}
                  </span>
                </div>
              </div>

              {isStale && (
                <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                  ⚠️ Bộ phối đã được chỉnh sửa kể từ khi đề xuất này được tạo (v{currentLook.revision} vs v{activeProposal.baseRevision}). Bạn cần tạo lại đề xuất mới để tránh xung đột phiên bản.
                </div>
              )}

              {activeProposal.diff.changedFields.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Không có thay đổi nào so với bộ phối hiện tại.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  {activeProposal.diff.colorChanges.map((c) => (
                    <div key={c.field} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, minWidth: '85px' }}>
                        {c.field === 'primaryColor' ? 'Màu áo:' : 'Màu quần:'}
                      </span>
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: c.from, border: '1px solid #ccc' }} />
                      <span>→</span>
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: c.to, border: '1px solid #ccc' }} />
                    </div>
                  ))}

                  {activeProposal.diff.changedFields.includes('modelId') && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Mẫu áo: </span>
                      <span>{currentLook.config.modelId} → {activeProposal.proposedConfig.modelId}</span>
                    </div>
                  )}

                  {activeProposal.diff.changedFields.includes('collarStyle') && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Cổ áo: </span>
                      <span>{currentLook.config.collarStyle} → {activeProposal.proposedConfig.collarStyle}</span>
                    </div>
                  )}

                  {activeProposal.diff.changedFields.includes('sleeveStyle') && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Tay áo: </span>
                      <span>{currentLook.config.sleeveStyle} → {activeProposal.proposedConfig.sleeveStyle}</span>
                    </div>
                  )}

                  {activeProposal.diff.changedFields.includes('fabric') && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Chất liệu: </span>
                      <span>{currentLook.config.fabric} → {activeProposal.proposedConfig.fabric}</span>
                    </div>
                  )}

                  {activeProposal.diff.changedFields.includes('pattern') && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Họa tiết: </span>
                      <span>{currentLook.config.pattern} → {activeProposal.proposedConfig.pattern}</span>
                    </div>
                  )}

                  {activeProposal.diff.addedAccessories.length > 0 && (
                    <div style={{ color: '#047857' }}>
                      <span style={{ fontWeight: 600 }}>+ Thêm phụ kiện: </span>
                      {activeProposal.diff.addedAccessories.join(', ')}
                    </div>
                  )}

                  {activeProposal.diff.removedAccessories.length > 0 && (
                    <div style={{ color: '#B91C1C' }}>
                      <span style={{ fontWeight: 600 }}>- Bỏ phụ kiện: </span>
                      {activeProposal.diff.removedAccessories.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Unchanged / Preserved fields */}
              <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Thuộc tính giữ nguyên / bảo lưu:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {!activeProposal.diff.changedFields.includes('primaryColor') && (
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      Áo: {currentLook.config.primaryColor.name} {currentLook.locks.primaryColor ? '🔒 (Đang khóa)' : ''}
                    </span>
                  )}
                  {!activeProposal.diff.changedFields.includes('pantsColor') && (
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      Quần: {currentLook.config.pantsColor.name} {currentLook.locks.pantsColor ? '🔒 (Đang khóa)' : ''}
                    </span>
                  )}
                  {!activeProposal.diff.changedFields.includes('collarStyle') && (
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      Cổ áo {currentLook.locks.collarStyle ? '🔒' : ''}
                    </span>
                  )}
                  {!activeProposal.diff.changedFields.includes('sleeveStyle') && (
                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      Tay áo {currentLook.locks.sleeveStyle ? '🔒' : ''}
                    </span>
                  )}
                  <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)', color: '#047857' }}>
                    Vóc dáng: {currentLook.config.bodyShape} (Bảo toàn)
                  </span>
                </div>
              </div>

              {/* Unsupported Requests warning */}
              {activeProposal.unsupportedRequests && activeProposal.unsupportedRequests.length > 0 && (
                <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#92400E' }}>
                  <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> Yêu cầu ngoài năng lực mẫu áo:
                  </div>
                  {activeProposal.unsupportedRequests.map((msg, i) => (
                    <div key={i}>• {msg}</div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {activeProposal.warnings && activeProposal.warnings.length > 0 && (
                <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#1E40AF' }}>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                    Lưu ý:
                  </div>
                  {activeProposal.warnings.map((msg, i) => (
                    <div key={i}>• {msg}</div>
                  ))}
                </div>
              )}

              {/* Citations */}
              {activeProposal.citations && activeProposal.citations.length > 0 && (
                <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Dẫn chứng văn hóa đã xuất bản:
                  </span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {activeProposal.citations.map((cite, i) => (
                      <div key={i}>
                        • <strong>{cite.title}</strong> ({cite.source})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Mọi thiết kế sinh ra đều được gắn nhãn: <br />
              <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
                "Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."
              </span><br />
              Dáng Việt đảm bảo thông số kết xuất luôn nằm trong bảng màu và chi tiết văn hóa hợp lệ.
            </p>
          </div>
        </div>

        {/* Right Column: 3D Preview Canvas & Actions */}
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
                background: activeProposal ? '#FEF3C7' : 'var(--accent-red-soft)',
                color: activeProposal ? '#92400E' : 'var(--accent-red)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '0.35rem',
              }}
            >
              {activeProposal ? 'Xem trước đề xuất (Preview - Chưa lưu)' : 'Bản thiết kế mẫu'}
            </span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {activeProposal?.title || 'Thiết kế Remix: Sen Ngọc & Hồng Phấn'}
            </h3>

            {/* Toggle 3D / 2D Buttons */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-subtle)',
                padding: '2px',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
              }}
            >
              <button
                type="button"
                onClick={() => setVisualizerMode('3d')}
                style={{
                  border: 'none',
                  background: visualizerMode === '3d' ? 'var(--accent-red)' : 'transparent',
                  color: visualizerMode === '3d' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ✨ 3D
              </button>
              <button
                type="button"
                onClick={() => setVisualizerMode('2d')}
                style={{
                  border: 'none',
                  background: visualizerMode === '2d' ? 'var(--accent-red)' : 'transparent',
                  color: visualizerMode === '2d' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                🎨 2D
              </button>
            </div>
          </div>

          {/* 3D or SVG Canvas */}
          <div style={{ width: '100%', padding: '0.5rem 0' }}>
            {visualizerMode === '3d' ? (
              <AoDai3DViewer
                config={previewConfig}
                locks={currentLook.locks}
                size="md"
                onBodyShapeChange={(shape) =>
                  setPreviewConfig((prev) => ({
                    ...prev,
                    bodyShape: shape,
                  }))
                }
                onModelChange={(modelId) =>
                  setPreviewConfig((prev) => ({
                    ...prev,
                    modelId,
                  }))
                }
              />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AoDaiVisualizer config={previewConfig} size="md" mode="detail" />
              </div>
            )}
          </div>

          {/* Explanation */}
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
              boxSizing: 'border-box',
            }}
          >
            <strong>Giải trình sáng tạo: </strong>
            {activeProposal?.explanation ||
              'Thiết kế cách điệu lấy cảm hứng từ trang phục lễ hội trường học, ứng dụng đường xẻ tà tay bay bổng và bảng màu color-block đậm chất Gen Z.'}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {activeProposal ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  style={{
                    padding: '0.7rem 1rem',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Hủy xem trước</span>
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying || isStale}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    background: isStale ? '#9CA3AF' : 'var(--accent-red)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    cursor: isApplying || isStale ? 'not-allowed' : 'pointer',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{isApplying ? 'Đang áp dụng...' : 'Áp dụng vào Phòng phối'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onApplyToStudio(
                    previewConfig,
                    'Thiết kế Remix',
                    'Mở thiết kế trong phòng phối',
                    selectedEvent,
                    selectedStyle
                  )
                }
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  background: 'var(--accent-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <span>Mở trong Phòng phối</span>
                <ArrowRight size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '0.7rem 1.1rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <BookmarkPlus size={16} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Lookbook'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
