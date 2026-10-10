import React, { useState } from 'react';
import { type LookbookItem, type Look, type LookbookResourceType } from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { Trash2, ExternalLink, GitCompare, Bookmark, Calendar, Download, UserCheck, Sparkles, SlidersHorizontal } from 'lucide-react';
import { exportCustomizationPng } from '../utils/exportImage.ts';

interface LookbookSectionProps {
  lookbookItems: LookbookItem[];
  onOpenInStudio: (item: LookbookItem) => Promise<void> | void;
  onDeleteItem: (id: string) => Promise<void>;
  onCompareTwo: (itemA: LookbookItem, itemB: LookbookItem) => void;
  isBusy?: boolean;
}

export const LookbookSection: React.FC<LookbookSectionProps> = ({
  lookbookItems,
  onOpenInStudio,
  onDeleteItem,
  onCompareTwo,
  isBusy = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [aiViewMode, setAiViewMode] = useState<Record<string, 'ai' | 'svg'>>({});
  const [resourceFilter, setResourceFilter] = useState<'all' | LookbookResourceType>('all');

  const isInteracting = isBusy || openingId !== null;

  const getItemResourceType = (item: LookbookItem): LookbookResourceType => {
    if (item.resourceType) return item.resourceType;
    if (item.designMetadata?.resourceType) return item.designMetadata.resourceType;
    if (item.designMetadata?.aiImageUrl) {
      return item.designMetadata?.referenceId ? 'ai_face_ref_image' : 'ai_prompt_image';
    }
    return 'svg_2d';
  };

  const filteredItems = lookbookItems.filter((item) => {
    if (resourceFilter === 'all') return true;
    return getItemResourceType(item) === resourceFilter;
  });

  const handleOpenClick = async (item: LookbookItem) => {
    if (isInteracting) return;
    setOpeningId(item.id);
    try {
      await onOpenInStudio(item);
    } finally {
      setOpeningId(null);
    }
  };

  const handleExportItemPng = async (item: LookbookItem, cardEl: HTMLElement | null) => {
    if (exportingId) return;
    setExportingId(item.id);
    try {
      const svgEl = cardEl?.querySelector('svg') as SVGSVGElement | null;
      const snapshotLook: Look = {
        id: item.lookId,
        title: item.title,
        eventId: item.eventId,
        styleId: item.styleId,
        config: JSON.parse(JSON.stringify(item.snapshotConfig)),
        locks: {
          primaryColor: false,
          pantsColor: false,
          collarStyle: false,
          sleeveStyle: false,
          fabric: false,
          pattern: false,
          accessories: false,
          bodyShape: false,
          modelId: false,
          avatarId: false,
        },
        explanation: item.notes || 'Bản phối lưu trữ Lookbook',
        revision: item.revision,
        isDesign: false,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      };

      await exportCustomizationPng({
        look: snapshotLook,
        svgElement: svgEl,
        eventLabel: item.eventId,
        styleLabel: item.styleId,
      });
    } catch (err: any) {
      alert(`Lỗi xuất ảnh Lookbook: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleTriggerCompare = () => {
    if (selectedIds.length !== 2) return;
    const a = lookbookItems.find((x) => x.id === selectedIds[0]);
    const b = lookbookItems.find((x) => x.id === selectedIds[1]);
    if (a && b) {
      onCompareTwo(a, b);
    }
  };

  return (
    <div className="lookbook-section" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <Bookmark className="text-accent-red" size={24} />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text-primary)' }}>
              Lookbook Cá Nhân ({lookbookItems.length})
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Các bộ phối đã lưu được khóa theo từng phiên bản (Revision snapshot) an toàn trong cơ sở dữ liệu.
          </p>
        </div>

        {selectedIds.length === 2 && (
          <button
            onClick={handleTriggerCompare}
            style={{
              padding: '0.7rem 1.25rem',
              background: 'var(--accent-blue)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <GitCompare size={16} />
            <span>So sánh 2 bộ đã chọn</span>
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <SlidersHorizontal size={15} /> Bộ lọc tài nguyên:
        </span>
        <button
          type="button"
          onClick={() => setResourceFilter('all')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: resourceFilter === 'all' ? '2px solid var(--accent-red)' : '1px solid var(--border-medium)',
            background: resourceFilter === 'all' ? 'var(--accent-red-soft)' : 'var(--bg-subtle)',
            color: resourceFilter === 'all' ? 'var(--accent-red)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Tất cả ({lookbookItems.length})
        </button>
        <button
          type="button"
          onClick={() => setResourceFilter('svg_2d')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: resourceFilter === 'svg_2d' ? '2px solid #2563EB' : '1px solid var(--border-medium)',
            background: resourceFilter === 'svg_2d' ? '#EFF6FF' : 'var(--bg-subtle)',
            color: resourceFilter === 'svg_2d' ? '#1D4ED8' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          📐 Bản phối SVG 2D ({lookbookItems.filter((i) => getItemResourceType(i) === 'svg_2d').length})
        </button>
        <button
          type="button"
          onClick={() => setResourceFilter('ai_prompt_image')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: resourceFilter === 'ai_prompt_image' ? '2px solid #16A34A' : '1px solid var(--border-medium)',
            background: resourceFilter === 'ai_prompt_image' ? '#F0FDF4' : 'var(--bg-subtle)',
            color: resourceFilter === 'ai_prompt_image' ? '#15803D' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ✨ Ảnh AI từ mô tả ({lookbookItems.filter((i) => getItemResourceType(i) === 'ai_prompt_image').length})
        </button>
        <button
          type="button"
          onClick={() => setResourceFilter('ai_face_ref_image')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: resourceFilter === 'ai_face_ref_image' ? '2px solid #9333EA' : '1px solid var(--border-medium)',
            background: resourceFilter === 'ai_face_ref_image' ? '#FAF5FF' : 'var(--bg-subtle)',
            color: resourceFilter === 'ai_face_ref_image' ? '#7E22CE' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          👤 Thử khuôn mặt AI ({lookbookItems.filter((i) => getItemResourceType(i) === 'ai_face_ref_image').length})
        </button>
      </div>

      {lookbookItems.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '4rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--border-medium)',
          }}
        >
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Lookbook của bạn hiện đang trống.
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Hãy vào Phòng phối đồ hoặc Xưởng thiết kế và bấm nút "Lưu Lookbook" để lưu trữ bộ phối yêu thích!
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--border-medium)',
          }}
        >
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Không có mục nào trong danh mục đã chọn.
          </p>
          <button
            type="button"
            onClick={() => setResourceFilter('all')}
            style={{
              padding: '0.4rem 0.9rem',
              background: 'var(--accent-red)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Xem tất cả ({lookbookItems.length})
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const rType = getItemResourceType(item);
            return (
              <div
                key={item.id}
                className="lookbook-card"
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  border: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-light)'}`,
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Select to compare checkbox */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                      style={{ accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                    />
                    <span>Chọn so sánh</span>
                  </label>

                  {rType === 'ai_face_ref_image' ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: '#FAF5FF',
                        color: '#7E22CE',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        border: '1px solid #E9D5FF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <UserCheck size={11} />
                      <span>Khuôn mặt AI · v{item.revision}</span>
                    </span>
                  ) : rType === 'ai_prompt_image' ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: '#DCFCE7',
                        color: '#166534',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        border: '1px solid #BBF7D0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Sparkles size={11} />
                      <span>Mô tả AI · v{item.revision}</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        border: '1px solid #BFDBFE',
                      }}
                    >
                      📐 Bản phối 2D · v{item.revision}
                    </span>
                  )}
                </div>

                {/* Visualizer: AI Image or SVG Visualizer */}
                <div
                  style={{
                    width: '100%',
                    height: '260px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    position: 'relative',
                    boxSizing: 'border-box',
                  }}
                >
                  {item.designMetadata?.aiImageUrl && (aiViewMode[item.id] ?? 'ai') === 'ai' ? (
                    <img
                      src={item.designMetadata.aiImageUrl}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{ padding: '0.75rem', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AoDaiVisualizer config={item.snapshotConfig} size="sm" mode="thumbnail" />
                    </div>
                  )}

                  {item.designMetadata?.aiImageUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiViewMode((prev) => ({
                          ...prev,
                          [item.id]: (prev[item.id] ?? 'ai') === 'ai' ? 'svg' : 'ai',
                        }));
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.65)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {(aiViewMode[item.id] ?? 'ai') === 'ai' ? '📐 Xem 2D Vector' : '🎨 Xem ảnh AI'}
                    </button>
                  )}
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginTop: '0.85rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    <Calendar size={13} />
                    <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  {item.notes && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic' }}>
                      "{item.notes}"
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                    <button
                      onClick={() => handleOpenClick(item)}
                      disabled={isInteracting}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        background: 'var(--bg-subtle)',
                        color: 'var(--accent-red)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        border: '1px solid var(--border-medium)',
                        opacity: isInteracting ? 0.6 : 1,
                        cursor: isInteracting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>{openingId === item.id ? 'Đang mở...' : 'Mở'}</span>
                    </button>

                    {item.designMetadata?.aiImageUrl ? (
                      <a
                        href={`${item.designMetadata.aiImageUrl}?download=1`}
                        download={`lookbook_ai_${item.id}.jpg`}
                        title="Tải ảnh AI gốc về máy (Độ phân giải cao)"
                        style={{
                          padding: '0.55rem 0.75rem',
                          background: 'var(--bg-subtle)',
                          color: 'var(--accent-blue)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          border: '1px solid var(--border-medium)',
                          textDecoration: 'none',
                        }}
                      >
                        <Download size={14} />
                        <span>Tải ảnh AI</span>
                      </a>
                    ) : (
                      <button
                        onClick={(e) => {
                          const card = (e.currentTarget as HTMLElement).closest('.lookbook-card') as HTMLElement | null;
                          handleExportItemPng(item, card);
                        }}
                        disabled={exportingId === item.id}
                        title="Xuất ảnh PNG chất lượng cao (2D Vector)"
                        style={{
                          padding: '0.55rem 0.75rem',
                          background: 'var(--bg-subtle)',
                          color: 'var(--accent-blue)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          border: '1px solid var(--border-medium)',
                          cursor: exportingId === item.id ? 'wait' : 'pointer',
                        }}
                      >
                        <Download size={14} />
                        <span>{exportingId === item.id ? 'Đang xuất...' : 'Xuất PNG'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      title="Xóa bộ này khỏi Lookbook"
                      style={{
                        padding: '0.55rem 0.75rem',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
