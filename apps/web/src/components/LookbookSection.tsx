import React, { useState } from 'react';
import { type LookbookItem } from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { Trash2, ExternalLink, GitCompare, Bookmark, Calendar } from 'lucide-react';

interface LookbookSectionProps {
  lookbookItems: LookbookItem[];
  onOpenInStudio: (item: LookbookItem) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onCompareTwo: (itemA: LookbookItem, itemB: LookbookItem) => void;
}

export const LookbookSection: React.FC<LookbookSectionProps> = ({
  lookbookItems,
  onOpenInStudio,
  onDeleteItem,
  onCompareTwo,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {lookbookItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
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

                  <span
                    style={{
                      fontSize: '0.7rem',
                      background: 'var(--bg-subtle)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Bản snapshot v{item.revision}
                  </span>
                </div>

                {/* SVG Visualizer */}
                <div
                  style={{
                    width: '100%',
                    height: '260px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <AoDaiVisualizer config={item.snapshotConfig} size="sm" mode="thumbnail" />
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
                      onClick={() => onOpenInStudio(item)}
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
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Mở trong phòng phối</span>
                    </button>

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
