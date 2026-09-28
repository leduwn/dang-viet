import React from 'react';
import { type EventItem, type CultureCard } from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { ArrowRight, BookOpen, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';

interface ExploreSectionProps {
  events: EventItem[];
  presets: any[];
  cultureCards: CultureCard[];
  onSelectEvent: (eventId: string) => void;
  onApplyPreset: (preset: any) => void;
}

export const ExploreSection: React.FC<ExploreSectionProps> = ({
  events,
  presets,
  cultureCards,
  onSelectEvent,
  onApplyPreset,
}) => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      {/* 1. Hero Introduction */}
      <section
        style={{
          background: 'linear-gradient(135deg, #FAF8F5 0%, #F5ECE9 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem',
          border: '1px solid var(--border-medium)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          alignItems: 'center',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              background: 'var(--accent-red-soft)',
              color: 'var(--accent-red)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            Đề bài thi: Việt phục Remix — Phong cách Gen Z
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.2rem',
              color: 'var(--text-primary)',
              lineHeight: 1.25,
              marginBottom: '1rem',
            }}
          >
            Khám phá Việt phục, <br />
            <span style={{ color: 'var(--accent-red)' }}>tạo nên dáng riêng.</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            Dáng Việt đồng hành cùng học sinh, sinh viên giải mã chiều sâu di sản áo dài, tự do phối màu, phụ kiện và thử nghiệm các phong cách đương đại cho từng sự kiện thanh xuân.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSelectEvent('ky_yeu')}
              style={{
                background: 'var(--accent-red)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span>Vào Phòng phối ngay</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-light)',
            }}
          >
            <AoDaiVisualizer
              config={presets[0]?.config || {
                primaryColor: { hex: '#B83A24', name: 'Đỏ son hoàng gia' },
                pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi' },
                accessories: ['chuoi_ngoc', 'non_la'],
              }}
              size="md"
            />
          </div>
        </div>
      </section>

      {/* 2. Three Main Events */}
      <section>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>
            3 Bối cảnh sự kiện tiêu biểu
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Mỗi sự kiện mang một tinh thần và quy tắc thẩm mỹ riêng
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      background: 'var(--accent-blue-soft)',
                      color: 'var(--accent-blue)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    Bối cảnh học đường
                  </span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {ev.name}
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {ev.description}
                </p>
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.25rem',
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>Ý nghĩa văn hóa: </strong>
                  {ev.culturalContext}
                </div>
              </div>

              <button
                onClick={() => onSelectEvent(ev.id)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'var(--bg-subtle)',
                  color: 'var(--accent-red)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <span>Phối đồ cho sự kiện này</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 12 Suggested Presets Gallery */}
      <section>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>
              12 Gợi ý phối đồ nổi bật
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Được nghiên cứu tỉ mỉ theo từng sự kiện và phong cách thẩm mỹ
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {presets.map((preset) => (
            <div
              key={preset.id}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ width: '100%', height: '310px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <AoDaiVisualizer config={preset.config} size="sm" />
              </div>

              <div style={{ width: '100%', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {preset.title}
                  </h4>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {preset.styleId === 'thanh_lich' ? 'Thanh lịch' : preset.styleId === 'tuoi_tre' ? 'Tươi trẻ' : 'Tối giản'}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    marginBottom: '1rem',
                    minHeight: '48px',
                  }}
                >
                  {preset.explanation}
                </p>

                <button
                  onClick={() => onApplyPreset(preset)}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    background: 'var(--accent-red)',
                    color: 'white',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Chọn và tùy biến bộ này</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Verified Cultural Knowledge Cards */}
      <section>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <BookOpen size={20} className="text-accent-red" />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>
              Tư liệu văn hóa đã kiểm chứng
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Các cứ liệu lịch sử, nhân vật, ấn phẩm và hiện vật bảo tàng được xác thực nguồn gốc
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {cultureCards.map((card) => (
            <div
              key={card.id}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      background: card.status === 'published' ? '#E8F5E9' : '#FFF3E0',
                      color: card.status === 'published' ? '#2E7D32' : '#E65100',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    {card.status === 'published' ? (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Đã kiểm chứng</span>
                      </>
                    ) : (
                      <span>Cần xác minh thêm</span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    Chủ đề: {card.category}
                  </span>
                </div>

                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  {card.title}
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '1rem' }}>
                  {card.content}
                </p>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.75rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
              >
                <div><strong>Nguồn:</strong> {card.sourceName} ({card.sourceAuthor})</div>
                <div><strong>Dẫn chứng:</strong> {card.sourceEvidence}</div>
                {card.sourceUrl && (
                  <a
                    href={card.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--accent-blue)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <span>Xem tư liệu bảo tàng</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
